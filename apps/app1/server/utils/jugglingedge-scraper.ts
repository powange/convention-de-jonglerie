/**
 * Scraper pour JugglingEdge.com
 * Extrait les données JSON-LD des événements et utilise Nominatim pour parser les adresses
 */

import type { FacebookImportJson } from './facebook-event-scraper'
import type { CandidatExterne, SourceEvenements } from './sources-evenements'

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
  // Liens externes trouvés sur la page (pour exploration par l'agent)
  externalLinks: {
    officialWebsite: string | null
    facebookEvent: string | null
    facebookPage: string | null
  }
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
 * Les entités nommées que ce site emploie réellement, en minuscules.
 *
 * ⚠️ MESURÉ sur `events.php` le 1er novembre 2026 : le JSON-LD des lignes rend
 * `Th&uuml;ringer H&uuml;tte`, `Schlierseestra&szlig;e`, `Rh&ouml;n`. L'ancien décodeur ne traitait
 * que cinq entités nommées et les numériques : tous les accents allemands, nordiques et portugais
 * de l'agenda restaient donc écrits `&uuml;` dans les adresses — sur un agenda qui couvre douze
 * pays, ce n'est pas un cas marginal.
 *
 * Les majuscules ne sont PAS listées : elles se déduisent de la casse de l'entité (`&Uuml;` → `Ü`),
 * ce qui évite de tenir deux tables qui pourraient diverger.
 */
const ENTITES_NOMMEES: Record<string, string> = {
  agrave: 'à',
  aacute: 'á',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  aring: 'å',
  aelig: 'æ',
  ccedil: 'ç',
  egrave: 'è',
  eacute: 'é',
  ecirc: 'ê',
  euml: 'ë',
  igrave: 'ì',
  iacute: 'í',
  icirc: 'î',
  iuml: 'ï',
  ntilde: 'ñ',
  ograve: 'ò',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  oslash: 'ø',
  ugrave: 'ù',
  uacute: 'ú',
  ucirc: 'û',
  uuml: 'ü',
  yacute: 'ý',
  yuml: 'ÿ',
  eth: 'ð',
  thorn: 'þ',
  szlig: 'ß',
  // Mesurées sur l'agenda du 1er novembre 2026 : `&lrm;` 45 fois, `&Scaron;` 2, `&ndash;` 1,
  // `&rsquo;` 1. Les trois dernières sont typographiques et reviendront ailleurs ; `&lrm;` est une
  // marque de sens d'écriture, retirée après décodage là où elle polluerait un libellé.
  lrm: '\u200e',
  rlm: '\u200f',
  scaron: 'š',
  ndash: '–',
  mdash: '—',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  hellip: '…',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
}

/**
 * Décode les entités HTML : numériques (`&#039;`, `&#x27;`) et nommées (`&uuml;`, `&amp;`).
 *
 * 📍 UNE SEULE PASSE, là où l'ancienne version enchaînait des `replace`. L'enchaînement décodait
 * `&amp;` d'abord, si bien qu'un texte doublement encodé — `&amp;uuml;`, qui veut dire le TEXTE
 * `&uuml;` — devenait `&uuml;` puis `ü` : on inventait un accent que la source n'avait pas écrit.
 * Une passe unique ne peut pas se relire elle-même.
 *
 * Une entité inconnue est laissée TELLE QUELLE plutôt que remplacée par un caractère de
 * remplacement : mieux vaut un `&hellip;` visible, qui se corrige, qu'un `?` qui se confond avec
 * une vraie donnée.
 */
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (tout, corps: string) => {
    if (corps.startsWith('#')) {
      const hexa = corps[1] === 'x' || corps[1] === 'X'
      const code = parseInt(hexa ? corps.slice(2) : corps.slice(1), hexa ? 16 : 10)
      return Number.isNaN(code) ? tout : String.fromCodePoint(code)
    }
    const caractere = ENTITES_NOMMEES[corps.toLowerCase()]
    if (!caractere) return tout
    // `&Uuml;` → `Ü`. Les entités sans majuscule (`&amp;`) ne sont pas concernées.
    return /^[A-Z]/.test(corps) ? caractere.toUpperCase() : caractere
  })
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
    const premierResultat = data?.[0]

    if (!premierResultat) {
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

    return extractAddressFromNominatim(
      premierResultat,
      parseFloat(premierResultat.lat),
      parseFloat(premierResultat.lon)
    )
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
// EXTRACTION DES LIENS EXTERNES
// ============================================

/**
 * Extrait les liens externes d'une page JugglingEdge
 * (site officiel, événement Facebook)
 */
function extractExternalLinks(html: string): {
  officialWebsite: string | null
  facebookEvent: string | null
  facebookPage: string | null
} {
  const result = {
    officialWebsite: null as string | null,
    facebookEvent: null as string | null,
    facebookPage: null as string | null,
  }

  // Extraire tous les liens href
  const hrefRegex = /href="([^"]+)"/gi
  const matches = [...html.matchAll(hrefRegex)]

  for (const match of matches) {
    const href = match[1]
    // Le HTML vient du dehors : un `href` vide n'a rien à faire dans la suite du traitement.
    if (!href) continue

    // Ignorer les liens JugglingEdge, Google Maps, et les ancres
    if (
      href.startsWith('#') ||
      href.includes('jugglingedge.com') ||
      href.includes('maps.google.com') ||
      href.includes('google.com/maps')
    ) {
      continue
    }

    // Détecter les événements Facebook
    if (href.includes('facebook.com/events/') && !result.facebookEvent) {
      result.facebookEvent = href.replace(/&amp;/g, '&')
    }
    // Détecter les pages Facebook (pas un événement)
    else if (href.includes('facebook.com/') && !href.includes('/events/') && !result.facebookPage) {
      result.facebookPage = href.replace(/&amp;/g, '&')
    }

    // Détecter les sites officiels (URLs externes qui ne sont pas des réseaux sociaux)
    if (
      href.startsWith('http') &&
      !href.includes('facebook.com') &&
      !href.includes('twitter.com') &&
      !href.includes('instagram.com') &&
      !href.includes('youtube.com') &&
      !result.officialWebsite
    ) {
      result.officialWebsite = href.replace(/&amp;/g, '&')
    }
  }

  return result
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
        const jsonStr = (match[1] ?? '').trim()
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

    // Extraire les liens externes (site officiel, Facebook)
    const externalLinks = extractExternalLinks(html)
    if (externalLinks.officialWebsite) {
      console.log(`[JUGGLINGEDGE] Site officiel trouvé: ${externalLinks.officialWebsite}`)
    }
    if (externalLinks.facebookEvent) {
      console.log(`[JUGGLINGEDGE] Facebook Event trouvé: ${externalLinks.facebookEvent}`)
    }
    if (externalLinks.facebookPage) {
      console.log(`[JUGGLINGEDGE] Page Facebook trouvée: ${externalLinks.facebookPage}`)
    }

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
      externalLinks,
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
      facebookUrl: jeEvent.externalLinks.facebookEvent || '',
      instagramUrl: '',
      officialWebsiteUrl: jeEvent.externalLinks.officialWebsite || '',
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

  // Ajouter les liens externes pour l'exploration
  const hasLinks =
    jeEvent.externalLinks.officialWebsite ||
    jeEvent.externalLinks.facebookEvent ||
    jeEvent.externalLinks.facebookPage
  if (hasLinks) {
    content += `\n--- LIENS À EXPLORER (FETCH_URL recommandé) ---\n`
    if (jeEvent.externalLinks.officialWebsite) {
      content += `Site officiel: ${jeEvent.externalLinks.officialWebsite}\n`
    }
    if (jeEvent.externalLinks.facebookEvent) {
      content += `Événement Facebook: ${jeEvent.externalLinks.facebookEvent}\n`
    }
    if (jeEvent.externalLinks.facebookPage) {
      content += `Page Facebook: ${jeEvent.externalLinks.facebookPage}\n`
    }
    content += `(Ces liens peuvent contenir des infos supplémentaires: email, tarifs, camping, restauration, etc.)\n`
  }

  content += `\n=== FIN DONNÉES JUGGLINGEDGE ===\n`

  return content
}

// ============================================
// LA LISTE DES ÉVÉNEMENTS (agenda)
// ============================================

/** L'agenda lu par défaut. Le sous-domaine `fr.` rend les noms de pays en français. */
const JUGGLINGEDGE_URL_LISTE = 'https://fr.jugglingedge.com/events.php'

/**
 * Analyse la page d'agenda et rend ses candidats.
 *
 * Séparée de la récupération réseau à dessein : c'est l'analyse qui casse quand le site change de
 * gabarit, et on veut pouvoir l'éprouver sur un HTML figé plutôt que sur le réseau — un test qui
 * dépend d'un site tiers échoue les jours où ce site est lent, et passe les jours où il a changé
 * sans qu'on l'ait vu.
 *
 * ## Ce que la page donne, mesuré le 1er novembre 2026 sur 45 lignes
 *
 * Chaque ligne est un `<tr id="EventRow…">` qui porte **son propre JSON-LD** — nom, date de début,
 * adresse, et surtout l'URL **canonique** de l'événement. Les deux colonnes que le JSON-LD n'a pas
 * sont dans le tableau : la durée en jours, et le pays.
 *
 * 📍 L'URL vient du JSON-LD, JAMAIS de l'attribut `href` de la ligne. Les liens de la page sont
 * relatifs (`/event.php?EventID=6542`) : résolus sur `fr.jugglingedge.com`, ils désigneraient le
 * même événement sous un autre hôte que `jugglingedge.com`. Or le refus d'un administrateur
 * s'attache à l'URL — deux URL pour un événement feraient réapparaître ce qu'on a écarté, et
 * `isJugglingEdgeEventUrl` ne reconnaît d'ailleurs pas le sous-domaine `fr.`.
 *
 * ⚠️ Une ligne sans URL canonique est ÉCARTÉE plutôt que rafistolée : sans clé, elle ne peut être
 * ni dédoublonnée, ni refusée durablement. Le compte des écartées est journalisé, pour qu'un
 * changement de gabarit se voie au lieu de vider la liste en silence.
 */
export function analyserListeJugglingEdge(html: string): CandidatExterne[] {
  const candidats: CandidatExterne[] = []
  let ecartees = 0

  for (const ligne of html.matchAll(/<tr id="EventRow(\d+)">([\s\S]*?)<\/tr>/g)) {
    const identifiant = ligne[1] ?? null
    const corps = ligne[2] ?? ''

    const bloc = corps.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    let ld: Record<string, unknown> | null = null
    if (bloc?.[1]) {
      try {
        ld = JSON.parse(bloc[1])
      } catch {
        ld = null
      }
    }

    const url = typeof ld?.url === 'string' ? ld.url : null
    if (!url) {
      ecartees++
      continue
    }

    const lieu = (ld?.location ?? null) as { name?: unknown; address?: unknown } | null
    const jours = corps.match(/<td class="Number">\s*(\d+)\s*<\/td>/)
    // Le libellé du lien de filtrage par région porte le nom du pays, suivi d'une marque
    // de sens d'écriture (`&lrm;`) qu'on retire.
    const pays = corps.match(/<a href="\/events\.php\?Region=[^"]*">([\s\S]*?)<\/a>/)

    candidats.push({
      url,
      identifiantSource: identifiant,
      titre: decodeHtmlEntities(typeof ld?.name === 'string' ? ld.name : '').trim(),
      debut: typeof ld?.startDate === 'string' ? ld.startDate : null,
      jours: jours?.[1] ? Number.parseInt(jours[1], 10) : null,
      pays: pays?.[1] ? decodeHtmlEntities(pays[1]).replace(/‎|‏/g, '').trim() : null,
      lieu: typeof lieu?.name === 'string' ? decodeHtmlEntities(lieu.name).trim() : null,
      adresse: typeof lieu?.address === 'string' ? decodeHtmlEntities(lieu.address).trim() : null,
    })
  }

  if (ecartees > 0) {
    console.warn(`[JUGGLINGEDGE] ${ecartees} ligne(s) d'agenda sans URL canonique, écartée(s)`)
  }
  return candidats
}

/** Va chercher l'agenda et l'analyse. Rend une liste vide plutôt que d'échouer. */
export async function listerEvenementsJugglingEdge(): Promise<CandidatExterne[]> {
  try {
    const response = await fetch(JUGGLINGEDGE_URL_LISTE, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!response.ok) {
      console.error(`[JUGGLINGEDGE] Agenda, erreur HTTP : ${response.status}`)
      return []
    }
    const candidats = analyserListeJugglingEdge(await response.text())
    console.log(`[JUGGLINGEDGE] Agenda : ${candidats.length} candidat(s)`)
    return candidats
  } catch (erreur) {
    console.error('[JUGGLINGEDGE] Agenda illisible :', erreur)
    return []
  }
}

/** JugglingEdge comme source d'événements. La première ; l'écran n'en suppose aucune en propre. */
export const sourceJugglingEdge: SourceEvenements = {
  cle: 'jugglingedge',
  nom: 'JugglingEdge',
  urlDeLaListe: JUGGLINGEDGE_URL_LISTE,
  lister: listerEvenementsJugglingEdge,
  reconnaitUrl: isJugglingEdgeEventUrl,
}
