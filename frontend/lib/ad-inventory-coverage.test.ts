import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import {
  AD_SLOT_REGISTRY,
  AD_VARIANT_SHELL_CLASS,
  type AdSlotKey,
} from '@/lib/ad-config'

const FRONTEND_ROOT = path.resolve(__dirname, '..')
const CONSUMER_ROOT = path.join(FRONTEND_ROOT, 'components')

/**
 * Collect TypeScript/TSX source under a directory.
 *
 * @param directory - Absolute directory path.
 * @returns Absolute file paths.
 */
function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory)
  const files: string[] = []

  for (const entry of entries) {
    const absolute = path.join(directory, entry)
    const stats = statSync(absolute)
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(absolute))
      continue
    }
    if (absolute.endsWith('.tsx') || absolute.endsWith('.ts')) {
      files.push(absolute)
    }
  }

  return files
}

describe('ad inventory coverage', () => {
  it('reserves a min-height shell for every layout variant', () => {
    for (const [variant, shellClass] of Object.entries(AD_VARIANT_SHELL_CLASS)) {
      expect(shellClass, variant).toMatch(/min-h-\[/)
    }
  })

  it('references every registered slot key from a public consumer', () => {
    const sources = collectSourceFiles(CONSUMER_ROOT)
      .filter((filePath) => !filePath.includes(`${path.sep}ad-slot.tsx`))
      .map((filePath) => readFileSync(filePath, 'utf8'))
      .join('\n')

    const unused: AdSlotKey[] = []
    for (const slotKey of Object.keys(AD_SLOT_REGISTRY) as AdSlotKey[]) {
      if (!sources.includes(`"${slotKey}"`) && !sources.includes(`'${slotKey}'`)) {
        unused.push(slotKey)
      }
    }

    expect(unused).toEqual([])
  })
})
