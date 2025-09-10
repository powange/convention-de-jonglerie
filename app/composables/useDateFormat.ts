/**
 * Composable pour formatter les dates avec horaires
 */
export const useDateFormat = () => {
  const { locale, t } = useI18n()

  /**
   * Formate une date avec l'heure
   */
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(locale.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * Formate seulement la date
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(locale.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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
        date: startDate.toLocaleDateString(locale.value, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        startTime: startDate.toLocaleTimeString(locale.value, {
          hour: '2-digit',
          minute: '2-digit',
        }),
        endTime: endDate.toLocaleTimeString(locale.value, {
          hour: '2-digit',
          minute: '2-digit',
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
        morning: t('editions.volunteers.time_granularity.morning'),
        noon: t('editions.volunteers.time_granularity.noon'),
        afternoon: t('editions.volunteers.time_granularity.afternoon'),
        evening: t('editions.volunteers.time_granularity.evening'),
      }

      const timeFormatted = timeTranslations[timePart] || timePart

      return `${dateFormatted} ${timeFormatted.toLowerCase()}`
    } catch {
      return dateTimeString.split('_').join(' ')
    }
  }

  return {
    formatDateTime,
    formatDate,
    formatDateTimeRange,
    formatDateRange,
    formatDateTimeWithGranularity,
  }
}
