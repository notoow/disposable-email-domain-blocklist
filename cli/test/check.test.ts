import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import test from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { runCli, type CliIo } from '../src/index.js'

function capture() {
  const output: string[] = []
  const errors: string[] = []
  const io: CliIo = {
    writeLine: (line) => output.push(line),
    writeError: (line) => errors.push(line),
  }
  return { io, output, errors }
}

test('check returns blocked disposable result with human-readable output and exit 0', async () => {
  const captured = capture()
  assert.equal(await runCli(['check', 'user@vtmpj.com'], captured.io), 0)
  assert.match(captured.output[0] ?? '', /^BLOCKED vtmpj\.com \(disposable, confidence=high, match=exact\)/)
  assert.deepEqual(captured.errors, [])
})

test('check --json has stable fields and does not include the raw email', async () => {
  const captured = capture()
  assert.equal(await runCli(['check', 'user@gmail.com', '--json'], captured.io), 0)
  assert.deepEqual(JSON.parse(captured.output[0] ?? ''), {
    schema_version: 1,
    valid: true,
    blocked: false,
    normalized_domain: 'gmail.com',
    classification: 'unlisted',
    confidence: null,
    matched_domain: null,
    match_type: 'none',
    reason: 'domain is not listed',
  })
  assert.doesNotMatch(captured.output[0] ?? '', /user@/)
})

test('check returns exit 2 for malformed input and missing arguments', async () => {
  const malformed = capture()
  assert.equal(await runCli(['check', 'not-an-email'], malformed.io), 2)
  assert.match(malformed.output[0] ?? '', /^INVALID /)

  const missing = capture()
  assert.equal(await runCli(['check'], missing.io), 2)
  assert.match(missing.errors[0] ?? '', /^Usage:/)
})

test('init supabase generates a migration without overwriting by default', async () => {
  const captured = capture()
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'disposable-email-cli-'))
  const outputPath = join(temporaryDirectory, 'disposable-email-guard.sql')
  try {
    assert.equal(await runCli(['init', 'supabase', '--output', outputPath], captured.io), 0)
    assert.match(captured.output[0] ?? '', /Generated .*disposable-email-guard\.sql/)

    const second = capture()
    assert.equal(await runCli(['init', 'supabase', '--output', outputPath], second.io), 2)
    assert.match(second.errors[0] ?? '', /Refusing to overwrite/)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test('install-agent writes all adapters transactionally and refuses conflicts', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'disposable-email-agents-'))
  try {
    const captured = capture()
    assert.equal(
      await runCli(['install-agent', '--target', 'all', '--output', temporaryDirectory], captured.io),
      0
    )
    assert.match(captured.output[0] ?? '', /Installed agent adapters: codex, claude, cursor/)

    const second = capture()
    assert.equal(
      await runCli(['install-agent', '--target', 'all', '--output', temporaryDirectory], second.io),
      2
    )
    assert.match(second.errors[0] ?? '', /Refusing to overwrite/)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})
