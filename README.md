# Disposable Email Domain Blocklist

Evidence-backed disposable email domain data and safe signup-boundary integrations for Node/TypeScript and Supabase.

## Quick start

```bash
pnpm install
pnpm check
node cli/dist/bin.js check user@vtmpj.com
node cli/dist/bin.js check user@gmail.com --json
```

The current evidence-backed seed blocks 33 active disposable domains, including `10minutemail.com`, `guerrillamail.com`, `mailinator.com`, `temp-mail.org`, `vtmpj.com`, and `yopmail.com`, plus their subdomains. An unlisted domain such as `gmail.com` is allowed by default. A blocked result is a valid decision and exits `0`; malformed input exits `2`. See the full list in [`data/domains.txt`](data/domains.txt).

## Supabase preview

Generate a migration for review. This command only writes a local file and never connects to Supabase or applies a database change.

```bash
node cli/dist/bin.js init supabase --output supabase/migrations/20260827000000_disposable_email_guard.sql
```

Inspect the SQL and run it through your normal migration review. Production application requires an explicit operator decision.

See the [Next.js server-boundary quickstart](docs/nextjs-disposable-email-validation.md) for a route-handler example.

## Agent adapters

Generate project-local instructions for Codex, Claude Code, and Cursor:

```bash
node cli/dist/bin.js install-agent --target all
```

The adapters share a canonical instruction source and require server/database enforcement, evidence review, privacy-safe logs, and approval before production changes.

## GitHub Pages

The public site is deployed from `site/` by `.github/workflows/pages.yml`:

<https://notoow.github.io/disposable-email-domain-blocklist/>

Each intent page has a unique title, canonical URL, concise answer block, visible FAQ where appropriate, JSON-LD matching the page text, internal links, `robots.txt`, and `sitemap.xml`. This follows foundational SEO guidance for generative search: useful text, crawlable pages, clear structure, and no artificial `llms.txt` or keyword stuffing.

## Data policy

The default policy blocks only active `disposable` records with medium or high confidence. Alias, role, free-provider, unknown, stale, disputed, and removed records are not blocked by default. Every active disposable record must have HTTPS evidence, an evidence note, and verification dates. See [the data schema](data/schema.json) and [the contribution guide](CONTRIBUTING.md).

This repository does not bulk-copy another blocklist. Code and data licensing are tracked separately in [docs/licensing.md](docs/licensing.md).

## Development

```bash
pnpm data:check
pnpm agents:generate
pnpm check
```

The matcher is network-free and can be imported from the core workspace package during development. Client-side validation is UX only; enforce the policy at the server or database signup boundary.

## Status

The repository is an MVP under active development. The unscoped npm name and release license/metadata are rechecked before any publish. No npm publish, GitHub release, or production database operation is performed by CI.
