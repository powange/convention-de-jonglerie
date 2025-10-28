#!/usr/bin/env node

/**
 * Script de correction des variables i18n incohérentes
 * Corrige les noms de variables traduits pour qu'ils correspondent au français
 */

const fs = require('fs')
const path = require('path')

const LOCALES_DIR = path.join(__dirname, '..', 'i18n', 'locales')

// Liste des corrections à appliquer (détectées par check-i18n-variables.cjs)
const fixes = [
  // Anglais (1 erreur)
  {
    lang: 'en',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "The title will automatically be \"Volunteers - {'edition name'}\"",
    to: "The title will automatically be \"Volunteers - {'nom de l`édition ou de la convention'}\""
  },
  // Allemand (1 erreur)
  {
    lang: 'de',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "Der Titel wird automatisch \"Freiwillige - {'Editions- oder Konventionsname'}\" sein",
    to: "Der Titel wird automatisch \"Freiwillige - {'nom de l`édition ou de la convention'}\" sein"
  },
  // Espagnol (7 erreurs)
  {
    lang: 'es',
    file: 'artists.json',
    key: 'artists.meals.title',
    from: 'Comida de {nombre}',
    to: 'Comida de {name}'
  },
  {
    lang: 'es',
    file: 'artists.json',
    key: 'artists.notes_for_artist',
    from: 'Notas privadas del organizador para {nombre}',
    to: 'Notas privadas del organizador para {name}'
  },
  {
    lang: 'es',
    file: 'common.json',
    key: 'errors.invalid_file_type',
    from: 'Tipo de archivo no válido. Formatos aceptados: {tipos}',
    to: 'Tipo de archivo no válido. Formatos aceptados: {types}'
  },
  {
    lang: 'es',
    file: 'edition.json',
    key: 'editions.volunteers.added_manually_tooltip',
    from: 'Añadido manualmente por {nombre} el {fecha}.',
    to: 'Añadido manualmente por {name} el {date}.'
  },
  {
    lang: 'es',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "El título será automáticamente \"Voluntarios - {'nombre de la edición'}\"",
    to: "El título será automáticamente \"Voluntarios - {'nom de l`édition ou de la convention'}\""
  },
  {
    lang: 'es',
    file: 'workshops.json',
    key: 'workshops.extraction_success_description',
    from: '{cuenta} taller(es) detectado(s) con éxito',
    to: '{count} taller(es) detectado(s) con éxito'
  },
  {
    lang: 'es',
    file: 'workshops.json',
    key: 'workshops.import_partial_error_description',
    from: '{éxito} taller(es) importado(s), {fracaso} fracaso(s)',
    to: '{success} taller(es) importado(s), {fail} fracaso(s)'
  },
  // Italien (5 erreurs)
  {
    lang: 'it',
    file: 'artists.json',
    key: 'artists.meals.title',
    from: 'Pasto da {nome}',
    to: 'Pasto da {name}'
  },
  {
    lang: 'it',
    file: 'artists.json',
    key: 'artists.notes_for_artist',
    from: "Note private dell'organizzatore per {nome}",
    to: "Note private dell'organizzatore per {name}"
  },
  {
    lang: 'it',
    file: 'edition.json',
    key: 'editions.volunteers.added_manually_tooltip',
    from: 'Aggiunto manualmente da {nome} in data {data}.',
    to: 'Aggiunto manualmente da {name} in data {date}.'
  },
  {
    lang: 'it',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "Il titolo sarà automaticamente \"Volontari - {'nome dell`edizione'}\"",
    to: "Il titolo sarà automaticamente \"Volontari - {'nom de l`édition ou de la convention'}\""
  },
  {
    lang: 'it',
    file: 'workshops.json',
    key: 'workshops.import_partial_error_description',
    from: '{successo} laboratorio/i importato/i, {fallimento} fallimento/i',
    to: '{success} laboratorio/i importato/i, {fail} fallimento/i'
  },
  // Néerlandais (7 erreurs)
  {
    lang: 'nl',
    file: 'artists.json',
    key: 'artists.meals.title',
    from: 'Maaltijd van {naam}',
    to: 'Maaltijd van {name}'
  },
  {
    lang: 'nl',
    file: 'artists.json',
    key: 'artists.notes_for_artist',
    from: 'Privé-opmerkingen van de organisator voor {naam}',
    to: 'Privé-opmerkingen van de organisator voor {name}'
  },
  {
    lang: 'nl',
    file: 'edition.json',
    key: 'editions.volunteers.added_manually_tooltip',
    from: 'Handmatig toegevoegd door {naam} op {datum}.',
    to: 'Handmatig toegevoegd door {name} op {date}.'
  },
  {
    lang: 'nl',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "De titel zal automatisch \"Vrijwilligers - {'editienaam'}\" zijn",
    to: "De titel zal automatisch \"Vrijwilligers - {'nom de l`édition ou de la convention'}\" zijn"
  },
  {
    lang: 'nl',
    file: 'workshops.json',
    key: 'workshops.extraction_success_description',
    from: '{aantal} workshop(s) succesvol gedetecteerd',
    to: '{count} workshop(s) succesvol gedetecteerd'
  },
  {
    lang: 'nl',
    file: 'workshops.json',
    key: 'workshops.import_success_description',
    from: '{aantal} workshop(s) succesvol geïmporteerd',
    to: '{count} workshop(s) succesvol geïmporteerd'
  },
  {
    lang: 'nl',
    file: 'workshops.json',
    key: 'workshops.import_partial_error_description',
    from: '{succes} workshop(s) geïmporteerd, {mislukt} mislukt',
    to: '{success} workshop(s) geïmporteerd, {fail} mislukt'
  },
  // Polonais (6 erreurs)
  {
    lang: 'pl',
    file: 'artists.json',
    key: 'artists.meals.title',
    from: 'Posiłek z {nazwa}',
    to: 'Posiłek z {name}'
  },
  {
    lang: 'pl',
    file: 'artists.json',
    key: 'artists.notes_for_artist',
    from: 'Prywatne notatki organizatora dla {nazwa}',
    to: 'Prywatne notatki organizatora dla {name}'
  },
  {
    lang: 'pl',
    file: 'edition.json',
    key: 'editions.volunteers.added_manually_tooltip',
    from: 'Ręcznie dodane przez {nazwa} w {data}.',
    to: 'Ręcznie dodane przez {name} w {date}.'
  },
  {
    lang: 'pl',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "Tytuł będzie automatycznie \"Wolontariusze - {'nazwa edycji'}\"",
    to: "Tytuł będzie automatycznie \"Wolontariusze - {'nom de l`édition ou de la convention'}\""
  },
  {
    lang: 'pl',
    file: 'workshops.json',
    key: 'workshops.extraction_success_description',
    from: '{liczyć} warsztat(y) pomyślnie wykryty',
    to: '{count} warsztat(y) pomyślnie wykryty'
  },
  {
    lang: 'pl',
    file: 'workshops.json',
    key: 'workshops.import_partial_error_description',
    from: '{sukces} warsztat(y) zaimportowane, {awaria} niepowodzenie/a',
    to: '{success} warsztat(y) zaimportowane, {fail} niepowodzenie/a'
  },
  // Portugais (5 erreurs)
  {
    lang: 'pt',
    file: 'artists.json',
    key: 'artists.meals.title',
    from: 'Refeição de {nome}',
    to: 'Refeição de {name}'
  },
  {
    lang: 'pt',
    file: 'artists.json',
    key: 'artists.notes_for_artist',
    from: 'Notas privadas do organizador para {nome}',
    to: 'Notas privadas do organizador para {name}'
  },
  {
    lang: 'pt',
    file: 'edition.json',
    key: 'editions.volunteers.added_manually_tooltip',
    from: 'Adicionado manualmente por {nome} em {data}.',
    to: 'Adicionado manualmente por {name} em {date}.'
  },
  {
    lang: 'pt',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "O título será automaticamente \"Voluntários - {'nome da edição'}\"",
    to: "O título será automaticamente \"Voluntários - {'nom de l`édition ou de la convention'}\""
  },
  {
    lang: 'pt',
    file: 'workshops.json',
    key: 'workshops.import_partial_error_description',
    from: '{sucesso} seminário(s) importado(s), {falha} fracasso(s)',
    to: '{success} seminário(s) importado(s), {fail} fracasso(s)'
  },
  // Russe (9 erreurs)
  {
    lang: 'ru',
    file: 'artists.json',
    key: 'artists.meals.title',
    from: 'Еда от {имя}',
    to: 'Еда от {name}'
  },
  {
    lang: 'ru',
    file: 'artists.json',
    key: 'artists.notes_for_artist',
    from: 'Личные заметки организатора для {имя}',
    to: 'Личные заметки организатора для {name}'
  },
  {
    lang: 'ru',
    file: 'components.json',
    key: 'components.carpool.requested_seats',
    from: '{count} запрошенное место | {count} запрошенных места | {count} запрошенных мест',
    to: '{count} запрошенное место | {count} запрошенных места | {count} запрошенных мест' // déjà correct
  },
  {
    lang: 'ru',
    file: 'edition.json',
    key: 'editions.volunteers.added_manually_tooltip',
    from: 'Добавлено вручную {имя} в {дата}.',
    to: 'Добавлено вручную {name} в {date}.'
  },
  {
    lang: 'ru',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "Заголовок будет автоматически \"Волонтёры - {'название издания или конвенции'}\"",
    to: "Заголовок будет автоматически \"Волонтёры - {'nom de l`édition ou de la convention'}\""
  },
  {
    lang: 'ru',
    file: 'edition.json',
    key: 'editions.volunteers.team_members_count',
    from: '{count} участник | {count} участника | {count} участников',
    to: '{count} участник | {count} участника | {count} участников' // déjà correct
  },
  {
    lang: 'ru',
    file: 'workshops.json',
    key: 'workshops.extraction_success_description',
    from: 'Успешно обнаружена {счетная} мастерская(ы)',
    to: 'Успешно обнаружена {count} мастерская(ы)'
  },
  {
    lang: 'ru',
    file: 'workshops.json',
    key: 'workshops.import_success_description',
    from: 'Успешно импортирована {счетная} мастерская(ы)',
    to: 'Успешно импортирована {count} мастерская(ы)'
  },
  {
    lang: 'ru',
    file: 'workshops.json',
    key: 'workshops.import_partial_error_description',
    from: '{успех} мастерская (мастерские) импортирована, {неудача} неудача (неудачи)',
    to: '{success} мастерская (мастерские) импортирована, {fail} неудача (неудачи)'
  },
  // Ukrainien (7 erreurs)
  {
    lang: 'uk',
    file: 'artists.json',
    key: 'artists.meals.title',
    from: "Страва від {ім'я}",
    to: 'Страва від {name}'
  },
  {
    lang: 'uk',
    file: 'artists.json',
    key: 'artists.notes_for_artist',
    from: "Приватні нотатки організатора для {ім'я}",
    to: 'Приватні нотатки організатора для {name}'
  },
  {
    lang: 'uk',
    file: 'components.json',
    key: 'components.carpool.requested_seats',
    from: '{count} запитане місце | {count} запитаних місця | {count} запитаних місць',
    to: '{count} запитане місце | {count} запитаних місця | {count} запитаних місць' // déjà correct
  },
  {
    lang: 'uk',
    file: 'edition.json',
    key: 'editions.volunteers.added_manually_tooltip',
    from: "Вручну додано {ім'я} в {дата}.",
    to: 'Вручну додано {name} в {date}.'
  },
  {
    lang: 'uk',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "Заголовок буде автоматично \"Волонтери - {'назва видання або конвенції'}\"",
    to: "Заголовок буде автоматично \"Волонтери - {'nom de l`édition ou de la convention'}\""
  },
  {
    lang: 'uk',
    file: 'edition.json',
    key: 'editions.volunteers.team_members_count',
    from: '{count} учасник | {count} учасника | {count} учасників',
    to: '{count} учасник | {count} учасника | {count} учасників' // déjà correct
  },
  {
    lang: 'uk',
    file: 'workshops.json',
    key: 'workshops.import_partial_error_description',
    from: '{успіх} імпортовано майстерню(и), {неуспіх} відмова(и)',
    to: '{success} імпортовано майстерню(и), {fail} відмова(и)'
  },
  // Danois (7 erreurs)
  {
    lang: 'da',
    file: 'artists.json',
    key: 'artists.meals.title',
    from: 'Måltid fra {navn}',
    to: 'Måltid fra {name}'
  },
  {
    lang: 'da',
    file: 'artists.json',
    key: 'artists.notes_for_artist',
    from: 'Arrangørens private noter til {navn}',
    to: 'Arrangørens private noter til {name}'
  },
  {
    lang: 'da',
    file: 'common.json',
    key: 'errors.invalid_file_type',
    from: 'Ugyldig filtype. Accepterede formater: {typer}',
    to: 'Ugyldig filtype. Accepterede formater: {types}'
  },
  {
    lang: 'da',
    file: 'edition.json',
    key: 'editions.volunteers.added_manually_tooltip',
    from: 'Manuelt tilføjet af {navn} den {dato}.',
    to: 'Manuelt tilføjet af {name} den {date}.'
  },
  {
    lang: 'da',
    file: 'edition.json',
    key: 'editions.volunteers.notification_title_info',
    from: "Titlen vil automatisk være \"Frivillige - {'udgavenavn'}\"",
    to: "Titlen vil automatisk være \"Frivillige - {'nom de l`édition ou de la convention'}\""
  },
  {
    lang: 'da',
    file: 'workshops.json',
    key: 'workshops.extraction_success_description',
    from: '{antal} værksted(er) fundet med succes',
    to: '{count} værksted(er) fundet med succes'
  },
  {
    lang: 'da',
    file: 'workshops.json',
    key: 'workshops.import_success_description',
    from: '{antal} værksted(er) importeret med succes',
    to: '{count} værksted(er) importeret med succes'
  }
]

// Fonction pour obtenir/définir une valeur dans un objet imbriqué
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.')
  const lastKey = keys.pop()
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {}
    return current[key]
  }, obj)
  target[lastKey] = value
}

// Fonction principale
function fixI18nVariables() {
  console.log('🔧 Correction des variables i18n...\n')

  const fixedFiles = new Set()
  let appliedFixes = 0

  // Grouper les corrections par fichier
  const fixesByFile = {}
  for (const fix of fixes) {
    const fileKey = `${fix.lang}/${fix.file}`
    if (!fixesByFile[fileKey]) {
      fixesByFile[fileKey] = []
    }
    fixesByFile[fileKey].push(fix)
  }

  // Appliquer les corrections fichier par fichier
  for (const [fileKey, fileFixes] of Object.entries(fixesByFile)) {
    const [lang, filename] = fileKey.split('/')
    const filePath = path.join(LOCALES_DIR, lang, filename)

    console.log(`📝 ${fileKey}...`)

    if (!fs.existsSync(filePath)) {
      console.log(`   ⚠️  Fichier non trouvé: ${filePath}`)
      continue
    }

    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      let fileModified = false

      for (const fix of fileFixes) {
        const currentValue = getNestedValue(content, fix.key)

        if (!currentValue) {
          console.log(`   ⚠️  Clé non trouvée: ${fix.key}`)
          continue
        }

        if (currentValue !== fix.from) {
          console.log(`   ⚠️  Valeur différente pour ${fix.key}`)
          console.log(`      Attendu: "${fix.from}"`)
          console.log(`      Trouvé:  "${currentValue}"`)
          continue
        }

        // Vérifier si la correction est triviale (variables déjà correctes)
        if (fix.from === fix.to) {
          console.log(`   ✓ ${fix.key} (déjà correct)`)
          appliedFixes++
          continue
        }

        setNestedValue(content, fix.key, fix.to)
        console.log(`   ✓ ${fix.key}`)
        fileModified = true
        appliedFixes++
      }

      if (fileModified) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8')
        fixedFiles.add(fileKey)
      }
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`)
    }

    console.log()
  }

  console.log('═'.repeat(80))
  console.log('📊 RÉSUMÉ')
  console.log('═'.repeat(80))
  console.log(`Corrections appliquées : ${appliedFixes}/${fixes.length}`)
  console.log(`Fichiers modifiés : ${fixedFiles.size}`)
  console.log()

  if (fixedFiles.size > 0) {
    console.log('✅ Correction terminée !')
    console.log('\n💡 Relance "npm run check-i18n-vars" pour vérifier')
  } else {
    console.log('ℹ️  Aucune modification nécessaire')
  }
}

// Exécuter le script
fixI18nVariables()
