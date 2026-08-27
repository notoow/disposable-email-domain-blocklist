# Disposable Email Domain Blocklist MVP Build Checklist

상태: Active

작성일: 2026-08-27

각 단계는 이전 단계의 verification checkpoint를 통과한 뒤 진행한다. production Supabase, npm publish, GitHub release, 외부 issue 생성은 이 체크리스트에 포함되어 있어도 별도 사용자 승인이 필요하다.

## 0. 저장소와 결정 기록

- [x] 빈 GitHub repository namespace 확인: `notoow/disposable-email-domain-blocklist`
- [x] npm exact unscoped 이름 snapshot 확인(2026-08-27: registry 404)
- [x] Vietls 구현을 읽고 재사용/분리 경계를 PRD에 기록
- [x] MVP PRD 작성
- [x] MVP technical spec 작성
- [x] root package/workspace/TypeScript/test scripts 구성
- [ ] 코드·데이터 라이선스 결정을 `docs/licensing.md`에 기록

검증 checkpoint: 저장소에 Vietls credential/project ID가 없고, publish/deploy 자동화가 아직 없어야 한다.

## 1. Evidence dataset foundation

- [x] `data/schema.json` 작성
- [x] `data/sources.json` source registry 작성
- [x] `data/domains.json`에 independently verified seed 추가
- [x] 최초 seed는 최소 `vtmpj.com`을 포함하고 source URL/note/date/provider를 기록
- [x] `scripts/normalize-data.mjs`의 check/write 모드 구현
- [x] sorted JSON/TXT/CSV 생성
- [x] malformed, duplicate, unsorted, missing evidence fixture 테스트
- [ ] external list bulk-copy를 막는 contribution 문구 작성

검증 checkpoint: `pnpm data:check`가 clean tree에서 통과하고 generated artifact를 지운 뒤 재생성해 같은 bytes가 나와야 한다.

## 2. TypeScript core matcher

- [x] DomainRecord/ClassificationResult/MatcherOptions 타입 구현
- [x] email parser와 domain normalizer 분리
- [x] exact lookup 구현
- [x] explicit `block_subdomains` longest-suffix match 구현
- [x] default blockable policy 구현
- [x] custom allowlist 우선순위 구현
- [x] custom denylist 구현
- [x] `classifyEmail`, `classifyDomain`, `isDisposableEmail`, `getDomainRecord` export
- [x] malformed/IDN/case/trailing-dot/three-level-domain 테스트
- [x] Gmail/Yahoo와 alias/unknown/low-confidence false-positive 테스트

검증 checkpoint: core unit test, typecheck, build가 통과하고 runtime에서 네트워크 호출이 없어야 한다.

## 3. CLI `check`

- [x] CLI package와 `disposable-email` binary 구성
- [x] `check <email-or-domain>` 사람용 출력 구현
- [x] `--json` stable schema 구현
- [x] exit 0/1/2 계약 구현
- [x] stdin/argument의 raw email을 diagnostic log에 남기지 않음
- [ ] installed tarball smoke test 작성

검증 checkpoint: `user@vtmpj.com`, `gmail.com`, malformed input의 text/JSON snapshot과 exit code가 명세와 일치해야 한다.

## 4. Supabase adapter

- [x] private schema/RLS/minimum-grant SQL template 작성
- [x] dataset에서 versioned seed SQL 생성
- [x] Before User Created function과 안정 오류 token 구현
- [x] `init supabase --output` preview/write 구현
- [x] 충돌 시 `--force` 없는 overwrite 거부
- [x] remote apply/credential access 부재 contract test
- [x] 정적 SQL 보안 계약 테스트
- [ ] local Supabase direct hook integration test (Docker daemon unavailable in this run)
- [ ] rollback/운영 적용 가이드 작성

검증 checkpoint: anon/authenticated table 접근은 실패하고, auth admin hook은 permanent email을 허용하며 exact/subdomain disposable을 user insert 전에 거부해야 한다.

## 5. Agent integration pack

- [x] `agent-integration/manifest.yaml` 작성
- [x] canonical `instructions.md` 작성
- [x] Codex `SKILL.md` renderer 구현
- [x] Claude Code `SKILL.md` renderer 구현
- [x] Cursor `.mdc` renderer 구현
- [x] `install-agent --target ...` preview/conflict 처리 구현
- [x] adapter version/hash snapshot test
- [x] 세 adapter의 production approval/privacy/server-boundary 문장 동등성 테스트

검증 checkpoint: fixture repo 세 개에서 설치 결과를 생성하고 기존 파일을 승인 없이 덮어쓰지 않아야 한다.

## 6. Contribution과 CI

- [x] domain report issue template 작성
- [x] false positive/removal request template 작성
- [x] CONTRIBUTING의 evidence/license/normalization 정책 작성
- [x] SECURITY와 secret reporting 경로 작성
- [x] PR CI: data check, typecheck, unit, build
- [x] generated artifact drift check
- [x] 신규 active disposable의 evidence coverage check
- [x] Dependabot와 release 권한 최소화

검증 checkpoint: 의도적으로 evidence를 제거하거나 중복 domain을 넣은 test branch에서 CI가 정확한 오류로 실패해야 한다.

## 7. Documentation quickstarts

- [x] README title/첫 문장/10초 설명
- [x] Node quickstart
- [x] Next.js server-boundary quickstart
- [x] Supabase migration preview quickstart
- [x] false positive/custom allowlist 문서
- [x] data freshness와 last verified 설명
- [x] client validation은 UX 보조라는 보안 안내
- [x] production apply가 수동임을 명시

검증 checkpoint: clean temporary project에서 명령을 복사해 실행하고 문서와 실제 출력의 차이가 없어야 한다.

## 8. Pre-release hardening

- [x] package contents allowlist 설정
- [x] `pnpm pack --dry-run` 검토
- [x] secret/PII/Vietls identifier scan
- [ ] SBOM/provenance/release permissions 검토
- [x] exact npm namespace 재확인
- [ ] 코드·데이터 license 최종 확정
- [x] changelog와 v0.1.0 release notes 초안
- [ ] 외부 설치 프로젝트 smoke test 3건

검증 checkpoint: release artifact만으로 Node/CLI quickstart가 재현되고 source env, local path, user data가 포함되지 않아야 한다.

## 9. 승인 필요 작업

- [ ] npm publish 실행 — 사용자 승인 필요
- [ ] GitHub push/release/Marketplace publish — 사용자 승인 필요
- [ ] production Supabase migration apply — 사용자 승인 필요
- [ ] hosted API/결제/후원 account 설정 — 사용자 승인 필요

## 검증 방법

- 각 PR에서 완료한 checkbox와 실제 명령/결과를 연결한다.
- 단계 checkpoint가 실패하면 다음 단계의 public API를 확정하지 않는다.
- `git diff --check`, unit/type/build, generated artifact drift를 매 구현 단위마다 실행한다.
- unrelated Vietls 작업 트리는 읽기 전용으로 유지한다.

## 다음 한 단계

3단계의 CLI `check` text/JSON 출력과 exit code 계약을 구현한다.
