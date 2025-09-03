#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

import { glob } from 'glob'

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
const localeFile = path.join(projectRoot, 'i18n', 'locales', 'fr.json')

function loadLocaleFile() {
  try {
    const content = fs.readFileSync(localeFile, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`${RED}Erreur lors du chargement de ${localeFile}:${RESET}`, error.message)
    process.exit(1)
  }
}

function flattenObject(obj, prefix = '') {
  let result = {}

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], fullKey))
    } else {
      result[fullKey] = obj[key]
    }
  }

  return result
}

function findDuplicateValues(obj) {
  const flatObj = flattenObject(obj)
  const valueToKeys = {}
  const duplicates = []

  for (const [key, value] of Object.entries(flatObj)) {
    if (typeof value === 'string') {
      if (!valueToKeys[value]) {
        valueToKeys[value] = []
      }
      valueToKeys[value].push(key)
    }
  }

  for (const [value, keys] of Object.entries(valueToKeys)) {
    if (keys.length > 1) {
      duplicates.push({ value, keys })
    }
  }

  return duplicates
}

function extractI18nKeysFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const keys = new Set()

  // $t('key') ou $t("key")
  const tFunctionRegex = /\$t\(['"]([\w.]+)['"]/g
  let match
  while ((match = tFunctionRegex.exec(content)) !== null) {
    keys.add(match[1])
  }

  // t('key') ou t("key") - plus permissif pour capturer t(type.label) etc.
  const tMethodRegex = /\bt\(\s*['"]([\w.]+)['"]\s*\)/g
  while ((match = tMethodRegex.exec(content)) !== null) {
    keys.add(match[1])
  }

  // t(`key`) avec template littéraux (backticks)
  const tTemplateRegex = /\bt\(\s*`([^`]+)`\s*\)/g
  while ((match = tTemplateRegex.exec(content)) !== null) {
    const template = match[1]
    // Si c'est un template avec interpolation, essayer d'extraire la partie statique
    if (template.includes('${')) {
      // Extraire les parties statiques du template
      const staticParts = template.split(/\$\{[^}]+\}/)

      // Pour les clés dynamiques comme admin.feedback.types.${...},
      // on va chercher les clés possibles dans le fichier de traduction
      if (staticParts[0] && staticParts[0].endsWith('.')) {
        const prefix = staticParts[0]
        // Marquer le préfixe comme utilisé pour les clés dynamiques
        keys.add('__DYNAMIC_PREFIX__' + prefix)
      }
    } else {
      // Template sans interpolation
      keys.add(template)
    }
  }

  // $t(`key`) avec template littéraux
  const dollarTTemplateRegex = /\$t\(\s*`([^`]+)`\s*\)/g
  while ((match = dollarTTemplateRegex.exec(content)) !== null) {
    const template = match[1]
    if (template.includes('${')) {
      const staticParts = template.split(/\$\{[^}]+\}/)
      if (staticParts[0] && staticParts[0].endsWith('.')) {
        keys.add('__DYNAMIC_PREFIX__' + staticParts[0])
      }
    } else {
      keys.add(template)
    }
  }

  // t(variable) - pour les expressions dynamiques, on les gère différemment
  // Cette section a été supprimée car elle causait trop de faux positifs

  // Recherche directe de clés i18n dans des chaînes (pour capturer les objets comme { label: 'feedback.types.bug' })
  // Mais exclure les propriétés d'objets JavaScript communes
  const stringKeyRegex = /['"`]([\w]+\.[\w.]+)['"`]/g
  while ((match = stringKeyRegex.exec(content)) !== null) {
    const potentialKey = match[1]
    const parts = potentialKey.split('.')

    // Filtrer les faux positifs
    // - Exclure les propriétés d'objets JavaScript communes
    const jsObjectPatterns = [
      'state',
      'props',
      'data',
      'form',
      'filters',
      'pagination',
      'authStore',
      'editionStore',
      'favoriteEditions',
      'passwordState',
      'registerState',
      'emailState',
      'convention',
      'edition',
      'user',
      'collaborator',
      'post',
      'comment',
      'offer',
      'request',
      'passenger',
      'item',
      'newItem',
      'option',
      'suggestion',
      'activity',
      'feedback',
      'resolveModal',
      'detailsModal',
      'addForm',
      'replyForm',
      'newPostForm',
      'currentLanguage',
      'lang',
      'leaflet',
      'activeService',
      'service',
      'category',
      'localValue',
      // Ajout 'h' pour ignorer les accès h.actor.pseudo / h.targetUser.pseudo
      'h',
      's',
      'selectedCountry',
      'selectedEdition',
      'activeServices',
      'formData',
    ]

    // Exceptions - ces patterns sont valides même s'ils commencent par un mot réservé
    const validI18nPatterns = [
      'feedback.types.',
      'feedback.error.',
      'feedback.success.',
      'feedback.validation.',
      'feedback.subject.',
      'feedback.message.',
      'feedback.name.',
      'feedback.email.',
    ]

    // Exclure les fichiers de traduction (.json)
    const isJsonFile = potentialKey.endsWith('.json')

    // Exclure les nombres et les propriétés qui commencent par des nombres
    const isNumeric = /^\d/.test(potentialKey) || /^\d+(\.\d+)?$/.test(potentialKey)

    // Exclure les accès de propriétés de variables courtes (ex: b.id, b.requester)
    const isShortVarProperty = /^[a-zA-Z]\.(id|requester|user|email|status|seats)$/.test(
      potentialKey
    )

    // Vérifier si c'est une clé i18n valide malgré le préfixe
    const isValidI18nKey = validI18nPatterns.some((pattern) => potentialKey.startsWith(pattern))

    // Exclure les propriétés d'objets JavaScript courants (sauf si c'est une clé i18n valide)
    const isJsProperty =
      !isValidI18nKey &&
      jsObjectPatterns.some(
        (pattern) => potentialKey.startsWith(pattern + '.') || potentialKey === pattern
      )

    // Garder seulement si:
    // - Au moins 2 niveaux
    // - Pas un fichier JSON
    // - Pas numérique
    // - Pas une propriété JS connue
    // - Commence par une lettre minuscule (convention i18n)
    if (
      parts.length >= 2 &&
      !isJsonFile &&
      !isNumeric &&
      !isJsProperty &&
      !isShortVarProperty &&
      /^[a-z]/.test(potentialKey)
    ) {
      keys.add(potentialKey)
    }
  }

  // i18n.global.t('key') ou i18n.global.t("key")
  const globalTRegex = /i18n\.global\.t\(['"]([\w.]+)['"]/g
  while ((match = globalTRegex.exec(content)) !== null) {
    keys.add(match[1])
  }

  // useI18n et const { t } = useI18n()
  const useI18nRegex = /useI18n\(\)/g
  if (useI18nRegex.test(content)) {
    const localTRegex = /(?:^|\s)t\(['"]([\w.]+)['"]\s*\)/g
    while ((match = localTRegex.exec(content)) !== null) {
      keys.add(match[1])
    }
  }

  return keys
}

function extractHardcodedTexts(filePath) {
  // Ne cherche les textes hardcodés que dans les fichiers Vue
  if (!filePath.endsWith('.vue')) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const hardcodedTexts = []

  // Extraire le template
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/)
  if (!templateMatch) return hardcodedTexts

  const template = templateMatch[1]

  // Textes entre balises (excluant les composants, les expressions {{ }}, et certains mots-clés)
  const textBetweenTagsRegex = />([^<>{}\n]+)</g
  let match
  while ((match = textBetweenTagsRegex.exec(template)) !== null) {
    const text = match[1].trim()
    if (
      text &&
      text.length > 2 &&
      !/^(v-|@|:|\$|true|false|null|undefined|\d+)/.test(text) &&
      !/^\s*$/.test(text) &&
      !text.includes('{{') &&
      !text.includes('}}') &&
      !/^[A-Z][a-z]+[A-Z]/.test(text) && // Exclure les noms de composants en CamelCase
      !/^[a-z]+-[a-z]+/.test(text) && // Exclure les noms de composants en kebab-case
      !/^(Icon|Ui|App|Base)[A-Z]/.test(text)
    ) {
      // Exclure les préfixes de composants communs
      hardcodedTexts.push({ text, line: getLineNumber(content, match.index) })
    }
  }

  // Attributs title, placeholder, label, alt (excluant les bindings :)
  const attributeRegex = /(?<!:)(title|placeholder|label|alt)="([^"]+)"/g
  while ((match = attributeRegex.exec(template)) !== null) {
    const text = match[2].trim()
    if (text && !text.includes('$t') && !text.includes('t(')) {
      hardcodedTexts.push({
        text,
        attribute: match[1],
        line: getLineNumber(content, match.index),
      })
    }
  }

  return hardcodedTexts
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length
}

async function getAllRelevantFiles() {
  const patterns = [
    // Fichiers Vue
    'app/**/*.vue',
    'components/**/*.vue',
    'layouts/**/*.vue',
    'pages/**/*.vue',
    // Fichiers TypeScript
    'app/**/*.ts',
    'composables/**/*.ts',
    'plugins/**/*.ts',
    'middleware/**/*.ts',
    'utils/**/*.ts',
    'server/**/*.ts',
    // Fichiers JavaScript
    'app/**/*.js',
    'composables/**/*.js',
    'plugins/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'server/**/*.js',
    // Fichiers de configuration Nuxt
    'nuxt.config.ts',
    'nuxt.config.js',
  ]

  let files = []
  for (const pattern of patterns) {
    const found = await glob(path.join(projectRoot, pattern).replace(/\\/g, '/'))
    files = files.concat(found)
  }

  return files
}

async function main() {
  // Parse les arguments
  const options = {
    step: {
      type: 'string',
      short: 's',
      description: 'Étape spécifique à exécuter (1-4)',
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

  const stepToRun = args.values.step ? parseInt(args.values.step) : null

  if (stepToRun !== null && (stepToRun < 1 || stepToRun > 4)) {
    console.error(`${RED}Erreur: L'étape doit être entre 1 et 4${RESET}`)
    showHelp()
    process.exit(1)
  }

  console.log(`\n${BOLD}${BLUE}=== Vérification i18n ===${RESET}\n`)

  // Charger le fichier de locale
  const localeData = loadLocaleFile()
  const flatLocale = flattenObject(localeData)
  const localeKeys = new Set(Object.keys(flatLocale))

  // Collecter toutes les clés utilisées dans les fichiers
  const usedKeys = new Set()
  const hardcodedTexts = []
  const allFiles = await getAllRelevantFiles()

  // Séparer les fichiers par type pour les statistiques
  const vueFiles = allFiles.filter((file) => file.endsWith('.vue'))
  const tsFiles = allFiles.filter((file) => file.endsWith('.ts'))
  const jsFiles = allFiles.filter((file) => file.endsWith('.js'))

  console.log(
    `${CYAN}Analyse de ${allFiles.length} fichiers (${vueFiles.length} Vue, ${tsFiles.length} TS, ${jsFiles.length} JS)...${RESET}\n`
  )

  for (const file of allFiles) {
    const keys = extractI18nKeysFromFile(file)
    keys.forEach((key) => usedKeys.add(key))

    const hardcoded = extractHardcodedTexts(file)
    if (hardcoded.length > 0) {
      hardcodedTexts.push({ file: path.relative(projectRoot, file), texts: hardcoded })
    }
  }

  let hasErrors = false

  // Traiter les préfixes dynamiques
  const dynamicPrefixes = [...usedKeys]
    .filter((key) => key.startsWith('__DYNAMIC_PREFIX__'))
    .map((key) => key.replace('__DYNAMIC_PREFIX__', ''))
  const cleanUsedKeys = new Set(
    [...usedKeys].filter((key) => !key.startsWith('__DYNAMIC_PREFIX__'))
  )

  // Pour les préfixes dynamiques, marquer toutes les clés qui commencent par ce préfixe comme utilisées
  for (const prefix of dynamicPrefixes) {
    for (const localeKey of localeKeys) {
      if (localeKey.startsWith(prefix)) {
        cleanUsedKeys.add(localeKey)
      }
    }
  }

  // 1. Clés utilisées dans le code mais absentes de fr.json
  if (!stepToRun || stepToRun === 1) {
    console.log(`${BOLD}1. Clés manquantes dans fr.json${RESET}`)
    const missingKeys = [...cleanUsedKeys].filter((key) => !localeKeys.has(key))
    if (missingKeys.length > 0) {
      console.log(`${RED}✗ ${missingKeys.length} clé(s) manquante(s):${RESET}`)
      missingKeys.forEach((key) => console.log(`  ${RED}- ${key}${RESET}`))
      hasErrors = true
    } else {
      console.log(`${GREEN}✓ Toutes les clés utilisées sont présentes${RESET}`)
    }
    if (stepToRun === 1) process.exit(hasErrors ? 1 : 0)
  }

  // 2. Clés dans fr.json mais non utilisées
  if (!stepToRun || stepToRun === 2) {
    if (!stepToRun) console.log('')
    console.log(`${BOLD}2. Clés inutilisées dans fr.json${RESET}`)
    const unusedKeys = [...localeKeys].filter((key) => !cleanUsedKeys.has(key))
    if (unusedKeys.length > 0) {
      console.log(`${YELLOW}⚠ ${unusedKeys.length} clé(s) inutilisée(s):${RESET}`)
      unusedKeys.forEach((key) => console.log(`  ${YELLOW}- ${key}${RESET}`))
    } else {
      console.log(`${GREEN}✓ Toutes les clés sont utilisées${RESET}`)
    }
    if (stepToRun === 2) process.exit(0)
  }

  // 3. Valeurs dupliquées dans fr.json
  if (!stepToRun || stepToRun === 3) {
    if (!stepToRun) console.log('')
    console.log(`${BOLD}3. Valeurs dupliquées dans fr.json${RESET}`)
    const duplicates = findDuplicateValues(localeData)
    if (duplicates.length > 0) {
      console.log(`${YELLOW}⚠ ${duplicates.length} valeur(s) dupliquée(s):${RESET}`)
      duplicates.forEach(({ value, keys }) => {
        console.log(
          `  ${YELLOW}Valeur: "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"${RESET}`
        )
        keys.forEach((key) => console.log(`    - ${key}`))
      })
    } else {
      console.log(`${GREEN}✓ Aucune valeur dupliquée${RESET}`)
    }
    if (stepToRun === 3) process.exit(0)
  }

  // 4. Textes hardcodés dans les fichiers Vue
  if (!stepToRun || stepToRun === 4) {
    if (!stepToRun) console.log('')
    console.log(
      `${BOLD}4. Textes hardcodés dans les fichiers Vue (potentiellement non traduits)${RESET}`
    )
    if (hardcodedTexts.length > 0) {
      console.log(
        `${YELLOW}⚠ Textes trouvés dans ${hardcodedTexts.length} fichier(s) Vue:${RESET}`
      )

      hardcodedTexts.forEach(({ file, texts }) => {
        console.log(`\n  ${CYAN}${file}:${RESET}`)
        texts.forEach(({ text, attribute, line }) => {
          if (attribute) {
            console.log(`    ${YELLOW}Ligne ${line}: ${attribute}="${text}"${RESET}`)
          } else {
            console.log(`    ${YELLOW}Ligne ${line}: "${text}"${RESET}`)
          }
        })
      })
    } else {
      console.log(`${GREEN}✓ Aucun texte hardcodé trouvé dans les fichiers Vue${RESET}`)
    }
    if (stepToRun === 4) process.exit(0)
  }

  // Résumé (seulement si toutes les étapes sont exécutées)
  if (!stepToRun) {
    const missingKeys = [...cleanUsedKeys].filter((key) => !localeKeys.has(key))
    const unusedKeys = [...localeKeys].filter((key) => !cleanUsedKeys.has(key))
    const duplicates = findDuplicateValues(localeData)

    console.log(`\n${BOLD}${BLUE}=== Résumé ===${RESET}`)
    console.log(`Total de clés dans fr.json: ${localeKeys.size}`)
    console.log(`Total de clés utilisées: ${usedKeys.size}`)
    console.log(
      `Fichiers analysés: ${allFiles.length} (${vueFiles.length} Vue, ${tsFiles.length} TS, ${jsFiles.length} JS)`
    )
    console.log(`Clés manquantes: ${missingKeys.length}`)
    console.log(`Clés inutilisées: ${unusedKeys.length}`)
    console.log(`Valeurs dupliquées: ${duplicates.length}`)
    console.log(`Fichiers Vue avec textes hardcodés: ${hardcodedTexts.length}`)

    // Code de sortie
    if (hasErrors) {
      process.exit(1)
    }
  }
}

function showHelp() {
  console.log(`
${BOLD}${BLUE}Vérification des traductions i18n${RESET}

${BOLD}Usage:${RESET}
  npm run check-i18n [options]

${BOLD}Options:${RESET}
  -s, --step <num>  Exécute uniquement l'étape spécifiée (1-4)
  -h, --help        Affiche cette aide

${BOLD}Étapes disponibles:${RESET}
  1 - Clés manquantes dans fr.json (utilisées dans le code mais absentes)
  2 - Clés inutilisées dans fr.json (présentes mais non utilisées)
  3 - Valeurs dupliquées dans fr.json (même texte pour plusieurs clés)
  4 - Textes hardcodés dans les fichiers Vue (non traduits)

${BOLD}Exemples:${RESET}
  npm run check-i18n              # Exécute toutes les vérifications
  npm run check-i18n -- -s 1      # Vérifie uniquement les clés manquantes
  npm run check-i18n -- --step=2  # Vérifie uniquement les clés inutilisées
  npm run check-i18n -- -h        # Affiche cette aide
`)
}

main()
