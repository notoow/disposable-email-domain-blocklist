import assert from 'node:assert/strict'
import test from 'node:test'

import { canonicalizeDataset, validateDataset } from './data-lib.mjs'

const sourceUrl = 'https://evidence.example/domain/example.test'
const sources = {
  schema_version: 1,
  sources: [
    {
      url: sourceUrl,
      publisher: 'Fixture',
      evidence_type: 'fixture',
      checked_at: '2026-08-27',
      redistribution_review: 'fixture',
      note: 'Fixture source',
    },
  ],
}

function record(domain) {
  return {
    domain,
    classification: 'disposable',
    confidence: 'high',
    source_urls: [sourceUrl],
    evidence_note: 'Fixture evidence',
    provider: null,
    first_seen: '2026-08-27',
    last_verified: '2026-08-27',
    block_subdomains: true,
    status: 'active',
  }
}

function document(records) {
  return {
    schema_version: 1,
    dataset_version: '2026.08.27.1',
    updated_at: '2026-08-27',
    records,
  }
}

test('dataset validator accepts an evidence-backed canonical record', () => {
  assert.deepEqual(validateDataset(document([record('example.test')]), sources), [])
})

test('dataset validator rejects duplicate, missing evidence, and unregistered evidence', () => {
  const first = record('example.test')
  const duplicate = { ...record('example.test'), source_urls: ['https://other.example/evidence'] }
  const errors = validateDataset(document([first, duplicate]), sources)

  assert.ok(errors.some((error) => error.includes('duplicates example.test')))
  assert.ok(errors.some((error) => error.includes('is not registered')))

  const missing = { ...record('missing.test'), source_urls: [], evidence_note: '' }
  const missingErrors = validateDataset(document([missing]), sources)
  assert.ok(missingErrors.some((error) => error.includes('must contain evidence')))
  assert.ok(missingErrors.some((error) => error.includes('evidence_note is required')))
})

test('dataset validator rejects malformed and unsorted domains', () => {
  const errors = validateDataset(
    document([record('z.example'), record('https://a.example/path')]),
    sources
  )

  assert.ok(errors.some((error) => error.includes('normalized ASCII domain')))
  assert.ok(errors.some((error) => error.includes('must be sorted after z.example')))
})

test('canonicalization normalizes and sorts domains without changing evidence facts', () => {
  const canonical = canonicalizeDataset(document([record('Z.example.'), record('a.example')]))
  assert.deepEqual(canonical.records.map(({ domain }) => domain), ['a.example', 'z.example'])
})
