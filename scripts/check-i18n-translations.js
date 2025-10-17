#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

import {
  LOCALES_DIR,
  loadLocaleFiles as sharedLoadLocaleFiles,
  writeLocaleFiles,
  flattenObject,
  unflattenObject,
} from './translation/shared-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const RESET = '\x1b[0m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'

const projectRoot = path.resolve(__dirname, '..')
const localesDir = LOCALES_DIR

/**
 * Charge tous les fichiers de traduction depuis le dossier de locales
 * Structure: i18n/locales/{langue}/{domaine}.json
 * et les fusionne en un seul objet par langue
 */
function loadLocaleFiles() {
  const locales = {}

  try {
    // Vérifier que le dossier existe
    if (!fs.existsSync(localesDir)) {
      console.error(`${RED}Erreur: Le dossier ${localesDir} n'existe pas${RESET}`)
      process.exit(1)
    }

    // Lister tous les dossiers de langue
    const localeDirs = fs.readdirSync(localesDir).filter((item) => {
      const itemPath = path.join(localesDir, item)
      return fs.statSync(itemPath).isDirectory()
    })

    if (localeDirs.length === 0) {
      console.error(`${RED}Erreur: Aucun dossier de langue trouvé dans ${localesDir}${RESET}`)
      process.exit(1)
    }

    // Pour chaque langue, charger tous les fichiers JSON avec la fonction partagée
    for (const locale of localeDirs) {
      const data = sharedLoadLocaleFiles(locale)
      if (data) {
        locales[locale] = data
      } else {
        console.warn(
          `${YELLOW}Avertissement: Aucun fichier de traduction trouvé dans ${locale}/${RESET}`
        )
      }
    }

    console.log(`${CYAN}Chargé ${localeDirs.length} langue(s): ${localeDirs.join(', ')}${RESET}`)

    return locales
  } catch (error) {
    console.error(
      `${RED}Erreur lors du chargement des fichiers de traduction:${RESET}`,
      error.message
    )
    process.exit(1)
  }
}

/**
 * Fonction récursive pour parcourir un objet JSON et trouver les clés avec [TODO]
 * Réutilise la logique de scripts/translation/list-todo-keys.js
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
 * Compte les clés TODO dans toutes les langues
 */
function countTodoKeys(locales) {
  const todoStats = {}
  let totalTodoKeys = 0

  for (const [locale, data] of Object.entries(locales)) {
    const todoKeys = findTodoKeys(data)
    const todoCount = Object.keys(todoKeys).length
    todoStats[locale] = {
      count: todoCount,
      keys: todoKeys,
    }
    totalTodoKeys += todoCount
  }

  return { todoStats, totalTodoKeys }
}

function compareTranslations(locales, referenceLocale = 'fr') {
  if (!locales[referenceLocale]) {
    console.error(
      `${RED}Erreur: Le fichier de référence ${referenceLocale}.json n'existe pas${RESET}`
    )
    process.exit(1)
  }

  const referenceKeys = new Set(Object.keys(flattenObject(locales[referenceLocale])))
  const results = {}

  for (const [locale, data] of Object.entries(locales)) {
    if (locale === referenceLocale) continue

    const localeKeys = new Set(Object.keys(flattenObject(data)))

    // Clés manquantes dans cette langue
    const missingKeys = [...referenceKeys].filter((key) => !localeKeys.has(key))

    // Clés en trop dans cette langue
    const extraKeys = [...localeKeys].filter((key) => !referenceKeys.has(key))

    results[locale] = {
      missingKeys,
      extraKeys,
      totalKeys: localeKeys.size,
      referenceTotal: referenceKeys.size,
    }
  }

  return results
}

/**
 * Compare la structure fichier par fichier pour détecter les clés dans les mauvais fichiers
 * Retourne un objet { locale: { key: { expected: 'file.json', actual: 'file.json' } } }
 */
function compareFileStructure(referenceLocale = 'fr') {
  const misplacedKeys = {}

  try {
    // Lister tous les dossiers de langue
    const localeDirs = fs.readdirSync(localesDir).filter((item) => {
      const itemPath = path.join(localesDir, item)
      return fs.statSync(itemPath).isDirectory()
    })

    // Charger la structure fichier par fichier de la référence
    const refDir = path.join(localesDir, referenceLocale)
    if (!fs.existsSync(refDir)) {
      return misplacedKeys
    }

    const refFiles = fs
      .readdirSync(refDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))

    // Construire le mapping référence: clé -> fichier
    const refMapping = {}
    for (const fileName of refFiles) {
      const filePath = path.join(refDir, `${fileName}.json`)
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      const flat = flattenObject(content)
      for (const key of Object.keys(flat)) {
        refMapping[key] = fileName
      }
    }

    // Comparer avec chaque langue
    for (const locale of localeDirs) {
      if (locale === referenceLocale) continue

      const localeDir = path.join(localesDir, locale)
      const localeFiles = fs
        .readdirSync(localeDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))

      // Construire le mapping pour cette langue
      const localeMapping = {}
      for (const fileName of localeFiles) {
        const filePath = path.join(localeDir, `${fileName}.json`)
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const flat = flattenObject(content)
        for (const key of Object.keys(flat)) {
          localeMapping[key] = fileName
        }
      }

      // Trouver les clés mal placées
      for (const [key, refFile] of Object.entries(refMapping)) {
        const actualFile = localeMapping[key]
        if (actualFile && actualFile !== refFile) {
          if (!misplacedKeys[locale]) {
            misplacedKeys[locale] = {}
          }
          misplacedKeys[locale][key] = {
            expected: refFile,
            actual: actualFile,
          }
        }
      }
    }

    return misplacedKeys
  } catch (error) {
    console.error(`${RED}Erreur lors de la comparaison de structure:${RESET}`, error.message)
    return misplacedKeys
  }
}

function showHelp() {
  console.log(`
${BOLD}${BLUE}Comparaison des traductions i18n${RESET}

${BOLD}Usage:${RESET}
  npm run check-translations [options]

${BOLD}Options:${RESET}
  -r, --reference <locale>  Langue de référence (défaut: fr)
  -l, --lang <locale>       Affiche uniquement les résultats pour cette langue
  -s, --summary            Affiche uniquement le résumé
  -p, --prune              Supprime les clés en trop dans les locales (par rapport à la référence)
  -f, --fill               Ajoute automatiquement les clés manquantes (copie valeur de la référence)
  --fill-mode <mode>   Mode de remplissage: copy (défaut), empty, todo
  --refill             Force le remplacement des valeurs identiques à la référence selon fill-mode
  --fix-structure          Réorganise les clés mal placées vers les bons fichiers
  -h, --help               Affiche cette aide

${BOLD}Exemples:${RESET}
  npm run check-translations                    # Compare toutes les langues avec fr
  npm run check-translations -- -r en          # Utilise en comme référence
  npm run check-translations -- -l es          # Affiche uniquement les résultats pour es
  npm run check-translations -- --summary      # Affiche uniquement le résumé
  npm run check-translations -- -h             # Affiche cette aide
`)
}

async function main() {
  // Parse les arguments
  const options = {
    reference: {
      type: 'string',
      short: 'r',
      description: 'Langue de référence',
    },
    lang: {
      type: 'string',
      short: 'l',
      description: 'Langue spécifique à analyser',
    },
    summary: {
      type: 'boolean',
      short: 's',
      description: 'Affiche uniquement le résumé',
    },
    prune: {
      type: 'boolean',
      short: 'p',
      description: 'Supprime les clés en trop (prune) dans les locales analysées',
    },
    fill: {
      type: 'boolean',
      short: 'f',
      description: 'Ajoute les clés manquantes en copiant la valeur de la locale de référence',
    },
    'fill-mode': {
      type: 'string',
      description: 'Mode de remplissage: copy | empty | todo',
    },
    refill: {
      type: 'boolean',
      description: 'Force le traitement aussi des clés dont la valeur est identique à la référence',
    },
    'fix-structure': {
      type: 'boolean',
      description: 'Réorganise les clés mal placées vers les bons fichiers selon la référence',
    },
    help: {
      type: 'boolean',
      short: 'h',
      description: "Affiche l'aide",
    },
  }

  let args
  try {
    args = parseArgs({ options, allowPositionals: false })
  } catch (error) {
    console.error(`${RED}Erreur: ${error.message}${RESET}`)
    showHelp()
    process.exit(1)
  }

  if (args.values.help) {
    showHelp()
    process.exit(0)
  }

  const referenceLocale = args.values.reference || 'fr'
  const targetLang = args.values.lang
  const summaryOnly = args.values.summary
  const pruneExtra = args.values.prune
  const fillMissing = args.values.fill
  const fillMode = (args.values['fill-mode'] || 'copy').toLowerCase()
  const refill = args.values.refill || false
  const fixStructure = args.values['fix-structure'] || false
  if (fillMissing && !['copy', 'empty', 'todo'].includes(fillMode)) {
    console.error(`${RED}Mode fill invalide: ${fillMode} (attendu: copy | empty | todo)${RESET}`)
    process.exit(1)
  }

  console.log(`\n${BOLD}${BLUE}=== Comparaison des traductions ===${RESET}\n`)

  // Charger tous les fichiers de locale
  const locales = loadLocaleFiles()
  const availableLocales = Object.keys(locales).sort()

  // Charger la langue de référence avec le mapping pour savoir dans quel fichier se trouve chaque clé
  const referenceWithMapping = sharedLoadLocaleFiles(referenceLocale, true)
  const referenceFileMapping = referenceWithMapping ? referenceWithMapping.fileMapping : null

  console.log(`${CYAN}Langues disponibles: ${availableLocales.join(', ')}${RESET}`)
  console.log(`${CYAN}Langue de référence: ${referenceLocale}${RESET}`)
  if (referenceFileMapping) {
    console.log(
      `${CYAN}Mode intelligent: utilisation du mapping de fichiers depuis ${referenceLocale}/${RESET}`
    )
  }
  console.log()

  if (!locales[referenceLocale]) {
    console.error(`${RED}Erreur: Le fichier ${referenceLocale}.json n'existe pas${RESET}`)
    process.exit(1)
  }

  if (targetLang && !locales[targetLang]) {
    console.error(`${RED}Erreur: Le fichier ${targetLang}.json n'existe pas${RESET}`)
    process.exit(1)
  }

  // Comparer les traductions
  const results = compareTranslations(locales, referenceLocale)

  // Compter les clés TODO
  const { todoStats, totalTodoKeys } = countTodoKeys(locales)

  // Vérifier la structure fichier par fichier
  const misplacedKeys = compareFileStructure(referenceLocale)

  let hasErrors = false
  let totalMissing = 0
  let totalExtra = 0
  let totalMisplaced = 0

  // Filtrer par langue si spécifié
  const languagesToShow = targetLang ? { [targetLang]: results[targetLang] } : results

  // Option fix-structure: réorganiser les clés mal placées avant l'affichage détaillé
  if (fixStructure) {
    for (const locale of Object.keys(languagesToShow)) {
      const misplacedForLocale = misplacedKeys[locale]
      if (misplacedForLocale && Object.keys(misplacedForLocale).length > 0) {
        console.log(
          `${CYAN}Réorganisation de ${locale}/ (${Object.keys(misplacedForLocale).length} clé(s))...${RESET}`
        )

        // Charger toutes les données de cette langue (aplaties)
        const localeData = locales[locale]
        const flat = flattenObject(localeData)

        // Écrire dans les fichiers avec le mapping de référence
        // writeLocaleFiles attend des données aplaties
        const updatedFiles = writeLocaleFiles(locale, flat, referenceFileMapping)

        console.log(
          `${GREEN}✓ ${Object.keys(misplacedForLocale).length} clé(s) réorganisée(s) dans ${locale}/ (${updatedFiles} fichier(s) mis à jour)${RESET}`
        )

        // Mettre à jour les données en mémoire (garder imbriqué pour la suite)
        locales[locale] = localeData
      }
    }

    // Recalculer la structure après réorganisation
    const updatedMisplaced = compareFileStructure(referenceLocale)
    for (const [loc, data] of Object.entries(updatedMisplaced)) {
      if (languagesToShow[loc]) {
        misplacedKeys[loc] = data
      }
    }

    console.log()
  }

  // Option prune: supprimer les clés en trop avant l'affichage détaillé
  if (pruneExtra) {
    for (const [locale, data] of Object.entries(languagesToShow)) {
      if (data.extraKeys.length > 0) {
        // Recharger contenu brut pour reconstruire proprement
        const original = locales[locale]
        // Aplatir
        const flat = flattenObject(original)
        // Retirer les extra
        for (const k of data.extraKeys) delete flat[k]
        // Reconstruire imbriqué avec la fonction partagée
        const rebuilt = unflattenObject(flat)

        // Écrire dans les fichiers de domaine (utilise le mapping de la référence si disponible)
        const updatedFiles = writeLocaleFiles(locale, rebuilt, referenceFileMapping)
        console.log(
          `${YELLOW}Pruned ${data.extraKeys.length} clé(s) en trop dans ${locale}/ (${updatedFiles} fichier(s) mis à jour)${RESET}`
        )
        // Mettre à jour les données en mémoire pour le reporting
        locales[locale] = rebuilt
      }
    }
    // Recalculer les résultats après prune
    const updated = compareTranslations(locales, referenceLocale)
    for (const [loc, d] of Object.entries(updated)) {
      if (languagesToShow[loc]) languagesToShow[loc] = d
    }
  }

  // Option fill: ajouter les clés manquantes depuis la locale de référence
  if (fillMissing) {
    const referenceFlat = flattenObject(locales[referenceLocale])
    for (const [locale, data] of Object.entries(languagesToShow)) {
      // Déterminer clés à remplir: manquantes + (optionnel) celles égales à la ref si --refill
      let keysToFill = [...data.missingKeys]
      if (refill) {
        const currentFlat = flattenObject(locales[locale])
        for (const [k, v] of Object.entries(referenceFlat)) {
          if (currentFlat[k] === v && !keysToFill.includes(k)) keysToFill.push(k)
        }
      }
      if (keysToFill.length > 0) {
        const original = locales[locale]
        const flat = flattenObject(original)
        let added = 0
        for (const k of keysToFill) {
          if (referenceFlat[k] === undefined) continue
          let newVal
          switch (fillMode) {
            case 'empty':
              newVal = ''
              break
            case 'todo':
              newVal = `[TODO] ${referenceFlat[k]}`
              break
            case 'copy':
            default:
              newVal = referenceFlat[k]
          }
          if (flat[k] !== newVal) {
            flat[k] = newVal
            added++
          }
        }
        if (added > 0) {
          // Reconstruire imbriqué avec la fonction partagée
          const rebuilt = unflattenObject(flat)

          // Écrire dans les fichiers de domaine (utilise le mapping de la référence si disponible)
          const updatedFiles = writeLocaleFiles(locale, rebuilt, referenceFileMapping)
          locales[locale] = rebuilt
          const modeNote = fillMode === 'copy' ? '' : ` (mode ${fillMode})`
          console.log(
            `${GREEN}Filled ${added} clé(s) dans ${locale}/ (${updatedFiles} fichier(s) mis à jour)${modeNote}${RESET}`
          )
        }
      }
    }
    // Recalculer après fill
    const updated = compareTranslations(locales, referenceLocale)
    for (const [loc, d] of Object.entries(updated)) {
      if (languagesToShow[loc]) languagesToShow[loc] = d
    }
  }

  for (const [locale, data] of Object.entries(languagesToShow)) {
    totalMissing += data.missingKeys.length
    totalExtra += data.extraKeys.length

    if (data.missingKeys.length > 0) hasErrors = true

    if (!summaryOnly) {
      console.log(`${BOLD}${BLUE}=== ${locale.toUpperCase()} ===${RESET}`)

      // Statistiques
      const coverage = ((data.totalKeys / data.referenceTotal) * 100).toFixed(1)
      const todoCount = todoStats[locale]?.count || 0
      console.log(`Couverture: ${data.totalKeys}/${data.referenceTotal} clés (${coverage}%)`)
      console.log(`Clés [TODO]: ${todoCount}`)

      // Clés manquantes
      if (data.missingKeys.length > 0) {
        console.log(`\n${RED}✗ ${data.missingKeys.length} clé(s) manquante(s):${RESET}`)
        data.missingKeys.forEach((key) => console.log(`  ${RED}- ${key}${RESET}`))
      } else {
        console.log(`\n${GREEN}✓ Toutes les clés de référence sont présentes${RESET}`)
      }

      // Clés en trop
      if (data.extraKeys.length > 0) {
        console.log(
          `\n${YELLOW}⚠ ${data.extraKeys.length} clé(s) en trop (absente(s) de ${referenceLocale}):${RESET}`
        )
        data.extraKeys.forEach((key) => console.log(`  ${YELLOW}+ ${key}${RESET}`))
      } else {
        console.log(`\n${GREEN}✓ Aucune clé en trop${RESET}`)
      }

      // Clés dans les mauvais fichiers
      const misplacedForLocale = misplacedKeys[locale]
      if (misplacedForLocale && Object.keys(misplacedForLocale).length > 0) {
        const count = Object.keys(misplacedForLocale).length
        console.log(`\n${YELLOW}⚠ ${count} clé(s) dans le mauvais fichier:${RESET}`)
        for (const [key, files] of Object.entries(misplacedForLocale)) {
          console.log(
            `  ${YELLOW}• ${key}${RESET}\n    Attendu: ${CYAN}${files.expected}.json${RESET}\n    Actuel: ${RED}${files.actual}.json${RESET}`
          )
        }
        totalMisplaced += count
      } else {
        console.log(`\n${GREEN}✓ Toutes les clés sont dans les bons fichiers${RESET}`)
      }

      console.log('')
    }
  }

  // Résumé
  console.log(`${BOLD}${BLUE}=== Résumé ===${RESET}`)
  const referenceTotal = Object.keys(flattenObject(locales[referenceLocale])).length
  console.log(`Total de clés dans ${referenceLocale}: ${referenceTotal}`)

  for (const [locale, data] of Object.entries(languagesToShow)) {
    const coverage = ((data.totalKeys / data.referenceTotal) * 100).toFixed(1)
    const status = data.missingKeys.length === 0 ? GREEN + '✓' : RED + '✗'
    const todoCount = todoStats[locale]?.count || 0
    const todoText = todoCount > 0 ? `, ${todoCount} TODO` : ''
    console.log(
      `${locale}: ${data.totalKeys} clés (${coverage}%) ${status}${RESET} ${data.missingKeys.length > 0 ? `${data.missingKeys.length} manquantes` : ''}${todoText}`
    )
  }

  if (!targetLang && !summaryOnly) {
    console.log(`\nTotal clés manquantes: ${totalMissing}`)
    console.log(`Total clés en trop: ${totalExtra}`)
    console.log(`Total clés mal placées: ${totalMisplaced}`)
    console.log(`Total clés [TODO]: ${totalTodoKeys}`)
  }

  // Code de sortie
  if (hasErrors) {
    process.exit(1)
  }
}

main()
