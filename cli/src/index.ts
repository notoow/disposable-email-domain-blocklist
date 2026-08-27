import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { renderSupabaseMigration } from '@internal/disposable-email-supabase'
import { AGENT_ADAPTERS } from './generated/adapters.js'
import {
  classifyDomain,
  classifyEmail,
  type ClassificationResult,
} from '@internal/disposable-email-core'

export interface CliIo {
  writeLine(line: string): void
  writeError(line: string): void
}

export const defaultCliIo: CliIo = {
  writeLine: (line) => console.log(line),
  writeError: (line) => console.error(line),
}

function usage(): string {
  return [
    'Usage:',
    '  disposable-email check <email-or-domain> [--json]',
    '  disposable-email init supabase [--output <path>] [--force]',
    '  disposable-email install-agent --target codex|claude|cursor|all [--output <dir>] [--force]',
  ].join('\n')
}

function jsonResult(result: ClassificationResult) {
  return {
    schema_version: 1,
    valid: result.valid,
    blocked: result.blocked,
    normalized_domain: result.normalized_domain,
    classification: result.classification,
    confidence: result.confidence,
    matched_domain: result.matched_domain,
    match_type: result.match_type,
    reason: result.reason,
  }
}

function textResult(result: ClassificationResult): string {
  if (!result.valid) return `INVALID ${result.reason}`

  const verdict = result.blocked ? 'BLOCKED' : 'ALLOWED'
  const details = [
    result.classification,
    result.confidence ? `confidence=${result.confidence}` : null,
    result.match_type !== 'none' ? `match=${result.match_type}` : null,
  ].filter(Boolean)
  return `${verdict} ${result.normalized_domain} (${details.join(', ')}) — ${result.reason}`
}

async function initSupabase(argv: readonly string[], io: CliIo): Promise<number> {
  const options = argv.slice(2)
  let outputPath = resolve(process.cwd(), 'supabase/migrations/20260827000000_disposable_email_guard.sql')
  let force = false

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index]
    if (option === '--force') {
      force = true
    } else if (option === '--output') {
      const candidate = options[index + 1]
      if (!candidate || candidate.startsWith('-')) {
        io.writeError('init supabase: --output requires a path')
        return 2
      }
      outputPath = resolve(process.cwd(), candidate)
      index += 1
    } else {
      io.writeError(`init supabase: unknown option ${option}`)
      return 2
    }
  }

  if (!force) {
    try {
      await access(outputPath)
      io.writeError(`Refusing to overwrite existing file: ${outputPath}`)
      return 2
    } catch {
      // The output path is available.
    }
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, renderSupabaseMigration(), 'utf8')
  io.writeLine(`Generated ${outputPath}`)
  return 0
}

async function installAgent(argv: readonly string[], io: CliIo): Promise<number> {
  const options = argv.slice(1)
  let target: keyof typeof AGENT_ADAPTERS | 'all' | null = null
  let outputRoot = process.cwd()
  let force = false

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index]
    if (option === '--target') {
      const candidate = options[index + 1]
      if (candidate !== 'codex' && candidate !== 'claude' && candidate !== 'cursor' && candidate !== 'all') {
        io.writeError('install-agent: --target must be codex, claude, cursor, or all')
        return 2
      }
      target = candidate
      index += 1
    } else if (option === '--output') {
      const candidate = options[index + 1]
      if (!candidate || candidate.startsWith('-')) {
        io.writeError('install-agent: --output requires a directory')
        return 2
      }
      outputRoot = resolve(process.cwd(), candidate)
      index += 1
    } else if (option === '--force') {
      force = true
    } else {
      io.writeError(`install-agent: unknown option ${option}`)
      return 2
    }
  }

  if (!target) {
    io.writeError('install-agent: --target is required')
    return 2
  }

  const targets = target === 'all' ? Object.keys(AGENT_ADAPTERS) : [target]
  const files = targets.map((name) => ({
    name,
    path: resolve(outputRoot, AGENT_ADAPTERS[name as keyof typeof AGENT_ADAPTERS].relativePath),
    content: AGENT_ADAPTERS[name as keyof typeof AGENT_ADAPTERS].content,
  }))

  if (!force) {
    for (const file of files) {
      try {
        await access(file.path)
        io.writeError(`Refusing to overwrite existing file: ${file.path}`)
        return 2
      } catch {
        // The target file is available.
      }
    }
  }

  for (const file of files) {
    await mkdir(dirname(file.path), { recursive: true })
    await writeFile(file.path, file.content, 'utf8')
  }
  io.writeLine(`Installed agent adapters: ${targets.join(', ')}`)
  return 0
}

export async function runCli(argv: readonly string[], io: CliIo = defaultCliIo): Promise<number> {
  try {
    if (argv[0] === 'init' && argv[1] === 'supabase') {
      return await initSupabase(argv, io)
    }
    if (argv[0] === 'install-agent') {
      return await installAgent(argv, io)
    }

    if (argv[0] !== 'check') {
      io.writeError(usage())
      return 2
    }

    const json = argv.includes('--json')
    const positional = argv.slice(1).filter((argument) => argument !== '--json')
    if (positional.length !== 1 || positional[0] === undefined || positional[0].startsWith('-')) {
      io.writeError(usage())
      return 2
    }

    const input = positional[0]
    const result = input.includes('@') ? classifyEmail(input) : classifyDomain(input)
    io.writeLine(json ? JSON.stringify(jsonResult(result)) : textResult(result))
    return result.valid ? 0 : 2
  } catch (error) {
    io.writeError(error instanceof Error ? `Unexpected error: ${error.name}` : 'Unexpected error')
    return 1
  }
}
