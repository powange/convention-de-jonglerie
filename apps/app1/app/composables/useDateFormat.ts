import { toIntlLocale } from '~/utils/locales'

import { fuseauUtilisable, journeeDans } from '~~/shared/utils/fuseau-edition'

/**
 * Composable pour formatter les dates avec horaires
 */
export const useDateFormat = () => {
  const { locale, t } = useI18n()

  // Le code i18n (`en`, `fr`…) n'a pas de région : `Intl` compléterait `en` en `en-US` et
  // sortirait des dates en MM/DD/YYYY. On passe donc toujours par la balise BCP-47.
  const intlLocale = computed(() => toIntlLocale(locale.value))

  /**
   * Le fuseau dans lequel lire un instant.
   *
   * ⚠️ `Europe/Paris` ÉTAIT CODÉ EN DUR dans treize fonctions de ce fichier : une édition
   * australienne affichait donc ses dates à l'heure de Paris, c'est-à-dire autre chose que ce que
   * son organisateur avait saisi. Chacune accepte désormais le fuseau de l'édition.
   *
   * ⚠️⚠️ ET LE REPLI RESTE `Europe/Paris`, délibérément — ce n'est pas un reste de l'ancien code.
   * `fuseauUtilisable(null)` rend `undefined`, ce qui ferait retomber l'affichage sur la MACHINE du
   * lecteur. Or 38 des 69 éditions de la base de développement ne déclarent AUCUN fuseau, et des
   * dizaines d'appels de ce composable affichent autre chose qu'une date d'édition — l'horodatage
   * d'un commentaire, d'une notification. Prendre la machine par défaut aurait donc changé en
   * silence ce que voient tous les lecteurs hors de France, sans qu'aucune donnée ait bougé.
   *
   * Conséquence voulue : seules les éditions qui DÉCLARENT un fuseau changent d'affichage, et elles
   * changent vers le bon. Le reste est strictement inchangé. Le choix du fuseau pour un horodatage
   * technique est une question distincte, laissée ouverte.
   */
  const zoneDeLecture = (fuseau?: string | null) => fuseauUtilisable(fuseau) ?? 'Europe/Paris'

  /**
   * Formate une date avec l'heure
   */
  const formatDateTime = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleString(intlLocale.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate seulement l'heure
   *
   * Pour ce qui se lit à côté d'une date déjà écrite — une heure de fin en face de son heure de
   * début — où répéter le jour à chaque ligne encombre sans rien apprendre. Même fuseau que les
   * autres, sans quoi deux colonnes voisines annonceraient des heures incomparables.
   */
  const formatTime = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString(intlLocale.value, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zoneDeLecture(fuseau),
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
  const formatDateShortMonth = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      // Le fuseau de l'édition, et non `Europe/Paris` codé en dur comme auparavant : une échéance
      // est une heure de LIEU, et l'heure saisie est désormais ancrée sur place. Ramener
      // l'affichage à Paris aurait montré un autre chiffre que celui tapé, pour toute convention
      // hors de France.
      //
      // 📍 Le repli est désormais celui de `zoneDeLecture` — `Europe/Paris` — et non plus la
      // machine : cette fonction était seule à le faire, ce qui donnait deux comportements
      // différents dans le même composable pour une édition sans fuseau.
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate une date et une heure avec le mois abrégé (ex: « 12 août 2026 20:00 »)
   */
  const formatDateTimeShortMonth = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleString(intlLocale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate seulement la date
   */
  const formatDate = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate une date en format long (ex: "Mercredi 19 février 2026")
   */
  const formatDateFull = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate une date sans son année (ex: « mercredi 19 février »)
   *
   * Pour les listes où l'année n'apprend rien : les dates d'une même édition tiennent toutes
   * dans la même année, et la répéter à chaque ligne d'un sélecteur ne fait que l'allonger.
   */
  const formatDateWeekdayMonth = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate une date en abrégé, sans année (ex: « mer. 19 févr. »)
   *
   * Pour les colonnes d'un tableau, où la place manque.
   */
  const formatDateWeekdayMonthShort = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate une date avec le nom court du jour
   */
  const formatDateWithWeekday = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(intlLocale.value, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate une date avec le nom court du jour et l'heure
   */
  const formatDateTimeWithWeekday = (dateString: string, fuseau?: string | null) => {
    const date = new Date(dateString)
    return date.toLocaleString(intlLocale.value, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zoneDeLecture(fuseau),
    })
  }

  /**
   * Formate une plage de dates avec horaires
   */
  const formatDateTimeRange = (startString: string, endString: string, fuseau?: string | null) => {
    const startDate = new Date(startString)
    const endDate = new Date(endString)

    /*
     * ⚠️ « MÊME JOUR » SE DÉCIDE SUR PLACE, pas au fuseau du lecteur. `toDateString()` découpe les
     * journées dans le fuseau de la MACHINE : une édition qui commence le 1er à 23 h et finit le
     * 2 à 1 h, heure locale, passait pour un seul jour vue d'un fuseau plus à l'ouest — et la
     * phrase rendue annonçait alors une plage d'heures sur une date fausse. C'est le même défaut
     * que celui qu'on répare, un cran plus loin.
     */
    if (journeeDans(startDate, fuseau) === journeeDans(endDate, fuseau)) {
      return t('dates.same_day_with_time', {
        date: startDate.toLocaleDateString(intlLocale.value, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: zoneDeLecture(fuseau),
        }),
        startTime: startDate.toLocaleTimeString(intlLocale.value, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: zoneDeLecture(fuseau),
        }),
        endTime: endDate.toLocaleTimeString(intlLocale.value, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: zoneDeLecture(fuseau),
        }),
      })
    }

    // Si différents jours
    return t('dates.date_range_with_time', {
      startDate: formatDateTime(startString, fuseau),
      endDate: formatDateTime(endString, fuseau),
    })
  }

  /**
   * Formate une plage de dates sans horaires (pour la compatibilité)
   */
  const formatDateRange = (startString: string, endString: string, fuseau?: string | null) => {
    // Même raison que dans `formatDateTimeRange` : la journée se découpe sur place.
    if (journeeDans(startString, fuseau) === journeeDans(endString, fuseau)) {
      return formatDate(startString, fuseau)
    }

    return t('dates.date_range', {
      startDate: formatDate(startString, fuseau),
      endDate: formatDate(endString, fuseau),
    })
  }

  /**
   * Même intervalle, en plus court : les deux dates séparées d'une flèche, sans « du » ni
   * « au ». Destiné aux endroits où la largeur manque — la barre de gestion, par exemple.
   */
  const formatDateRangeCompact = (
    startString: string,
    endString: string,
    fuseau?: string | null
  ) => {
    if (journeeDans(startString, fuseau) === journeeDans(endString, fuseau)) {
      return formatDate(startString, fuseau)
    }

    return t('dates.date_range_compact', {
      startDate: formatDate(startString, fuseau),
      endDate: formatDate(endString, fuseau),
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
