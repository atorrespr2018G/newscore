import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const messagesDir = path.join(__dirname, '..', 'messages')
const locales = ['en', 'es']
const namespaces = ['common', 'navigation', 'home', 'auth']

function flattenKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix]
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    return flattenKeys(nested, nextPrefix)
  })
}

async function loadNamespace(locale, namespace) {
  const filePath = path.join(messagesDir, locale, `${namespace}.json`)
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

function diffKeys(base, compare) {
  return [...base].filter((key) => !compare.has(key)).sort()
}

const baseKeysByNamespace = new Map()

for (const namespace of namespaces) {
  const baseMessages = await loadNamespace('en', namespace)
  baseKeysByNamespace.set(namespace, new Set(flattenKeys(baseMessages)))
}

let hasErrors = false

for (const locale of locales.slice(1)) {
  for (const namespace of namespaces) {
    const messages = await loadNamespace(locale, namespace)
    const localeKeys = new Set(flattenKeys(messages))
    const baseKeys = baseKeysByNamespace.get(namespace)

    const missing = diffKeys(baseKeys, localeKeys)
    const extra = diffKeys(localeKeys, baseKeys)

    if (missing.length > 0 || extra.length > 0) {
      hasErrors = true
      console.error(`[${locale}/${namespace}]`)
      if (missing.length > 0) console.error(`  missing: ${missing.join(', ')}`)
      if (extra.length > 0) console.error(`  extra: ${extra.join(', ')}`)
    }
  }
}

if (hasErrors) {
  process.exit(1)
}

console.log('i18n message files are in sync for enabled locales.')
