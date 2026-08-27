export type DomainClassification =
  | 'disposable'
  | 'alias'
  | 'role'
  | 'free_provider'
  | 'unknown'

export type Confidence = 'low' | 'medium' | 'high'
export type DomainStatus = 'active' | 'stale' | 'disputed' | 'removed'

export interface DomainRecord {
  domain: string
  classification: DomainClassification
  confidence: Confidence
  source_urls: string[] | readonly string[]
  evidence_note: string
  provider: string | null
  first_seen: string
  last_verified: string
  block_subdomains: boolean
  status: DomainStatus
}

export interface DomainRule {
  domain: string
  block_subdomains?: boolean
}

export interface MatcherOptions {
  records?: readonly DomainRecord[]
  allowlist?: readonly DomainRule[]
  denylist?: readonly DomainRule[]
}

export interface ClassificationResult {
  input: string
  normalized_domain: string | null
  valid: boolean
  blocked: boolean
  classification: DomainClassification | 'unlisted' | 'invalid_input'
  confidence: Confidence | null
  matched_domain: string | null
  match_type: 'exact' | 'subdomain' | 'none' | 'invalid'
  source: 'allowlist' | 'denylist' | 'dataset' | 'none'
  reason: string
  record: DomainRecord | null
}

