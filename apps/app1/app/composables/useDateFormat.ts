import { toIntlLocale } from '~/utils/locales'

/**
 * Composable pour formatter les dates avec horaires
 */
export const useDateFormat = () => {
  const { locale, t } = useI18n()

  // Le code i18n (`en`, `fr`…) n'a pas de région : `Intl` compléterait `en` en `en-US` et
  // sortirait des dates en MM/DD/YYYY. On passe donc toujours par la balise BCP-47.
  const intlLocale = computed(() => toIntlLocale(locale.value))

  /**
   * Formate une date avec l'heure
   */
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(intlLocale.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate seulement l'heure
   *
   * Pour ce qui se lit à côté d'une date déjà écrite — une heure de fin en face de son heure de
   * début — où répéter le jour à chaque ligne encombre sans rien apprendre. Même fuseau que les
   * autres, sans quoi deux colonnes voisines annonceraient des heures incomparables.
   */
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString(intlLocale.value, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate une date avec le mois abrégé (ex: « 12 août 2026 »)
   *
   * Pour une date qui se lit seule plutôt que dans une colonne — une échéance sur une carte, un
   * horodatage sous un commentaire. Le mois en lettres se reconnaît d'un coup d'œil là où
   * « 12/08 » demande de savoir si l'on est en notation française ou américaine ; en colonne,
   * `formatDate` reste préférable parce que ses chiffres s'alignent.
   */
  const formatDateShortMonth = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate une date et une heure avec le mois abrégé (ex: « 12 août 2026 20:00 »)
   */
  const formatDateTimeShortMonth = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(intlLocale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate seulement la date
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate une date en format long (ex: "Mercredi 19 février 2026")
   */
  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate une date sans son année (ex: « mercredi 19 février »)
   *
   * Pour les listes où l'année n'apprend rien : les dates d'une même édition tiennent toutes
   * dans la même année, et la répéter à chaque ligne d'un sélecteur ne fait que l'allonger.
   */
  const formatDateWeekdayMonth = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate une date en abrégé, sans année (ex: « mer. 19 févr. »)
   *
   * Pour les colonnes d'un tableau, où la place manque.
   */
  const formatDateWeekdayMonthShort = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate une date avec le nom court du jour
   */
  const formatDateWithWeekday = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate une date avec le nom court du jour et l'heure
   */
  const formatDateTimeWithWeekday = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(intlLocale.value, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    })
  }

  /**
   * Formate une plage de dates avec horaires
   */
  const formatDateTimeRange = (startString: string, endString: string) => {
    const startDate = new Date(startString)
    const endDate = new Date(endString)

    // Si même jour
    if (startDate.toDateString() === endDate.toDateString()) {
      return t('dates.same_day_with_time', {
        date: startDate.toLocaleDateString(intlLocale.value, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Europe/Paris',
        }),
        startTime: startDate.toLocaleTimeString(intlLocale.value, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris',
        }),
        endTime: endDate.toLocaleTimeString(intlLocale.value, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris',
        }),
      })
    }

    // Si différents jours
    return t('dates.date_range_with_time', {
      startDate: formatDateTime(startString),
      endDate: formatDateTime(endString),
    })
  }

  /**
   * Formate une plage de dates sans horaires (pour la compatibilité)
   */
  const formatDateRange = (startString: string, endString: string) => {
    const startDate = new Date(startString)
    const endDate = new Date(endString)

    if (startDate.toDateString() === endDate.toDateString()) {
      return formatDate(startString)
    }

    return t('dates.date_range', {
      startDate: formatDate(startString),
      endDate: formatDate(endString),
    })
  }

  /**
   * Même intervalle, en plus court : les deux dates séparées d'une flèche, sans « du » ni
   * « au ». Destiné aux endroits où la largeur manque — la barre de gestion, par exemple.
   */
  const formatDateRangeCompact = (startString: string, endString: string) => {
    const startDate = new Date(startString)
    const endDate = new Date(endString)

    if (startDate.toDateString() === endDate.toDateString()) {
      return formatDate(startString)
    }

    return t('dates.date_range_compact', {
      startDate: formatDate(startString),
      endDate: formatDate(endString),
    })
  }

  /**
   * Formate une date avec granularité temporelle (format: date_granularity)
   * Exemple: "2024-01-15_morning" -> "15 janv. matin"
   */
  const formatDateTimeWithGranularity = (dateTimeString: string) => {
    if (!dateTimeString || !dateTimeString.includes('_')) {
      return dateTimeString
    }

    const [datePart, timePart] = dateTimeString.split('_')

    try {
      const date = new Date(datePart)
      const dateFormatted = date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      })

      // Traduction des granularités
      const timeTranslations: Record<string, string> = {
        morning: t('edition.volunteers.time_granularity.morning'),
        noon: t('edition.volunteers.time_granularity.noon'),
        afternoon: t('edition.volunteers.time_granularity.afternoon'),
        evening: t('edition.volunteers.time_granularity.evening'),
      }

      const timeFormatted = timeTranslations[timePart] || timePart

      return `${dateFormatted} ${timeFormatted.toLowerCase()}`
    } catch {
      return dateTimeString.split('_').join(' ')
    }
  }

  return {
    formatDateTime,
    formatTime,
    formatDateShortMonth,
    formatDateTimeShortMonth,
    formatDate,
    formatDateFull,
    formatDateWeekdayMonth,
    formatDateWeekdayMonthShort,
    formatDateWithWeekday,
    formatDateTimeWithWeekday,
    formatDateTimeRange,
    formatDateRange,
    formatDateRangeCompact,
    formatDateTimeWithGranularity,
  }
}
