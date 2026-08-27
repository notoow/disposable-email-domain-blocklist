import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DomainMatcher,
  classifyDomain,
  classifyEmail,
  getDomainRecord,
  isDisposableEmail,
  type DomainRecord,
} from '../src/index.js'

function fixture(overrides: Partial<DomainRecord> & Pick<DomainRecord, 'domain'>): DomainRecord {
  return {
    classification: 'disposable',
    confidence: 'high',
    source_urls: ['https://evidence.example/fixture'],
    evidence_note: 'Fixture only',
    provider: null,
    first_seen: '2026-08-27',
    last_verified: '2026-08-27',
    block_subdomains: true,
    status: 'active',
    ...overrides,
  }
}

test('default dataset blocks vtmpj.com and its subdomains with evidence', () => {
  const exact = classifyEmail('user@vtmpj.com')
  assert.equal(exact.blocked, true)
  assert.equal(exact.match_type, 'exact')
  assert.equal(exact.record?.provider, '10minutemail.com')

  const subdomain = classifyDomain('mail.vtmpj.com')
  assert.equal(subdomain.blocked, true)
  assert.equal(subdomain.match_type, 'subdomain')
  assert.equal(subdomain.matched_domain, 'vtmpj.com')
})

test('unlisted permanent providers remain allowed', () => {
  assert.equal(isDisposableEmail('user@gmail.com'), false)
  assert.equal(classifyDomain('yahoo.com').classification, 'unlisted')
})

test('a three-level record does not block its parent and respects block_subdomains=false', () => {
  const matcher = new DomainMatcher({
    records: [fixture({ domain: 'tempo.mintraccoon.com', block_subdomains: false })],
  })

  assert.equal(matcher.classifyDomain('tempo.mintraccoon.com').blocked, true)
  assert.equal(matcher.classifyDomain('child.tempo.mintraccoon.com').blocked, false)
  assert.equal(matcher.classifyDomain('mintraccoon.com').blocked, false)
})

test('allowlist takes precedence over custom and dataset deny rules', () => {
  const matcher = new DomainMatcher({
    records: [fixture({ domain: 'blocked.example' })],
    denylist: [{ domain: 'blocked.example', block_subdomains: true }],
    allowlist: [{ domain: 'safe.blocked.example' }],
  })

  assert.equal(matcher.classifyDomain('safe.blocked.example').source, 'allowlist')
  assert.equal(matcher.classifyDomain('safe.blocked.example').blocked, false)
  assert.equal(matcher.classifyDomain('child.blocked.example').source, 'denylist')
})

test('non-blockable classifications and states are returned without blocking', () => {
  for (const record of [
    fixture({ domain: 'alias.example', classification: 'alias' }),
    fixture({ domain: 'low.example', confidence: 'low' }),
    fixture({ domain: 'stale.example', status: 'stale' }),
  ]) {
    const result = new DomainMatcher({ records: [record] }).classifyDomain(record.domain)
    assert.equal(result.valid, true)
    assert.equal(result.blocked, false)
    assert.equal(result.source, 'dataset')
  }
})

test('normalization handles case, whitespace, trailing root dot, and IDN', () => {
  const defaultMatcher = new DomainMatcher()
  const matcher = new DomainMatcher({
    records: [fixture({ domain: 'xn--bcher-kva.example' })],
  })
  assert.equal(defaultMatcher.classifyEmail('  USER@VTMPJ.COM  ').normalized_domain, 'vtmpj.com')
  assert.equal(defaultMatcher.classifyDomain('vtmpj.com.').blocked, true)
  assert.equal(matcher.classifyDomain('bücher.example').blocked, true)
})

test('malformed inputs are invalid rather than disposable', () => {
  for (const input of [
    'not-an-email',
    '@example.com',
    'user@@example.com',
    'user@localhost',
    'user@127.0.0.1',
    'https://vtmpj.com',
  ]) {
    const result = input.includes('@') ? classifyEmail(input) : classifyDomain(input)
    assert.equal(result.valid, false, input)
    assert.equal(result.blocked, false, input)
  }
})

test('getDomainRecord returns only an exact canonical record', () => {
  assert.equal(getDomainRecord('VTMPJ.COM.')?.domain, 'vtmpj.com')
  assert.equal(getDomainRecord('child.vtmpj.com'), null)
})
