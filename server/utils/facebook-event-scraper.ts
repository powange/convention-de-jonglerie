/**
 * Utilitaire pour scraper les événements Facebook et les convertir en JSON d'import
 */
import { scrapeFbEvent } from 'facebook-event-scraper'

/**
 * Type pour les données retournées par facebook-event-scraper
 */
export interface FacebookScraperResult {
  id: string
  name: string
  description: string
  url: string
  startTimestamp: number
  endTimestamp?: number
  formattedDate: string
  timezone: string
  isOnline: boolean // Propriété de l'API Facebook (non utilisée - notre modèle utilise EditionStatus)
  location?: {
    name?: string
    address?: string
    coordinates?: {
      latitude: number
      longitude: number
    }
    countryCode?: string
  }
  photo?: {
    url?: string
    imageUri?: string
  }
  hosts?: Array<{
    id: string
    name: string
    url: string
  }>
  ticketUrl?: string
}

/**
 * Structure du JSON d'import pour une édition
 */
export interface FacebookImportJson {
  convention: {
    name: string
    email: string
    description: string
  }
  edition: {
    name: string
    description: string
    startDate: string
    endDate: string
    timezone: string
    addressLine1: string
    addressLine2: string
    city: string
    region: string
    country: string
    postalCode: string
    latitude: number | null
    longitude: number | null
    ticketingUrl: string
    facebookUrl: string
    instagramUrl: string
    officialWebsiteUrl: string
    imageUrl: string
  }
}

/**
 * Template JSON vide pour l'import
 */
const EMPTY_IMPORT_JSON: FacebookImportJson = {
  convention: { name: '', email: '', description: '' },
  edition: {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    timezone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    country: '',
    postalCode: '',
    latitude: null,
    longitude: null,
    ticketingUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    officialWebsiteUrl: '',
    imageUrl: '',
  },
}

/**
 * Scrape un événement Facebook et retourne les données brutes
 * @param url - URL de l'événement Facebook
 * @returns Les données de l'événement ou null si échec
 */
export async function scrapeFacebookEvent(url: string): Promise<FacebookScraperResult | null> {
  try {
    console.log(`[FB-SCRAPER] Scraping: ${url}`)
    const fbEvent = (await scrapeFbEvent(url)) as FacebookScraperResult

    console.log('[FB-SCRAPER] Données récupérées:')
    console.log(JSON.stringify(fbEvent, null, 2))

    return fbEvent
  } catch (error: any) {
    console.error(`[FB-SCRAPER] Erreur: ${error.message}`)
    return null
  }
}

/**
 * Convertit les données de facebook-event-scraper en JSON d'import
 */
export function facebookEventToImportJson(fbEvent: FacebookScraperResult): FacebookImportJson {
  const json: FacebookImportJson = JSON.parse(JSON.stringify(EMPTY_IMPORT_JSON))

  // Nom de l'édition (pas de la convention, qui peut être différente)
  if (fbEvent.name) {
    json.edition.name = fbEvent.name
  }

  // Description
  if (fbEvent.description) {
    json.edition.description = fbEvent.description.substring(0, 2000)
  }

  // Dates depuis les timestamps (le scraper retourne des timestamps en secondes)
  if (fbEvent.startTimestamp) {
    const startDate = new Date(fbEvent.startTimestamp * 1000)
    json.edition.startDate = startDate.toISOString().replace('.000Z', '')
  }
  if (fbEvent.endTimestamp) {
    const endDate = new Date(fbEvent.endTimestamp * 1000)
    json.edition.endDate = endDate.toISOString().replace('.000Z', '')
  }

  // Timezone (le scraper le fournit directement, ex: "UTC-06" ou "Australia/Melbourne")
  if (fbEvent.timezone) {
    // Le scraper peut retourner un format UTC-XX ou un timezone IANA
    if (fbEvent.timezone.startsWith('UTC')) {
      // Convertir UTC-XX en timezone approximatif (on garde pour info mais on préfère déduire du pays)
      console.log(`[FB-SCRAPER] Timezone Facebook: ${fbEvent.timezone}`)
    } else {
      json.edition.timezone = fbEvent.timezone
    }
  }

  // Lieu et coordonnées
  if (fbEvent.location) {
    if (fbEvent.location.name) {
      json.edition.addressLine1 = fbEvent.location.name
    }
    if (fbEvent.location.address) {
      // Parser l'adresse pour extraire ville, code postal, pays
      const addressParts = parseAddress(fbEvent.location.address)
      if (addressParts.addressLine1 && !json.edition.addressLine1) {
        json.edition.addressLine1 = addressParts.addressLine1
      }
      if (addressParts.city) json.edition.city = addressParts.city
      if (addressParts.region) json.edition.region = addressParts.region
      if (addressParts.postalCode) json.edition.postalCode = addressParts.postalCode
      if (addressParts.country) json.edition.country = addressParts.country
    }
    if (fbEvent.location.coordinates) {
      json.edition.latitude = fbEvent.location.coordinates.latitude
      json.edition.longitude = fbEvent.location.coordinates.longitude
    }
    // Utiliser le countryCode pour déduire le pays si pas trouvé dans l'adresse
    if (!json.edition.country && fbEvent.location.countryCode) {
      json.edition.country = countryCodeToName(fbEvent.location.countryCode)
    }
  }

  // Déduire le timezone du pays si pas déjà défini
  if (!json.edition.timezone && json.edition.country) {
    json.edition.timezone = guessTimezoneFromCountry(json.edition.country)
  }

  // URL Facebook (depuis le scraper)
  if (fbEvent.url) {
    json.edition.facebookUrl = fbEvent.url
  }

  // URL de billetterie (depuis le scraper)
  if (fbEvent.ticketUrl) {
    json.edition.ticketingUrl = fbEvent.ticketUrl
  } else if (fbEvent.description) {
    // Fallback: extraire depuis la description
    const ticketUrl = extractTicketUrlFromText(fbEvent.description)
    if (ticketUrl) {
      json.edition.ticketingUrl = ticketUrl
    }
  }

  // Image
  if (fbEvent.photo?.imageUri) {
    json.edition.imageUrl = fbEvent.photo.imageUri
  } else if (fbEvent.photo?.url) {
    json.edition.imageUrl = fbEvent.photo.url
  }

  return json
}

/**
 * Convertit un code pays ISO en nom de pays
 */
export function countryCodeToName(code: string): string {
  const countryMap: Record<string, string> = {
    FR: 'France',
    DE: 'Germany',
    BE: 'Belgium',
    CH: 'Switzerland',
    IT: 'Italy',
    ES: 'Spain',
    NL: 'Netherlands',
    GB: 'United Kingdom',
    UK: 'United Kingdom',
    AU: 'Australia',
    US: 'United States',
    CA: 'Canada',
    PT: 'Portugal',
    PL: 'Poland',
    AT: 'Austria',
    CZ: 'Czech Republic',
    DK: 'Denmark',
    SE: 'Sweden',
    NO: 'Norway',
    FI: 'Finland',
    IE: 'Ireland',
    NZ: 'New Zealand',
  }
  return countryMap[code.toUpperCase()] || code
}

/**
 * Extrait une URL de billetterie depuis un texte (description)
 */
export function extractTicketUrlFromText(text: string): string | null {
  const ticketingDomains = [
    'trybooking.com',
    'eventbrite.',
    'weezevent.',
    'billetweb.',
    'helloasso.com',
    'ticketmaster.',
    'fnacspectacles.',
    'digitick.',
    'yurplan.',
  ]

  // Chercher toutes les URLs dans le texte
  const urlMatches = text.match(/https?:\/\/[^\s<>"]+/g)
  if (urlMatches) {
    for (const url of urlMatches) {
      if (ticketingDomains.some((domain) => url.toLowerCase().includes(domain))) {
        return url
      }
    }
  }
  return null
}

/**
 * Parse une adresse pour extraire ses composants
 */
export function parseAddress(address: string): {
  addressLine1?: string
  city?: string
  region?: string
  postalCode?: string
  country?: string
} {
  const result: {
    addressLine1?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
  } = {}

  // Pattern pour adresse australienne: "30 Bornong Rd, Cooriemungle VIC 3268, Australia"
  const ausMatch = address.match(/^(.+?),\s*(\w+)\s+([A-Z]{2,3})\s+(\d{4}),\s*(.+)$/)
  if (ausMatch) {
    result.addressLine1 = ausMatch[1]
    result.city = ausMatch[2]
    result.region = ausMatch[3]
    result.postalCode = ausMatch[4]
    result.country = ausMatch[5]
    return result
  }

  // Pattern pour adresse européenne: "123 Rue Example, 75001 Paris, France"
  const euMatch = address.match(/^(.+?),\s*(\d{4,5})\s+(.+?),\s*(.+)$/)
  if (euMatch) {
    result.addressLine1 = euMatch[1]
    result.postalCode = euMatch[2]
    result.city = euMatch[3]
    result.country = euMatch[4]
    return result
  }

  // Pattern simple: "Ville, Pays"
  const simpleMatch = address.match(/^(.+?),\s*(.+)$/)
  if (simpleMatch) {
    result.city = simpleMatch[1]
    result.country = simpleMatch[2]
  }

  return result
}

/**
 * Devine le timezone IANA à partir du pays
 */
export function guessTimezoneFromCountry(country: string): string {
  const countryLower = country.toLowerCase()
  const timezoneMap: Record<string, string> = {
    france: 'Europe/Paris',
    allemagne: 'Europe/Berlin',
    germany: 'Europe/Berlin',
    belgique: 'Europe/Brussels',
    belgium: 'Europe/Brussels',
    suisse: 'Europe/Zurich',
    switzerland: 'Europe/Zurich',
    italie: 'Europe/Rome',
    italy: 'Europe/Rome',
    espagne: 'Europe/Madrid',
    spain: 'Europe/Madrid',
    'pays-bas': 'Europe/Amsterdam',
    netherlands: 'Europe/Amsterdam',
    'royaume-uni': 'Europe/London',
    uk: 'Europe/London',
    'united kingdom': 'Europe/London',
    angleterre: 'Europe/London',
    england: 'Europe/London',
    australie: 'Australia/Melbourne',
    australia: 'Australia/Melbourne',
    'états-unis': 'America/New_York',
    usa: 'America/New_York',
    'united states': 'America/New_York',
    canada: 'America/Toronto',
    portugal: 'Europe/Lisbon',
    pologne: 'Europe/Warsaw',
    poland: 'Europe/Warsaw',
    autriche: 'Europe/Vienna',
    austria: 'Europe/Vienna',
    'czech republic': 'Europe/Prague',
    denmark: 'Europe/Copenhagen',
    sweden: 'Europe/Stockholm',
    norway: 'Europe/Oslo',
    finland: 'Europe/Helsinki',
    ireland: 'Europe/Dublin',
    'new zealand': 'Pacific/Auckland',
  }

  return timezoneMap[countryLower] || 'Europe/Paris'
}
