import { getTimeZones, type TimeZone } from '@vvo/tzdb'

import type { SelectMenuItem } from '@nuxt/ui'

/**
 * Mapping des codes continent vers des noms en français
 */
const CONTINENT_LABELS: Record<string, string> = {
  EU: 'Europe',
  NA: 'Amérique du Nord',
  SA: 'Amérique du Sud',
  AS: 'Asie',
  OC: 'Océanie',
  AF: 'Afrique',
  AN: 'Antarctique',
}

/**
 * Ordre d'affichage des continents (Europe en premier car plus pertinent)
 */
const CONTINENT_ORDER = ['EU', 'NA', 'SA', 'AS', 'OC', 'AF', 'AN']

/**
 * Composable pour gérer les fuseaux horaires IANA via @vvo/tzdb
 */
export const useTimezones = () => {
  /**
   * Récupère tous les fuseaux horaires avec leurs métadonnées
   */
  const getAllTimezones = () => {
    return getTimeZones()
  }

  /**
   * Formate l'offset en heures:minutes (ex: "+05:30", "-08:00")
   */
  const formatOffset = (offsetInMinutes: number): string => {
    const sign = offsetInMinutes >= 0 ? '+' : '-'
    const absOffset = Math.abs(offsetInMinutes)
    const hours = Math.floor(absOffset / 60)
    const minutes = absOffset % 60
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  /**
   * Normalise une chaîne pour la recherche : minuscules + suppression des accents.
   */
  const normalize = (value: string): string =>
    value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  /**
   * Génère les items pour le USelectMenu avec groupes par continent.
   * Format : "Villes principales (GMT+X)".
   *
   * Le filtrage est réalisé ici (le USelectMenu doit donc utiliser `ignore-filter`)
   * afin de ne pas afficher les libellés des groupes sans résultat et de conserver
   * chaque fuseau dans sa catégorie.
   *
   * @param search Terme de recherche optionnel (insensible à la casse et aux accents).
   */
  const getSelectMenuItems = (search = ''): SelectMenuItem[] => {
    const timezones = getTimeZones()
    const items: SelectMenuItem[] = []
    const query = normalize(search.trim())

    // Grouper par continent
    const grouped: Record<string, typeof timezones> = {}
    for (const tz of timezones) {
      const continent = tz.continentCode
      if (!grouped[continent]) {
        grouped[continent] = []
      }
      grouped[continent].push(tz)
    }

    // Construire les items dans l'ordre des continents
    for (const continentCode of CONTINENT_ORDER) {
      const continentTimezones = grouped[continentCode]
      if (!continentTimezones || continentTimezones.length === 0) continue

      // Trier par offset puis par nom
      const sortedTimezones = [...continentTimezones].sort((a, b) => {
        if (a.rawOffsetInMinutes !== b.rawOffsetInMinutes) {
          return a.rawOffsetInMinutes - b.rawOffsetInMinutes
        }
        return a.alternativeName.localeCompare(b.alternativeName)
      })

      // Construire les options du groupe en appliquant le filtre de recherche
      const groupOptions: SelectMenuItem[] = []
      for (const tz of sortedTimezones) {
        const cities = tz.mainCities.slice(0, 3).join(', ')
        const offset = formatOffset(tz.currentTimeOffsetInMinutes)
        const label = `${cities} (GMT${offset})`

        if (
          query &&
          ![label, cities, tz.alternativeName, tz.countryName, tz.name].some((field) =>
            normalize(field).includes(query)
          )
        ) {
          continue
        }

        groupOptions.push({
          label,
          // Champs supplémentaires pour l'affichage
          city: cities,
          region: tz.alternativeName,
          country: tz.countryName,
          offset,
          value: tz.name,
        })
      }

      // Ne pas afficher de catégorie sans résultat (ni label ni séparateur orphelin)
      if (groupOptions.length === 0) continue

      // Ajouter un séparateur si ce n'est pas le premier groupe
      if (items.length > 0) {
        items.push({ type: 'separator' })
      }

      // Ajouter le label du groupe (continent) puis ses options
      items.push({
        type: 'label',
        label: CONTINENT_LABELS[continentCode] || continentCode,
      })
      items.push(...groupOptions)
    }

    return items
  }

  /**
   * Obtient le fuseau horaire par défaut pour un pays donné
   */
  const getDefaultTimezoneForCountry = (country: string): string | undefined => {
    const timezones = getTimeZones()
    // Chercher un fuseau horaire qui correspond au pays
    const match = timezones.find(
      (tz: TimeZone) =>
        tz.countryName.toLowerCase() === country.toLowerCase() ||
        tz.countryCode.toLowerCase() === country.toLowerCase()
    )
    return match?.name
  }

  /**
   * Obtient le fuseau horaire actuel du navigateur
   */
  const getBrowserTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'Europe/Paris'
    }
  }

  /**
   * Formate un fuseau horaire pour l'affichage
   * Ex: "Europe/Paris" -> "Paris, Lyon, Marseille (GMT+01:00)"
   */
  const formatTimezoneWithOffset = (timezone: string): string => {
    const timezones = getTimeZones()
    const tz = timezones.find((t: TimeZone) => t.name === timezone || t.group.includes(timezone))

    if (tz) {
      const cities = tz.mainCities.slice(0, 3).join(', ')
      const offset = formatOffset(tz.currentTimeOffsetInMinutes)
      return `${cities} (GMT${offset})`
    }

    // Fallback si non trouvé
    return timezone
  }

  /**
   * Obtient l'offset GMT d'un fuseau horaire
   */
  const getTimezoneOffset = (timezone: string): string => {
    const timezones = getTimeZones()
    const tz = timezones.find((t: TimeZone) => t.name === timezone || t.group.includes(timezone))

    if (tz) {
      return `GMT${formatOffset(tz.currentTimeOffsetInMinutes)}`
    }

    // Fallback via Intl
    try {
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
      })
      const parts = formatter.formatToParts(now)
      const offsetPart = parts.find((p) => p.type === 'timeZoneName')
      return offsetPart?.value || ''
    } catch {
      return ''
    }
  }

  /**
   * Obtient l'abréviation du fuseau horaire (ex: "CET", "PST")
   */
  const getTimezoneAbbreviation = (timezone: string): string => {
    const timezones = getTimeZones()
    const tz = timezones.find((t: TimeZone) => t.name === timezone || t.group.includes(timezone))
    return tz?.abbreviation || ''
  }

  /**
   * Obtient les informations complètes d'un fuseau horaire
   */
  const getTimezoneInfo = (timezone: string): TimeZone | undefined => {
    const timezones = getTimeZones()
    return timezones.find((t: TimeZone) => t.name === timezone || t.group.includes(timezone))
  }

  return {
    getAllTimezones,
    getSelectMenuItems,
    getDefaultTimezoneForCountry,
    getBrowserTimezone,
    formatTimezoneWithOffset,
    getTimezoneAbbreviation,
    getTimezoneOffset,
    getTimezoneInfo,
  }
}
