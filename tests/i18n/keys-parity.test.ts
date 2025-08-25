import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Test de parité des nouvelles clés i18n perdu/trouvé

describe('i18n lost&found new keys parity', () => {
  const localesDir = path.resolve(__dirname, '../../i18n/locales')
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'))
  const requiredKeys = [
    'editions.lost_found_before_start',
    'editions.items_appear_when_started'
  ]
  const deprecatedKeys = [
    'editions.lost_found_after_edition',
    'editions.items_appear_after_edition'
  ]

  const load = (file: string) => JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf-8'))

  function get(obj: any, dotted: string) {
    return dotted.split('.').reduce((acc, k) => acc?.[k], obj)
  }

  files.forEach(file => {
    const json = load(file)
    requiredKeys.forEach(key => {
      it(`${file} contient ${key}`, () => {
        expect(get(json, key)).toBeTypeOf('string')
      })
    })
    deprecatedKeys.forEach(key => {
      it(`${file} ne contient plus ${key}`, () => {
        expect(get(json, key)).toBeUndefined()
      })
    })
  })
})
