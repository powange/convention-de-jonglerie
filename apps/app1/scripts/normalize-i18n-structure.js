#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

import {
  LOCALES_DIR,
  loadLocaleFiles,
  writeLocaleFiles,
  flattenObject,
} from './translation/shared-config.js'

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'

/**
 * Script pour normaliser la structure de tous les fichiers i18n
 * Convertit les clés aplaties (ex: "notifications.this_week")
 * en structure imbriquée (ex: { "notifications": { "this_week": ... } })
 */
async function main() {
  console.log(`\n${BOLD}${CYAN}=== Normalisation de la structure i18n ===${RESET}\n`)

  // Charger la référence française avec le mapping pour savoir dans quel fichier va chaque clé
  const referenceWithMapping = loadLocaleFiles('fr', true)
  if (!referenceWithMapping) {
    console.error('Erreur: impossible de charger la référence française')
    process.exit(1)
  }
  const referenceFileMapping = referenceWithMapping.fileMapping

  // Lister toutes les langues
  const localeDirs = fs.readdirSync(LOCALES_DIR).filter((item) => {
    const itemPath = path.join(LOCALES_DIR, item)
    return fs.statSync(itemPath).isDirectory()
  })

  console.log(`${CYAN}Langues trouvées: ${localeDirs.join(', ')}${RESET}\n`)

  // Pour chaque langue, charger et réécrire avec la structure imbriquée
  for (const locale of localeDirs) {
    console.log(`${CYAN}Traitement de ${locale}/...${RESET}`)

    // Charger toutes les données de cette langue (fusionnées)
    const localeData = loadLocaleFiles(locale)
    if (!localeData) {
      console.log(`  Aucune donnée trouvée, passage à la langue suivante`)
      continue
    }

    // Aplatir pour obtenir toutes les clés
    const flat = flattenObject(localeData)
    const keyCount = Object.keys(flat).length

    // Réécrire avec le mapping de référence (ceci va créer la structure imbriquée)
    const updatedFiles = writeLocaleFiles(locale, flat, referenceFileMapping)

    console.log(
      `${GREEN}✓ ${keyCount} clé(s) normalisée(s) dans ${locale}/ (${updatedFiles} fichier(s) mis à jour)${RESET}`
    )
  }

  console.log(`\n${GREEN}${BOLD}✓ Normalisation terminée !${RESET}\n`)
}

main()
