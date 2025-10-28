#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Configuration centralisée de la répartition des clés par domaine
 * Cette configuration est utilisée par tous les scripts de traduction
 * pour garantir la cohérence de l'organisation des fichiers.
 *
 * Note sur le lazy loading:
 * - Les fichiers listés ici sont généralement chargés globalement via nuxt.config.ts
 * - Certains fichiers peuvent être exclus de la config globale et chargés au niveau
 *   composant via le composable useLazyI18n() (ex: permissions.json)
 */
export const SPLIT_CONFIG = {
  common: [
    'common',
    'navigation',
    'footer',
    'errors',
    'messages',
    'validation',
    'countries',
    'dates',
    'log',
    'c',
    'calendar',
  ],
  admin: ['admin'],
  edition: ['editions', 'conventions', 'collaborators', 'carpool', 'diet'],
  auth: ['auth', 'profile'],
  permissions: ['permissions'], // Chargé au niveau composant via useLazyI18n('permissions')
  feedback: ['feedback'], // Chargé au niveau composant via useLazyI18n('feedback')
  public: ['homepage', 'pages', 'seo'],
  components: ['components', 'forms', 'upload'],
  notifications: ['notifications', 'push_notifications'],
  ticketing: ['ticketing'],
  workshops: ['workshops'],
  artists: ['artists'],
  gestion: ['gestion'],
  app: ['app', 'pwa', 'services'],
}

export const LOCALES_DIR = path.join(__dirname, '..', '..', 'i18n', 'locales')

/**
 * Détermine le fichier de domaine cible pour une clé donnée
 */
export function getTargetFile(key) {
  const topLevelKey = key.split('.')[0]
  for (const [file, keys] of Object.entries(SPLIT_CONFIG)) {
    if (keys.includes(topLevelKey)) {
      return file
    }
  }
  return 'common' // Par défaut
}

/**
 * Fonction de tri récursif des clés d'un objet
 */
export function sortKeys(obj) {
  if (Array.isArray(obj) || obj === null || typeof obj !== 'object') return obj
  const out = {}
  for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key])
  return out
}

/**
 * Écrit les données dans les fichiers de domaine d'une langue
 * @param {string} locale - Code de la langue
 * @param {object} data - Données aplaties à écrire
 * @param {object} fileMapping - (Optionnel) Mapping clé -> fichier source. Si fourni, utilise ce mapping au lieu de SPLIT_CONFIG
 */
export function writeLocaleFiles(locale, data, fileMapping = null) {
  const localeDir = path.join(LOCALES_DIR, locale)

  // S'assurer que le dossier de la langue existe
  if (!fs.existsSync(localeDir)) {
    fs.mkdirSync(localeDir, { recursive: true })
  }

  // Organiser les données par fichier de domaine
  const fileContents = {}

  // Déterminer quels fichiers nous allons créer
  if (fileMapping) {
    // Utiliser le mapping fourni (provenant de la langue de référence)
    const targetFiles = new Set(Object.values(fileMapping))
    for (const file of targetFiles) {
      fileContents[file] = {}
    }
  } else {
    // Utiliser SPLIT_CONFIG par défaut (rétrocompatibilité)
    for (const file of Object.keys(SPLIT_CONFIG)) {
      fileContents[file] = {}
    }
  }

  // Répartir les clés dans les bons fichiers
  for (const [key, value] of Object.entries(data)) {
    let targetFile
    if (fileMapping && fileMapping[key]) {
      // Utiliser le mapping si disponible
      targetFile = fileMapping[key]
    } else {
      // Sinon utiliser SPLIT_CONFIG
      targetFile = getTargetFile(key)
    }

    if (!fileContents[targetFile]) {
      fileContents[targetFile] = {}
    }
    fileContents[targetFile][key] = value
  }

  // Écrire chaque fichier de domaine
  let updatedFiles = 0
  for (const [file, content] of Object.entries(fileContents)) {
    const filePath = path.join(localeDir, `${file}.json`)
    if (Object.keys(content).length > 0) {
      // Convertir les données aplaties en structure imbriquée avant d'écrire
      const nested = unflattenObject(content)
      const sorted = sortKeys(nested)
      fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8')
      updatedFiles++
    } else if (fs.existsSync(filePath)) {
      // Supprimer les fichiers vides
      fs.unlinkSync(filePath)
    }
  }

  return updatedFiles
}

/**
 * Fusionne profondément deux objets (deep merge)
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {}
      }
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

/**
 * Charge tous les fichiers JSON d'un dossier de langue et les fusionne
 * @param {string} locale - Code de la langue (ex: "fr", "en")
 * @param {boolean} withFileMapping - Si true, retourne aussi un mapping clé -> fichier source
 * @returns {object|null} Les données fusionnées, ou { data, fileMapping } si withFileMapping=true
 */
export function loadLocaleFiles(locale, withFileMapping = false) {
  const localeDir = path.join(LOCALES_DIR, locale)

  if (!fs.existsSync(localeDir) || !fs.statSync(localeDir).isDirectory()) {
    return null
  }

  const files = fs.readdirSync(localeDir).filter((file) => file.endsWith('.json'))

  if (files.length === 0) {
    return null
  }

  // Fusionner tous les fichiers de cette langue
  const mergedData = {}
  const fileMapping = {} // clé aplatie -> nom du fichier source (sans .json)

  for (const file of files) {
    const filePath = path.join(localeDir, file)
    const content = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(content)

    // Si on veut le mapping, enregistrer de quel fichier vient chaque clé
    if (withFileMapping) {
      const fileName = file.replace('.json', '')
      const flatData = flattenObject(data)
      for (const key of Object.keys(flatData)) {
        fileMapping[key] = fileName
      }
    }

    // Utiliser deepMerge au lieu de Object.assign pour préserver les structures imbriquées
    deepMerge(mergedData, data)
  }

  return withFileMapping ? { data: mergedData, fileMapping } : mergedData
}

/**
 * Aplatit un objet imbriqué en utilisant la notation point
 */
export function flattenObject(obj, prefix = '') {
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

/**
 * Reconstruit un objet imbriqué depuis un objet aplati
 */
export function unflattenObject(flat) {
  const rebuilt = {}
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split('.').filter(Boolean)
    let cursor = rebuilt
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      const last = i === parts.length - 1
      if (last) {
        cursor[p] = v
      } else {
        if (typeof cursor[p] !== 'object' || cursor[p] === null || Array.isArray(cursor[p])) {
          cursor[p] = {}
        }
        cursor = cursor[p]
      }
    }
  }
  return rebuilt
}
