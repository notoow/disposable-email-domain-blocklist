import assert from 'node:assert/strict'
import test from 'node:test'

import { renderSupabaseMigration } from '../src/index.js'

const record = {
  domain: 'vtmpj.com',
  classification: 'disposable' as const,
  confidence: 'high' as const,
  source_urls: ['https://verifymail.io/domain/vtmpj.com'],
  evidence_note: 'Evidence',
  provider: '10minutemail.com',
  first_seen: '2026-08-27',
  last_verified: '2026-08-27',
  block_subdomains: true,
  status: 'active' as const,
}

test('Supabase renderer keeps the hook private and seeds only default-blockable records', () => {
  const sql = renderSupabaseMigration([record])
  assert.match(sql, /create schema if not exists disposable_email_guard/)
  assert.match(
    sql,
    /alter table disposable_email_guard\.blocked_signup_email_domains enable row level security/
  )
  assert.match(
    sql,
    /revoke all on table disposable_email_guard\.blocked_signup_email_domains from public, anon, authenticated/
  )
  assert.match(sql, /security invoker/)
  assert.match(sql, /set search_path = ''/)
  assert.match(
    sql,
    /grant execute on function disposable_email_guard\.before_user_created_email_guard\(jsonb\) to supabase_auth_admin/
  )
  assert.doesNotMatch(sql, /security definer/)
  assert.match(sql, /SIGNUP_EMAIL_NOT_ALLOWED/)
  assert.match(sql, /vtmpj\.com/)
  assert.match(sql, /block_subdomains and email_domain like/)
})

test('Supabase renderer rejects unsafe identifiers and does not connect remotely', () => {
  assert.throws(
    () => renderSupabaseMigration([record], { schema: 'unsafe-schema' }),
    /lowercase SQL identifier/
  )
  assert.throws(
    () => renderSupabaseMigration([record], { table: 'table;drop' }),
    /lowercase SQL identifier/
  )
})

test('Supabase renderer remains valid when no records are currently blockable', () => {
  const sql = renderSupabaseMigration([
    { ...record, classification: 'alias', confidence: 'high' },
  ])
  assert.match(sql, /from \(values\n  \(null::text/)
  assert.match(sql, /where false\non conflict/)
  assert.doesNotMatch(sql, /values\n\non conflict/)
})
