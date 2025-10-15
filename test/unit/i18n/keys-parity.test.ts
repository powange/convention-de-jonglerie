import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Test de parité des nouvelles clés i18n perdu/trouvé

describe('i18n lost&found new keys parity', () => {
  const localesDir = path.resolve(__dirname, '../../../i18n/locales')

  // Lister tous les dossiers de langue
  const localeDirs = fs
    .readdirSync(localesDir)
    .filter((item) => {
      const itemPath = path.join(localesDir, item)
      return fs.statSync(itemPath).isDirectory()
    })

  const requiredKeys = ['editions.lost_found_before_start', 'editions.items_appear_when_started']
  const deprecatedKeys = [
    'editions.lost_found_after_edition',
    'editions.items_appear_after_edition',
  ]

  /**
   * Charge tous les fichiers JSON d'un dossier de langue et les fusionne
   */
  const loadLocaleFiles = (locale: string) => {
    const localeDir = path.join(localesDir, locale)
    const files = fs.readdirSync(localeDir).filter((file) => file.endsWith('.json'))

    // Fusionner tous les fichiers de cette langue
    const mergedData: any = {}
    for (const file of files) {
      const filePath = path.join(localeDir, file)
      const content = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(content)
      Object.assign(mergedData, data)
    }

    return mergedData
  }

  function get(obj: any, dotted: string) {
    return dotted.split('.').reduce((acc, k) => acc?.[k], obj)
  }

  localeDirs.forEach((locale) => {
    const json = loadLocaleFiles(locale)
    requiredKeys.forEach((key) => {
      it(`${locale} contient ${key}`, () => {
        expect(get(json, key)).toBeTypeOf('string')
      })
    })
    deprecatedKeys.forEach((key) => {
      it(`${locale} ne contient plus ${key}`, () => {
        expect(get(json, key)).toBeUndefined()
      })
    })
  })
})
