#!/usr/bin/env node

/**
 * Script pour marquer des clés de traduction comme [TODO] dans toutes les langues (sauf fr)
 *
 * Utilisation :
 *   node scripts/translation/mark-todo.js                                      # Auto-détecte les clés modifiées
 *   node scripts/translation/mark-todo.js gestion.ticketing.stats_view_items   # Clés spécifiques
 *   node scripts/translation/mark-todo.js --keys "key1,key2"                   # Avec option --keys
 *
 * Options :
 *   --keys      : Liste de clés séparées par des virgules
 *   --langs     : Langues cibles (par défaut : toutes sauf fr)
 *   --dry-run   : Simulation sans modification des fichiers
 *   --help      : Afficher l'aide
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { LOCALES_ROOTS } from './shared-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const LOCALES_DIR = path.resolve(__dirname, '../../i18n/locales')
/**
 * Racine du dépôt, distincte de celle de l'application depuis le passage en monorepo.
 *
 * `git diff --name-only` renvoie des chemins relatifs à la racine du dépôt — donc préfixés
 * `apps/app1/` — alors que les commandes git tournent depuis l'application. Les résoudre depuis
 * cette dernière donnait `apps/app1/apps/app1/…` et le mode automatique ne trouvait plus rien.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const REFERENCE_LANG = 'fr'
const ALL_LANGS = ['cs', 'da', 'de', 'en', 'es', 'it', 'nl', 'pl', 'pt', 'ru', 'sv', 'uk']

/**
 * Dossiers français à scruter, relatifs à la racine du dépôt.
 *
 * Un layer porte ses propres traductions : n'observer que celui de l'application laissait
 * reformuler un libellé français sans que les douze autres langues soient marquées, et les
 * traductions périmées restaient en place sans que rien ne le signale.
 */
const CHEMINS_FR = LOCALES_ROOTS.map(
  (racine) => `${path.relative(REPO_ROOT, racine.dir).split(path.sep).join('/')}/${REFERENCE_LANG}/`
)

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

/**
 * Afficher l'aide
 */
function showHelp() {
  console.log(`
${colors.bright}${colors.blue}Script mark-todo.js${colors.reset}

${colors.bright}Description :${colors.reset}
  Marque des clés de traduction comme [TODO] dans toutes les langues (sauf français)

  ${colors.yellow}Mode automatique :${colors.reset} Sans arguments, détecte automatiquement les clés modifiées
  dans les fichiers français non commités (via git diff)

${colors.bright}Utilisation :${colors.reset}
  ${colors.cyan}node scripts/translation/mark-todo.js${colors.reset}                    # Mode automatique
  ${colors.cyan}node scripts/translation/mark-todo.js [options] <clé1> <clé2> ...${colors.reset}

${colors.bright}Arguments :${colors.reset}
  <clé>       Clé complète en notation point (ex: gestion.ticketing.stats_view_items)

${colors.bright}Options :${colors.reset}
  --keys      Liste de clés séparées par des virgules
  --langs     Langues cibles (par défaut : toutes sauf fr)
  --dry-run   Simulation sans modification des fichiers
  --help      Afficher cette aide

${colors.bright}Exemples :${colors.reset}
  ${colors.green}# Mode automatique (détecte les clés modifiées)${colors.reset}
  node scripts/translation/mark-todo.js

  ${colors.green}# Marquer des clés spécifiques${colors.reset}
  node scripts/translation/mark-todo.js gestion.ticketing.stats_view_items gestion.ticketing.stats_items

  ${colors.green}# Avec option --keys${colors.reset}
  node scripts/translation/mark-todo.js --keys "gestion.ticketing.stats_view_items,gestion.ticketing.stats_items"

  ${colors.green}# Simulation (dry-run)${colors.reset}
  node scripts/translation/mark-todo.js --dry-run gestion.ticketing.stats_view_items

  ${colors.green}# Langues spécifiques uniquement${colors.reset}
  node scripts/translation/mark-todo.js --langs "en,de,es" gestion.ticketing.stats_view_items
`)
}

/**
 * Parser les arguments de ligne de commande
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    keys: [],
    langs: ALL_LANGS,
    dryRun: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--keys') {
      i++
      if (i < args.length) {
        options.keys.push(...args[i].split(',').map((k) => k.trim()))
      }
    } else if (arg === '--langs') {
      i++
      if (i < args.length) {
        options.langs = args[i].split(',').map((l) => l.trim())
      }
    } else if (!arg.startsWith('--')) {
      options.keys.push(arg)
    }
  }

  return options
}

/**
 * Charger un fichier JSON
 */
function loadJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`${colors.red}Erreur lecture ${filePath}: ${error.message}${colors.reset}`)
    return null
  }
}

/**
 * Sauvegarder un fichier JSON
 */
function saveJson(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2) + '\n'
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (error) {
    console.error(`${colors.red}Erreur écriture ${filePath}: ${error.message}${colors.reset}`)
    return false
  }
}

/**
 * Récupérer la valeur d'une clé en notation point
 * Ex: "gestion.ticketing.stats_view_items" -> obj.gestion.ticketing.stats_view_items
 */
function getNestedValue(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return undefined
    }
  }

  return current
}

/**
 * Définir la valeur d'une clé en notation point
 */
function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.')
  const lastKey = keys.pop()
  let current = obj

  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {}
    }
    current = current[key]
  }

  current[lastKey] = value
  return true
}

/**
 * Détecter les clés modifiées dans les fichiers français via git diff
 */
function detectModifiedKeys() {
  try {
    // Récupérer le diff des fichiers français non commités
    const gitDiff = execSync(`git diff HEAD -- ${CHEMINS_FR.join(' ')}`, {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
    })

    if (!gitDiff.trim()) {
      return []
    }

    const modifiedKeys = new Set()
    const lines = gitDiff.split('\n')

    let currentFile = null
    let currentPrefix = null

    for (const line of lines) {
      // Détecter le fichier en cours
      if (line.startsWith('diff --git')) {
        const match = line.match(/i18n\/locales\/fr\/([^/]+)\.json/)
        if (match) {
          currentFile = match[1]
        }
      }

      // Analyser les lignes modifiées (lignes commençant par + ou -)
      // On cherche les lignes qui modifient des valeurs de traduction
      if (line.startsWith('+') || line.startsWith('-')) {
        // Ignorer les lignes de metadata git
        if (line.startsWith('+++') || line.startsWith('---')) continue

        // Chercher les clés JSON modifiées
        // Format: "    "key": "value"" ou "  "key": {"
        const keyMatch = line.match(/^\s*[+-]\s*"([^"]+)"\s*:/)
        if (keyMatch) {
          const key = keyMatch[1]

          // Construire le chemin complet de la clé
          // Pour simplifier, on considère que si une clé est modifiée, c'est elle qu'on doit marquer
          if (currentFile) {
            // Si le fichier est par exemple "gestion.json", le préfixe est "gestion"
            const fullKey = `${currentFile}.${key}`
            modifiedKeys.add(fullKey)
          }
        }
      }
    }

    return Array.from(modifiedKeys)
  } catch (error) {
    // Si git diff échoue (pas de git, pas de repo, etc.), retourner un tableau vide
    if (error.status !== 0 && error.stderr) {
      console.error(`${colors.yellow}⚠️  Git diff échoué : ${error.message}${colors.reset}`)
    }
    return []
  }
}

/**
 * Extraire toutes les clés d'un objet JSON de manière récursive
 */
function extractAllKeys(obj, prefix = '') {
  const keys = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // C'est un objet imbriqué, récursion
      keys.push(...extractAllKeys(value, fullKey))
    } else if (typeof value === 'string') {
      // C'est une valeur de traduction
      keys.push(fullKey)
    }
  }

  return keys
}

/**
 * Détecter les clés modifiées avec une analyse plus précise du diff
 */
function detectModifiedKeysAdvanced() {
  try {
    // Récupérer la liste des fichiers français modifiés
    const modifiedFiles = execSync(`git diff --name-only HEAD -- ${CHEMINS_FR.join(' ')}`, {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
    })
      .trim()
      .split('\n')
      .filter((f) => f.endsWith('.json'))

    if (modifiedFiles.length === 0 || (modifiedFiles.length === 1 && !modifiedFiles[0])) {
      return []
    }

    const modifiedKeys = []

    for (const filePath of modifiedFiles) {
      // Charger la version actuelle du fichier. Le chemin vient de git, donc relatif à la racine
      // du dépôt : c'est de là qu'il faut le résoudre, pas depuis l'application.
      const fullPath = path.resolve(REPO_ROOT, filePath)
      const currentData = loadJson(fullPath)
      if (!currentData) continue

      // Charger la version committée du fichier
      let committedContent
      try {
        committedContent = execSync(`git show HEAD:${filePath}`, {
          encoding: 'utf-8',
          cwd: path.resolve(__dirname, '../..'),
        })
      } catch (error) {
        // Le fichier n'existe pas dans HEAD (nouveau fichier)
        // Toutes les clés sont nouvelles
        const allKeys = extractAllKeys(currentData)
        modifiedKeys.push(...allKeys)
        continue
      }

      const committedData = JSON.parse(committedContent)

      // Comparer les deux versions pour trouver les clés modifiées
      const currentKeys = extractAllKeys(currentData)

      for (const key of currentKeys) {
        const currentValue = getNestedValue(currentData, key)
        const committedValue = getNestedValue(committedData, key)

        // La clé est modifiée si :
        // 1. Elle n'existait pas avant
        // 2. Sa valeur a changé
        if (currentValue !== committedValue) {
          modifiedKeys.push(key)
        }
      }
    }

    return modifiedKeys
  } catch (error) {
    console.error(
      `${colors.yellow}⚠️  Erreur détection clés modifiées : ${error.message}${colors.reset}`
    )
    return []
  }
}

/**
 * Trouver le fichier qui contient une clé
 */
function findFileForKey(lang, keyPath) {
  // Toutes les racines, pas seulement celle de l'application : reformuler un libellé français
  // porté par un layer ne marquait aucune autre langue, et les douze traductions restaient en
  // place, périmées, sans que rien ne le signale.
  for (const racine of LOCALES_ROOTS) {
    const langDir = path.join(racine.dir, lang)
    if (!fs.existsSync(langDir)) continue

    for (const file of fs.readdirSync(langDir).filter((f) => f.endsWith('.json'))) {
      const filePath = path.join(langDir, file)
      const data = loadJson(filePath)
      if (data && getNestedValue(data, keyPath) !== undefined) {
        return filePath
      }
    }
  }

  return null
}

/**
 * Marquer une clé comme [TODO] dans une langue
 */
function markKeyAsTodo(lang, keyPath, dryRun = false) {
  const filePath = findFileForKey(lang, keyPath)

  if (!filePath) {
    return { success: false, reason: 'Clé non trouvée' }
  }

  const data = loadJson(filePath)
  if (!data) {
    return { success: false, reason: 'Erreur de lecture' }
  }

  const currentValue = getNestedValue(data, keyPath)

  if (typeof currentValue !== 'string') {
    return { success: false, reason: 'Valeur non-string' }
  }

  if (currentValue.startsWith('[TODO]')) {
    return { success: false, reason: 'Déjà marqué [TODO]' }
  }

  const newValue = `[TODO] ${currentValue}`

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      filePath,
      oldValue: currentValue,
      newValue,
    }
  }

  setNestedValue(data, keyPath, newValue)

  if (!saveJson(filePath, data)) {
    return { success: false, reason: 'Erreur de sauvegarde' }
  }

  return {
    success: true,
    filePath,
    oldValue: currentValue,
    newValue,
  }
}

/**
 * Script principal
 */
function main() {
  const options = parseArgs()

  if (options.help) {
    showHelp()
    process.exit(0)
  }

  // Si aucune clé n'est fournie, détecter automatiquement les clés modifiées
  if (options.keys.length === 0) {
    console.log(
      `${colors.cyan}🔍 Mode automatique : détection des clés modifiées...${colors.reset}\n`
    )

    const detectedKeys = detectModifiedKeysAdvanced()

    if (detectedKeys.length === 0) {
      console.log(
        `${colors.yellow}Aucune clé modifiée détectée dans les fichiers français (i18n/locales/fr/)${colors.reset}`
      )
      console.log(
        `${colors.dim}Astuce : Modifiez des traductions françaises ou spécifiez des clés manuellement${colors.reset}\n`
      )
      process.exit(0)
    }

    console.log(
      `${colors.green}✓ ${detectedKeys.length} clé(s) modifiée(s) détectée(s) :${colors.reset}`
    )
    detectedKeys.forEach((key) => console.log(`  - ${key}`))
    console.log()

    // Demander confirmation
    console.log(
      `${colors.yellow}Ces clés vont être marquées comme [TODO] dans toutes les langues (sauf fr)${colors.reset}`
    )
    console.log(
      `${colors.dim}Appuyez sur Ctrl+C pour annuler ou Entrée pour continuer...${colors.reset}`
    )

    // En mode automatique, on attend une confirmation (sauf si --dry-run)
    if (!options.dryRun) {
      try {
        execSync('read -p ""', { stdio: 'inherit', shell: '/bin/bash' })
      } catch (error) {
        // L'utilisateur a annulé (Ctrl+C)
        console.log(`\n${colors.yellow}Opération annulée${colors.reset}`)
        process.exit(0)
      }
    }

    options.keys = detectedKeys
  }

  console.log(`${colors.bright}${colors.blue}=== Marquage des clés [TODO] ===${colors.reset}\n`)

  if (options.dryRun) {
    console.log(
      `${colors.yellow}⚠️  Mode DRY-RUN : Aucune modification ne sera effectuée${colors.reset}\n`
    )
  }

  console.log(`${colors.cyan}Clés à marquer :${colors.reset}`)
  options.keys.forEach((key) => console.log(`  - ${key}`))
  console.log()

  console.log(`${colors.cyan}Langues cibles :${colors.reset} ${options.langs.join(', ')}\n`)

  let totalSuccess = 0
  let totalSkipped = 0
  let totalErrors = 0

  // Statistiques par clé
  const stats = {}

  for (const key of options.keys) {
    console.log(`${colors.bright}${key}${colors.reset}`)
    stats[key] = { success: [], skipped: [], errors: [] }

    for (const lang of options.langs) {
      const result = markKeyAsTodo(lang, key, options.dryRun)

      if (result.success) {
        totalSuccess++
        stats[key].success.push(lang)
        const dryRunLabel = result.dryRun ? ` ${colors.yellow}(dry-run)${colors.reset}` : ''
        console.log(
          `  ${colors.green}✓${colors.reset} ${lang}: "${result.oldValue}" → "${result.newValue}"${dryRunLabel}`
        )
      } else {
        if (result.reason === 'Clé non trouvée' || result.reason === 'Déjà marqué [TODO]') {
          totalSkipped++
          stats[key].skipped.push(lang)
          console.log(`  ${colors.yellow}○${colors.reset} ${lang}: ${result.reason}`)
        } else {
          totalErrors++
          stats[key].errors.push(lang)
          console.log(`  ${colors.red}✗${colors.reset} ${lang}: ${result.reason}`)
        }
      }
    }

    console.log()
  }

  // Résumé
  console.log(`${colors.bright}${colors.blue}=== Résumé ===${colors.reset}`)
  console.log(`${colors.green}✓ Marquées :${colors.reset} ${totalSuccess}`)
  console.log(`${colors.yellow}○ Ignorées :${colors.reset} ${totalSkipped}`)
  if (totalErrors > 0) {
    console.log(`${colors.red}✗ Erreurs :${colors.reset} ${totalErrors}`)
  }

  if (options.dryRun) {
    console.log(
      `\n${colors.yellow}Aucune modification n'a été effectuée (dry-run). Relancez sans --dry-run pour appliquer les changements.${colors.reset}`
    )
  }
}

main()
