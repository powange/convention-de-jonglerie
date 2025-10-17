#!/usr/bin/env node

/**
 * Script pour extraire les traductions depuis les fichiers de backup
 * et générer le fichier translations-config.json complet
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BACKUP_DIR = path.join(__dirname, '../../i18n/locales-backup')
const TEMPLATE_PATH = path.join(__dirname, 'translations-config.template.json')
const OUTPUT_PATH = path.join(__dirname, 'translations-config.json')

// Langues à traiter (sans le français qui est la source)
const LANGUAGES = ['da', 'de', 'en', 'es', 'it', 'nl', 'pl', 'pt', 'ru', 'uk']

// Mapping des clés vers leurs chemins dans les fichiers de backup
const KEY_MAPPINGS = {
  // Feedback keys
  'feedback.title': 'feedback.title',
  'feedback.description': 'feedback.description',
  'feedback.type.label': 'feedback.type.label',
  'feedback.type.placeholder': 'feedback.type.placeholder',
  'feedback.subject.label': 'feedback.subject.label',
  'feedback.subject.placeholder': 'feedback.subject.placeholder',
  'feedback.message.label': 'feedback.message.label',
  'feedback.message.placeholder': 'feedback.message.placeholder',
  'feedback.guest.info': 'feedback.guest.info',
  'feedback.name.label': 'feedback.name.label',
  'feedback.name.placeholder': 'feedback.name.placeholder',
  'feedback.email.label': 'feedback.email.label',
  'feedback.email.placeholder': 'feedback.email.placeholder',
  'feedback.url.label': 'feedback.url.label',
  'feedback.url.placeholder': 'feedback.url.placeholder',
  'feedback.recaptcha.protected_by': 'feedback.recaptcha.protected_by',
  'feedback.recaptcha.privacy_policy': 'feedback.recaptcha.privacy_policy',
  'feedback.recaptcha.and': 'feedback.recaptcha.and',
  'feedback.recaptcha.terms_of_service': 'feedback.recaptcha.terms_of_service',
  'feedback.recaptcha.apply': 'feedback.recaptcha.apply',
}

// Fonction pour obtenir une valeur depuis un objet imbriqué avec un chemin en notation pointée
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Charger le template
console.log('📖 Chargement du template...')
const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'))

// Traiter chaque langue
console.log('\n🔄 Extraction des traductions depuis les backups...\n')

for (const lang of LANGUAGES) {
  const backupPath = path.join(BACKUP_DIR, `${lang}.json`)

  if (!fs.existsSync(backupPath)) {
    console.log(`⚠️  Fichier de backup manquant pour ${lang}`)
    continue
  }

  console.log(`📚 Traitement de ${lang}...`)
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))

  let foundCount = 0
  let missingCount = 0

  // Pour chaque clé dans le template
  for (const [key, translations] of Object.entries(template.translations)) {
    // Vérifier si on a un mapping pour cette clé
    const backupPath = KEY_MAPPINGS[key]

    if (backupPath) {
      const value = getNestedValue(backup, backupPath)

      if (value && value !== '[TODO]') {
        // Remplacer le TODO par la vraie traduction
        template.translations[key][lang] = value
        foundCount++
      } else {
        missingCount++
      }
    } else {
      // Clé notification - on va générer manuellement plus tard
      missingCount++
    }
  }

  console.log(`   ✓ ${foundCount} traductions trouvées`)
  if (missingCount > 0) {
    console.log(`   ⚠ ${missingCount} traductions manquantes (à générer manuellement)`)
  }
}

// Sauvegarder le fichier de config mis à jour
console.log('\n💾 Sauvegarde du fichier translations-config.json...')
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(template, null, 2), 'utf8')

console.log('\n✅ Extraction terminée !')
console.log(`📄 Fichier généré : ${OUTPUT_PATH}`)

// Compter combien de TODO restent
let remainingTodos = 0
for (const translations of Object.values(template.translations)) {
  for (const [lang, value] of Object.entries(translations)) {
    if (lang !== 'fr' && value.startsWith('TODO:')) {
      remainingTodos++
    }
  }
}

console.log(
  `\n📊 Statistique : ${remainingTodos} traductions TODO restantes à générer manuellement`
)
