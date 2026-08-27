# Disposable Email Domain Blocklist MVP PRD

상태: Draft for implementation

작성일: 2026-08-27

제품명: Disposable Email Domain Blocklist

## 1. 제품 요약

Disposable Email Domain Blocklist는 임시메일 가입을 서버 경계에서 차단하기 위한 evidence 기반 오픈 데이터셋과 TypeScript 도구 모음이다. MVP는 도메인 판정 결과뿐 아니라 왜 차단하는지, 언제 확인했는지, 어떤 정책으로 하위 도메인을 처리하는지를 함께 제공한다.

첫 사용자는 Node/TypeScript 또는 Supabase로 가입 기능을 만든 개발자다. 사용자는 5분 이내에 이메일이나 도메인을 판정하고, Supabase Before User Created Hook용 migration을 미리 생성하며, 운영 반영 전 변경 내용을 검토할 수 있어야 한다.

## 2. 문제 정의

기존 가입 방어는 다음 중 하나에 머무는 경우가 많다.

- 브라우저의 이메일 문법 검사만 수행한다.
- 출처와 갱신 이력이 없는 도메인 문자열 목록을 복사한다.
- exact domain과 하위 도메인을 같은 방식으로 처리해 오탐 범위를 키운다.
- 이메일 인증이 임시메일 수신 자체를 막지 못한다는 점을 놓친다.
- 운영 데이터베이스에 바로 SQL을 적용해 검토·rollback 경계를 잃는다.

이 제품은 판정 데이터, 런타임 API, 설치 adapter를 분리하고 모든 차단 결과에 사람이 읽을 수 있는 근거를 연결한다.

## 3. 목표와 비목표

### MVP 목표

- 검증된 레코드를 JSON canonical dataset으로 관리한다.
- JSON에서 정렬된 JSON/TXT/CSV artifact를 재현 가능하게 생성한다.
- Node/TypeScript에서 email/domain을 정규화하고 exact/subdomain 정책으로 판정한다.
- CLI `check`가 사람이 읽는 출력과 JSON 출력을 제공한다.
- CLI `init supabase`가 migration을 생성하되 기본값으로 운영 DB에 적용하지 않는다.
- 신규 데이터의 schema, 중복, 정렬, evidence 누락을 CI에서 거부한다.
- Codex, Claude Code, Cursor adapter가 하나의 canonical instruction에서 생성된다.
- 일반 무료 메일과 alias/unknown 분류는 기본 차단하지 않는다.

### MVP 비목표

- SMTP probing 또는 실제 mailbox 존재 확인
- IP/device/fraud reputation 점수화
- 웹 전체 scraping과 외부 blocklist 자동 병합
- Gmail, Yahoo 같은 무료 메일 서비스 차단
- 모든 alias/forwarding 서비스 차단
- production Supabase 자동 변경
- npm/GitHub release 자동 실행
- hosted API, 결제, 대시보드

## 4. 핵심 사용자와 주요 작업

### Node/Next.js 개발자

가입 API에서 `isDisposableEmail(email)`을 호출하고, 차단 시 안정적인 reason을 사용자 메시지로 매핑한다. 브라우저 검사는 UX 보조로 쓸 수 있지만 서버 검사를 제거하지 않는다.

### Supabase 개발자

`init supabase`로 private schema, 최소 권한, denylist table, Before User Created Hook 함수가 포함된 migration을 생성한다. 생성된 diff와 로컬 테스트를 본 후 본인이 `supabase db push` 또는 SQL Editor 적용을 결정한다.

### 데이터 기여자

도메인, 분류, confidence, 근거 URL, 관찰일, 하위 도메인 정책을 제출한다. CI 결과로 누락과 중복을 즉시 확인한다. 다른 저장소 목록의 일괄 복사는 허용되지 않는다.

### AI 코딩 에이전트 사용자

현재 프로젝트의 실제 가입 경계를 찾고, provider에 맞는 서버 측 방어와 테스트를 제안받는다. 운영 변경은 preview 이후 별도 승인을 거친다.

## 5. 사용자 스토리와 수용 기준

| ID | 사용자 스토리 | 수용 기준 |
|---|---|---|
| U1 | 개발자로서 이메일이 차단 대상인지 확인하고 싶다. | `user@vtmpj.com`은 `blocked=true`, `user@gmail.com`은 기본 `blocked=false`다. |
| U2 | 개발자로서 판정 이유를 보고 싶다. | 판정 결과에 matched domain, classification, confidence, reason, source URLs가 포함된다. |
| U3 | 개발자로서 정확한 하위 도메인 정책을 원한다. | `block_subdomains=true`인 `x.example`은 `a.x.example`을 막고, `example`의 형제·상위 도메인은 막지 않는다. |
| U4 | 데이터 기여자로서 잘못된 레코드를 CI에서 발견하고 싶다. | schema 위반, 정규화되지 않은 domain, 중복, 비정렬, 빈 evidence는 실패한다. |
| U5 | Supabase 사용자로서 안전한 migration preview를 원한다. | 명령은 파일만 생성하고 원격 명령·credential 접근을 하지 않는다. |
| U6 | 서비스 운영자로서 false positive를 해제하고 싶다. | custom allowlist가 dataset deny 결정보다 우선한다. |
| U7 | 자동화 사용자로서 안정적인 출력을 원한다. | CLI `--json` schema와 exit code가 문서화되고 테스트된다. |
| U8 | 여러 코딩 에이전트를 쓰는 개발자로서 같은 보안 원칙을 원한다. | 세 adapter가 canonical instruction hash/version을 공유한다. |

## 6. 기본 정책

기본 차단 조건은 `status=active`, `classification=disposable`, `confidence`가 `medium` 또는 `high`인 레코드다. `alias`, `role`, `free_provider`, `unknown`, `stale`, `removed`, `disputed`는 기본 허용 또는 경고다.

정책 우선순위는 다음과 같다.

1. custom allowlist exact/subdomain 규칙
2. custom denylist exact/subdomain 규칙
3. canonical dataset 규칙
4. 일치 없음(`unknown`, 허용)

문법 오류는 disposable 판정과 분리해 `invalid_input`으로 반환한다. 사용자가 문법 오류를 차단할지는 호출 경계에서 결정한다.

## 7. Vietls 구현 재사용 경계

| Vietls 자산 | 판단 | MVP 처리 |
|---|---|---|
| `auth_gate` private schema와 public/anon/authenticated revoke | 재사용 | Supabase template의 보안 baseline으로 일반화한다. |
| `supabase_auth_admin` 최소 SELECT/EXECUTE 권한 | 재사용 | migration 생성물과 정적 계약 테스트에 포함한다. |
| `block_subdomains` + exact match SQL | 재사용 | core matcher와 SQL adapter가 같은 fixture를 통과하게 한다. |
| `SIGNUP_EMAIL_NOT_ALLOWED` 안정 토큰 | 원칙 재사용 | adapter 기본 오류 코드로 사용하되 사용자 UI 문구는 소비자 앱 책임으로 둔다. |
| auth hook 직접 호출/정적 migration 테스트 | 재사용 | 생성물 contract test와 선택적 로컬 Supabase integration test로 확장한다. |
| SQL의 정규식 provider 키워드 차단 | 분리/기본 제외 | 근거 없는 광범위 매칭과 오탐 위험 때문에 dataset 판정과 별도 opt-in heuristic으로만 검토한다. |
| 기존 seed domain 문자열 | 그대로 재사용 금지 | evidence와 재배포 권리를 독립 확인한 레코드만 새 dataset에 편입한다. |
| Vietls 로그인 UI, 번역, analytics, 진단 logger | 앱 종속 | 예제에서 오류 매핑 패턴만 설명하고 패키지에 복사하지 않는다. |
| Vietls Supabase project ID/config | 비공개 운영 종속 | 어떤 artifact에도 포함하지 않는다. |

## 8. 데이터와 법적 요구사항

- canonical record에는 `domain`, `classification`, `confidence`, `source_urls`, `evidence_note`, `provider`, `first_seen`, `last_verified`, `block_subdomains`, `status`가 있어야 한다.
- 신규 active disposable 레코드는 최소 하나의 HTTPS evidence URL과 비어 있지 않은 evidence note가 있어야 한다.
- 제3자 목록은 discovery 용도로만 사용할 수 있으며, 원본 문자열을 일괄 복사하지 않는다.
- code license와 data license는 분리한다. 출시 전 data license를 최종 결정하기 전까지 seed data의 재배포 근거를 레코드 또는 source registry에 기록한다.
- 삭제/이의제기 시 레코드를 즉시 지우는 대신 상태와 이력을 보존할 수 있어야 한다.

## 9. CLI 제품 계약

```text
disposable-email check <email-or-domain> [--json]
disposable-email init supabase [--output <path>] [--force]
disposable-email report-domain <domain> --evidence <https-url>
disposable-email install-agent --target codex|claude|cursor|all
```

- `check`: 정상 판정은 exit 0, 입력 오류는 exit 2, 내부 오류는 exit 1이다. 차단 여부는 JSON field로 전달하며 차단 자체를 프로세스 오류로 보지 않는다.
- `init supabase`: 기본 경로 충돌 시 실패하며 `--force` 없이 덮어쓰지 않는다. 원격 DB 명령을 실행하지 않는다.
- `report-domain`: MVP에서는 issue URL 또는 제출용 JSON을 생성하고 외부 전송은 하지 않는다.
- `install-agent`: 기존 파일을 preview하고 충돌 시 덮어쓰지 않는다.

## 10. 성공 지표

MVP 출시 전 제품 품질 지표:

- core/data/CLI unit test 100% 통과
- 생성 artifact가 clean checkout에서 byte-for-byte 재현
- seed dataset의 active disposable 레코드 evidence coverage 100%
- exact/subdomain/allowlist/Unicode normalization fixture가 Node와 Supabase SQL에서 동일
- `npm pack --dry-run`에 source env, credential, Vietls 파일이 없음
- 빈 Node와 local Supabase 예제에서 quickstart 재현

출시 후 관찰 지표는 외부 설치 repo, 반복 사용자, evidence PR, false-positive 처리 시간 순으로 우선한다.

## 11. namespace 조사 스냅샷

2026-08-27 기준:

- GitHub `notoow/disposable-email-domain-blocklist`는 생성되어 있고 비어 있다. 이 로컬 저장소의 `origin`으로 연결한다.
- npm unscoped `disposable-email-domain-blocklist`는 registry 조회에서 404였으나, publish 직전 다시 확인해야 한다.
- npm scope 소유권이 확정되지 않았으므로 package 이름은 구현 중 `@disposable-email-domain-blocklist/core` 같은 가상 이름을 쓰지 않고 private workspace 이름으로 둔다. 공개 이름은 release gate에서 결정한다.

참고: [Supabase Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [npm scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/), [GitHub repository](https://github.com/notoow/disposable-email-domain-blocklist)

## 검증 방법

- 이 문서의 U1~U8이 기술 명세의 API/테스트 항목과 각각 연결되는지 검토한다.
- Vietls 경로를 읽기 전용으로 유지하고, 이 저장소에 Vietls project ID·UI copy·credential이 들어오지 않았는지 `rg`로 확인한다.
- publish 직전 GitHub/npm namespace와 라이선스 결정을 다시 확인한다.

## 다음 한 단계

Docker가 실행되는 환경에서 생성된 Supabase SQL을 local direct-hook smoke로 검증하고, 그 뒤 evidence seed를 확대한다.
