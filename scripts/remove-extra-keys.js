#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Clés à supprimer
const keysToRemove = [
  'pages.management.in_development',
  'pages.management.upcoming_feature',
  'profile.first_name_required',
  'profile.last_name_required',
]

// Langues à traiter
const languages = ['da', 'de', 'en', 'es', 'it', 'nl', 'pl', 'pt', 'ru', 'uk']

// Fonction pour supprimer une clé imbriquée
function removeNestedKey(obj, keyPath) {
  const keys = keyPath.split('.')
  const lastKey = keys.pop()

  let current = obj
  for (const key of keys) {
    if (current[key] === undefined) {
      return false // La clé n'existe pas
    }
    current = current[key]
  }

  if (lastKey in current) {
    delete current[lastKey]
    return true
  }

  return false
}

// Traiter chaque langue
languages.forEach((lang) => {
  const filePath = path.join(__dirname, '..', 'i18n', 'locales', `${lang}.json`)

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(content)

    let modified = false
    keysToRemove.forEach((key) => {
      if (removeNestedKey(data, key)) {
        console.log(`✓ Supprimé ${key} de ${lang}.json`)
        modified = true
      }
    })

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
      console.log(`✓ Fichier ${lang}.json mis à jour\n`)
    } else {
      console.log(`ℹ Aucune modification pour ${lang}.json\n`)
    }
  } catch (error) {
    console.error(`✗ Erreur lors du traitement de ${lang}.json:`, error.message)
  }
})

console.log('✓ Suppression des clés en trop terminée')
