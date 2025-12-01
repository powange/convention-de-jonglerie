/**
 * Scraper pour JugglingEdge.com
 * Extrait les données JSON-LD des événements et utilise Nominatim pour parser les adresses
 */

import type { FacebookImportJson } from './facebook-event-scraper'

// ============================================
// TYPES
// ============================================

/**
 * Structure JSON-LD d'un événement JugglingEdge
 */
export interface JugglingEdgeJsonLd {
  '@type'?: string
  name?: string
  description?: string
  startDate?: string
  endDate?: string
  url?: string
  location?: {
    '@type'?: string
    name?: string
    address?: string
    geo?: {
      '@type'?: string
      latitude?: number
      longitude?: number
    }
  }
}

/**
 * Résultat du scraping JugglingEdge
 */
export interface JugglingEdgeScraperResult {
  name: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  url: string | null
  location: {
    name: string | null
    fullAddress: string | null
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    region: string | null
    country: string | null
    postalCode: string | null
    latitude: number | null
    longitude: number | null
  } | null
}

/**
 * Résultat du géocodage inverse Nominatim
 */
interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address: {
    house_number?: string
    road?: string
    suburb?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    region?: string
    postcode?: string
    country?: string
    country_code?: string
  }
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Vérifie si une URL est un événement JugglingEdge
 */
export function isJugglingEdgeEventUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      (parsed.hostname === 'jugglingedge.com' || parsed.hostname === 'www.jugglingedge.com') &&
      parsed.pathname.includes('event.php')
    )
  } catch {
    return false
  }
}

/**
 * Décode les entités HTML (comme &#039; -> ')
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
}

/**
 * Nettoie la description (enlève les \r\n multiples, trim)
 */
function cleanDescription(desc: string): string {
  return desc
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ============================================
// NOMINATIM - PARSING D'ADRESSE
// ============================================

const NOMINATIM_USER_AGENT = 'Convention-de-Jonglerie-App/1.0'
const NOMINATIM_DELAY = 1000 // 1 seconde entre les requêtes (respect de l'API)

/**
 * Parse une adresse complète via Nominatim (géocodage)
 * Utilise l'adresse textuelle pour obtenir les champs séparés
 * Les coordonnées existantes sont utilisées seulement si Nominatim n'en retourne pas
 */
async function parseAddressWithNominatim(
  fullAddress: string,
  existingLat?: number,
  existingLon?: number
): Promise<{
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  region: string | null
  country: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
}> {
  try {
    // Géocodage avec l'adresse textuelle (location.address du JSON-LD)
    if (!fullAddress || fullAddress.trim().length === 0) {
      console.log("[JUGGLINGEDGE] Pas d'adresse fournie, utilisation des coordonnées existantes")
      return {
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        country: null,
        postalCode: null,
        latitude: existingLat ?? null,
        longitude: existingLon ?? null,
      }
    }

    console.log(`[JUGGLINGEDGE] Geocoding adresse: ${fullAddress}`)
    const encodedAddress = encodeURIComponent(fullAddress)
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodedAddress}`

    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    })

    if (!response.ok) {
      console.warn(`[JUGGLINGEDGE] Nominatim error: ${response.status}`)
      return {
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        country: null,
        postalCode: null,
        latitude: existingLat || null,
        longitude: existingLon || null,
      }
    }

    const data = (await response.json()) as NominatimResult[]

    if (!data || data.length === 0) {
      console.warn('[JUGGLINGEDGE] Nominatim: aucun résultat')
      return {
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        country: null,
        postalCode: null,
        latitude: existingLat || null,
        longitude: existingLon || null,
      }
    }

    return extractAddressFromNominatim(data[0], parseFloat(data[0].lat), parseFloat(data[0].lon))
  } catch (error: any) {
    console.error(`[JUGGLINGEDGE] Erreur Nominatim: ${error.message}`)
    return {
      addressLine1: null,
      addressLine2: null,
      city: null,
      region: null,
      country: null,
      postalCode: null,
      latitude: existingLat || null,
      longitude: existingLon || null,
    }
  }
}

/**
 * Extrait les champs d'adresse depuis un résultat Nominatim
 */
function extractAddressFromNominatim(
  result: NominatimResult,
  lat: number,
  lon: number
): {
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  region: string | null
  country: string | null
  postalCode: string | null
  latitude: number
  longitude: number
} {
  const addr = result.address

  // Construire addressLine1 (numéro + rue)
  let addressLine1: string | null = null
  if (addr.road) {
    addressLine1 = addr.house_number ? `${addr.house_number} ${addr.road}` : addr.road
  }

  // addressLine2 (quartier/suburb si différent de la ville)
  const addressLine2 = addr.suburb || null

  // Ville (plusieurs champs possibles)
  const city = addr.city || addr.town || addr.village || addr.municipality || null

  // Région/État
  const region = addr.state || addr.region || addr.county || null

  // Code postal
  const postalCode = addr.postcode || null

  // Pays
  const country = addr.country || null

  console.log(`[JUGGLINGEDGE] Nominatim parsed: ${city}, ${region}, ${country}`)

  return {
    addressLine1,
    addressLine2,
    city,
    region,
    country,
    postalCode,
    latitude: lat,
    longitude: lon,
  }
}

// ============================================
// SCRAPER PRINCIPAL
// ============================================

/**
 * Scrape un événement JugglingEdge depuis son URL
 * Extrait les JSON-LD et parse l'adresse via Nominatim
 */
export async function scrapeJugglingEdgeEvent(
  url: string
): Promise<JugglingEdgeScraperResult | null> {
  console.log(`[JUGGLINGEDGE] Scraping: ${url}`)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      console.error(`[JUGGLINGEDGE] HTTP error: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Extraire les JSON-LD
    const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    const matches = [...html.matchAll(jsonLdRegex)]

    let eventData: JugglingEdgeJsonLd | null = null

    for (const match of matches) {
      try {
        const jsonStr = match[1].trim()
        const parsed = JSON.parse(jsonStr)

        // Chercher un Event dans le JSON-LD
        if (parsed['@type'] === 'Event') {
          eventData = parsed
          break
        }
        // Peut être un tableau
        if (Array.isArray(parsed)) {
          const event = parsed.find((item) => item['@type'] === 'Event')
          if (event) {
            eventData = event
            break
          }
        }
      } catch {
        // Ignorer les JSON malformés
      }
    }

    if (!eventData) {
      console.warn('[JUGGLINGEDGE] Aucun JSON-LD Event trouvé')
      return null
    }

    console.log('[JUGGLINGEDGE] JSON-LD Event trouvé:', eventData.name)

    // Extraire les données de base
    const result: JugglingEdgeScraperResult = {
      name: eventData.name ? decodeHtmlEntities(eventData.name) : null,
      description: eventData.description
        ? cleanDescription(decodeHtmlEntities(eventData.description))
        : null,
      startDate: eventData.startDate || null,
      endDate: eventData.endDate || null,
      url: eventData.url || url,
      location: null,
    }

    // Parser l'adresse si présente
    if (eventData.location) {
      const loc = eventData.location
      const existingLat = loc.geo?.latitude
      const existingLon = loc.geo?.longitude
      const fullAddress = loc.address || ''

      // Attendre un peu pour respecter le rate limit de Nominatim
      await new Promise((resolve) => setTimeout(resolve, NOMINATIM_DELAY))

      // Parser l'adresse via Nominatim
      const parsedAddress = await parseAddressWithNominatim(fullAddress, existingLat, existingLon)

      result.location = {
        name: loc.name || null,
        fullAddress: fullAddress || null,
        ...parsedAddress,
      }
    }

    console.log('[JUGGLINGEDGE] Scraping terminé:', result.name)
    return result
  } catch (error: any) {
    console.error(`[JUGGLINGEDGE] Erreur scraping: ${error.message}`)
    return null
  }
}

// ============================================
// CONVERSION EN JSON D'IMPORT
// ============================================

/**
 * Convertit les données JugglingEdge en JSON d'import pré-rempli
 * Similaire à facebookEventToImportJson
 */
export function jugglingEdgeEventToImportJson(
  jeEvent: JugglingEdgeScraperResult
): FacebookImportJson {
  const json: FacebookImportJson = {
    convention: {
      name: '', // À remplir par l'IA ou l'utilisateur
      email: '', // À remplir par l'IA ou l'utilisateur
      description: '',
    },
    edition: {
      name: jeEvent.name || '',
      description: jeEvent.description || '',
      startDate: jeEvent.startDate || '',
      endDate: jeEvent.endDate || jeEvent.startDate || '', // Si pas de endDate, utiliser startDate
      timezone: '', // À déduire du pays
      addressLine1: jeEvent.location?.addressLine1 || jeEvent.location?.name || '',
      addressLine2: jeEvent.location?.addressLine2 || '',
      city: jeEvent.location?.city || '',
      region: jeEvent.location?.region || '',
      country: jeEvent.location?.country || '',
      postalCode: jeEvent.location?.postalCode || '',
      latitude: jeEvent.location?.latitude ?? null,
      longitude: jeEvent.location?.longitude ?? null,
      imageUrl: '', // JugglingEdge ne fournit pas d'image dans JSON-LD
      ticketingUrl: '', // À extraire du contenu si présent
      facebookUrl: '',
      instagramUrl: '',
      officialWebsiteUrl: '', // À déduire par l'IA depuis la description
    },
  }

  // Déduire le timezone du pays
  if (json.edition.country) {
    json.edition.timezone = guessTimezoneFromCountry(json.edition.country)
  }

  return json
}

/**
 * Déduit le timezone IANA depuis le nom du pays
 */
function guessTimezoneFromCountry(country: string): string {
  const countryLower = country.toLowerCase()

  const timezoneMap: Record<string, string> = {
    france: 'Europe/Paris',
    germany: 'Europe/Berlin',
    deutschland: 'Europe/Berlin',
    allemagne: 'Europe/Berlin',
    'united kingdom': 'Europe/London',
    uk: 'Europe/London',
    england: 'Europe/London',
    angleterre: 'Europe/London',
    belgium: 'Europe/Brussels',
    belgique: 'Europe/Brussels',
    netherlands: 'Europe/Amsterdam',
    'pays-bas': 'Europe/Amsterdam',
    switzerland: 'Europe/Zurich',
    suisse: 'Europe/Zurich',
    italy: 'Europe/Rome',
    italie: 'Europe/Rome',
    spain: 'Europe/Madrid',
    espagne: 'Europe/Madrid',
    portugal: 'Europe/Lisbon',
    austria: 'Europe/Vienna',
    autriche: 'Europe/Vienna',
    australia: 'Australia/Melbourne',
    australie: 'Australia/Melbourne',
    'united states': 'America/New_York',
    usa: 'America/New_York',
    'états-unis': 'America/New_York',
    canada: 'America/Toronto',
    japan: 'Asia/Tokyo',
    japon: 'Asia/Tokyo',
    'czech republic': 'Europe/Prague',
    czechia: 'Europe/Prague',
    'république tchèque': 'Europe/Prague',
    poland: 'Europe/Warsaw',
    pologne: 'Europe/Warsaw',
    sweden: 'Europe/Stockholm',
    suède: 'Europe/Stockholm',
    norway: 'Europe/Oslo',
    norvège: 'Europe/Oslo',
    denmark: 'Europe/Copenhagen',
    danemark: 'Europe/Copenhagen',
    finland: 'Europe/Helsinki',
    finlande: 'Europe/Helsinki',
    ireland: 'Europe/Dublin',
    irlande: 'Europe/Dublin',
    scotland: 'Europe/London',
    écosse: 'Europe/London',
    wales: 'Europe/London',
    'pays de galles': 'Europe/London',
  }

  return timezoneMap[countryLower] || 'Europe/Paris'
}

/**
 * Formate les données JugglingEdge en contenu texte pour l'IA
 * Similaire à formatFacebookDataAsContent
 */
export function formatJugglingEdgeDataAsContent(
  jeEvent: JugglingEdgeScraperResult,
  url: string
): string {
  let content = `=== DONNÉES JUGGLINGEDGE (JSON-LD) ===\n`
  content += `Source: ${url}\n\n`

  if (jeEvent.name) {
    content += `Nom de l'événement: ${jeEvent.name}\n`
  }

  if (jeEvent.startDate) {
    content += `Date de début: ${jeEvent.startDate}\n`
  }
  if (jeEvent.endDate && jeEvent.endDate !== jeEvent.startDate) {
    content += `Date de fin: ${jeEvent.endDate}\n`
  }

  if (jeEvent.location) {
    content += `\n--- LIEU ---\n`
    if (jeEvent.location.name) {
      content += `Nom du lieu: ${jeEvent.location.name}\n`
    }
    if (jeEvent.location.fullAddress) {
      content += `Adresse complète: ${jeEvent.location.fullAddress}\n`
    }
    if (jeEvent.location.addressLine1) {
      content += `Adresse: ${jeEvent.location.addressLine1}\n`
    }
    if (jeEvent.location.city) {
      content += `Ville: ${jeEvent.location.city}\n`
    }
    if (jeEvent.location.region) {
      content += `Région: ${jeEvent.location.region}\n`
    }
    if (jeEvent.location.postalCode) {
      content += `Code postal: ${jeEvent.location.postalCode}\n`
    }
    if (jeEvent.location.country) {
      content += `Pays: ${jeEvent.location.country}\n`
    }
    if (jeEvent.location.latitude && jeEvent.location.longitude) {
      content += `Coordonnées: ${jeEvent.location.latitude}, ${jeEvent.location.longitude}\n`
    }
  }

  if (jeEvent.description) {
    content += `\n--- DESCRIPTION ---\n${jeEvent.description}\n`
  }

  content += `\n=== FIN DONNÉES JUGGLINGEDGE ===\n`

  return content
}
