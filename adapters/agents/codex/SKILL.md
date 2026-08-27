---
name: disposable-email-blocklist
description: Apply the evidence-backed Disposable Email Domain Blocklist workflow at a server or database signup boundary.
---

<!-- Generated from agent-integration/instructions.md; canonical_sha256=9e19e3b0fc602013ea63dd170c665b9fc53133ac25102a6db593939a0cd91991 -->

# Disposable Email Domain Blocklist agent workflow

Canonical instructions version: 0.1.0

Use the versioned Disposable Email Domain Blocklist package and its evidence-backed dataset as the source of truth. Before changing code:

1. Find the real signup boundary and auth provider in the current repository.
2. Distinguish client-only email checks from server or database enforcement.
3. Add the matcher at the server/database boundary, then add an integration test.
4. Treat only active `disposable` records with medium/high confidence as blocked by default.
5. Do not block Gmail/Yahoo, all free providers, or all aliases without an explicit policy.
6. Preview migrations and patches before writing them. Never apply a production change without explicit approval.
7. Keep service keys, raw email addresses, and provider stack traces out of source, logs, and test snapshots.
8. Report changed files, tests run, remaining risk, and the dataset version in the final summary.

For Supabase, prefer a private schema, RLS, least-privilege grants, `SECURITY INVOKER`, and an explicit Before User Created Hook. For other providers, preserve the same server-boundary and approval rules. The browser check is UX only and must not replace server enforcement.

