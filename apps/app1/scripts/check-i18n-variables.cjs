#!/usr/bin/env node

/**
 * Script de vérification des variables i18n
 * Vérifie que toutes les clés avec des variables {xxx} ont les mêmes variables
 * dans toutes les langues par rapport au français (langue de référence)
 */

const fs = require('fs')
const path = require('path')

const REFERENCE_LANG = 'fr'

// Toutes les racines de traductions : celle de l'application, et celle de chaque layer qui en
// porte une. Le découpage est le même que dans `translation/shared-config.js`, redit ici parce
// que ce script est en CommonJS et ne peut pas importer ce module ESM.
const LOCALES_ROOTS = [
  path.join(__dirname, '..', 'i18n', 'locales'),
  ...(() => {
    const layersDir = path.join(__dirname, '..', '..', '..', 'layers')
    if (!fs.existsSync(layersDir)) return []
    return fs
      .readdirSync(layersDir)
      .map(layer => path.join(layersDir, layer, 'i18n', 'locales'))
      .filter(dir => fs.existsSync(dir))
  })(),
]

// Détection automatique de toutes les langues disponibles
const SUPPORTED_LANGS = [
  ...new Set(
    LOCALES_ROOTS.flatMap(racine =>
      fs.readdirSync(racine).filter(file => fs.statSync(path.join(racine, file)).isDirectory())
    )
  ),
]
  .filter(lang => lang !== REFERENCE_LANG)
  .sort()

// Extrait toutes les variables {xxx} d'une chaîne
function extractVariables(text) {
  if (typeof text !== 'string') return []
  const matches = text.match(/\{([^}]+)\}/g)
  return matches ? matches.map(m => m.slice(1, -1)).sort() : []
}

// Parcourt récursivement un objet JSON et collecte les clés avec variables
function collectKeysWithVariables(obj, prefix = '') {
  const result = {}

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, collectKeysWithVariables(value, fullKey))
    } else if (typeof value === 'string') {
      const variables = extractVariables(value)
      if (variables.length > 0) {
        result[fullKey] = { text: value, variables }
      }
    }
  }

  return result
}

// Charge tous les fichiers JSON d'une langue et collecte les clés avec variables
function loadLanguageKeysWithVariables(lang) {
  const allKeys = {}

  for (const racine of LOCALES_ROOTS) {
    const langDir = path.join(racine, lang)
    if (!fs.existsSync(langDir)) continue

    const files = fs.readdirSync(langDir).filter(f => f.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(langDir, file)
      const domain = file.replace('.json', '')

      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        const keysWithVars = collectKeysWithVariables(content)

        // Préfixer les clés avec le domaine pour éviter les collisions
        for (const [key, data] of Object.entries(keysWithVars)) {
          allKeys[`${domain}.${key}`] = data
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la lecture de ${filePath}:`, error.message)
      }
    }
  }

  return allKeys
}

// Fonction principale
function checkI18nVariables() {
  console.log('🔍 Vérification des variables i18n...\n')

  // Charger le français (langue de référence)
  console.log(`📖 Chargement de la langue de référence (${REFERENCE_LANG})...`)
  const frenchKeysWithVars = loadLanguageKeysWithVariables(REFERENCE_LANG)

  console.log(`   Trouvé ${Object.keys(frenchKeysWithVars).length} clés avec variables\n`)

  if (Object.keys(frenchKeysWithVars).length === 0) {
    console.log('⚠️  Aucune clé avec variables trouvée dans le français')
    return
  }

  const errors = []
  let totalChecks = 0

  // Vérifier chaque langue
  for (const lang of SUPPORTED_LANGS) {
    console.log(`🌍 Vérification de ${lang}...`)
    const langKeysWithVars = loadLanguageKeysWithVariables(lang)

    let langErrors = 0

    // Vérifier chaque clé française avec variables
    for (const [key, frData] of Object.entries(frenchKeysWithVars)) {
      totalChecks++
      const langData = langKeysWithVars[key]

      if (!langData) {
        // Clé manquante dans la langue cible
        errors.push({
          lang,
          key,
          issue: 'missing_key',
          frenchVars: frData.variables,
          frenchText: frData.text
        })
        langErrors++
      } else {
        // Comparer les variables
        const frVars = frData.variables.join(',')
        const langVars = langData.variables.join(',')

        if (frVars !== langVars) {
          // Vérifier si c'est juste une différence de formes plurielles
          // (même variables mais répétées différemment pour les langues slaves)
          const frUniqueVars = [...new Set(frData.variables)].sort().join(',')
          const langUniqueVars = [...new Set(langData.variables)].sort().join(',')

          // Si les variables uniques sont identiques, c'est juste une différence
          // dans le nombre de formes plurielles (normal pour pl, ru, uk)
          if (frUniqueVars === langUniqueVars) {
            // Ignorer cette différence (formes plurielles)
            continue
          }

          errors.push({
            lang,
            key,
            issue: 'variables_mismatch',
            frenchVars: frData.variables,
            langVars: langData.variables,
            frenchText: frData.text,
            langText: langData.text
          })
          langErrors++
        }
      }
    }

    console.log(`   ${langErrors === 0 ? '✅' : '❌'} ${langErrors} erreur(s)\n`)
  }

  // Afficher le résumé
  console.log('\n' + '═'.repeat(80))
  console.log('📊 RÉSUMÉ')
  console.log('═'.repeat(80))
  console.log(`Total de vérifications : ${totalChecks}`)
  console.log(`Erreurs trouvées : ${errors.length}\n`)

  if (errors.length === 0) {
    console.log('✅ Toutes les variables i18n sont cohérentes !')
    return
  }

  // Grouper les erreurs par type
  const missingKeys = errors.filter(e => e.issue === 'missing_key')
  const mismatchVars = errors.filter(e => e.issue === 'variables_mismatch')

  if (missingKeys.length > 0) {
    console.log('❌ CLÉS MANQUANTES')
    console.log('─'.repeat(80))
    for (const error of missingKeys) {
      console.log(`\n[${error.lang}] ${error.key}`)
      console.log(`   Variables attendues : ${error.frenchVars.join(', ')}`)
      console.log(`   Texte français : "${error.frenchText}"`)
    }
    console.log('\n')
  }

  if (mismatchVars.length > 0) {
    console.log('❌ VARIABLES INCOHÉRENTES')
    console.log('─'.repeat(80))
    for (const error of mismatchVars) {
      console.log(`\n[${error.lang}] ${error.key}`)
      console.log(`   Français : ${error.frenchVars.join(', ')} → "${error.frenchText}"`)
      console.log(`   ${error.lang} : ${error.langVars.join(', ')} → "${error.langText}"`)
    }
    console.log('\n')
  }

  process.exit(1)
}

// Exécuter le script
checkI18nVariables()
