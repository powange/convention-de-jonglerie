#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Nouvelles traductions UI pour toutes les autres langues (copier depuis le français existant)
const missingKeys = [
  'upload.success_message',
  'upload.delete_message',
  'upload.error_message',
  'components.convention_form.image_uploaded',
  'components.convention_form.image_deleted',
  'components.edition_form.poster_placeholder',
  'components.edition_form.poster_alt',
  'components.edition_form.address_tip',
  'components.edition_form.country_placeholder',
  'components.edition_form.convention_description_placeholder',
  'components.edition_form.social_networks_title',
  'components.edition_form.step_general_title',
  'components.edition_form.step_general_description',
  'components.edition_form.step_services_title',
  'components.edition_form.step_visibility_title',
  'components.edition_form.step_visibility_description',
  'components.date_time_picker.placeholder',
  'components.country_multi_select.placeholder',
  'components.collaborators.added',
  'components.collaborators.add_error',
  'components.collaborators.removed',
  'components.collaborators.load_error',
  'components.collaborators.remove_error',
  'pages.benevoles.external_mode_active',
  'pages.benevoles.url_label',
  'pages.benevoles.sort_tip',
  'pages.objets_trouves.photo_alt',
  'pages.profile.photo_alt',
  'pages.profile.photo_placeholder',
  'validation.name_min_3',
  'validation.name_max_100',
  'validation.name_max_200',
  'validation.description_max_1000',
  'validation.date_end_after_start',
  'validation.date_start_required',
  'countries.czech_republic',
]

// Fonction pour récupérer une clé imbriquée
function getNestedKey(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  for (const key of keys) {
    if (current[key] === undefined) {
      return undefined
    }
    current = current[key]
  }
  return current
}

// Fonction pour ajouter une clé imbriquée
function setNestedKey(obj, keyPath, value) {
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
}

// Lire les valeurs du français et de l'anglais comme références
const frPath = path.join(__dirname, '..', 'i18n', 'locales', 'fr.json')
const enPath = path.join(__dirname, '..', 'i18n', 'locales', 'en.json')

const frData = JSON.parse(fs.readFileSync(frPath, 'utf8'))
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'))

// Langues à traiter (toutes sauf fr et en)
const languages = ['da', 'de', 'es', 'it', 'nl', 'pl', 'pt', 'ru', 'uk']

// Traiter chaque langue
languages.forEach((lang) => {
  const filePath = path.join(__dirname, '..', 'i18n', 'locales', `${lang}.json`)

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(content)

    let addedCount = 0

    // Ajouter les clés manquantes en utilisant la traduction française (sera traduite plus tard)
    missingKeys.forEach((key) => {
      const currentValue = getNestedKey(data, key)
      if (currentValue === undefined) {
        const frValue = getNestedKey(frData, key)
        if (frValue !== undefined) {
          setNestedKey(data, key, frValue)
          addedCount++
        }
      }
    })

    // Écrire le fichier mis à jour
    if (addedCount > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
      console.log(`✓ Fichier ${lang}.json mis à jour avec ${addedCount} nouvelles clés`)
    } else {
      console.log(`ℹ ${lang}.json déjà à jour`)
    }
  } catch (error) {
    console.error(`✗ Erreur lors du traitement de ${lang}.json:`, error.message)
  }
})

console.log('\n✓ Ajout des clés UI manquantes terminé')
