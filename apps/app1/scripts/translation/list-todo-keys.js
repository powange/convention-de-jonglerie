#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { LOCALES_ROOTS, listerLangues } from './shared-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REFERENCE_LANG = 'fr' // Langue de référence

/**
 * Fusionne deux arborescences de traductions en profondeur.
 *
 * Une fusion superficielle ne conviendrait pas : plusieurs fichiers partagent la même racine
 * (`gestion-map.json` porte `{ gestion: { map } }`, `gestion-tasks.json` porte
 * `{ gestion: { task } }`). Le dernier fichier lu écraserait alors la racine entière des
 * précédents, et le script annoncerait « aucune clé [TODO] » alors que des centaines attendent
 * d'être traduites.
 */
function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {}
      }
      deepMerge(target[key], value)
    } else {
      target[key] = value
    }
  }
  return target
}

/**
 * Charge tous les fichiers JSON d'une langue et les fusionne.
 *
 * Toutes les racines sont lues, pas seulement celle de l'application : les layers portent leurs
 * propres traductions, et un `[TODO]` qui y dort ne serait jamais listé — donc jamais traduit.
 */
function loadLocaleFiles(locale) {
  const mergedData = {}
  let fichiersLus = 0

  for (const racine of LOCALES_ROOTS) {
    const localeDir = path.join(racine.dir, locale)
    if (!fs.existsSync(localeDir) || !fs.statSync(localeDir).isDirectory()) continue

    for (const file of fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'))) {
      deepMerge(mergedData, JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8')))
      fichiersLus++
    }
  }

  return fichiersLus === 0 ? null : mergedData
}

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
 * Fonction récursive pour parcourir un objet JSON et trouver les clés avec [TODO]
 */
function findTodoKeys(obj, prefix = '') {
  const todoKeys = {}

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'string' && value.startsWith('[TODO]')) {
      todoKeys[currentPath] = value
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedTodos = findTodoKeys(value, currentPath)
      Object.assign(todoKeys, nestedTodos)
    }
  }

  return todoKeys
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
 * Charge et analyse tous les fichiers de langue
 */
function analyzeLanguageFiles() {
  const languageFiles = listerLangues()

  console.log(`${colors.blue}${colors.bold}=== DIAGNOSTIC DES CLÉS [TODO] ===${colors.reset}\n`)
  console.log(`${colors.cyan}Langues détectées: ${languageFiles.join(', ')}${colors.reset}`)
  console.log(`${colors.cyan}Langue de référence: ${REFERENCE_LANG}${colors.reset}\n`)

  // Charger tous les fichiers
  const languageData = {}
  const allTodoKeys = new Set()

  for (const lang of languageFiles) {
    try {
      const data = loadLocaleFiles(lang)
      if (!data) {
        console.error(
          `${colors.red}Erreur: Aucun fichier de traduction trouvé pour ${lang}${colors.reset}`
        )
        continue
      }

      languageData[lang] = data

      // Trouver les clés TODO dans cette langue
      const todoKeys = findTodoKeys(data)
      Object.keys(todoKeys).forEach((key) => allTodoKeys.add(key))
    } catch (error) {
      console.error(
        `${colors.red}Erreur lors du chargement de ${lang}: ${error.message}${colors.reset}`
      )
    }
  }

  if (allTodoKeys.size === 0) {
    console.log(`${colors.green}${colors.bold}✅ Aucune clé [TODO] trouvée !${colors.reset}`)
    return
  }

  // Analyser chaque clé TODO trouvée
  console.log(`${colors.yellow}${colors.bold}=== CLÉS [TODO] TROUVÉES ===${colors.reset}\n`)

  let totalTodoKeys = 0
  let totalTranslationsNeeded = 0

  // Trier les clés par ordre alphabétique
  const sortedTodoKeys = Array.from(allTodoKeys).sort()

  for (const keyPath of sortedTodoKeys) {
    console.log(`${colors.bold}${keyPath}:${colors.reset}`)

    let hasReference = false
    let referenceValue = ''
    let todoCount = 0

    // Vérifier la langue de référence en premier
    if (languageData[REFERENCE_LANG]) {
      const refValue = getNestedValue(languageData[REFERENCE_LANG], keyPath)
      if (refValue && !refValue.toString().startsWith('[TODO]')) {
        hasReference = true
        referenceValue = refValue
        console.log(
          `  ${colors.green}✓ ${REFERENCE_LANG}: "${refValue}" (référence)${colors.reset}`
        )
      }
    }

    // Vérifier toutes les autres langues
    for (const lang of languageFiles) {
      if (lang === REFERENCE_LANG) continue

      const value = getNestedValue(languageData[lang], keyPath)
      if (!value) {
        console.log(`  ${colors.red}✗ ${lang}: (manquant)${colors.reset}`)
        todoCount++
      } else if (value.toString().startsWith('[TODO]')) {
        console.log(`  ${colors.red}✗ ${lang}: "${value}"${colors.reset}`)
        todoCount++
      } else {
        console.log(`  ${colors.green}✓ ${lang}: "${value}"${colors.reset}`)
      }
    }

    // Si pas de référence en français, montrer la clé française aussi
    if (!hasReference && languageData[REFERENCE_LANG]) {
      const refValue = getNestedValue(languageData[REFERENCE_LANG], keyPath)
      if (refValue) {
        console.log(`  ${colors.red}✗ ${REFERENCE_LANG}: "${refValue}"${colors.reset}`)
        todoCount++
      }
    }

    totalTodoKeys++
    totalTranslationsNeeded += todoCount

    console.log() // Ligne vide entre les clés
  }

  // Résumé final
  console.log(`${colors.blue}${colors.bold}=== RÉSUMÉ ===${colors.reset}`)
  console.log(`${colors.yellow}Total de clés avec [TODO]: ${totalTodoKeys}${colors.reset}`)
  console.log(
    `${colors.yellow}Total de traductions nécessaires: ${totalTranslationsNeeded}${colors.reset}`
  )
  console.log(
    `${colors.yellow}Langues concernées: ${languageFiles.filter((lang) => lang !== REFERENCE_LANG).length}${colors.reset}`
  )

  // Générer les fichiers de traduction
  const args = process.argv.slice(2)
  if (args.includes('--legacy')) {
    // Ancien format: un seul fichier avec toutes les langues
    generateConfigTemplate(sortedTodoKeys, languageData, languageFiles)
  } else {
    // Nouveau format par défaut: un fichier par langue
    generatePerLanguageFiles(sortedTodoKeys, languageData, languageFiles)
  }
}

/**
 * Génère des fichiers de traduction par langue (un fichier par langue)
 * Format: todo-{lang}.json avec { "clé": "valeur française de référence" }
 */
function generatePerLanguageFiles(todoKeys, languageData, languageFiles) {
  if (todoKeys.length === 0) return

  const generatedFiles = []

  for (const lang of languageFiles) {
    if (lang === REFERENCE_LANG) continue

    // Collecter les clés TODO pour cette langue
    const todoForLang = {}

    for (const keyPath of todoKeys) {
      const value = getNestedValue(languageData[lang], keyPath)

      // Si la clé est manquante ou commence par [TODO]
      if (!value || value.toString().startsWith('[TODO]')) {
        // Récupérer la valeur française de référence
        const refValue = getNestedValue(languageData[REFERENCE_LANG], keyPath)
        if (refValue && !refValue.toString().startsWith('[TODO]')) {
          todoForLang[keyPath] = refValue
        }
      }
    }

    // Générer le fichier seulement s'il y a des clés à traduire
    if (Object.keys(todoForLang).length > 0) {
      const filePath = path.join(__dirname, `todo-${lang}.json`)
      fs.writeFileSync(filePath, JSON.stringify(todoForLang, null, 2) + '\n')
      generatedFiles.push({ lang, count: Object.keys(todoForLang).length, path: filePath })
    }
  }

  if (generatedFiles.length > 0) {
    console.log(`\n${colors.green}${colors.bold}📄 Fichiers générés par langue:${colors.reset}`)
    for (const file of generatedFiles) {
      console.log(`  ${colors.cyan}todo-${file.lang}.json${colors.reset} (${file.count} clés)`)
    }
    console.log(`\n${colors.yellow}💡 Workflow:${colors.reset}`)
    console.log(`  1. Remplacez les valeurs françaises par les traductions dans chaque fichier`)
    console.log(
      `  2. Lancez: ${colors.cyan}node scripts/translation/apply-translations.js${colors.reset}`
    )
    console.log(`  3. Les fichiers todo-*.json seront automatiquement supprimés après application`)
  }
}

/**
 * Génère un template de fichier de configuration (ancien format, conservé pour compatibilité)
 */
function generateConfigTemplate(todoKeys, languageData, languageFiles) {
  if (todoKeys.length === 0) return

  const configTemplate = {
    translations: {},
  }

  for (const keyPath of todoKeys) {
    const translations = {}

    // Ajouter la référence française si elle existe et n'est pas TODO
    if (languageData[REFERENCE_LANG]) {
      const refValue = getNestedValue(languageData[REFERENCE_LANG], keyPath)
      if (refValue && !refValue.toString().startsWith('[TODO]')) {
        translations[REFERENCE_LANG] = refValue
      }
    }

    // Ajouter des placeholders pour les autres langues
    for (const lang of languageFiles) {
      if (lang === REFERENCE_LANG) continue

      const value = getNestedValue(languageData[lang], keyPath)
      if (!value || value.toString().startsWith('[TODO]')) {
        translations[lang] = `TODO: Traduire en ${lang}`
      } else {
        translations[lang] = value
      }
    }

    configTemplate.translations[keyPath] = translations
  }

  // Sauvegarder le template
  const templatePath = path.join(__dirname, 'translations-config.template.json')
  fs.writeFileSync(templatePath, JSON.stringify(configTemplate, null, 2) + '\n')

  console.log(
    `\n${colors.green}📄 Template de configuration généré: ${templatePath}${colors.reset}`
  )
  console.log(
    `${colors.cyan}💡 Éditez ce fichier pour ajouter les traductions, puis renommez-le en 'translations-config.json'${colors.reset}`
  )
}

// Exécuter l'analyse
analyzeLanguageFiles()
