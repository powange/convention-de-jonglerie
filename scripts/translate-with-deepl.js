/**
 * Script de traduction automatique avec DeepL API
 *
 * Usage:
 *   node scripts/translate-with-deepl.js [options]
 *
 *   La clé API DeepL est lue automatiquement depuis le fichier .env
 *   Vous pouvez aussi la fournir via variable d'environnement :
 *   DEEPL_API_KEY=your_key node scripts/translate-with-deepl.js [options]
 *
 * Options:
 *   --force       Retraduire toutes les clés (même celles déjà traduites)
 *   --help        Afficher l'aide
 *
 * Modes:
 *   - Par défaut (incrémental): Traduit uniquement les nouvelles clés
 *   - Avec --force: Retraduit tout en écrasant les traductions existantes
 *
 * Prérequis:
 *   npm install --save-dev deepl-node dotenv
 */

import 'dotenv/config'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

import { Translator } from 'deepl-node'

// Parse command line arguments
const args = process.argv.slice(2)
const FORCE_MODE = args.includes('--force')
const SHOW_HELP = args.includes('--help')

if (SHOW_HELP) {
  console.log(`
🌍 Script de traduction automatique DeepL

Usage:
  node scripts/translate-with-deepl.js [options]

La clé API DeepL est lue automatiquement depuis le fichier .env
Assurez-vous que DEEPL_API_KEY est définie dans votre .env

Options:
  --force       Retraduire toutes les clés (écrase les traductions existantes)
  --help        Afficher cette aide

Modes:
  • Mode incrémental (défaut): Traduit uniquement les nouvelles clés
    - Préserve les traductions existantes
    - Économise les caractères DeepL
    - Conserve les corrections manuelles

  • Mode force (--force): Retraduit tout
    - Écrase toutes les traductions existantes
    - Utilise plus de caractères DeepL
    - À utiliser pour mettre à jour en masse

Exemples:
  # Mode incrémental (recommandé) - lit .env automatiquement
  node scripts/translate-with-deepl.js

  # Mode force
  node scripts/translate-with-deepl.js --force

  # Avec variable d'environnement (optionnel)
  DEEPL_API_KEY=your_key node scripts/translate-with-deepl.js
`)
  process.exit(0)
}

const DEEPL_API_KEY = process.env.DEEPL_API_KEY

if (!DEEPL_API_KEY) {
  console.error('❌ Erreur: DEEPL_API_KEY non définie')
  console.log('\nAssurez-vous que votre fichier .env contient :')
  console.log('  DEEPL_API_KEY="votre_clé_deepl"')
  console.log('\nOu fournissez-la via variable d\'environnement :')
  console.log('  DEEPL_API_KEY=your_key node scripts/translate-with-deepl.js')
  console.log('\nPour obtenir une clé gratuite : https://www.deepl.com/pro-api')
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

// Statistiques de traduction
const stats = {
  translated: 0,
  preserved: 0,
  errors: 0,
}

/**
 * Traduit récursivement un objet JSON avec mode incrémental
 */
async function translateObject(obj, targetLang, path = '', existingObj = {}) {
  const result = {}

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key
    const existingValue = existingObj[key]

    if (typeof value === 'string') {
      // Vérifier si on doit traduire ou préserver
      const shouldTranslate = FORCE_MODE || !existingValue || typeof existingValue !== 'string'

      if (shouldTranslate) {
        // Traduire la chaîne
        try {
          console.log(`  🔄 Traduction: ${currentPath}`)
          const translation = await translator.translateText(value, SOURCE_LANG, targetLang)
          result[key] = translation.text
          stats.translated++

          // Pause pour respecter les limites de taux
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`  ❌ Erreur pour ${currentPath}:`, error.message)
          result[key] = existingValue || value // Garder la valeur existante ou originale
          stats.errors++
        }
      } else {
        // Préserver la traduction existante
        console.log(`  ✓ Préservé: ${currentPath}`)
        result[key] = existingValue
        stats.preserved++
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Traduire récursivement les objets imbriqués
      result[key] = await translateObject(
        value,
        targetLang,
        currentPath,
        existingValue && typeof existingValue === 'object' ? existingValue : {}
      )
    } else {
      // Conserver les autres types (arrays, null, etc.)
      result[key] = value
    }
  }

  return result
}

/**
 * Traduit un fichier JSON avec mode incrémental
 */
async function translateFile(filename, targetLangCode, targetDir) {
  const sourcePath = join(SOURCE_DIR, filename)
  const targetPath = join(I18N_DIR, targetDir, filename)

  console.log(`\n📄 Traduction de ${filename} vers ${targetDir}...`)

  // Statistiques locales pour ce fichier
  const fileStats = { translated: 0, preserved: 0, errors: 0 }
  const beforeStats = { ...stats }

  try {
    // Lire le fichier source
    const sourceContent = JSON.parse(readFileSync(sourcePath, 'utf-8'))

    // Lire le fichier cible existant (si existe et mode incrémental)
    let existingContent = {}
    if (!FORCE_MODE && existsSync(targetPath)) {
      try {
        existingContent = JSON.parse(readFileSync(targetPath, 'utf-8'))
        console.log(`  ℹ️  Fichier existant détecté - Mode incrémental activé`)
      } catch (error) {
        console.log(`  ⚠️  Impossible de lire le fichier existant - Traduction complète`)
      }
    }

    // Traduire avec fusion incrémentale
    const translatedContent = await translateObject(sourceContent, targetLangCode, '', existingContent)

    // Calculer les stats pour ce fichier
    fileStats.translated = stats.translated - beforeStats.translated
    fileStats.preserved = stats.preserved - beforeStats.preserved
    fileStats.errors = stats.errors - beforeStats.errors

    // Écrire le fichier traduit
    writeFileSync(targetPath, JSON.stringify(translatedContent, null, 2) + '\n', 'utf-8')

    console.log(`✅ ${filename} traité avec succès`)
    console.log(`   📊 Nouvelles traductions: ${fileStats.translated} | Préservées: ${fileStats.preserved} | Erreurs: ${fileStats.errors}`)
  } catch (error) {
    console.error(`❌ Erreur lors de la traduction de ${filename}:`, error.message)
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🌍 Traduction automatique avec DeepL\n')
  console.log(`Mode: ${FORCE_MODE ? '⚡ FORCE (retraduit tout)' : '🔄 INCRÉMENTAL (nouvelles clés uniquement)'}`)
  console.log('\nConfiguration:')
  console.log(`  Source: ${SOURCE_LANG} (Français)`)
  console.log(`  Cibles: ${TARGET_LANGS.map(l => l.name).join(', ')}`)
  console.log(`  Fichiers: ${FILES_TO_TRANSLATE.length}`)
  console.log(`  Total fichiers à traiter: ${FILES_TO_TRANSLATE.length * TARGET_LANGS.length}\n`)

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

  // Réinitialiser les statistiques
  stats.translated = 0
  stats.preserved = 0
  stats.errors = 0

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
  console.log('\n📊 Statistiques globales:')
  console.log(`  ✨ Nouvelles traductions: ${stats.translated}`)
  console.log(`  ✓  Traductions préservées: ${stats.preserved}`)
  console.log(`  ❌ Erreurs: ${stats.errors}`)
  console.log(`  📝 Total de clés traitées: ${stats.translated + stats.preserved + stats.errors}`)

  if (stats.preserved > 0 && !FORCE_MODE) {
    console.log('\n💡 Astuce:')
    console.log('   Les traductions existantes ont été préservées.')
    console.log('   Pour tout retraduire, utilisez: --force')
  }

  console.log('\nProchaines étapes:')
  console.log('1. Vérifier les nouvelles traductions générées')
  console.log('2. Faire réviser par un locuteur natif si possible')
  console.log('3. Tester l\'application: npm run dev')
  console.log('4. Vérifier la parité: npm run check-translations')
}

// Exécution
main().catch(console.error)
