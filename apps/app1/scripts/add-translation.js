#!/usr/bin/env node

/**
 * Script pour ajouter rapidement de nouveaux termes au dictionnaire de traduction
 * Usage: node scripts/add-translation.js "terme français" --category actions
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DICTIONARY_FILE = path.join(__dirname, 'translation-dictionary.js')
const LANGUAGES = ['en', 'es', 'de', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'da', 'cs', 'sv']

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(text) {
  return new Promise((resolve) => rl.question(text, resolve))
}

async function addTranslation() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.length === 0) {
    console.log(`
Usage: node scripts/add-translation.js "terme français" [--category nom]

Exemple: node scripts/add-translation.js "Valider" --category actions
    `)
    process.exit(0)
  }

  const frenchTerm = args[0]
  const categoryIndex = args.indexOf('--category')
  const category =
    categoryIndex !== -1
      ? args[categoryIndex + 1]
      : await question('Catégorie (actions/status/forms/messages/etc.) : ')

  console.log(`\nAjout du terme : "${frenchTerm}"`)
  console.log(`Catégorie : ${category}`)
  console.log('\nEntrez les traductions pour chaque langue (appuyez sur Entrée pour passer) :\n')

  const translations = {}

  for (const lang of LANGUAGES) {
    const translation = await question(`${lang.toUpperCase()}: `)
    if (translation.trim()) {
      translations[lang] = translation.trim()
    }
  }

  if (Object.keys(translations).length === 0) {
    console.log('❌ Aucune traduction fournie. Annulé.')
    rl.close()
    return
  }

  // Lire le fichier actuel
  let content = fs.readFileSync(DICTIONARY_FILE, 'utf8')

  // Créer l'entrée de traduction
  const translationEntry = `    "${frenchTerm}": {\n${Object.entries(translations)
    .map(([lang, trans]) => `      ${lang}: "${trans}"`)
    .join(',\n')}\n    }`

  // Chercher la catégorie et ajouter l'entrée
  const categoryPattern = new RegExp(`(\\s+${category}:\\s*\\{[^}]*)(\\s+\\})`, 's')
  const match = content.match(categoryPattern)

  if (match) {
    // La catégorie existe, ajouter à la fin
    const replacement = match[1] + ',\n' + translationEntry + match[2]
    content = content.replace(categoryPattern, replacement)
  } else {
    // Créer une nouvelle catégorie
    const newCategory = `
  // === ${category.toUpperCase()} ===
  ${category}: {
${translationEntry}
  },`

    const insertPoint = content.lastIndexOf('};')
    content = content.slice(0, insertPoint) + ',' + newCategory + '\n' + content.slice(insertPoint)
  }

  // Écrire le fichier
  fs.writeFileSync(DICTIONARY_FILE, content, 'utf8')

  console.log(`\n✅ Terme "${frenchTerm}" ajouté avec succès !`)
  console.log(`📁 Catégorie: ${category}`)
  console.log(`🌍 Langues: ${Object.keys(translations).join(', ')}`)
  console.log(
    '\n💡 Vous pouvez maintenant utiliser mass-translator.js pour appliquer ces traductions.'
  )

  rl.close()
}

addTranslation().catch(console.error)
