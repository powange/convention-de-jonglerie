#!/usr/bin/env node

/**
 * Script pour générer les fichiers todo-{lang}.json à partir d'un fichier consolidé.
 *
 * Permet à Claude d'écrire UN seul fichier avec toutes les traductions,
 * puis ce script le ventile en fichiers par langue pour apply-translations.js.
 *
 * Utilisation :
 *   node scripts/translation/generate-todo-files.js [fichier]
 *
 * Fichier d'entrée (par défaut : scripts/translation/translations-all.json) :
 *   {
 *     "en": {
 *       "navigation.dark_mode": "Dark mode",
 *       "navigation.language": "Language"
 *     },
 *     "de": {
 *       "navigation.dark_mode": "Dunkelmodus",
 *       "navigation.language": "Sprache"
 *     }
 *   }
 *
 * Génère : todo-en.json, todo-de.json, etc.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REFERENCE_LANG = 'fr'

// Couleurs pour l'affichage
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
}

// Fichier d'entrée (argument ou défaut)
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    `${colors.blue}${colors.bold}=== AIDE - GÉNÉRATION DES FICHIERS TODO ===${colors.reset}\n`
  )
  console.log(`${colors.bold}Usage:${colors.reset}`)
  console.log(`  node scripts/translation/generate-todo-files.js [fichier]\n`)
  console.log(`${colors.bold}Arguments:${colors.reset}`)
  console.log(
    `  fichier    Chemin du fichier consolidé (défaut: scripts/translation/translations-all.json)\n`
  )
  console.log(`${colors.bold}Format du fichier d'entrée:${colors.reset}`)
  console.log(`  {`)
  console.log(`    "en": { "clé": "traduction", ... },`)
  console.log(`    "de": { "clé": "traduction", ... }`)
  console.log(`  }\n`)
  console.log(`${colors.bold}Résultat:${colors.reset}`)
  console.log(`  Génère todo-en.json, todo-de.json, etc. dans scripts/translation/`)
  console.log(`  Ces fichiers sont ensuite utilisés par apply-translations.js`)
  process.exit(0)
}

const inputFile =
  args.find((a) => !a.startsWith('-')) || path.join(__dirname, 'translations-all.json')
const inputPath = path.isAbsolute(inputFile) ? inputFile : path.resolve(process.cwd(), inputFile)

// Vérifier que le fichier existe
if (!fs.existsSync(inputPath)) {
  console.error(`${colors.red}❌ Fichier non trouvé: ${inputPath}${colors.reset}`)
  console.log(`${colors.yellow}💡 Créez le fichier avec la structure:${colors.reset}`)
  console.log(`  {`)
  console.log(`    "en": { "clé": "traduction" },`)
  console.log(`    "de": { "clé": "traduction" }`)
  console.log(`  }`)
  process.exit(1)
}

// Charger et parser le fichier
let consolidated
try {
  const content = fs.readFileSync(inputPath, 'utf-8')
  consolidated = JSON.parse(content)
} catch (error) {
  console.error(`${colors.red}❌ Erreur de lecture/parsing: ${error.message}${colors.reset}`)
  process.exit(1)
}

console.log(`${colors.blue}${colors.bold}=== GÉNÉRATION DES FICHIERS TODO ===${colors.reset}\n`)
console.log(`${colors.cyan}Fichier source: ${inputPath}${colors.reset}`)

// Valider la structure
const langs = Object.keys(consolidated).filter((lang) => lang !== REFERENCE_LANG)

if (langs.length === 0) {
  console.error(
    `${colors.red}❌ Aucune langue trouvée dans le fichier (la langue de référence '${REFERENCE_LANG}' est exclue)${colors.reset}`
  )
  process.exit(1)
}

console.log(`${colors.cyan}Langues trouvées: ${langs.join(', ')}${colors.reset}\n`)

// Générer les fichiers todo-{lang}.json
let totalFiles = 0
let totalTranslations = 0

for (const lang of langs) {
  const translations = consolidated[lang]

  if (!translations || typeof translations !== 'object') {
    console.log(`${colors.yellow}⚠ ${lang}: Données invalides, ignoré${colors.reset}`)
    continue
  }

  const keys = Object.keys(translations)
  if (keys.length === 0) {
    console.log(`${colors.yellow}⚠ ${lang}: Aucune clé, ignoré${colors.reset}`)
    continue
  }

  // Vérifier que les traductions ne sont pas vides
  const validTranslations = {}
  let emptyCount = 0

  for (const [key, value] of Object.entries(translations)) {
    if (!value || value.toString().trim() === '') {
      emptyCount++
    } else {
      validTranslations[key] = value
    }
  }

  if (emptyCount > 0) {
    console.log(
      `${colors.yellow}⚠ ${lang}: ${emptyCount} traduction(s) vide(s) ignorée(s)${colors.reset}`
    )
  }

  if (Object.keys(validTranslations).length === 0) {
    console.log(`${colors.yellow}⚠ ${lang}: Aucune traduction valide, ignoré${colors.reset}`)
    continue
  }

  // Écrire le fichier todo-{lang}.json
  const outputPath = path.join(__dirname, `todo-${lang}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(validTranslations, null, 2) + '\n')

  const keyCount = Object.keys(validTranslations).length
  console.log(`${colors.green}✓ todo-${lang}.json (${keyCount} clé(s))${colors.reset}`)
  totalFiles++
  totalTranslations += keyCount
}

// Résumé
console.log(`\n${colors.blue}${colors.bold}=== RÉSUMÉ ===${colors.reset}`)
console.log(`${colors.green}✓ ${totalFiles} fichier(s) généré(s)${colors.reset}`)
console.log(`${colors.green}✓ ${totalTranslations} traduction(s) au total${colors.reset}`)

if (totalFiles > 0) {
  console.log(`\n${colors.yellow}💡 Étape suivante:${colors.reset}`)
  console.log(`  ${colors.cyan}node scripts/translation/apply-translations.js${colors.reset}`)
}

// Supprimer le fichier consolidé après génération réussie
if (totalFiles > 0) {
  try {
    fs.unlinkSync(inputPath)
    console.log(
      `\n${colors.cyan}🧹 Fichier source supprimé: ${path.basename(inputPath)}${colors.reset}`
    )
  } catch {
    // Pas grave si la suppression échoue
  }
}
