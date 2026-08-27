import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { canonicalizeDataset, renderArtifacts, validateDataset } from './data-lib.mjs'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const mode = process.argv[2]

if (mode !== '--check' && mode !== '--write') {
  console.error('Usage: node scripts/normalize-data.mjs --check|--write')
  process.exitCode = 2
} else {
  const datasetPath = resolve(root, 'data/domains.json')
  const sourcesPath = resolve(root, 'data/sources.json')
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'))
  const sources = JSON.parse(await readFile(sourcesPath, 'utf8'))
  const canonical = canonicalizeDataset(dataset)
  const errors = validateDataset(canonical, sources)

  if (errors.length > 0) {
    for (const error of errors) console.error(`data error: ${error}`)
    process.exitCode = 1
  } else {
    const artifacts = renderArtifacts(canonical)
    const stale = []

    for (const [relativePath, expected] of Object.entries(artifacts)) {
      const outputPath = resolve(root, relativePath)
      if (mode === '--write') {
        await writeFile(outputPath, expected, 'utf8')
      } else {
        let actual = null
        try {
          actual = await readFile(outputPath, 'utf8')
        } catch {
          // Missing generated artifacts are reported as stale below.
        }
        if (actual !== expected) stale.push(relativePath)
      }
    }

    if (stale.length > 0) {
      for (const path of stale) console.error(`stale generated artifact: ${path}`)
      console.error('Run pnpm data:write and commit the result.')
      process.exitCode = 1
    } else {
      console.log(mode === '--write' ? 'Data artifacts generated.' : 'Data artifacts are valid and current.')
    }
  }
}
