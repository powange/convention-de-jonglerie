#!/usr/bin/env tsx
/**
 * Généralise la transformation des fichiers de locales:
 *  - Convertit les clés 'a.b.c': "val" en structure imbriquée { a: { b: { c: 'val' }}}
 *  - Préserve et fusionne les objets déjà imbriqués
 *  - Trie récursivement les clés
 *  - Accepte une liste de locales en arguments, sinon toutes.
 *
 * Usage:
 *   npm run i18n:nest            # toutes les locales
 *   npm run i18n:nest -- en fr   # locales spécifiques
 *   npm run i18n:nest:da         # alias pour da
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const localesDir = resolve(__dirname, '../i18n/locales')

function isPlainObject(v: any): v is Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    const sv = source[key]
    if (isPlainObject(sv)) {
      if (!isPlainObject(target[key])) target[key] = {}
      deepMerge(target[key], sv)
    } else {
      target[key] = sv
    }
  }
  return target
}

function sortKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeys)
  if (!isPlainObject(obj)) return obj
  const out: Record<string, any> = {}
  for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k])
  return out
}

interface Collision {
  path: string
  existing: any
  incoming: any
}

function transformLocale(filePath: string, allowCollisions: boolean) {
  const raw = readFileSync(filePath, 'utf8')
  let data: Record<string, any>
  try {
    data = JSON.parse(raw)
  } catch (e) {
    console.error('JSON invalide:', filePath)
    return false
  }
  const result: Record<string, any> = {}
  const collisions: Collision[] = []
  for (const [key, value] of Object.entries(data)) {
    if (!key.includes('.')) {
      if (isPlainObject(value)) {
        result[key] = deepMerge(result[key] || {}, value)
      } else {
        result[key] = value
      }
      continue
    }
    const parts = key.split('.')
    let cursor = result
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      const last = i === parts.length - 1
      if (last) {
        const existing = cursor[p]
        const incoming = value
        const existingIsObj = isPlainObject(existing)
        const incomingIsObj = isPlainObject(incoming)
        let collision = false
        if (existing !== undefined) {
          if (existingIsObj && !incomingIsObj) collision = true
          else if (!existingIsObj && incomingIsObj) collision = true
          else if (!existingIsObj && !incomingIsObj && existing !== incoming) collision = true
        }
        if (collision) {
          collisions.push({ path: parts.join('.'), existing, incoming })
          if (!allowCollisions) continue
          // en mode permissif on ne change rien (on garde la valeur existante)
        } else {
          if (incomingIsObj) {
            if (!existingIsObj) cursor[p] = {}
            deepMerge(cursor[p], incoming)
          } else {
            cursor[p] = incoming
          }
        }
      } else {
        if (cursor[p] !== undefined && !isPlainObject(cursor[p])) {
          collisions.push({
            path: parts.slice(0, i + 1).join('.'),
            existing: cursor[p],
            incoming: {},
          })
          if (!allowCollisions) {
            // abandon descente pour cette clé
            break
          } else {
            // ne pas écraser la valeur primitive ; on ne peut pas descendre davantage
            break
          }
        } else {
          if (!isPlainObject(cursor[p])) cursor[p] = {}
          cursor = cursor[p]
        }
      }
    }
  }
  if (collisions.length && !allowCollisions) {
    console.error(`Collisions détectées dans ${filePath}:`)
    for (const c of collisions) {
      console.error(
        ` - ${c.path}: existant=${JSON.stringify(c.existing)} / entrant=${JSON.stringify(c.incoming)}`
      )
    }
    console.error(
      'Abandon. Relancez avec --allow-collisions pour ignorer et conserver les valeurs existantes.'
    )
    return false
  }
  if (collisions.length && allowCollisions) {
    console.warn(
      `Collisions ignorées (${collisions.length}) dans ${filePath} (valeurs existantes conservées).`
    )
  }
  const sorted = sortKeys(result)
  writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8')
  return true
}
const rawArgs = process.argv.slice(2)
const allowCollisions = rawArgs.includes('--allow-collisions')
const args = rawArgs.filter((a) => !a.startsWith('--'))
let targets: string[]
if (args.length) {
  targets = args.map((a) => a.replace(/\.json$/, ''))
} else {
  targets = readdirSync(localesDir)
    .filter((f) => extname(f) === '.json')
    .map((f) => f.replace(/\.json$/, ''))
}

let ok = 0
let fail = 0
for (const locale of targets) {
  const path = resolve(localesDir, `${locale}.json`)
  const success = transformLocale(path, allowCollisions)
  if (success) {
    ok++
    console.log(`✔ ${locale}`)
  } else {
    fail++
    console.warn(`✖ ${locale}`)
  }
}
console.log(`Terminé. Succès: ${ok}, Échecs: ${fail}`)
if (fail) process.exit(1)
