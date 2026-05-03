import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PIPELINE_DIR = join(__dirname, '..')
const CONTACTS_DIR = join(__dirname, '../../../routes/app/contacts')
const SELF = fileURLToPath(import.meta.url)

const BANNED = [
  'bg-white',
  'bg-gray-',
  'text-gray-',
  'border-gray-',
  'bg-slate-',
] as const

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full)
  }
  return out
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1')
}

const files = [...walk(PIPELINE_DIR), ...walk(CONTACTS_DIR)].filter(
  (f) => f !== SELF,
)

describe('no literal color classes in pipeline + contacts', () => {
  it.each(files)('%s contains no banned color substrings', (file) => {
    const src = stripComments(readFileSync(file, 'utf8'))
    for (const bad of BANNED) {
      expect(src).not.toContain(bad)
    }
  })
})
