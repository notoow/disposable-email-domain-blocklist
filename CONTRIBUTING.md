# Contributing

## Domain reports

Open a domain report with:

- normalized lowercase ASCII domain
- classification and confidence proposal
- at least one HTTPS evidence URL
- a short evidence note describing what the source establishes
- first seen and last verified dates
- whether subdomains should be matched
- license/terms considerations for redistributing the factual record

Do not paste an entire third-party list or scrape pages indiscriminately. A maintainer must independently review every active disposable record.

## Code changes

Run `pnpm check` before opening a pull request. Generated files must be produced by `pnpm data:write` or `pnpm agents:generate`; do not edit generated artifacts directly. Keep matcher behavior deterministic and network-free.

Changes that affect signup enforcement must include a server/database integration test and a false-positive test. Never add service keys, raw user emails, provider stack traces, or local project IDs to fixtures, logs, or documentation.

## Review gates

CI checks schema, evidence, normalization, generated drift, type safety, tests, and build output. Production Supabase apply, npm publish, GitHub release, and hosted-service changes are outside automated contribution workflows.

