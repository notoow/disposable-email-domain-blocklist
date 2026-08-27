import { domainToASCII } from 'node:url'

export const CLASSIFICATIONS = new Set([
  'disposable',
  'alias',
  'role',
  'free_provider',
  'unknown',
])
export const CONFIDENCES = new Set(['low', 'medium', 'high'])
export const STATUSES = new Set(['active', 'stale', 'disputed', 'removed'])

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function normalizeDomain(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\.$/, '')
  if (!trimmed || trimmed.includes('@') || trimmed.includes('*')) return null

  const ascii = domainToASCII(trimmed).toLowerCase()
  if (!ascii || ascii.length > 253) return null
  const labels = ascii.split('.')
  if (labels.length < 2 || labels.some((label) => !LABEL_PATTERN.test(label))) return null
  return ascii
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function validateSourceRegistry(sourceDocument) {
  const errors = []
  if (!sourceDocument || sourceDocument.schema_version !== 1) {
    errors.push('sources.json schema_version must be 1')
  }
  if (!Array.isArray(sourceDocument?.sources)) {
    return { errors: [...errors, 'sources.json sources must be an array'], urls: new Set() }
  }

  const urls = new Set()
  for (const [index, source] of sourceDocument.sources.entries()) {
    const prefix = `sources[${index}]`
    if (!source || typeof source !== 'object') {
      errors.push(`${prefix} must be an object`)
      continue
    }
    if (typeof source.url !== 'string' || !source.url.startsWith('https://')) {
      errors.push(`${prefix}.url must be HTTPS`)
    } else if (urls.has(source.url)) {
      errors.push(`${prefix}.url duplicates ${source.url}`)
    } else {
      urls.add(source.url)
    }
    if (!isValidDate(source.checked_at)) errors.push(`${prefix}.checked_at must be YYYY-MM-DD`)
    for (const field of ['publisher', 'evidence_type', 'redistribution_review', 'note']) {
      if (typeof source[field] !== 'string' || source[field].trim() === '') {
        errors.push(`${prefix}.${field} must be a non-empty string`)
      }
    }
  }

  return { errors, urls }
}

export function validateDataset(document, sourceDocument) {
  const errors = []
  const sourceRegistry = validateSourceRegistry(sourceDocument)
  errors.push(...sourceRegistry.errors)

  if (!document || document.schema_version !== 1) errors.push('schema_version must be 1')
  if (typeof document?.dataset_version !== 'string' || !VERSION_PATTERN.test(document.dataset_version)) {
    errors.push('dataset_version must use YYYY.MM.DD.N')
  }
  if (!isValidDate(document?.updated_at)) errors.push('updated_at must be YYYY-MM-DD')
  if (!Array.isArray(document?.records)) return [...errors, 'records must be an array']

  const seen = new Set()
  let previous = ''

  for (const [index, record] of document.records.entries()) {
    const prefix = `records[${index}]`
    if (!record || typeof record !== 'object') {
      errors.push(`${prefix} must be an object`)
      continue
    }

    const normalized = normalizeDomain(record.domain)
    if (!normalized || normalized !== record.domain) {
      errors.push(`${prefix}.domain must be a normalized ASCII domain`)
    }
    if (seen.has(record.domain)) errors.push(`${prefix}.domain duplicates ${record.domain}`)
    seen.add(record.domain)
    if (previous && record.domain.localeCompare(previous, 'en') <= 0) {
      errors.push(`${prefix}.domain must be sorted after ${previous}`)
    }
    previous = record.domain

    if (!CLASSIFICATIONS.has(record.classification)) errors.push(`${prefix}.classification is invalid`)
    if (!CONFIDENCES.has(record.confidence)) errors.push(`${prefix}.confidence is invalid`)
    if (!STATUSES.has(record.status)) errors.push(`${prefix}.status is invalid`)
    if (typeof record.block_subdomains !== 'boolean') {
      errors.push(`${prefix}.block_subdomains must be boolean`)
    }
    if (record.provider !== null && (typeof record.provider !== 'string' || !record.provider.trim())) {
      errors.push(`${prefix}.provider must be null or a non-empty string`)
    }
    if (!isValidDate(record.first_seen)) errors.push(`${prefix}.first_seen must be YYYY-MM-DD`)
    if (!isValidDate(record.last_verified)) errors.push(`${prefix}.last_verified must be YYYY-MM-DD`)
    if (isValidDate(record.first_seen) && isValidDate(record.last_verified) && record.first_seen > record.last_verified) {
      errors.push(`${prefix}.first_seen must not be after last_verified`)
    }

    const requiresEvidence = record.status === 'active' && record.classification === 'disposable'
    if (!Array.isArray(record.source_urls) || (requiresEvidence && record.source_urls.length === 0)) {
      errors.push(`${prefix}.source_urls must contain evidence`)
    } else {
      const recordUrls = new Set()
      for (const url of record.source_urls) {
        if (typeof url !== 'string' || !url.startsWith('https://')) {
          errors.push(`${prefix}.source_urls must contain only HTTPS URLs`)
        } else if (recordUrls.has(url)) {
          errors.push(`${prefix}.source_urls duplicates ${url}`)
        } else {
          recordUrls.add(url)
          if (!sourceRegistry.urls.has(url)) errors.push(`${prefix}.source_urls is not registered: ${url}`)
        }
      }
    }
    if (requiresEvidence && (typeof record.evidence_note !== 'string' || !record.evidence_note.trim())) {
      errors.push(`${prefix}.evidence_note is required for active disposable records`)
    }
  }

  return errors
}

export function canonicalizeDataset(document) {
  return {
    ...document,
    records: [...document.records]
      .map((record) => ({
        ...record,
        domain: normalizeDomain(record.domain) ?? record.domain,
        source_urls: [...record.source_urls].sort(),
      }))
      .sort((left, right) => left.domain.localeCompare(right.domain, 'en')),
  }
}

export function renderArtifacts(document) {
  const blockable = document.records.filter(
    (record) =>
      record.status === 'active' &&
      record.classification === 'disposable' &&
      (record.confidence === 'medium' || record.confidence === 'high')
  )

  const csvHeader = [
    'domain',
    'classification',
    'confidence',
    'provider',
    'first_seen',
    'last_verified',
    'block_subdomains',
    'status',
    'source_urls',
    'evidence_note',
  ]
  const quoteCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csvRows = document.records.map((record) =>
    csvHeader.map((key) => quoteCsv(key === 'source_urls' ? record.source_urls.join(' ') : record[key])).join(',')
  )

  const generatedRecords = `// Generated by scripts/normalize-data.mjs. Do not edit.\n` +
    `import type { DomainRecord } from '../types.js'\n\n` +
    `export const DEFAULT_DOMAIN_RECORDS = ${JSON.stringify(document.records, null, 2)} as const satisfies readonly DomainRecord[]\n`

  return {
    'data/domains.json': `${JSON.stringify(document, null, 2)}\n`,
    'data/domains.txt': `${blockable.map((record) => record.domain).join('\n')}\n`,
    'data/domains.csv': `${csvHeader.join(',')}\n${csvRows.join('\n')}\n`,
    'packages/core/src/generated/default-records.ts': generatedRecords,
  }
}

