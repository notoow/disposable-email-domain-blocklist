import { DomainMatcher } from './matcher.js'
import { DEFAULT_DOMAIN_RECORDS } from './generated/default-records.js'
import type { ClassificationResult, MatcherOptions } from './types.js'

export { DomainMatcher } from './matcher.js'
export { normalizeDomain, parseEmailDomain } from './normalize.js'
export { DEFAULT_DOMAIN_RECORDS }
export type {
  ClassificationResult,
  Confidence,
  DomainClassification,
  DomainRecord,
  DomainRule,
  DomainStatus,
  MatcherOptions,
} from './types.js'

export function classifyEmail(input: string, options?: MatcherOptions): ClassificationResult {
  return new DomainMatcher(options).classifyEmail(input)
}

export function classifyDomain(input: string, options?: MatcherOptions): ClassificationResult {
  return new DomainMatcher(options).classifyDomain(input)
}

export function isDisposableEmail(input: string, options?: MatcherOptions): boolean {
  return new DomainMatcher(options).isDisposableEmail(input)
}

export function getDomainRecord(domain: string) {
  return new DomainMatcher().getDomainRecord(domain)
}
