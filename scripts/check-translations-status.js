#!/usr/bin/env node

/**
 * Script de vérification de l'état des traductions
 * Affiche les statistiques et les clés manquantes par langue
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LOCALES_DIR = path.join(__dirname, '..', 'i18n', 'locales')
const LANGUAGES = ['en', 'es', 'de', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'da']

class TranslationChecker {
  constructor() {
    this.results = {}
  }

  // Analyse un fichier de langue
  analyzeFile(langCode) {
    const filePath = path.join(LOCALES_DIR, `${langCode}.json`)

    if (!fs.existsSync(filePath)) {
      return { error: 'Fichier non trouvé' }
    }

    const content = fs.readFileSync(filePath, 'utf8')

    // Compter les clés [TODO]
    const todoMatches = content.match(/\[TODO\]/g) || []
    const todoCount = todoMatches.length

    // Compter le nombre total de clés (approximatif)
    const keyMatches = content.match(/"\s*[^"]+"\s*:/g) || []
    const totalKeys = keyMatches.length

    // Calculer le pourcentage de completion
    const completionRate =
      totalKeys > 0 ? (((totalKeys - todoCount) / totalKeys) * 100).toFixed(1) : '100.0'

    // Extraire les clés [TODO] avec leur contexte
    const todoKeys = []
    const lines = content.split('\n')
    lines.forEach((line, index) => {
      if (line.includes('[TODO]')) {
        const match = line.match(/^\s*"([^"]+)"\s*:\s*"([^"]*\[TODO\][^"]*)"/)
        if (match) {
          todoKeys.push({
            key: match[1],
            value: match[2],
            line: index + 1,
          })
        }
      }
    })

    return {
      totalKeys,
      todoCount,
      completionRate: parseFloat(completionRate),
      todoKeys,
      fileSize: fs.statSync(filePath).size,
    }
  }

  // Génère un rapport complet
  generateReport() {
    console.log('🌍 === ÉTAT DES TRADUCTIONS ===\n')

    const stats = []
    let totalTodos = 0
    let totalKeys = 0

    // Analyse de chaque langue
    for (const lang of LANGUAGES) {
      const result = this.analyzeFile(lang)
      this.results[lang] = result

      if (!result.error) {
        stats.push({
          lang: lang.toUpperCase(),
          completion: result.completionRate,
          todos: result.todoCount,
          total: result.totalKeys,
        })
        totalTodos += result.todoCount
        totalKeys += result.totalKeys
      }
    }

    // Tri par taux de completion
    stats.sort((a, b) => b.completion - a.completion)

    // Affichage du tableau de statut
    console.log('📊 RÉSUMÉ PAR LANGUE:')
    console.log('┌──────┬──────────┬───────┬───────┐')
    console.log('│ LANG │ COMPLET  │ [TODO]│ TOTAL │')
    console.log('├──────┼──────────┼───────┼───────┤')

    stats.forEach((stat) => {
      const completion = `${stat.completion.toFixed(1)}%`.padStart(7)
      const todos = stat.todos.toString().padStart(6)
      const total = stat.total.toString().padStart(6)
      console.log(`│ ${stat.lang.padEnd(4)} │ ${completion} │ ${todos} │ ${total} │`)
    })

    console.log('└──────┴──────────┴───────┴───────┘')

    const overallCompletion =
      totalKeys > 0 ? (((totalKeys - totalTodos) / totalKeys) * 100).toFixed(1) : '100.0'
    console.log(
      `\n🎯 GLOBAL: ${overallCompletion}% complet (${totalTodos} clés [TODO] sur ${totalKeys} total)\n`
    )

    // Affichage des détails pour les langues incomplètes
    const incompleteLanguages = stats.filter((s) => s.todos > 0)

    if (incompleteLanguages.length > 0) {
      console.log('🔍 DÉTAIL DES CLÉS MANQUANTES:\n')

      for (const stat of incompleteLanguages.slice(0, 3)) {
        // Max 3 langues pour éviter un affichage trop long
        const lang = stat.lang.toLowerCase()
        const result = this.results[lang]

        console.log(`📝 ${stat.lang} (${stat.todos} clés à traduire):`)
        result.todoKeys.slice(0, 5).forEach((key) => {
          console.log(`   • ${key.key}: "${key.value}" (ligne ${key.line})`)
        })

        if (result.todoKeys.length > 5) {
          console.log(`   ... et ${result.todoKeys.length - 5} autres`)
        }
        console.log('')
      }
    } else {
      console.log('🎉 Toutes les langues sont complètement traduites !')
    }

    // Recommandations
    this.showRecommendations(stats)
  }

  // Affiche des recommandations basées sur l'analyse
  showRecommendations(stats) {
    console.log('💡 RECOMMANDATIONS:\n')

    const incompleteCount = stats.filter((s) => s.todos > 0).length

    if (incompleteCount === 0) {
      console.log('✅ Parfait ! Toutes les traductions sont terminées.')
      return
    }

    if (incompleteCount <= 3) {
      console.log('🎯 Presque fini ! Quelques langues à compléter :')
      console.log('   node scripts/mass-translator.js --dry-run')
      console.log('   (puis sans --dry-run pour appliquer)')
    } else {
      console.log('🚀 Utilisez le traducteur automatique :')
      console.log('   node scripts/mass-translator.js --dry-run')

      const mostIncomplete = stats.filter((s) => s.todos > 10).map((s) => s.lang.toLowerCase())
      if (mostIncomplete.length > 0) {
        console.log(`\n🎯 Priorité aux langues : ${mostIncomplete.join(', ')}`)
        console.log(
          `   node scripts/mass-translator.js --lang "${mostIncomplete.join(',')}" --dry-run`
        )
      }
    }

    console.log('\n📚 Pour ajouter de nouveaux termes au dictionnaire :')
    console.log('   node scripts/add-translation.js "Nouveau terme"')
  }

  // Mode détaillé pour une langue spécifique
  showLanguageDetails(langCode) {
    const result = this.analyzeFile(langCode)

    if (result.error) {
      console.log(`❌ Erreur pour ${langCode}: ${result.error}`)
      return
    }

    console.log(`🌍 === DÉTAIL POUR ${langCode.toUpperCase()} ===\n`)
    console.log(`📊 Statistiques:`)
    console.log(`   • Total clés: ${result.totalKeys}`)
    console.log(`   • Clés [TODO]: ${result.todoCount}`)
    console.log(`   • Completion: ${result.completionRate}%`)
    console.log(`   • Taille fichier: ${(result.fileSize / 1024).toFixed(1)} KB\n`)

    if (result.todoKeys.length > 0) {
      console.log(`📝 Clés à traduire (${result.todoKeys.length}):`)
      result.todoKeys.forEach((key, index) => {
        console.log(`${(index + 1).toString().padStart(3)}. ${key.key}`)
        console.log(`     "${key.value}" (ligne ${key.line})`)
      })
    } else {
      console.log('🎉 Aucune traduction manquante !')
    }
  }
}

// Interface CLI
function main() {
  const args = process.argv.slice(2)
  const checker = new TranslationChecker()

  if (args.includes('--help')) {
    console.log(`
Usage: node scripts/check-translations-status.js [options]

Options:
  --lang <code>    Afficher les détails pour une langue spécifique
  --help           Afficher cette aide

Exemples:
  node scripts/check-translations-status.js              # Rapport complet
  node scripts/check-translations-status.js --lang en   # Détails pour l'anglais
    `)
    return
  }

  const langIndex = args.indexOf('--lang')
  if (langIndex !== -1 && args[langIndex + 1]) {
    checker.showLanguageDetails(args[langIndex + 1])
  } else {
    checker.generateReport()
  }
}

main()
