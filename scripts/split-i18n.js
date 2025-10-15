/**
 * Script de migration pour séparer les fichiers de traduction par domaine
 * Usage: node scripts/split-i18n.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration de la séparation
const SPLIT_CONFIG = {
  // Fichier commun - chargé par défaut (traductions de base)
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
    'c', // Clés courtes communes
    'calendar', // Calendrier utilisé partout
  ],

  // Traductions admin - chargées uniquement dans /admin
  admin: ['admin', 'feedback'],

  // Traductions éditions - chargées dans /editions
  edition: ['editions', 'conventions', 'collaborators', 'carpool', 'diet'],

  // Traductions auth - chargées dans /auth, /login, /register, etc.
  auth: ['auth', 'profile', 'permissions'],

  // Traductions pages publiques - chargées sur les pages publiques
  public: ['homepage', 'pages', 'seo'],

  // Traductions composants UI - chargées partout
  components: ['components', 'forms', 'upload', 'notifications', 'push_notifications'],

  // Traductions PWA et services - chargées globalement
  app: ['app', 'pwa', 'services'],
}

/**
 * Détermine dans quel fichier une clé doit aller
 */
function getTargetFile(key) {
  for (const [file, keys] of Object.entries(SPLIT_CONFIG)) {
    if (keys.includes(key)) {
      return file
    }
  }
  // Par défaut, mettre dans common
  return 'common'
}

/**
 * Sépare un fichier de traduction en plusieurs fichiers par domaine
 */
function splitTranslationFile(locale) {
  const inputFile = path.join(__dirname, '..', 'i18n', 'locales', `${locale}.json`)

  if (!fs.existsSync(inputFile)) {
    console.warn(`⚠️  Fichier ${inputFile} introuvable, ignoré`)
    return
  }

  console.log(`📦 Traitement de ${locale}.json...`)

  // Lire le fichier source
  const content = JSON.parse(fs.readFileSync(inputFile, 'utf8'))

  // Créer le dossier de destination
  const outputDir = path.join(__dirname, '..', 'i18n', 'locales', locale)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Initialiser les fichiers de sortie
  const outputs = {}
  for (const file of Object.keys(SPLIT_CONFIG)) {
    outputs[file] = {}
  }

  // Distribuer les clés dans les bons fichiers
  for (const [key, value] of Object.entries(content)) {
    const targetFile = getTargetFile(key)
    outputs[targetFile][key] = value
  }

  // Écrire les fichiers
  let totalKeys = 0
  for (const [file, data] of Object.entries(outputs)) {
    const keysCount = Object.keys(data).length
    if (keysCount > 0) {
      const outputFile = path.join(outputDir, `${file}.json`)
      fs.writeFileSync(outputFile, JSON.stringify(data, null, 2) + '\n', 'utf8')
      console.log(`  ✅ ${file}.json - ${keysCount} clés`)
      totalKeys += keysCount
    }
  }

  console.log(`  📊 Total: ${totalKeys} clés\n`)
}

/**
 * Fonction principale
 */
function main() {
  console.log('🚀 Démarrage de la migration des fichiers de traduction\n')

  // Liste des locales à traiter
  const locales = ['en', 'da', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk']

  // Traiter chaque locale
  for (const locale of locales) {
    splitTranslationFile(locale)
  }

  console.log('✨ Migration terminée !')
  console.log('\n📝 Prochaines étapes :')
  console.log('  1. Vérifier les fichiers générés dans i18n/locales/{locale}/')
  console.log('  2. Mettre à jour nuxt.config.ts')
  console.log('  3. Créer le middleware de chargement')
  console.log('  4. Supprimer les anciens fichiers i18n/locales/*.json')
}

// Exécuter
main()
