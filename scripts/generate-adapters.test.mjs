import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('all rendered agent adapters carry the canonical instruction hash and safety contract', async () => {
  const canonical = await readFile('agent-integration/instructions.md', 'utf8')
  const hash = createHash('sha256').update(canonical).digest('hex')
  const paths = [
    'adapters/agents/codex/SKILL.md',
    'adapters/agents/claude/SKILL.md',
    'adapters/agents/cursor/disposable-email-blocklist.mdc',
  ]

  for (const path of paths) {
    const content = await readFile(path, 'utf8')
    assert.match(content, new RegExp(`canonical_sha256=${hash}`))
    assert.match(content, /server\/database boundary/)
    assert.match(content, /explicit approval/)
    assert.match(content, /Do not block Gmail\/Yahoo/)
  }
})

