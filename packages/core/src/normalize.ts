import { isIP } from 'node:net'
import { domainToASCII } from 'node:url'

const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().replace(/\.$/, '')
  if (!trimmed || trimmed.includes('@') || trimmed.includes('*')) return null

  const domain = domainToASCII(trimmed).toLowerCase()
  if (!domain || domain.length > 253 || isIP(domain) !== 0) return null

  const labels = domain.split('.')
  if (labels.length < 2 || labels.some((label) => !LABEL_PATTERN.test(label))) return null
  return domain
}

export function parseEmailDomain(input: string): string | null {
  const email = input.trim()
  if (!email || email.length > 254) return null

  const firstAt = email.indexOf('@')
  if (firstAt <= 0 || firstAt !== email.lastIndexOf('@')) return null

  const localPart = email.slice(0, firstAt)
  const domainPart = email.slice(firstAt + 1)
  if (localPart.length > 64 || /\s|[\u0000-\u001f\u007f]/u.test(localPart)) return null
  return normalizeDomain(domainPart)
}

