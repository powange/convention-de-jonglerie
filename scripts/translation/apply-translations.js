#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { LOCALES_DIR, loadLocaleFiles, writeLocaleFiles } from './shared-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIG_FILE = path.join(__dirname, 'translations-config.json')

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

/**
 * Définit une valeur dans un objet imbriqué
 */
function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.')
  let current = obj

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {}
    }
    current = current[keys[i]]
  }

  current[keys[keys.length - 1]] = value
}

/**
 * Obtient la valeur d'une clé dans un objet imbriqué
 */
function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined
  }, obj)
}

/**
 * Charge le fichier de configuration des traductions
 */
function loadTranslationsConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(
      `${colors.red}❌ Fichier de configuration non trouvé: ${CONFIG_FILE}${colors.reset}`
    )
    console.log(
      `${colors.yellow}💡 Lancez d'abord: node scripts/translation/list-todo-keys.js${colors.reset}`
    )
    process.exit(1)
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(content)

    if (!config.translations) {
      console.error(
        `${colors.red}❌ Structure invalide: 'translations' manquant dans le fichier de config${colors.reset}`
      )
      process.exit(1)
    }

    return config.translations
  } catch (error) {
    console.error(
      `${colors.red}❌ Erreur lors du chargement de la configuration: ${error.message}${colors.reset}`
    )
    process.exit(1)
  }
}

/**
 * Applique les traductions à tous les fichiers de langue
 */
function applyTranslations() {
  console.log(`${colors.blue}${colors.bold}=== APPLICATION DES TRADUCTIONS ===${colors.reset}\n`)

  const translations = loadTranslationsConfig()
  const keyPaths = Object.keys(translations)

  if (keyPaths.length === 0) {
    console.log(
      `${colors.yellow}⚠️  Aucune traduction trouvée dans le fichier de configuration${colors.reset}`
    )
    return
  }

  console.log(`${colors.cyan}Clés à traiter: ${keyPaths.length}${colors.reset}`)
  console.log(`${colors.cyan}Fichier de configuration: ${CONFIG_FILE}${colors.reset}\n`)

  // Obtenir la liste des dossiers de langue
  const languageFiles = fs
    .readdirSync(LOCALES_DIR)
    .filter((item) => {
      const itemPath = path.join(LOCALES_DIR, item)
      return fs.statSync(itemPath).isDirectory()
    })
    .sort()

  let totalUpdates = 0
  let totalFiles = 0

  // Traiter chaque langue
  for (const lang of languageFiles) {
    console.log(`${colors.bold}Traitement de ${lang}/:${colors.reset}`)

    let data
    let fileModified = false

    try {
      data = loadLocaleFiles(lang)
      if (!data) {
        console.log(`  ${colors.red}✗ Erreur: Aucun fichier de traduction trouvé${colors.reset}`)
        continue
      }
    } catch (error) {
      console.log(`  ${colors.red}✗ Erreur de lecture: ${error.message}${colors.reset}`)
      continue
    }

    // Appliquer chaque traduction pour cette langue
    for (const keyPath of keyPaths) {
      const translation = translations[keyPath][lang]

      if (!translation) {
        console.log(`  ${colors.yellow}⚠ ${keyPath}: Pas de traduction pour ${lang}${colors.reset}`)
        continue
      }

      // Vérifier si la traduction est encore un placeholder
      if (translation.startsWith('TODO:')) {
        console.log(
          `  ${colors.yellow}⚠ ${keyPath}: Traduction non complétée (${translation})${colors.reset}`
        )
        continue
      }

      const currentValue = getNestedValue(data, keyPath)

      // Vérifier si la clé existe et commence par [TODO]
      if (!currentValue) {
        console.log(`  ${colors.yellow}⚠ ${keyPath}: Clé non trouvée${colors.reset}`)
        continue
      }

      if (!currentValue.toString().startsWith('[TODO]')) {
        console.log(`  ${colors.blue}ℹ ${keyPath}: Déjà traduit ("${currentValue}")${colors.reset}`)
        continue
      }

      // Appliquer la traduction
      setNestedValue(data, keyPath, translation)
      console.log(
        `  ${colors.green}✓ ${keyPath}: "${currentValue}" → "${translation}"${colors.reset}`
      )
      fileModified = true
      totalUpdates++
    }

    // Sauvegarder les fichiers si modifiés
    if (fileModified) {
      try {
        const updatedFiles = writeLocaleFiles(lang, data)
        console.log(
          `  ${colors.green}✓ ${updatedFiles} fichier(s) de domaine sauvegardé(s)${colors.reset}`
        )
        totalFiles++
      } catch (error) {
        console.log(`  ${colors.red}✗ Erreur de sauvegarde: ${error.message}${colors.reset}`)
      }
    } else {
      console.log(`  ${colors.blue}ℹ Aucune modification nécessaire${colors.reset}`)
    }

    console.log() // Ligne vide entre les langues
  }

  // Résumé final
  console.log(`${colors.blue}${colors.bold}=== RÉSUMÉ ===${colors.reset}`)
  console.log(`${colors.green}✓ ${totalUpdates} traduction(s) appliquée(s)${colors.reset}`)
  console.log(`${colors.green}✓ ${totalFiles} fichier(s) modifié(s)${colors.reset}`)
  console.log(`${colors.cyan}📁 Fichiers traités: ${languageFiles.join(', ')}${colors.reset}`)

  if (totalUpdates > 0) {
    console.log(
      `\n${colors.yellow}💡 N'oubliez pas de vérifier les changements avec git diff${colors.reset}`
    )
    console.log(`${colors.yellow}💡 Lancez les tests pour valider les traductions${colors.reset}`)
  }
}

/**
 * Valide le fichier de configuration avant application
 */
function validateConfig() {
  console.log(`${colors.blue}${colors.bold}=== VALIDATION DE LA CONFIGURATION ===${colors.reset}\n`)

  const translations = loadTranslationsConfig()
  const keyPaths = Object.keys(translations)

  if (keyPaths.length === 0) {
    console.log(
      `${colors.yellow}⚠️  Aucune traduction trouvée dans le fichier de configuration${colors.reset}`
    )
    return false
  }

  let hasErrors = false
  let readyTranslations = 0

  for (const keyPath of keyPaths) {
    const langs = Object.keys(translations[keyPath])
    console.log(`${colors.bold}${keyPath}:${colors.reset}`)

    for (const lang of langs) {
      const translation = translations[keyPath][lang]

      if (!translation) {
        console.log(`  ${colors.red}✗ ${lang}: Traduction manquante${colors.reset}`)
        hasErrors = true
      } else if (translation.startsWith('TODO:')) {
        console.log(`  ${colors.yellow}⚠ ${lang}: ${translation}${colors.reset}`)
      } else {
        console.log(`  ${colors.green}✓ ${lang}: "${translation}"${colors.reset}`)
        readyTranslations++
      }
    }
    console.log()
  }

  console.log(`${colors.blue}${colors.bold}=== RÉSUMÉ VALIDATION ===${colors.reset}`)
  console.log(`${colors.green}✓ ${readyTranslations} traduction(s) prête(s)${colors.reset}`)

  if (hasErrors) {
    console.log(
      `${colors.red}❌ Des erreurs ont été détectées dans la configuration${colors.reset}`
    )
  } else {
    console.log(`${colors.green}✅ Configuration valide${colors.reset}`)
  }

  return !hasErrors
}

// Gestion des arguments de ligne de commande
const args = process.argv.slice(2)

if (args.includes('--validate') || args.includes('-v')) {
  validateConfig()
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(
    `${colors.blue}${colors.bold}=== AIDE - SCRIPT D'APPLICATION DES TRADUCTIONS ===${colors.reset}\n`
  )
  console.log(`${colors.bold}Usage:${colors.reset}`)
  console.log(`  node scripts/translation/apply-translations.js [options]\n`)
  console.log(`${colors.bold}Options:${colors.reset}`)
  console.log(`  --validate, -v    Valide le fichier de configuration sans appliquer`)
  console.log(`  --help, -h        Affiche cette aide\n`)
  console.log(`${colors.bold}Prérequis:${colors.reset}`)
  console.log(`  - Fichier translations-config.json dans le même répertoire`)
  console.log(`  - Généré avec: node scripts/translation/list-todo-keys.js\n`)
  console.log(`${colors.bold}Workflow:${colors.reset}`)
  console.log(`  1. ${colors.cyan}node scripts/translation/list-todo-keys.js${colors.reset}`)
  console.log(`  2. ${colors.cyan}Éditer translations-config.template.json${colors.reset}`)
  console.log(`  3. ${colors.cyan}Renommer en translations-config.json${colors.reset}`)
  console.log(
    `  4. ${colors.cyan}node scripts/translation/apply-translations.js --validate${colors.reset}`
  )
  console.log(`  5. ${colors.cyan}node scripts/translation/apply-translations.js${colors.reset}`)
} else {
  if (validateConfig()) {
    console.log(
      `\n${colors.green}✅ Configuration validée, application des traductions...\n${colors.reset}`
    )
    applyTranslations()
  } else {
    console.log(
      `\n${colors.red}❌ Veuillez corriger la configuration avant d'appliquer les traductions${colors.reset}`
    )
    process.exit(1)
  }
}
