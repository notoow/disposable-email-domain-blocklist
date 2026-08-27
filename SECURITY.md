# Security policy

## Scope

Report vulnerabilities in the matcher, CLI file-writing behavior, generated Supabase SQL, agent installation, or CI/release configuration.

The dataset is a policy input, not an identity or mailbox verification service. SMTP probing, fraud scoring, and provider-wide blocking are out of scope for this MVP.

## Safe operation

- Enforce at a server or database signup boundary; browser checks are not a security boundary.
- Review generated SQL before applying it and never commit service-role credentials.
- Keep raw email addresses and provider error details out of logs and snapshots.
- Use custom allowlists for reviewed exceptions rather than weakening the global dataset.
- Treat evidence disputes as a status/review change, not an unreviewed delete.

## Reporting

Do not open a public issue for a sensitive vulnerability. Use the repository's private security reporting channel when it is configured, and include a minimal reproduction, affected version/commit, impact, and a proposed safe disclosure timeline. Do not include secrets or real user data in the report.

