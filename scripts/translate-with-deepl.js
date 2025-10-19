/**
 * Script de traduction automatique avec DeepL API
 *
 * Usage:
 *   DEEPL_API_KEY=your_key node scripts/translate-with-deepl.js
 *
 * Prérequis:
 *   npm install --save-dev deepl-node
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'

import { Translator } from 'deepl-node'

const DEEPL_API_KEY = process.env.DEEPL_API_KEY

if (!DEEPL_API_KEY) {
  console.error('❌ Erreur: DEEPL_API_KEY non définie')
  console.log('Usage: DEEPL_API_KEY=your_key node scripts/translate-with-deepl.js')
  process.exit(1)
}

const translator = new Translator(DEEPL_API_KEY)

// Configuration
const SOURCE_LANG = 'FR' // Langue source (français)
const TARGET_LANGS = [
  { code: 'SV', dir: 'sv', name: 'Suédois' },
  { code: 'CS', dir: 'cs', name: 'Tchèque' },
]

const I18N_DIR = 'i18n/locales'
const SOURCE_DIR = join(I18N_DIR, 'fr')

// Fichiers à traduire
const FILES_TO_TRANSLATE = [
  'admin.json',
  'app.json',
  'auth.json',
  'common.json',
  'components.json',
  'edition.json',
  'feedback.json',
  'notifications.json',
  'permissions.json',
  'public.json',
  'ticketing.json',
]

/**
 * Traduit récursivement un objet JSON
 */
async function translateObject(obj, targetLang, path = '') {
  const result = {}

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key

    if (typeof value === 'string') {
      // Traduire la chaîne
      try {
        console.log(`  Traduction: ${currentPath}`)
        const translation = await translator.translateText(value, SOURCE_LANG, targetLang)
        result[key] = translation.text

        // Pause pour respecter les limites de taux
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`  ❌ Erreur pour ${currentPath}:`, error.message)
        result[key] = value // Garder la valeur originale en cas d'erreur
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Traduire récursivement les objets imbriqués
      result[key] = await translateObject(value, targetLang, currentPath)
    } else {
      // Conserver les autres types (arrays, null, etc.)
      result[key] = value
    }
  }

  return result
}

/**
 * Traduit un fichier JSON
 */
async function translateFile(filename, targetLangCode, targetDir) {
  const sourcePath = join(SOURCE_DIR, filename)
  const targetPath = join(I18N_DIR, targetDir, filename)

  console.log(`\n📄 Traduction de ${filename} vers ${targetDir}...`)

  try {
    // Lire le fichier source
    const sourceContent = JSON.parse(readFileSync(sourcePath, 'utf-8'))

    // Traduire
    const translatedContent = await translateObject(sourceContent, targetLangCode)

    // Écrire le fichier traduit
    writeFileSync(targetPath, JSON.stringify(translatedContent, null, 2) + '\n', 'utf-8')

    console.log(`✅ ${filename} traduit avec succès`)
  } catch (error) {
    console.error(`❌ Erreur lors de la traduction de ${filename}:`, error.message)
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🌍 Traduction automatique avec DeepL\n')
  console.log('Configuration:')
  console.log(`  Source: ${SOURCE_LANG} (Français)`)
  console.log(`  Cibles: ${TARGET_LANGS.map(l => l.name).join(', ')}`)
  console.log(`  Fichiers: ${FILES_TO_TRANSLATE.length}`)
  console.log(`  Total traductions: ${FILES_TO_TRANSLATE.length * TARGET_LANGS.length}\n`)

  // Vérifier l'utilisation de l'API
  try {
    const usage = await translator.getUsage()
    if (usage.character) {
      console.log(`📊 Utilisation DeepL:`)
      console.log(`  Caractères utilisés: ${usage.character.count.toLocaleString()}`)
      console.log(`  Limite: ${usage.character.limit.toLocaleString()}`)
      console.log(`  Restants: ${(usage.character.limit - usage.character.count).toLocaleString()}\n`)
    }
  } catch (error) {
    console.log('⚠️  Impossible de récupérer l\'utilisation de l\'API\n')
  }

  // Traduire pour chaque langue cible
  for (const targetLang of TARGET_LANGS) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🇸🇪🇨🇿 TRADUCTION VERS ${targetLang.name.toUpperCase()} (${targetLang.code})`)
    console.log('='.repeat(60))

    for (const filename of FILES_TO_TRANSLATE) {
      await translateFile(filename, targetLang.code, targetLang.dir)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('✅ TRADUCTION TERMINÉE')
  console.log('='.repeat(60))
  console.log('\nProchaines étapes:')
  console.log('1. Vérifier les traductions générées')
  console.log('2. Faire réviser par un locuteur natif si possible')
  console.log('3. Tester l\'application: npm run dev')
  console.log('4. Vérifier la parité: npm run check-translations')
}

// Exécution
main().catch(console.error)
