#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Traductions à ajouter en anglais
const translationsToAdd = {
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'common.updated_at': 'Updated on {date}',
  'common.saving': 'Saving...',
  'common.saved': 'Saved',
  'common.required': 'Required',
  'volunteersInfo.externalUrl': 'External URL',
  'pages.management.volunteer_description_active':
    'Configure volunteer applications here: open/close, description, internal mode or external link.',
  'editions.volunteers_admin_only_note':
    'The following information (applications, filters and detailed statistics) is visible only to authorized organizers and collaborators.',
  'editions.volunteers_filtered_count': '{filtered} of {total} applications',
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

// Lire le fichier en.json
const filePath = path.join(__dirname, '..', 'i18n', 'locales', 'en.json')

try {
  const content = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(content)

  // Ajouter les traductions manquantes
  Object.entries(translationsToAdd).forEach(([key, value]) => {
    setNestedKey(data, key, value)
    console.log(`✓ Ajouté ${key}: "${value}"`)
  })

  // Écrire le fichier mis à jour
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log('\n✓ Fichier en.json mis à jour avec succès')
} catch (error) {
  console.error('✗ Erreur:', error.message)
  process.exit(1)
}
