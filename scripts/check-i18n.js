#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

import { glob } from 'glob'

import {
  SPLIT_CONFIG,
  getTargetFile,
  flattenObject as sharedFlattenObject,
  writeLocaleFiles,
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
const localeDir = path.join(projectRoot, 'i18n', 'locales', 'fr')

// Fichiers à exclure de l'analyse (qui génèrent des faux positifs)
// Ces fichiers contiennent leurs propres traductions intégrées
const EXCLUDED_FILES = ['app/pages/privacy-policy.vue']

// Fichiers exclus uniquement de l'étape 4 (textes hardcodés)
// Ces fichiers contiennent des textes techniques intentionnellement non traduits
const EXCLUDED_HARDCODED_FILES = [
  'app/components/admin/ImportDocumentation.vue', // Documentation technique d'import
]

/**
 * Détecte si un fichier Vue utilise useI18n({ useScope: 'local' })
 * Ces fichiers ont leurs traductions intégrées dans des blocs <i18n>
 * et leurs appels t() ne doivent pas être analysés comme des clés globales.
 */
function usesLocalScope(content) {
  return /useI18n\(\s*\{\s*useScope:\s*['"]local['"]\s*\}/.test(content)
}

// Dossiers à exclure de l'analyse (patterns)
const EXCLUDED_DIRS = [
  'server/generated/', // Fichiers générés par Prisma
]

/**
 * Clés détectées comme manquantes mais qui sont des faux positifs.
 * Supporte les patterns exacts et les préfixes avec wildcard (*).
 * Exemples :
 *   'facebook.com'        → ignore exactement 'facebook.com'
 *   'edition.imageUrl'    → ignore exactement 'edition.imageUrl'
 *   'example.*'           → ignore 'example.com', 'example.fr', etc.
 */
const IGNORED_MISSING_KEYS = [
  // Noms de domaine détectés comme clés i18n (dans useUrlValidation.ts et emailService.ts)
  'facebook.com',
  'example.*',
  // Noms de champs Prisma utilisés dans ai-update.vue (pas des clés i18n)
  'edition.imageUrl',
  'edition.startDate',
  'edition.endDate',
  'edition.description',
  'edition.name',
  'edition.addressLine1',
  'edition.city',
  'edition.country',
  'edition.postalCode',
  'edition.ticketingUrl',
  'edition.facebookUrl',
  'edition.instagramUrl',
  'edition.officialWebsiteUrl',
  'edition.latitude',
  'edition.longitude',
  'convention.logo',
  'convention.name',
  'convention.email',
  'convention.description',
]

/**
 * Vérifie si une clé correspond à un pattern ignoré.
 */
function isIgnoredMissingKey(key) {
  return IGNORED_MISSING_KEYS.some((pattern) => {
    if (pattern.endsWith('.*')) {
      return key.startsWith(pattern.slice(0, -1))
    }
    return key === pattern
  })
}

/**
 * Fusionne profondément deux objets (deep merge)
 */
function deepMerge(target, source) {
  const result = { ...target }
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

/**
 * Charge tous les fichiers de traduction depuis le dossier de locale
 * et les fusionne en un seul objet
 */
function loadLocaleFiles() {
  try {
    // Vérifier que le dossier existe
    if (!fs.existsSync(localeDir)) {
      console.error(`${RED}Erreur: Le dossier ${localeDir} n'existe pas${RESET}`)
      process.exit(1)
    }

    // Lister tous les fichiers JSON dans le dossier
    const files = fs.readdirSync(localeDir).filter((file) => file.endsWith('.json'))

    if (files.length === 0) {
      console.error(`${RED}Erreur: Aucun fichier de traduction trouvé dans ${localeDir}${RESET}`)
      process.exit(1)
    }

    // Fusionner tous les fichiers avec deep merge
    let mergedData = {}
    for (const file of files) {
      const filePath = path.join(localeDir, file)
      const content = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(content)
      mergedData = deepMerge(mergedData, data)
    }

    console.log(
      `${CYAN}Chargé ${files.length} fichier(s) de traduction: ${files.join(', ')}${RESET}\n`
    )

    return mergedData
  } catch (error) {
    console.error(
      `${RED}Erreur lors du chargement des fichiers de traduction:${RESET}`,
      error.message
    )
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

function removeKeysFromObject(obj, keysToRemove) {
  const newObj = { ...obj }

  for (const keyToRemove of keysToRemove) {
    const keyParts = keyToRemove.split('.')
    let current = newObj

    // Naviguer jusqu'au parent de la clé à supprimer
    for (let i = 0; i < keyParts.length - 1; i++) {
      if (current[keyParts[i]]) {
        current = current[keyParts[i]]
      } else {
        break
      }
    }

    // Supprimer la clé
    const lastKey = keyParts[keyParts.length - 1]
    if (current && Object.prototype.hasOwnProperty.call(current, lastKey)) {
      delete current[lastKey]

      // Nettoyer les objets vides remontant dans la hiérarchie
      let parent = newObj
      for (let i = 0; i < keyParts.length - 2; i++) {
        parent = parent[keyParts[i]]
      }

      // Si l'objet parent est vide après suppression, on le supprime aussi
      if (keyParts.length > 1) {
        const parentKey = keyParts[keyParts.length - 2]
        if (current && typeof current === 'object' && Object.keys(current).length === 0) {
          let grandParent = newObj
          for (let i = 0; i < keyParts.length - 2; i++) {
            grandParent = grandParent[keyParts[i]]
          }
          if (grandParent) {
            delete grandParent[parentKey]
          }
        }
      }
    }
  }

  return newObj
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

function removeComments(content) {
  // Supprimer les commentaires JavaScript/TypeScript
  let result = content

  // 1. Supprimer les commentaires multi-lignes /* ... */
  result = result.replace(/\/\*[\s\S]*?\*\//g, '')

  // 2. Supprimer les commentaires de ligne // ...
  // Attention à ne pas supprimer les // dans les strings
  result = result.replace(/\/\/.*$/gm, '')

  return result
}

function preprocessVueContent(content) {
  // Créer une copie du contenu pour le traitement
  let processedContent = content

  // 1. Supprimer le contenu des interpolations {{ }} SEULEMENT si elles ne contiennent pas d'appels de traduction
  processedContent = processedContent.replace(/\{\{([^}]*)\}\}/g, (match, inner) => {
    // Garder les interpolations qui contiennent $t( ou t(
    if (inner.includes('$t(') || inner.includes('t(')) {
      return match
    }
    // Supprimer les autres (accès aux propriétés d'objets comme volunteer.user.phone)
    return ''
  })

  // 2. Supprimer complètement le contenu des directives conditionnelles et de liaison
  // Ces directives ne peuvent jamais contenir de traduction directe (seulement des conditions JS)
  // Supporte les modificateurs avec : et . (ex: v-model:value, v-model.number, v-model.trim)
  processedContent = processedContent.replace(
    /(\s+v-(?:model|if|else-if|show|for)(?:[:.][\w-]+)*\s*=\s*)(["'])([^"']*)\2/g,
    (_match, directive, quote) => {
      return directive + quote + quote
    }
  )

  // 3. Supprimer le contenu des autres directives Vue SEULEMENT si elles ne contiennent pas d'appels de traduction
  processedContent = processedContent.replace(
    /(\s+(?:v-(?:bind|on)|[@:][\w-]*)\s*=\s*)(["'])([^"']*)\2/g,
    (match, directive, quote, value) => {
      // Garder les directives qui contiennent $t( ou t(
      if (value.includes('$t(') || value.includes('t(')) {
        return match
      }
      // Supprimer les autres (conditions comme volunteer.user.phone, formState.maxVolunteers, etc.)
      return directive + quote + quote
    }
  )

  // 4. Supprimer les directives sans valeur (v-else)
  processedContent = processedContent.replace(/\s+v-else\b/g, '')

  return processedContent
}

function extractI18nKeysFromFile(filePath) {
  const originalContent = fs.readFileSync(filePath, 'utf8')
  let content = originalContent
  const keys = new Map() // Map<key, {line: number}>

  // Ignorer les fichiers Vue qui utilisent useI18n({ useScope: 'local' })
  // Leurs appels t() référencent des traductions locales (<i18n> bloc), pas des clés globales
  if (filePath.endsWith('.vue') && usesLocalScope(originalContent)) {
    return keys
  }

  // Pour les fichiers Vue, prétraiter le contenu pour exclure les directives et interpolations
  if (filePath.endsWith('.vue')) {
    content = preprocessVueContent(content)
  }

  // Pour les fichiers TS/JS, supprimer les commentaires
  if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
    content = removeComments(content)
  }

  // Fonction helper pour ajouter une clé avec sa ligne
  const addKey = (key, index) => {
    const line = getLineNumber(originalContent, index)
    if (!keys.has(key)) {
      keys.set(key, { line })
    }
  }

  // $t('key') ou $t("key")
  const tFunctionRegex = /\$t\(['"]([\w.]+)['"]/g
  let match
  while ((match = tFunctionRegex.exec(content)) !== null) {
    addKey(match[1], match.index)
  }

  // t('key') ou t("key") - plus permissif pour capturer t(type.label) etc.
  const tMethodRegex = /\bt\(\s*['"]([\w.]+)['"]\s*\)/g
  while ((match = tMethodRegex.exec(content)) !== null) {
    addKey(match[1], match.index)
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
        addKey('__DYNAMIC_PREFIX__' + prefix, match.index)
      }
    } else {
      // Template sans interpolation
      addKey(template, match.index)
    }
  }

  // $t(`key`) avec template littéraux
  const dollarTTemplateRegex = /\$t\(\s*`([^`]+)`\s*\)/g
  while ((match = dollarTTemplateRegex.exec(content)) !== null) {
    const template = match[1]
    if (template.includes('${')) {
      const staticParts = template.split(/\$\{[^}]+\}/)
      if (staticParts[0] && staticParts[0].endsWith('.')) {
        addKey('__DYNAMIC_PREFIX__' + staticParts[0], match.index)
      }
    } else {
      addKey(template, match.index)
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

    // Vérifier si on est dans un attribut :key= (faux positif fréquent)
    const matchStart = match.index
    const beforeMatch = content.substring(Math.max(0, matchStart - 30), matchStart)
    const isInKeyAttribute = /:key\s*=\s*$/.test(beforeMatch)

    if (isInKeyAttribute) {
      continue // Ignorer les propriétés d'objets dans :key=
    }

    // Vérifier si on est dans une propriété accessorKey (définitions de colonnes de table)
    const isInAccessorKey = /accessorKey\s*:\s*$/.test(beforeMatch)

    if (isInAccessorKey) {
      continue // Ignorer les valeurs dans accessorKey: 'user.email'
    }

    // Vérifier si on est dans un contexte includes() (ex: .includes('helloasso.com'))
    if (isInIncludesContext(content, matchStart)) {
      continue // Ignorer les strings dans includes()
    }

    // Filtrer les faux positifs
    // - Exclure les propriétés d'objets JavaScript communes
    // - Exclure les noms de domaine utilisés dans les scrapers
    const jsObjectPatterns = [
      'leaflet',
      'backup.tar.gz',
      // Domaines de billetterie (utilisés dans les scrapers)
      'trybooking.com',
      'helloasso.com',
      'shotgun.live',
      'jugglingedge.com',
      'www.jugglingedge.com',
    ]

    // Exceptions - ces patterns sont valides même s'ils commencent par un mot réservé
    const validI18nPatterns = []

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
      addKey(potentialKey, matchStart)
    }
  }

  // i18n.global.t('key') ou i18n.global.t("key")
  const globalTRegex = /i18n\.global\.t\(['"]([\w.]+)['"]/g
  while ((match = globalTRegex.exec(content)) !== null) {
    addKey(match[1], match.index)
  }

  // useI18n et const { t } = useI18n()
  const useI18nRegex = /useI18n\(\)/g
  if (useI18nRegex.test(content)) {
    const localTRegex = /(?:^|\s)t\(['"]([\w.]+)['"]\s*\)/g
    while ((match = localTRegex.exec(content)) !== null) {
      addKey(match[1], match.index)
    }
  }

  return keys
}

function extractHardcodedTexts(filePath) {
  // Ne cherche les textes hardcodés que dans les fichiers Vue
  if (!filePath.endsWith('.vue')) {
    return []
  }

  // Exclure les fichiers de documentation technique
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/')
  if (EXCLUDED_HARDCODED_FILES.some((f) => relativePath === f)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const hardcodedTexts = []

  // Extraire le template
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/)
  if (!templateMatch) return hardcodedTexts

  // Retirer le contenu des balises <code>, <pre> et <script> pour éviter les faux positifs
  const template = templateMatch[1].replace(/<(code|pre|script)[^>]*>[\s\S]*?<\/\1>/gi, '')

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

/**
 * Vérifie si une string est dans un contexte includes()
 * Retourne true si la string est utilisée dans une fonction includes()
 */
function isInIncludesContext(content, matchIndex) {
  // Chercher en arrière pour voir si on est dans un contexte includes()
  const maxLookback = 50 // Nombre de caractères à regarder en arrière
  const startIndex = Math.max(0, matchIndex - maxLookback)
  const beforeMatch = content.substring(startIndex, matchIndex)

  // Vérifier si on a un pattern includes( juste avant notre match
  // Pattern: .includes( ou includes( avec possibles espaces
  return /\.includes\s*\(\s*$/.test(beforeMatch) || /\bincludes\s*\(\s*$/.test(beforeMatch)
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
    // glob v10+ retourne un itérable, il faut le convertir en tableau
    files = files.concat([...found])
  }

  // Filtrer les fichiers exclus (fichiers individuels et dossiers)
  const filteredFiles = files.filter((file) => {
    const relativePath = path.relative(projectRoot, file).replace(/\\/g, '/')

    // Vérifier si le fichier est dans un dossier exclu
    const isInExcludedDir = EXCLUDED_DIRS.some((excludedDir) => {
      return relativePath.startsWith(excludedDir)
    })
    if (isInExcludedDir) return false

    // Vérifier si le fichier est exclu individuellement
    const isExcluded = EXCLUDED_FILES.some((excludedFile) => {
      const normalizedExcluded = excludedFile.replace(/\\/g, '/')
      return relativePath === normalizedExcluded
    })
    return !isExcluded
  })

  // Afficher les fichiers exclus si présents
  const excludedCount = files.length - filteredFiles.length
  if (excludedCount > 0) {
    console.log(
      `${YELLOW}ℹ️  ${excludedCount} fichier(s) exclu(s) de l'analyse (traductions per-component)${RESET}`
    )
  }

  return filteredFiles
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
    'delete-unused': {
      type: 'boolean',
      short: 'd',
      description: 'Supprime automatiquement les clés inutilisées (nécessite confirmation)',
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

  // Charger les fichiers de locale
  const localeData = loadLocaleFiles()
  const flatLocale = flattenObject(localeData)
  const localeKeys = new Set(Object.keys(flatLocale))

  // Collecter toutes les clés utilisées dans les fichiers
  // Map<key, Array<{file, line}>>
  const usedKeysMap = new Map()
  const hardcodedTexts = []
  const allFiles = await getAllRelevantFiles()

  // Séparer les fichiers par type pour les statistiques
  const vueFiles = allFiles.filter((file) => file.endsWith('.vue'))
  const tsFiles = allFiles.filter((file) => file.endsWith('.ts'))
  const jsFiles = allFiles.filter((file) => file.endsWith('.js'))

  // Compter les fichiers Vue avec scope local (exclus de l'analyse des clés)
  const localScopeFiles = vueFiles.filter((file) => {
    const content = fs.readFileSync(file, 'utf8')
    return usesLocalScope(content)
  })
  if (localScopeFiles.length > 0) {
    console.log(
      `${YELLOW}ℹ️  ${localScopeFiles.length} fichier(s) Vue avec useScope: 'local' (clés i18n ignorées)${RESET}`
    )
  }

  console.log(
    `${CYAN}Analyse de ${allFiles.length} fichiers (${vueFiles.length} Vue, ${tsFiles.length} TS, ${jsFiles.length} JS)...${RESET}\n`
  )

  for (const file of allFiles) {
    const keys = extractI18nKeysFromFile(file)
    const relativePath = path.relative(projectRoot, file)

    keys.forEach((location, key) => {
      if (!usedKeysMap.has(key)) {
        usedKeysMap.set(key, [])
      }
      usedKeysMap.get(key).push({
        file: relativePath,
        line: location.line,
      })
    })

    const hardcoded = extractHardcodedTexts(file)
    if (hardcoded.length > 0) {
      hardcodedTexts.push({ file: relativePath, texts: hardcoded })
    }
  }

  // Créer un Set simple pour la compatibilité avec le code existant
  const usedKeys = new Set(usedKeysMap.keys())

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
    const allMissingKeys = [...cleanUsedKeys].filter((key) => !localeKeys.has(key))
    const missingKeys = allMissingKeys.filter((key) => !isIgnoredMissingKey(key))
    const ignoredCount = allMissingKeys.length - missingKeys.length
    if (missingKeys.length > 0) {
      console.log(`${RED}✗ ${missingKeys.length} clé(s) manquante(s):${RESET}`)
      missingKeys.forEach((key) => {
        console.log(`  ${RED}- ${key}${RESET}`)
        // Afficher les emplacements où cette clé est utilisée
        const locations = usedKeysMap.get(key)
        if (locations && locations.length > 0) {
          locations.forEach((loc) => {
            console.log(`    ${CYAN}${loc.file}:${loc.line}${RESET}`)
          })
        }
      })
      hasErrors = true
    } else {
      console.log(`${GREEN}✓ Toutes les clés utilisées sont présentes${RESET}`)
    }
    if (ignoredCount > 0) {
      console.log(
        `${YELLOW}ℹ️  ${ignoredCount} faux positif(s) ignoré(s) (voir IGNORED_MISSING_KEYS)${RESET}`
      )
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

      // Option de suppression automatique
      if (args.values['delete-unused']) {
        console.log(
          `\n${BOLD}${RED}⚠ ATTENTION: Vous vous apprêtez à supprimer ${unusedKeys.length} clé(s) inutilisée(s) !${RESET}`
        )
        console.log(`${YELLOW}Une sauvegarde sera créée avant la suppression.${RESET}`)

        // Demander confirmation
        const readline = await import('readline')
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })

        const answer = await new Promise((resolve) => {
          rl.question(`${BOLD}Confirmez-vous la suppression ? (oui/non): ${RESET}`, (answer) => {
            rl.close()
            resolve(answer.toLowerCase())
          })
        })

        if (answer === 'oui' || answer === 'o' || answer === 'y' || answer === 'yes') {
          try {
            // Créer un dossier de sauvegarde
            const backupDir = path.join(
              projectRoot,
              'i18n',
              'locales-backup',
              `backup-${Date.now()}`
            )
            fs.mkdirSync(backupDir, { recursive: true })

            // Sauvegarder tous les fichiers français uniquement
            const files = fs.readdirSync(localeDir).filter((file) => file.endsWith('.json'))
            for (const file of files) {
              const srcPath = path.join(localeDir, file)
              const dstPath = path.join(backupDir, file)
              fs.copyFileSync(srcPath, dstPath)
            }
            console.log(`${GREEN}✓ Sauvegarde créée: ${path.basename(backupDir)}${RESET}`)

            // Supprimer les clés inutilisées du français uniquement
            const updatedLocaleData = removeKeysFromObject(localeData, unusedKeys)

            // Aplatir les données pour l'écriture (writeLocaleFiles attend des données aplaties)
            const flatUpdatedData = sharedFlattenObject(updatedLocaleData)

            // Écrire les fichiers mis à jour en utilisant la fonction partagée
            const updatedFiles = writeLocaleFiles('fr', flatUpdatedData)

            console.log(`${GREEN}✓ ${unusedKeys.length} clé(s) supprimée(s) avec succès !${RESET}`)
            console.log(`${CYAN}${updatedFiles} fichier(s) mis à jour${RESET}`)

            // Si on a supprimé des clés, on arrête ici (ne pas continuer les autres étapes)
            process.exit(0)
          } catch (error) {
            console.error(`${RED}❌ Erreur lors de la suppression: ${error.message}${RESET}`)
            process.exit(1)
          }
        } else {
          console.log(`${YELLOW}Suppression annulée.${RESET}`)
          // Si l'utilisateur annule, on arrête aussi (ne pas continuer les autres étapes)
          process.exit(0)
        }
      } else {
        console.log(
          `\n${CYAN}💡 Tip: Utilisez --delete-unused pour supprimer automatiquement ces clés${RESET}`
        )
      }
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
      console.log(`${YELLOW}⚠ Textes trouvés dans ${hardcodedTexts.length} fichier(s) Vue:${RESET}`)

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
    const allMissingSummary = [...cleanUsedKeys].filter((key) => !localeKeys.has(key))
    const missingSummary = allMissingSummary.filter((key) => !isIgnoredMissingKey(key))
    const ignoredSummary = allMissingSummary.length - missingSummary.length
    const unusedKeys = [...localeKeys].filter((key) => !cleanUsedKeys.has(key))
    const duplicates = findDuplicateValues(localeData)

    console.log(`\n${BOLD}${BLUE}=== Résumé ===${RESET}`)
    console.log(`Total de clés dans fr.json: ${localeKeys.size}`)
    console.log(`Total de clés utilisées: ${usedKeys.size}`)
    console.log(
      `Fichiers analysés: ${allFiles.length} (${vueFiles.length} Vue, ${tsFiles.length} TS, ${jsFiles.length} JS)`
    )
    console.log(`Clés manquantes: ${missingSummary.length}`)
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
  -s, --step <num>     Exécute uniquement l'étape spécifiée (1-4)
  -d, --delete-unused  Supprime automatiquement les clés inutilisées (avec confirmation)
  -h, --help           Affiche cette aide

${BOLD}Étapes disponibles:${RESET}
  1 - Clés manquantes dans fr.json (utilisées dans le code mais absentes)
  2 - Clés inutilisées dans fr.json (présentes mais non utilisées)
  3 - Valeurs dupliquées dans fr.json (même texte pour plusieurs clés)
  4 - Textes hardcodés dans les fichiers Vue (non traduits)

${BOLD}Exemples:${RESET}
  npm run check-i18n                     # Exécute toutes les vérifications
  npm run check-i18n -- -s 1             # Vérifie uniquement les clés manquantes
  npm run check-i18n -- --step=2         # Vérifie uniquement les clés inutilisées
  npm run check-i18n -- --delete-unused  # Supprime les clés inutilisées (avec confirmation)
  npm run check-i18n -- -s 2 -d          # Vérifie les clés inutilisées et les supprime
  npm run check-i18n -- -h               # Affiche cette aide

${BOLD}${YELLOW}Note sur --delete-unused:${RESET}
  • Une sauvegarde automatique est créée avant toute suppression
  • Une confirmation est demandée avant la suppression
  • Fonctionne avec toutes les étapes ou avec --step=2 uniquement
`)
}

main()
