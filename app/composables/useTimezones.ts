import type { SelectMenuItem } from '@nuxt/ui'

/**
 * Mapping des régions IANA vers des noms traduits
 */
const REGION_LABELS: Record<string, string> = {
  Africa: 'Afrique',
  America: 'Amérique',
  Antarctica: 'Antarctique',
  Arctic: 'Arctique',
  Asia: 'Asie',
  Atlantic: 'Atlantique',
  Australia: 'Australie',
  Europe: 'Europe',
  Indian: 'Océan Indien',
  Pacific: 'Pacifique',
}

/**
 * Mapping pays -> timezone par défaut (pour pré-sélection automatique)
 */
const COUNTRY_DEFAULT_TIMEZONES: Record<string, string> = {
  France: 'Europe/Paris',
  Allemagne: 'Europe/Berlin',
  Germany: 'Europe/Berlin',
  Espagne: 'Europe/Madrid',
  Spain: 'Europe/Madrid',
  Italie: 'Europe/Rome',
  Italy: 'Europe/Rome',
  'Royaume-Uni': 'Europe/London',
  'United Kingdom': 'Europe/London',
  Belgique: 'Europe/Brussels',
  Belgium: 'Europe/Brussels',
  Suisse: 'Europe/Zurich',
  Switzerland: 'Europe/Zurich',
  Canada: 'America/Toronto',
  'États-Unis': 'America/New_York',
  'United States': 'America/New_York',
  USA: 'America/New_York',
  Japon: 'Asia/Tokyo',
  Japan: 'Asia/Tokyo',
  Chine: 'Asia/Shanghai',
  China: 'Asia/Shanghai',
  Australie: 'Australia/Sydney',
  Australia: 'Australia/Sydney',
  Brésil: 'America/Sao_Paulo',
  Brazil: 'America/Sao_Paulo',
  Mexique: 'America/Mexico_City',
  Mexico: 'America/Mexico_City',
  Inde: 'Asia/Kolkata',
  India: 'Asia/Kolkata',
  Argentine: 'America/Buenos_Aires',
  Argentina: 'America/Buenos_Aires',
  Pays: 'Europe/Amsterdam',
  Netherlands: 'Europe/Amsterdam',
  Portugal: 'Europe/Lisbon',
  Pologne: 'Europe/Warsaw',
  Poland: 'Europe/Warsaw',
  Autriche: 'Europe/Vienna',
  Austria: 'Europe/Vienna',
  Russie: 'Europe/Moscow',
  Russia: 'Europe/Moscow',
}

/**
 * Composable pour gérer les fuseaux horaires IANA
 */
export const useTimezones = () => {
  /**
   * Récupère tous les fuseaux horaires disponibles via l'API Intl
   */
  const getAllTimezones = (): string[] => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      // Fallback pour les navigateurs qui ne supportent pas supportedValuesOf
      console.warn("Intl.supportedValuesOf non supporté, utilisation d'une liste par défaut")
      return [
        'Europe/Paris',
        'Europe/London',
        'Europe/Berlin',
        'America/New_York',
        'America/Los_Angeles',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney',
      ]
    }
  }

  /**
   * Groupe les fuseaux horaires par région
   */
  const getGroupedTimezones = (): Record<string, string[]> => {
    const timezones = getAllTimezones()
    const grouped: Record<string, string[]> = {}

    for (const tz of timezones) {
      const [region] = tz.split('/')
      if (region && REGION_LABELS[region]) {
        if (!grouped[region]) {
          grouped[region] = []
        }
        grouped[region].push(tz)
      }
    }

    return grouped
  }

  /**
   * Obtient l'offset GMT d'un fuseau horaire
   */
  const getTimezoneOffset = (timezone: string): string => {
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
   * Génère les items pour le USelectMenu avec groupes par région
   * Format : "Ville (GMT+X)" avec région en label de groupe
   */
  const getSelectMenuItems = (): SelectMenuItem[] => {
    const grouped = getGroupedTimezones()
    const items: SelectMenuItem[] = []

    // Ordre des régions (Europe en premier car plus pertinent pour ce projet)
    const regionOrder = [
      'Europe',
      'America',
      'Asia',
      'Australia',
      'Pacific',
      'Africa',
      'Atlantic',
      'Indian',
      'Antarctica',
      'Arctic',
    ]

    for (const region of regionOrder) {
      if (!grouped[region]) continue

      // Ajouter un séparateur si ce n'est pas le premier groupe
      if (items.length > 0) {
        items.push({ type: 'separator' })
      }

      // Ajouter le label du groupe (région)
      items.push({
        type: 'label',
        label: REGION_LABELS[region] || region,
      })

      // Ajouter les fuseaux de ce groupe
      for (const tz of grouped[region]) {
        // Extraire le nom de la ville (ex: "Europe/Paris" -> "Paris")
        const cityPart = tz.split('/').slice(1).join('/').replace(/_/g, ' ')
        const offset = getTimezoneOffset(tz)
        const regionLabel = REGION_LABELS[region] || region

        items.push({
          label: `${cityPart || tz} (${offset})`,
          // Champ supplémentaire pour la recherche et l'affichage
          region: regionLabel,
          city: cityPart || tz,
          offset,
          value: tz,
        })
      }
    }

    return items
  }

  /**
   * Obtient le fuseau horaire par défaut pour un pays donné
   */
  const getDefaultTimezoneForCountry = (country: string): string | undefined => {
    return COUNTRY_DEFAULT_TIMEZONES[country]
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
   * Formate un fuseau horaire pour l'affichage (avec offset actuel)
   * Ex: "Europe/Paris" -> "Europe/Paris (UTC+1)"
   */
  const formatTimezoneWithOffset = (timezone: string): string => {
    try {
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
      })
      const parts = formatter.formatToParts(now)
      const offsetPart = parts.find((p) => p.type === 'timeZoneName')
      const offset = offsetPart?.value || ''

      // Extraire le nom de la ville
      const cityPart = timezone.split('/').slice(1).join('/').replace(/_/g, ' ')
      return `${cityPart} (${offset})`
    } catch {
      return timezone
    }
  }

  /**
   * Obtient l'abréviation du fuseau horaire (ex: "CET", "PST")
   */
  const getTimezoneAbbreviation = (timezone: string, date?: Date): string => {
    try {
      const d = date || new Date()
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
      })
      const parts = formatter.formatToParts(d)
      const tzPart = parts.find((p) => p.type === 'timeZoneName')
      return tzPart?.value || ''
    } catch {
      return ''
    }
  }

  return {
    getAllTimezones,
    getGroupedTimezones,
    getSelectMenuItems,
    getDefaultTimezoneForCountry,
    getBrowserTimezone,
    formatTimezoneWithOffset,
    getTimezoneAbbreviation,
    getTimezoneOffset,
  }
}
