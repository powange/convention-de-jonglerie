#!/usr/bin/env node

/**
 * Script de traduction automatique en masse pour les clés i18n
 * Usage: node scripts/mass-translator.js [options]
 *
 * Options:
 *   --pattern <pattern>  Motif à rechercher (défaut: "[TODO]")
 *   --dry-run           Simulation sans modification des fichiers
 *   --lang <codes>      Langues spécifiques (ex: "en,es,de")
 *   --help              Afficher l'aide
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  TRANSLATION_DICTIONARY,
  CONTEXT_PATTERNS as EXTERNAL_CONTEXT_PATTERNS,
  getFlatTranslations,
} from './translation-dictionary.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const LOCALES_DIR = path.join(__dirname, '..', 'i18n', 'locales')
const DEFAULT_LANGUAGES = ['en', 'es', 'de', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'da']
const REFERENCE_LANG = 'fr'

// Dictionnaire de traductions communes - facilement extensible
const COMMON_TRANSLATIONS = {
  // Navigation et interface
  Accueil: {
    en: 'Home',
    es: 'Inicio',
    de: 'Startseite',
    it: 'Home',
    nl: 'Startpagina',
    pl: 'Strona główna',
    pt: 'Início',
    ru: 'Главная',
    uk: 'Головна',
    da: 'Hjem',
  },
  Rechercher: {
    en: 'Search',
    es: 'Buscar',
    de: 'Suchen',
    it: 'Cerca',
    nl: 'Zoeken',
    pl: 'Szukaj',
    pt: 'Pesquisar',
    ru: 'Поиск',
    uk: 'Пошук',
    da: 'Søg',
  },
  Modifier: {
    en: 'Edit',
    es: 'Editar',
    de: 'Bearbeiten',
    it: 'Modifica',
    nl: 'Bewerken',
    pl: 'Edytuj',
    pt: 'Editar',
    ru: 'Редактировать',
    uk: 'Редагувати',
    da: 'Rediger',
  },
  Supprimer: {
    en: 'Delete',
    es: 'Eliminar',
    de: 'Löschen',
    it: 'Elimina',
    nl: 'Verwijderen',
    pl: 'Usuń',
    pt: 'Excluir',
    ru: 'Удалить',
    uk: 'Видалити',
    da: 'Slet',
  },
  Enregistrer: {
    en: 'Save',
    es: 'Guardar',
    de: 'Speichern',
    it: 'Salva',
    nl: 'Opslaan',
    pl: 'Zapisz',
    pt: 'Salvar',
    ru: 'Сохранить',
    uk: 'Зберегти',
    da: 'Gem',
  },
  Annuler: {
    en: 'Cancel',
    es: 'Cancelar',
    de: 'Abbrechen',
    it: 'Annulla',
    nl: 'Annuleren',
    pl: 'Anuluj',
    pt: 'Cancelar',
    ru: 'Отменить',
    uk: 'Скасувати',
    da: 'Annuller',
  },
  Confirmer: {
    en: 'Confirm',
    es: 'Confirmar',
    de: 'Bestätigen',
    it: 'Conferma',
    nl: 'Bevestigen',
    pl: 'Potwierdź',
    pt: 'Confirmar',
    ru: 'Подтвердить',
    uk: 'Підтвердити',
    da: 'Bekræft',
  },
  Fermer: {
    en: 'Close',
    es: 'Cerrar',
    de: 'Schließen',
    it: 'Chiudi',
    nl: 'Sluiten',
    pl: 'Zamknij',
    pt: 'Fechar',
    ru: 'Закрыть',
    uk: 'Закрити',
    da: 'Luk',
  },

  // États et statuts
  Actif: {
    en: 'Active',
    es: 'Activo',
    de: 'Aktiv',
    it: 'Attivo',
    nl: 'Actief',
    pl: 'Aktywny',
    pt: 'Ativo',
    ru: 'Активный',
    uk: 'Активний',
    da: 'Aktiv',
  },
  Inactif: {
    en: 'Inactive',
    es: 'Inactivo',
    de: 'Inaktiv',
    it: 'Inattivo',
    nl: 'Inactief',
    pl: 'Nieaktywny',
    pt: 'Inativo',
    ru: 'Неактивный',
    uk: 'Неактивний',
    da: 'Inaktiv',
  },
  'En cours': {
    en: 'In progress',
    es: 'En progreso',
    de: 'In Bearbeitung',
    it: 'In corso',
    nl: 'In uitvoering',
    pl: 'W toku',
    pt: 'Em andamento',
    ru: 'В процессе',
    uk: 'В процесі',
    da: 'I gang',
  },
  Terminé: {
    en: 'Completed',
    es: 'Terminado',
    de: 'Abgeschlossen',
    it: 'Completato',
    nl: 'Voltooid',
    pl: 'Zakończony',
    pt: 'Concluído',
    ru: 'Завершено',
    uk: 'Завершено',
    da: 'Færdig',
  },

  // Dates et temps
  "Aujourd'hui": {
    en: 'Today',
    es: 'Hoy',
    de: 'Heute',
    it: 'Oggi',
    nl: 'Vandaag',
    pl: 'Dzisiaj',
    pt: 'Hoje',
    ru: 'Сегодня',
    uk: 'Сьогодні',
    da: 'I dag',
  },
  Hier: {
    en: 'Yesterday',
    es: 'Ayer',
    de: 'Gestern',
    it: 'Ieri',
    nl: 'Gisteren',
    pl: 'Wczoraj',
    pt: 'Ontem',
    ru: 'Вчера',
    uk: 'Вчора',
    da: 'I går',
  },
  Demain: {
    en: 'Tomorrow',
    es: 'Mañana',
    de: 'Morgen',
    it: 'Domani',
    nl: 'Morgen',
    pl: 'Jutro',
    pt: 'Amanhã',
    ru: 'Завтра',
    uk: 'Завтра',
    da: 'I morgen',
  },
}

// Patterns avancés pour reconnaître des contextes spécifiques
const CONTEXT_PATTERNS = [
  {
    pattern: /adresse.*requise?$/i,
    translations: {
      en: 'Address is required',
      es: 'La dirección es requerida',
      de: 'Adresse ist erforderlich',
      it: "L'indirizzo è richiesto",
      nl: 'Adres is verplicht',
      pl: 'Adres jest wymagany',
      pt: 'Endereço é obrigatório',
      ru: 'Адрес обязателен',
      uk: "Адреса обов'язкова",
      da: 'Adressen er påkrævet',
    },
  },
  {
    pattern: /mot de passe.*requis$/i,
    translations: {
      en: 'Password is required',
      es: 'La contraseña es requerida',
      de: 'Passwort ist erforderlich',
      it: 'La password è richiesta',
      nl: 'Wachtwoord is verplicht',
      pl: 'Hasło jest wymagane',
      pt: 'Senha é obrigatória',
      ru: 'Пароль обязателен',
      uk: "Пароль обов'язковий",
      da: 'Adgangskode er påkrævet',
    },
  },
  {
    pattern: /chargement/i,
    translations: {
      en: 'Loading',
      es: 'Cargando',
      de: 'Laden',
      it: 'Caricamento',
      nl: 'Laden',
      pl: 'Ładowanie',
      pt: 'Carregando',
      ru: 'Загрузка',
      uk: 'Завантаження',
      da: 'Indlæser',
    },
  },
]

class MassTranslator {
  constructor(options = {}) {
    this.pattern = options.pattern || '[TODO]'
    this.dryRun = options.dryRun || false
    this.languages = options.languages || DEFAULT_LANGUAGES
    this.verbose = options.verbose || false

    this.stats = {
      filesProcessed: 0,
      totalTranslations: 0,
      byLanguage: {},
    }
  }

  log(message, level = 'info') {
    if (level === 'verbose' && !this.verbose) return
    console.log(message)
  }

  // Recherche une traduction dans le dictionnaire commun
  findCommonTranslation(text, targetLang) {
    const cleanText = text.replace(/^\[TODO\]\s*/, '').trim()

    // Utiliser le dictionnaire externe centralisé
    const flatTranslations = getFlatTranslations()

    // Recherche exacte
    if (flatTranslations[cleanText] && flatTranslations[cleanText][targetLang]) {
      return flatTranslations[cleanText][targetLang]
    }

    // Recherche par pattern (dictionnaire externe)
    for (const pattern of EXTERNAL_CONTEXT_PATTERNS) {
      const match = cleanText.match(pattern.pattern)
      if (match && pattern.getTranslations) {
        const translations = pattern.getTranslations(match)
        if (translations && translations[targetLang]) {
          return translations[targetLang]
        }
      }
    }

    // Fallback vers les anciens patterns internes
    for (const pattern of CONTEXT_PATTERNS) {
      if (pattern.pattern.test(cleanText) && pattern.translations[targetLang]) {
        return pattern.translations[targetLang]
      }
    }

    // Fallback vers l'ancien dictionnaire interne
    if (COMMON_TRANSLATIONS[cleanText] && COMMON_TRANSLATIONS[cleanText][targetLang]) {
      return COMMON_TRANSLATIONS[cleanText][targetLang]
    }

    return null
  }

  // Analyse un fichier de traduction
  analyzeFile(filePath) {
    if (!fs.existsSync(filePath)) return { total: 0, found: [] }

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const found = []

    lines.forEach((line, index) => {
      if (line.includes(this.pattern)) {
        const match = line.match(/"([^"]*\[TODO\][^"]*)"/)
        if (match) {
          found.push({
            line: index + 1,
            text: match[1],
            fullLine: line,
          })
        }
      }
    })

    return { total: found.length, found }
  }

  // Traduit un fichier
  translateFile(langCode) {
    const filePath = path.join(LOCALES_DIR, `${langCode}.json`)
    const analysis = this.analyzeFile(filePath)

    if (analysis.total === 0) {
      return 0
    }

    let content = fs.readFileSync(filePath, 'utf8')
    let translationCount = 0

    for (const item of analysis.found) {
      const translation = this.findCommonTranslation(item.text, langCode)

      if (translation) {
        const escapedPattern = item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        content = content.replace(new RegExp(escapedPattern, 'g'), translation)
        translationCount++

        this.log(`${langCode}: "${item.text}" → "${translation}"`, 'verbose')
      }
    }

    if (translationCount > 0 && !this.dryRun) {
      fs.writeFileSync(filePath, content, 'utf8')
    }

    return translationCount
  }

  // Point d'entrée principal
  async translate() {
    this.log(`=== TRADUCTEUR EN MASSE ===`)
    this.log(`Pattern: ${this.pattern}`)
    this.log(`Langues: ${this.languages.join(', ')}`)
    this.log(`Mode: ${this.dryRun ? 'SIMULATION' : 'MODIFICATION'}`)
    this.log('')

    // Analyse préliminaire
    this.log('📊 Analyse préliminaire:')
    let totalFound = 0
    for (const lang of this.languages) {
      const analysis = this.analyzeFile(path.join(LOCALES_DIR, `${lang}.json`))
      totalFound += analysis.total
      this.log(`${lang}: ${analysis.total} clés à traduire`)
    }

    if (totalFound === 0) {
      this.log('\n✅ Aucune traduction nécessaire !')
      return
    }

    this.log(`\n🔄 Début de la traduction...`)

    // Traduction
    for (const lang of this.languages) {
      const count = this.translateFile(lang)
      this.stats.byLanguage[lang] = count
      this.stats.totalTranslations += count

      if (count > 0) {
        this.log(`${lang}: ${count} traductions ${this.dryRun ? 'simulées' : 'appliquées'}`)
      }
    }

    // Résumé
    this.log(`\n=== RÉSUMÉ ===`)
    this.log(`Total traductions: ${this.stats.totalTranslations}`)
    if (this.dryRun) {
      this.log('⚠️  Mode simulation - Aucune modification appliquée')
      this.log('Pour appliquer les modifications, relancez sans --dry-run')
    } else {
      this.log('✅ Traductions appliquées avec succès !')
    }
  }
}

// Interface CLI
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    pattern: '[TODO]',
    dryRun: false,
    languages: DEFAULT_LANGUAGES,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--pattern':
        options.pattern = args[++i]
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--lang':
        options.languages = args[++i].split(',')
        break
      case '--verbose':
        options.verbose = true
        break
      case '--help':
        console.log(`
Usage: node scripts/mass-translator.js [options]

Options:
  --pattern <pattern>  Motif à rechercher (défaut: "[TODO]")
  --dry-run           Simulation sans modification des fichiers
  --lang <codes>      Langues spécifiques séparées par des virgules (ex: "en,es,de")
  --verbose           Affichage détaillé
  --help              Afficher cette aide

Exemples:
  node scripts/mass-translator.js                    # Traduction complète
  node scripts/mass-translator.js --dry-run          # Simulation
  node scripts/mass-translator.js --lang "en,es"     # Langues spécifiques
  node scripts/mass-translator.js --pattern "[NEW]"  # Pattern personnalisé
        `)
        process.exit(0)
        break
    }
  }

  return options
}

// Exécution
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs()
  const translator = new MassTranslator(options)
  translator.translate().catch(console.error)
}

export { MassTranslator, COMMON_TRANSLATIONS, CONTEXT_PATTERNS }
