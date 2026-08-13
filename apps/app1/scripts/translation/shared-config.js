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
  edition: ['editions', 'conventions', 'organizers', 'carpool', 'diet'],
  auth: ['auth'],
  profil: ['profile'],
  permissions: ['permissions'], // Chargé au niveau composant via useLazyI18n('permissions')
  feedback: ['feedback'], // Chargé au niveau composant via useLazyI18n('feedback')
  public: ['homepage', 'pages', 'seo'],
  components: ['components', 'forms', 'upload'],
  notifications: ['notifications', 'push_notifications'],
  ticketing: ['ticketing'],
  workshops: ['workshops'],
  artists: ['artists'],
  gestion: ['gestion'],
  // Domaines partagés public/gestion (namespace = nom du fichier)
  map: ['map'],
  tasks: ['tasks'],
  volunteers: ['volunteers'],
  // Note : les domaines gestion-map/gestion-tasks/gestion-volunteers utilisent le
  // namespace `gestion.*` (sous-clés map/task/volunteers) et ne peuvent pas être
  // distingués ici (top-level `gestion`). Leur répartition repose sur le mapping
  // par clé aplatie de la locale de référence (fileMapping), pas sur SPLIT_CONFIG.
  app: ['app', 'pwa', 'services'],
  messenger: ['messenger'],
  'project-costs': ['project_costs'],
  survey: ['survey'],
}

const APP_LOCALES_DIR = path.join(__dirname, '..', '..', 'i18n', 'locales')
const LAYERS_DIR = path.join(__dirname, '..', '..', '..', '..', 'layers')

/**
 * Dossier de locales de l'application.
 *
 * Conservé pour les scripts qui n'ont besoin que d'énumérer les langues — elles sont les mêmes
 * partout. Pour lire ou écrire des clés, passer par `LOCALES_ROOTS` : une partie d'entre elles
 * vit dans les layers.
 */
export const LOCALES_DIR = APP_LOCALES_DIR

/**
 * Tous les dossiers de locales du dépôt : celui de l'application, et celui de chaque layer qui
 * en déclare un.
 *
 * Les layers portent leurs propres traductions, au même titre que leurs pages et leurs points
 * d'API. Ne regarder que le dossier de l'application faisait dire à l'outillage « 0 clé
 * manquante » alors qu'une langue entière ignorait un fichier du layer — l'écart ne se voyait
 * qu'à l'exécution, sur une clé affichée en français au milieu d'une page anglaise.
 *
 * L'identifiant sert à savoir où réécrire une clé : une clé lue dans le layer doit y retourner,
 * et non atterrir dans un fichier de même nom côté application, qui l'aurait dupliquée.
 */
export const LOCALES_ROOTS = [
  { id: 'app', dir: APP_LOCALES_DIR },
  ...(fs.existsSync(LAYERS_DIR)
    ? fs
        .readdirSync(LAYERS_DIR)
        .map((layer) => ({ id: layer, dir: path.join(LAYERS_DIR, layer, 'i18n', 'locales') }))
        .filter((racine) => fs.existsSync(racine.dir))
    : []),
]

/** Sépare `"volunteers:volunteers"` en sa racine et son fichier de domaine. */
export function decouperCible(cible) {
  const separateur = cible.indexOf(':')
  if (separateur === -1) return { racineId: 'app', fichier: cible }
  return { racineId: cible.slice(0, separateur), fichier: cible.slice(separateur + 1) }
}

/** Réunit les langues présentes, quelle que soit la racine qui les porte. */
export function listerLangues() {
  const langues = new Set()
  for (const racine of LOCALES_ROOTS) {
    if (!fs.existsSync(racine.dir)) continue
    for (const item of fs.readdirSync(racine.dir)) {
      if (fs.statSync(path.join(racine.dir, item)).isDirectory()) langues.add(item)
    }
  }
  return [...langues].sort()
}

/**
 * Racine où réside déjà un fichier de domaine, à défaut de mapping explicite.
 *
 * Sans cette recherche, une écriture sans mapping renverrait `volunteers.json` dans
 * l'application, où un second fichier du même nom serait apparu à côté de celui du layer.
 */
function racineDuFichier(fichier, locale) {
  const existante = LOCALES_ROOTS.find((racine) =>
    fs.existsSync(path.join(racine.dir, locale, `${fichier}.json`))
  )
  return existante ? existante.id : 'app'
}

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
  // Organiser les données par cible « racine:fichier »
  const fileContents = {}

  // Déterminer quelles cibles nous allons écrire
  if (fileMapping) {
    // Utiliser le mapping fourni (provenant de la langue de référence)
    for (const cible of new Set(Object.values(fileMapping))) {
      fileContents[cible] = {}
    }
  } else {
    // Utiliser SPLIT_CONFIG par défaut (rétrocompatibilité)
    for (const file of Object.keys(SPLIT_CONFIG)) {
      fileContents[`${racineDuFichier(file, locale)}:${file}`] = {}
    }
  }

  // Répartir les clés dans les bonnes cibles
  for (const [key, value] of Object.entries(data)) {
    let cible
    if (fileMapping && fileMapping[key]) {
      // Utiliser le mapping si disponible
      cible = fileMapping[key]
    } else {
      // Sinon utiliser SPLIT_CONFIG, en respectant la racine où le fichier vit déjà
      const file = getTargetFile(key)
      cible = `${racineDuFichier(file, locale)}:${file}`
    }

    if (!fileContents[cible]) {
      fileContents[cible] = {}
    }
    fileContents[cible][key] = value
  }

  // Écrire chaque fichier de domaine
  let updatedFiles = 0
  for (const [cible, content] of Object.entries(fileContents)) {
    const { racineId, fichier: file } = decouperCible(cible)
    const racine = LOCALES_ROOTS.find((r) => r.id === racineId) || LOCALES_ROOTS[0]
    const localeDir = path.join(racine.dir, locale)
    if (Object.keys(content).length > 0 && !fs.existsSync(localeDir)) {
      fs.mkdirSync(localeDir, { recursive: true })
    }
    const filePath = path.join(localeDir, `${file}.json`)
    if (Object.keys(content).length > 0) {
      // Préserver l'ordre des clés du fichier existant pour éviter tout diff de
      // réordonnancement : on réordonne `content` (aplati) selon l'ordre du fichier
      // déjà présent, puis on ajoute à la fin les éventuelles nouvelles clés.
      let orderedContent = content
      if (fs.existsSync(filePath)) {
        try {
          const existingFlat = flattenObject(JSON.parse(fs.readFileSync(filePath, 'utf8')))
          orderedContent = {}
          for (const k of Object.keys(existingFlat)) {
            if (k in content) orderedContent[k] = content[k]
          }
          for (const k of Object.keys(content)) {
            if (!(k in orderedContent)) orderedContent[k] = content[k]
          }
        } catch {
          orderedContent = content
        }
      }
      // Convertir les données aplaties en structure imbriquée avant d'écrire.
      const nested = unflattenObject(orderedContent)
      fs.writeFileSync(filePath, JSON.stringify(nested, null, 2) + '\n', 'utf8')
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
  // Fusionner tous les fichiers de cette langue, dans toutes les racines
  const mergedData = {}
  const fileMapping = {} // clé aplatie -> "racine:fichier" d'origine
  let fichiersLus = 0

  for (const racine of LOCALES_ROOTS) {
    const localeDir = path.join(racine.dir, locale)
    if (!fs.existsSync(localeDir) || !fs.statSync(localeDir).isDirectory()) continue

    for (const file of fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'))
      fichiersLus++

      // Si on veut le mapping, enregistrer d'où vient chaque clé — racine comprise, sans quoi
      // une réécriture la déplacerait d'un layer vers l'application.
      if (withFileMapping) {
        const cible = `${racine.id}:${file.replace('.json', '')}`
        for (const key of Object.keys(flattenObject(data))) {
          fileMapping[key] = cible
        }
      }

      // Utiliser deepMerge au lieu de Object.assign pour préserver les structures imbriquées
      deepMerge(mergedData, data)
    }
  }

  if (fichiersLus === 0) {
    return null
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
