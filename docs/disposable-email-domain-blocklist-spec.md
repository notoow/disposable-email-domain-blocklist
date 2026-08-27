# Disposable Email Domain Blocklist MVP Technical Spec

상태: Draft for implementation

작성일: 2026-08-27

## 1. 구현 범위와 원칙

MVP는 `data`, `packages/core`, `cli`, `adapters/supabase`, `adapters/agents` 다섯 경계를 가진 pnpm workspace로 구현한다. 데이터와 판정 로직은 canonical source이며 CLI와 adapter는 이를 호출하거나 렌더링하는 얇은 계층이다.

핵심 원칙:

- 런타임 판정은 네트워크 없이 결정적이어야 한다.
- email parsing, domain normalization, policy evaluation을 분리한다.
- 모든 generated file은 source에서 재생성 가능해야 한다.
- generated artifact를 수동 편집하지 않는다.
- consumer의 production DB나 agent file을 승인 없이 덮어쓰지 않는다.
- Node 20 이상, TypeScript strict mode, ESM을 baseline으로 한다.

## 2. 초기 저장소 구조

```text
data/
  domains.json
  domains.txt                 # generated
  domains.csv                 # generated
  schema.json
  sources.json
packages/core/
  src/index.ts
  test/matcher.test.ts
  package.json
cli/
  src/index.ts
  test/check.test.ts
adapters/supabase/
  templates/before-user-created.sql.hbs
  test/template.test.ts
adapters/agents/
  codex/
  claude/
  cursor/
agent-integration/
  manifest.yaml
  instructions.md
scripts/
  normalize-data.mjs
  generate-adapters.mjs
docs/
plans/
```

첫 slice는 `data`와 `packages/core`까지만 구현한다. 다음 slice부터 CLI와 adapter를 추가한다.

## 3. 데이터 모델

### 3.1 DomainRecord

```ts
type DomainClassification =
  | 'disposable'
  | 'alias'
  | 'role'
  | 'free_provider'
  | 'unknown'

type Confidence = 'low' | 'medium' | 'high'
type DomainStatus = 'active' | 'stale' | 'disputed' | 'removed'

interface DomainRecord {
  domain: string
  classification: DomainClassification
  confidence: Confidence
  source_urls: string[]
  evidence_note: string
  provider: string | null
  first_seen: string       // YYYY-MM-DD
  last_verified: string    // YYYY-MM-DD
  block_subdomains: boolean
  status: DomainStatus
}
```

`domain`은 소문자 ASCII hostname이며 trailing dot을 갖지 않는다. URL, path, port, wildcard, email local-part를 허용하지 않는다. JSON array는 `domain`의 code-point ascending 순서로 정렬되고 중복을 허용하지 않는다.

`sources.json`은 source별 URL, publisher, evidence type, license/terms review 상태, checked date, note를 관리한다. domain record의 URL이 source registry에 없더라도 스키마상 허용하되 release validator는 등록을 요구한다.

### 3.2 차단 가능성

```ts
const DEFAULT_BLOCKABLE = {
  classifications: new Set(['disposable']),
  confidences: new Set(['medium', 'high']),
  statuses: new Set(['active']),
}
```

데이터에 존재한다는 사실과 기본 차단 결정을 동일시하지 않는다.

## 4. 입력 정규화

### 4.1 Email parsing

- 앞뒤 ASCII whitespace를 제거한다.
- `@`가 정확히 하나인지 검사한다.
- local-part와 domain이 비어 있지 않은지 검사한다.
- 전체 길이 254, domain 길이 253 제한을 적용한다.
- local-part의 완전한 RFC 5322 검증은 MVP 범위가 아니다. 라이브러리는 mailbox deliverability를 주장하지 않는다.
- email 입력에서 domain만 판정하며 local-part를 로그/오류 reason에 포함하지 않는다.

### 4.2 Domain normalization

- standalone domain 입력은 앞뒤 whitespace와 마지막 root dot 하나를 제거한다.
- `node:url`의 `domainToASCII`로 IDN을 ASCII로 변환하고 소문자화한다.
- 각 label은 1~63자, 전체는 253자 이하여야 한다.
- label은 영숫자로 시작/종료하고 내부 hyphen만 허용한다.
- 최소 두 label을 요구한다. localhost/IP/URL/port/wildcard는 `invalid_input`이다.

public suffix 추출은 기본 matcher에 필요하지 않다. 데이터 레코드 자체가 exact hostname과 `block_subdomains`를 명시하므로 `tempo.mintraccoon.com`을 저장해도 `mintraccoon.com` 전체를 차단하지 않는다. 향후 organizational-domain 기능을 추가할 때만 PSL dependency를 별도 도입한다.

## 5. Core API

```ts
interface ClassificationResult {
  input: string
  normalized_domain: string | null
  valid: boolean
  blocked: boolean
  classification: DomainClassification | 'unlisted' | 'invalid_input'
  confidence: Confidence | null
  matched_domain: string | null
  match_type: 'exact' | 'subdomain' | 'none' | 'invalid'
  source: 'allowlist' | 'denylist' | 'dataset' | 'none'
  reason: string
  record: DomainRecord | null
}

interface MatcherOptions {
  records?: readonly DomainRecord[]
  allowlist?: readonly DomainRule[]
  denylist?: readonly DomainRule[]
}

interface DomainRule {
  domain: string
  block_subdomains?: boolean
}

class DomainMatcher {
  constructor(options?: MatcherOptions)
  classify(input: string): ClassificationResult
  isDisposableEmail(email: string): boolean
  getDomainRecord(domain: string): DomainRecord | null
}

export function classifyEmail(input: string, options?: MatcherOptions): ClassificationResult
export function classifyDomain(input: string, options?: MatcherOptions): ClassificationResult
export function isDisposableEmail(input: string, options?: MatcherOptions): boolean
export function getDomainRecord(domain: string): DomainRecord | null
```

`classifyEmail`은 반드시 email 모양을 요구하고 `classifyDomain`은 `@`를 거부한다. 편의 함수 `classify`를 나중에 추가할 수 있으나 모호한 자동 감지는 초기 공개 API에서 제외한다.

### 5.1 매칭 알고리즘

각 rule은 정규화 시 검증된다. 판정 시 exact lookup을 먼저 하고, 이후 입력 domain의 왼쪽 label을 하나씩 제거하며 `block_subdomains=true`인 가장 긴 suffix rule을 찾는다. 따라서 가장 구체적인 rule이 이긴다.

우선순위:

1. allowlist에서 exact 또는 가장 긴 subdomain match가 있으면 허용
2. denylist에서 exact 또는 가장 긴 subdomain match가 있으면 차단
3. dataset에서 exact 또는 가장 긴 subdomain match를 찾음
4. dataset record가 default blockable이면 차단, 아니면 분류만 반환
5. 없으면 unlisted/허용

allowlist의 하위 도메인 허용 여부도 명시적이다. `example.com` exact allowlist가 `a.example.com`까지 자동 허용하지 않는다.

### 5.2 안정성과 privacy

- API는 입력 전체를 throw message에 포함하지 않는다.
- 생성된 result의 `input` 필드는 CLI 호환을 위해 유지하되, 애플리케이션 로그에 쓰지 말라는 문서를 제공한다. release 전 이 필드 제거 여부를 다시 검토한다.
- 잘못된 dataset/rule은 matcher 생성 시 throw한다. 사용자 입력 오류는 result로 반환한다.
- source URL fetch는 runtime API가 수행하지 않는다.

## 6. 생성 artifact

`scripts/normalize-data.mjs --check`는 다음을 검증한다.

- JSON Schema 준수
- canonical normalization
- domain 중복과 정렬
- active disposable의 HTTPS evidence와 note
- 날짜 형식 및 `first_seen <= last_verified`
- source registry 연결
- generated TXT/CSV/compact JSON의 현재 상태

`--write`는 canonical JSON을 정렬하고 TXT/CSV를 재생성한다. CI는 `--check`만 실행하고 diff가 생기면 실패한다.

TXT에는 default-blockable domain만 한 줄씩 출력한다. CSV와 JSON에는 전체 분류를 보존한다. artifact header/metadata에는 dataset version과 generated date를 넣되 빌드 시각으로 매번 달라지지 않게 source metadata의 `updated_at`을 사용한다.

## 7. CLI 설계

CLI는 core를 import하고 별도 판정 로직을 갖지 않는다.

`check` JSON 출력 최소 schema:

```json
{
  "schema_version": 1,
  "valid": true,
  "blocked": true,
  "normalized_domain": "vtmpj.com",
  "classification": "disposable",
  "confidence": "high",
  "matched_domain": "vtmpj.com",
  "match_type": "exact",
  "reason": "active disposable domain with high confidence"
}
```

사람용 출력은 한 줄 결론과 evidence URL을 보여준다. JSON에서는 ANSI color를 사용하지 않는다. `check`는 네트워크를 호출하지 않는다.

## 8. Supabase adapter

생성 migration은 다음을 포함한다.

- consumer가 충돌 가능성을 줄일 수 있는 configurable private schema(기본 `disposable_email_guard`)
- blocklist table과 `block_subdomains`
- RLS enable
- `public`, `anon`, `authenticated`의 schema/table/function 권한 revoke
- `supabase_auth_admin`에 필요한 `USAGE`, `SELECT`, `EXECUTE`만 grant
- `SECURITY INVOKER`, 빈 `search_path`
- event의 email domain 정규화와 exact/subdomain query
- 안정 오류 message `SIGNUP_EMAIL_NOT_ALLOWED`
- versioned seed insert
- rollback 설명을 별도 문서로 제공

Vietls SQL의 provider-name 정규식 heuristic은 MVP template에 포함하지 않는다. evidence dataset에 없는 domain을 이름만으로 자동 차단하지 않는다.

생성기는 migration 파일을 쓰기 전에 경로, overwrite 여부, record count, schema/function 이름을 출력한다. Supabase CLI 호출과 원격 credential 읽기는 하지 않는다.

## 9. Agent adapter

`agent-integration/instructions.md`가 다음 공통 계약의 source of truth다.

1. auth provider와 실제 signup 경계를 찾는다.
2. 기존 client-only validation과 server/DB validation을 구분한다.
3. server/DB 경계에 matcher 또는 provider adapter를 설치한다.
4. migration/patch/test를 먼저 preview한다.
5. production apply, publish, secret 변경은 별도 승인을 요구한다.
6. raw email과 provider error를 로그에 남기지 않는다.
7. 무료 provider나 alias 전체를 임의로 차단하지 않는다.

renderer는 tool별 frontmatter와 경로만 변환하며 공통 본문의 version/hash를 삽입한다. snapshot test로 세 adapter의 보안 문장과 version 일치를 검증한다.

## 10. 테스트 전략

### Core unit fixture

- exact disposable: `vtmpj.com`
- permitted unlisted: `gmail.com`
- permitted explicit free provider record
- subdomain blocked when flag true
- subdomain allowed when flag false
- three-level record does not block parent
- longest suffix selection
- allowlist overrides dataset and denylist
- malformed email/domain, URL, port, IP, wildcard
- uppercase, surrounding whitespace, trailing dot, IDN
- inactive/low-confidence/alias/unknown is not default blocked

### Data contract

- schema pass/fail fixtures
- duplicate and sort failure
- missing/HTTP evidence failure
- stale generated artifact failure

### Supabase contract

- SQL contains private schema, RLS, revokes, minimum grants, invoker, empty search path
- direct function call allows permanent domain and rejects exact/subdomain disposable
- table is inaccessible to anon/authenticated
- optional local Supabase smoke runs only when CLI/runtime is present

### Release gates

- lint, typecheck, unit, build
- `pnpm pack --dry-run` allowlist inspection
- secret scan and forbidden Vietls identifier scan
- clean checkout generation diff
- no publish/deploy job on untrusted pull requests

## 11. Versioning

- package version: SemVer
- dataset schema: integer `schema_version`
- dataset content: `dataset_version` in `YYYY.MM.DD.N` format for independent data releases
- CLI JSON: integer `schema_version`
- agent manifest: SemVer adapter version plus canonical instruction hash

breaking record/API/CLI JSON changes require the corresponding major/schema bump. 새로운 domain 추가는 package patch 또는 data-only release로 처리한다.

## 12. 결정 사항과 보류 사항

결정:

- Node 20+, ESM, strict TypeScript
- pnpm workspace
- public suffix dependency 없이 explicit hostname rule
- external list bulk import 없음
- remote/network-free runtime matcher
- production apply 없음

release 전 보류:

- 코드 라이선스 MIT 대 Apache-2.0
- 데이터 라이선스와 source별 재배포 검토
- npm unscoped 이름 또는 사용자/조직 scope
- `ClassificationResult.input` 보존 여부
- local-part 문법 검증 수준

참고: [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks), [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)

## 검증 방법

- PRD U1~U8을 이 문서의 API, adapter, test 항목에 trace한다.
- seed fixture로 exact/subdomain/allowlist 우선순위를 먼저 red-green test한다.
- Supabase template은 Vietls migration과 보안 계약을 비교하되 project-specific 값이나 seed를 복사하지 않았는지 확인한다.
- clean checkout에서 `pnpm install --frozen-lockfile && pnpm test && pnpm build`를 release baseline으로 삼는다.

## 다음 한 단계

Docker가 실행되는 환경에서 Supabase function direct-call smoke를 추가하고, installed tarball fixture를 별도 release gate로 검증한다.
