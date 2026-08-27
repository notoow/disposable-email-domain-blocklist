import { DEFAULT_DOMAIN_RECORDS } from './generated/default-records.js'
import { normalizeDomain, parseEmailDomain } from './normalize.js'
import type {
  ClassificationResult,
  DomainRecord,
  DomainRule,
  MatcherOptions,
} from './types.js'

type NormalizedRule<T> = T & { domain: string; block_subdomains: boolean }
type Match<T> = { value: NormalizedRule<T>; type: 'exact' | 'subdomain' }

function normalizeRules<T extends DomainRule>(rules: readonly T[], label: string): NormalizedRule<T>[] {
  return rules.map((rule) => {
    const domain = normalizeDomain(rule.domain)
    if (!domain || domain !== rule.domain.toLowerCase().replace(/\.$/, '')) {
      throw new TypeError(`${label} contains an invalid or non-canonical domain`)
    }
    return { ...rule, domain, block_subdomains: rule.block_subdomains ?? false }
  })
}

function findMatch<T extends DomainRule>(domain: string, rules: readonly NormalizedRule<T>[]): Match<T> | null {
  let best: Match<T> | null = null

  for (const rule of rules) {
    const exact = domain === rule.domain
    const subdomain = rule.block_subdomains && domain.endsWith(`.${rule.domain}`)
    if (!exact && !subdomain) continue

    if (!best || rule.domain.length > best.value.domain.length) {
      best = { value: rule, type: exact ? 'exact' : 'subdomain' }
    }
  }

  return best
}

function invalidResult(input: string): ClassificationResult {
  return {
    input,
    normalized_domain: null,
    valid: false,
    blocked: false,
    classification: 'invalid_input',
    confidence: null,
    matched_domain: null,
    match_type: 'invalid',
    source: 'none',
    reason: 'input is not a supported email address or domain',
    record: null,
  }
}

function isDefaultBlockable(record: DomainRecord): boolean {
  return (
    record.status === 'active' &&
    record.classification === 'disposable' &&
    (record.confidence === 'medium' || record.confidence === 'high')
  )
}

export class DomainMatcher {
  readonly #records: NormalizedRule<DomainRecord>[]
  readonly #allowlist: NormalizedRule<DomainRule>[]
  readonly #denylist: NormalizedRule<DomainRule>[]

  constructor(options: MatcherOptions = {}) {
    this.#records = normalizeRules(options.records ?? DEFAULT_DOMAIN_RECORDS, 'records')
    this.#allowlist = normalizeRules(options.allowlist ?? [], 'allowlist')
    this.#denylist = normalizeRules(options.denylist ?? [], 'denylist')
  }

  classifyEmail(input: string): ClassificationResult {
    const domain = parseEmailDomain(input)
    return domain ? this.#classifyNormalized(input, domain) : invalidResult(input)
  }

  classifyDomain(input: string): ClassificationResult {
    const domain = normalizeDomain(input)
    return domain ? this.#classifyNormalized(input, domain) : invalidResult(input)
  }

  isDisposableEmail(input: string): boolean {
    return this.classifyEmail(input).blocked
  }

  getDomainRecord(input: string): DomainRecord | null {
    const domain = normalizeDomain(input)
    if (!domain) return null
    return this.#records.find((record) => record.domain === domain) ?? null
  }

  #classifyNormalized(input: string, domain: string): ClassificationResult {
    const allow = findMatch(domain, this.#allowlist)
    if (allow) {
      return {
        input,
        normalized_domain: domain,
        valid: true,
        blocked: false,
        classification: 'unlisted',
        confidence: null,
        matched_domain: allow.value.domain,
        match_type: allow.type,
        source: 'allowlist',
        reason: 'matched custom allowlist',
        record: null,
      }
    }

    const deny = findMatch(domain, this.#denylist)
    if (deny) {
      return {
        input,
        normalized_domain: domain,
        valid: true,
        blocked: true,
        classification: 'unknown',
        confidence: null,
        matched_domain: deny.value.domain,
        match_type: deny.type,
        source: 'denylist',
        reason: 'matched custom denylist',
        record: null,
      }
    }

    const dataset = findMatch(domain, this.#records)
    if (dataset) {
      const record = dataset.value
      const blocked = isDefaultBlockable(record)
      return {
        input,
        normalized_domain: domain,
        valid: true,
        blocked,
        classification: record.classification,
        confidence: record.confidence,
        matched_domain: record.domain,
        match_type: dataset.type,
        source: 'dataset',
        reason: blocked
          ? `active disposable domain with ${record.confidence} confidence`
          : `dataset classification ${record.classification} is not blocked by default`,
        record,
      }
    }

    return {
      input,
      normalized_domain: domain,
      valid: true,
      blocked: false,
      classification: 'unlisted',
      confidence: null,
      matched_domain: null,
      match_type: 'none',
      source: 'none',
      reason: 'domain is not listed',
      record: null,
    }
  }
}

