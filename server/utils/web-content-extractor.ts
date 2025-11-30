/**
 * Utilitaire pour extraire le contenu pertinent d'une page web
 * Extrait les métadonnées, données structurées, et informations utiles
 */

/**
 * Métadonnées Open Graph extraites
 */
export interface OpenGraphData {
  title?: string
  description?: string
  image?: string
  url?: string
  siteName?: string
  type?: string
  [key: string]: string | undefined
}

/**
 * Données structurées JSON-LD de type Event
 */
export interface JsonLdEventData {
  name?: string
  description?: string
  startDate?: string
  endDate?: string
  location?: {
    name?: string
    address?:
      | string
      | {
          streetAddress?: string
          addressLocality?: string
          postalCode?: string
          addressCountry?: string
        }
  }
  image?: string | string[]
  url?: string
  organizer?: { name?: string; url?: string }
  offers?: { url?: string; price?: string; priceCurrency?: string }
}

/**
 * Informations extraites du contenu de la page
 */
export interface ExtractedContactInfo {
  emails: string[]
  phones: string[]
  instagramUrls: string[]
  facebookUrls: string[]
  ticketingUrls: string[]
  websiteUrls: string[]
}

/**
 * Élément de navigation avec hiérarchie
 * url est optionnel car certains éléments sont juste des titres de sous-menus
 */
export interface NavLink {
  text: string
  url?: string
  children?: NavLink[]
}

/**
 * Résultat complet de l'extraction
 */
export interface WebContentExtraction {
  url: string
  title: string
  metaDescription: string
  openGraph: OpenGraphData
  jsonLdEvents: JsonLdEventData[]
  contactInfo: ExtractedContactInfo
  navigation: NavLink[]
  textContent: string
  links: string[]
}

/**
 * Domaines de billetterie connus
 */
const TICKETING_DOMAINS = [
  'trybooking.com',
  'eventbrite.',
  'weezevent.',
  'billetweb.',
  'helloasso.com',
  'ticketmaster.',
  'fnacspectacles.',
  'digitick.',
  'yurplan.',
  'shotgun.live',
]

/**
 * Extrait le titre de la page
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return titleMatch ? titleMatch[1].trim() : ''
}

/**
 * Extrait la meta description
 */
function extractMetaDescription(html: string): string {
  // Format 1: name="description" content="..."
  const match1 = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  )
  if (match1) return match1[1].trim()

  // Format 2: content="..." name="description"
  const match2 = html.match(
    /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i
  )
  if (match2) return match2[1].trim()

  return ''
}

/**
 * Extrait les métadonnées Open Graph
 */
function extractOpenGraph(html: string): OpenGraphData {
  const ogData: OpenGraphData = {}

  // Trouver toutes les balises meta
  const metaTags = html.matchAll(/<meta\s+([^>]+)>/gi)
  for (const metaMatch of metaTags) {
    const attributes = metaMatch[1]

    // Vérifier si c'est une balise OG
    const propertyMatch = attributes.match(/property=["'](og:[^"']+)["']/i)
    if (propertyMatch) {
      const property = propertyMatch[1]
      const contentMatch = attributes.match(/content=["']([^"']*)["']/i)
      if (contentMatch) {
        const key = property.replace('og:', '')
        ogData[key] = contentMatch[1]
      }
    }
  }

  return ogData
}

/**
 * Extrait les données JSON-LD de type Event
 */
function extractJsonLdEvents(html: string): JsonLdEventData[] {
  const events: JsonLdEventData[] = []

  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )

  for (const match of jsonLdMatches) {
    try {
      const parsed = JSON.parse(match[1])

      // Gérer le cas d'un Event direct
      if (parsed['@type'] === 'Event') {
        events.push(parseJsonLdEvent(parsed))
      }

      // Gérer le cas d'un @graph contenant des Events
      if (Array.isArray(parsed['@graph'])) {
        for (const item of parsed['@graph']) {
          if (item['@type'] === 'Event') {
            events.push(parseJsonLdEvent(item))
          }
        }
      }
    } catch {
      // Ignorer les erreurs de parsing JSON
    }
  }

  return events
}

/**
 * Parse un objet JSON-LD Event
 */
function parseJsonLdEvent(item: Record<string, unknown>): JsonLdEventData {
  return {
    name: item.name as string | undefined,
    description: item.description as string | undefined,
    startDate: item.startDate as string | undefined,
    endDate: item.endDate as string | undefined,
    location: item.location as JsonLdEventData['location'],
    image: item.image as string | string[] | undefined,
    url: item.url as string | undefined,
    organizer: item.organizer as JsonLdEventData['organizer'],
    offers: item.offers as JsonLdEventData['offers'],
  }
}

/**
 * Extrait les emails d'un texte
 */
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailRegex) || []

  // Filtrer les emails invalides ou génériques
  return [...new Set(matches)].filter((email) => {
    const lower = email.toLowerCase()
    // Exclure les emails de tracking/système
    return (
      !lower.includes('sentry') &&
      !lower.includes('webpack') &&
      !lower.includes('example.com') &&
      !lower.includes('localhost')
    )
  })
}

/**
 * Extrait les numéros de téléphone d'un texte
 */
function extractPhones(text: string): string[] {
  // Patterns pour téléphones français et internationaux
  const phoneRegex =
    /(?:\+33|0033|0)[1-9](?:[\s.-]?\d{2}){4}|\+\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g
  const matches = text.match(phoneRegex) || []
  return [...new Set(matches)]
}

/**
 * Extrait les URLs Instagram
 */
function extractInstagramUrls(html: string): string[] {
  const instagramRegex = /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/gi
  const matches = html.match(instagramRegex) || []
  return [...new Set(matches)].slice(0, 5) // Limiter à 5
}

/**
 * Extrait les URLs Facebook (hors événements)
 */
function extractFacebookUrls(html: string): string[] {
  const facebookRegex = /https?:\/\/(?:www\.)?facebook\.com\/(?!events)[a-zA-Z0-9_.]+\/?/gi
  const matches = html.match(facebookRegex) || []
  return [...new Set(matches)].slice(0, 5)
}

/**
 * Extrait les URLs de billetterie
 */
function extractTicketingUrls(html: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/gi
  const allUrls = html.match(urlRegex) || []

  const ticketingUrls = allUrls.filter((url) =>
    TICKETING_DOMAINS.some((domain) => url.toLowerCase().includes(domain))
  )

  return [...new Set(ticketingUrls)].slice(0, 3)
}

/**
 * Extrait la navigation du site avec sa hiérarchie
 */
function extractNavigation(html: string, baseUrl: string): NavLink[] {
  const navigation: NavLink[] = []

  let parsedBase: URL
  try {
    parsedBase = new URL(baseUrl)
  } catch {
    return navigation
  }

  // Trouver toutes les balises <nav>
  const navMatches = html.matchAll(/<nav[^>]*>([\s\S]*?)<\/nav>/gi)

  for (const navMatch of navMatches) {
    const navContent = navMatch[1]
    const navLinks = parseNavLinks(navContent, parsedBase)
    navigation.push(...navLinks)
  }

  // Dédupliquer par URL (garder les éléments sans URL - titres de sous-menus)
  const seen = new Set<string>()
  return navigation.filter((link) => {
    // Les éléments sans URL (titres de sous-menus) sont toujours gardés
    if (!link.url) return true
    if (seen.has(link.url)) return false
    seen.add(link.url)
    return true
  })
}

/**
 * Parse récursivement les liens d'une navigation
 * Gère les sous-menus dans <ul>, <div class="subnav">, etc.
 */
function parseNavLinks(html: string, baseUrl: URL, depth: number = 0): NavLink[] {
  if (depth > 3) return [] // Limiter la profondeur

  const links: NavLink[] = []

  // Trouver le premier <ul> et extraire son contenu avec gestion des imbrications
  const ulContent = extractTagContent(html, 'ul')
  const contentToParse = ulContent || html

  // Parser les <li> un par un en gérant la profondeur
  const liItems = extractTopLevelLiItems(contentToParse)

  for (const liContent of liItems) {
    // Chercher le premier lien <a>
    const linkMatch = liContent.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)

    let text = ''
    let url: string | undefined

    if (linkMatch) {
      const href = linkMatch[1]
      text = linkMatch[2].replace(/<[^>]+>/g, '').trim()

      // Ignorer les liens "#" ou "javascript:" - ce sont des titres de sous-menus
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        try {
          url = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
        } catch {
          // URL invalide
        }
      }
    }

    // Chercher aussi dans <label> (utilisé pour les menus mobiles)
    if (!text) {
      const labelMatch = liContent.match(/<label[^>]*>([\s\S]*?)<\/label>/i)
      if (labelMatch) {
        text = labelMatch[1].replace(/<[^>]+>/g, '').trim()
      }
    }

    // Si pas de texte trouvé dans le lien, chercher dans <span>
    if (!text) {
      const spanMatch = liContent.match(/<span[^>]*>([\s\S]*?)<\/span>/i)
      if (spanMatch) {
        text = spanMatch[1].replace(/<[^>]+>/g, '').trim()
      }
    }

    // Si toujours pas de texte, chercher le texte du lien même s'il pointe vers #
    if (!text && linkMatch) {
      text = linkMatch[2].replace(/<[^>]+>/g, '').trim()
    }

    if (!text) continue

    const navLink: NavLink = { text }
    if (url) {
      navLink.url = url
    }

    // Chercher un sous-menu (dans <div class="subnav">, ou <ul> direct)
    const subnavContent = extractTagContentWithClass(liContent, 'div', 'subnav')
    const subUlContent = extractTagContent(liContent, 'ul')

    const subMenuContent = subnavContent || subUlContent

    if (subMenuContent) {
      const children = parseNavLinks(subMenuContent, baseUrl, depth + 1)
      if (children.length > 0) {
        navLink.children = children
      }
    }

    links.push(navLink)
  }

  // Si pas de <li> trouvés, chercher directement les <a>
  if (links.length === 0) {
    const directLinks = html.matchAll(/<a[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    for (const linkMatch of directLinks) {
      const href = linkMatch[1]
      if (href.startsWith('javascript:')) continue

      const text = linkMatch[2].replace(/<[^>]+>/g, '').trim()

      if (text && href) {
        try {
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
          links.push({ text, url: fullUrl })
        } catch {
          // Ignorer les URLs invalides
        }
      }
    }
  }

  return links
}

/**
 * Extrait le contenu d'une balise en gérant les imbrications
 */
function extractTagContent(html: string, tagName: string): string | null {
  const openTagRegex = new RegExp(`<${tagName}[^>]*>`, 'i')
  const openMatch = html.match(openTagRegex)
  if (!openMatch) return null

  const startIndex = openMatch.index! + openMatch[0].length
  let depth = 1
  let i = startIndex

  while (i < html.length && depth > 0) {
    const remaining = html.substring(i)
    const openNext = remaining.match(new RegExp(`^<${tagName}[^>]*>`, 'i'))
    const closeNext = remaining.match(new RegExp(`^</${tagName}>`, 'i'))

    if (openNext) {
      depth++
      i += openNext[0].length
    } else if (closeNext) {
      depth--
      if (depth === 0) {
        return html.substring(startIndex, i)
      }
      i += closeNext[0].length
    } else {
      i++
    }
  }

  return null
}

/**
 * Extrait le contenu d'une balise avec une classe spécifique
 */
function extractTagContentWithClass(
  html: string,
  tagName: string,
  className: string
): string | null {
  const openTagRegex = new RegExp(
    `<${tagName}[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>`,
    'i'
  )
  const openMatch = html.match(openTagRegex)
  if (!openMatch) return null

  const startIndex = openMatch.index! + openMatch[0].length
  let depth = 1
  let i = startIndex

  while (i < html.length && depth > 0) {
    const remaining = html.substring(i)
    const openNext = remaining.match(new RegExp(`^<${tagName}[^>]*>`, 'i'))
    const closeNext = remaining.match(new RegExp(`^</${tagName}>`, 'i'))

    if (openNext) {
      depth++
      i += openNext[0].length
    } else if (closeNext) {
      depth--
      if (depth === 0) {
        return html.substring(startIndex, i)
      }
      i += closeNext[0].length
    } else {
      i++
    }
  }

  return null
}

/**
 * Extrait les éléments <li> de premier niveau (sans les <li> imbriqués dans des sous-menus)
 */
function extractTopLevelLiItems(html: string): string[] {
  const items: string[] = []
  let depth = 0
  let currentItem = ''
  let inLi = false
  let i = 0

  while (i < html.length) {
    // Chercher les balises
    if (html.substring(i, i + 3).toLowerCase() === '<li') {
      if (depth === 0) {
        inLi = true
        currentItem = ''
      }
      depth++
      // Avancer jusqu'à la fin de la balise ouvrante
      while (i < html.length && html[i] !== '>') {
        currentItem += html[i]
        i++
      }
      if (i < html.length) {
        currentItem += html[i]
        i++
      }
    } else if (html.substring(i, i + 4).toLowerCase() === '</li') {
      depth--
      // Avancer jusqu'à la fin de la balise fermante
      while (i < html.length && html[i] !== '>') {
        currentItem += html[i]
        i++
      }
      if (i < html.length) {
        currentItem += html[i]
        i++
      }
      if (depth === 0 && inLi) {
        items.push(currentItem)
        currentItem = ''
        inLi = false
      }
    } else {
      if (inLi) {
        currentItem += html[i]
      }
      i++
    }
  }

  return items
}

/**
 * Extrait les liens internes utiles (tarifs, infos, contact, etc.)
 */
function extractUsefulLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  const linkMatches = html.matchAll(/<a[^>]*href=["']([^"'#]+)["'][^>]*>([^<]*)</gi)

  let parsedBase: URL
  try {
    parsedBase = new URL(baseUrl)
  } catch {
    return links
  }

  const usefulKeywords = [
    'info',
    'pratique',
    'tarif',
    'prix',
    'programme',
    'lieu',
    'accès',
    'acces',
    'contact',
    'inscription',
    'bénévole',
    'benevole',
    'billetterie',
    'ticket',
    'hébergement',
    'hebergement',
    'camping',
    'restauration',
    'repas',
  ]

  for (const match of linkMatches) {
    try {
      const linkText = match[2].toLowerCase()
      const href = match[1]

      // Vérifier si le texte du lien contient des mots-clés utiles
      if (usefulKeywords.some((keyword) => linkText.includes(keyword))) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, parsedBase).toString()
        if (!links.includes(fullUrl) && links.length < 10) {
          links.push(fullUrl)
        }
      }
    } catch {
      // Ignorer les URLs invalides
    }
  }

  return links
}

/**
 * Extrait le contenu textuel nettoyé d'une page HTML
 */
function extractTextContent(html: string, maxLength: number = 3000): string {
  // Supprimer les éléments non pertinents
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<figure\b[^<]*(?:(?!<\/figure>)<[^<]*)*<\/figure>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Convertir les balises de bloc en sauts de ligne pour préserver la structure
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<\/section>/gi, '\n')
    .replace(/<\/article>/gi, '\n')

  // Supprimer toutes les balises HTML restantes
  text = text.replace(/<[^>]+>/g, ' ')

  // Décoder les entités HTML
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&euro;/g, '€')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')

  // Nettoyer les espaces multiples sur chaque ligne (mais garder les sauts de ligne)
  text = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    // Réduire les sauts de ligne multiples (max 2)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Limiter la longueur
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...'
  }

  return text
}

/**
 * Extrait toutes les informations utiles d'une page HTML
 *
 * @param html - Le HTML brut de la page
 * @param url - L'URL source
 * @param maxTextLength - Limite de caractères pour le contenu textuel
 * @returns Les informations extraites
 */
export function extractWebContent(
  html: string,
  url: string,
  maxTextLength: number = 3000
): WebContentExtraction {
  const textContent = extractTextContent(html, maxTextLength)

  return {
    url,
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    openGraph: extractOpenGraph(html),
    jsonLdEvents: extractJsonLdEvents(html),
    contactInfo: {
      emails: extractEmails(html + textContent),
      phones: extractPhones(textContent),
      instagramUrls: extractInstagramUrls(html),
      facebookUrls: extractFacebookUrls(html),
      ticketingUrls: extractTicketingUrls(html),
      websiteUrls: [], // Sera rempli par les liens utiles
    },
    navigation: extractNavigation(html, url),
    textContent,
    links: extractUsefulLinks(html, url),
  }
}

/**
 * Formate les données extraites en texte pour l'IA
 *
 * @param extraction - Les données extraites
 * @param maxContentLength - Limite totale de caractères
 * @returns Le texte formaté pour l'IA
 */
export function formatExtractionForAI(
  extraction: WebContentExtraction,
  maxContentLength: number = 2500
): string {
  let text = `=== PAGE: ${extraction.url} ===\n`
  text += `Titre: ${extraction.title}\n`

  if (extraction.metaDescription) {
    text += `Description: ${extraction.metaDescription}\n`
  }

  // Informations de contact trouvées
  const { contactInfo } = extraction
  if (contactInfo.emails.length > 0) {
    text += `\nEmails trouvés: ${contactInfo.emails.join(', ')}\n`
  }
  if (contactInfo.phones.length > 0) {
    text += `Téléphones trouvés: ${contactInfo.phones.join(', ')}\n`
  }
  if (contactInfo.instagramUrls.length > 0) {
    text += `Instagram: ${contactInfo.instagramUrls[0]}\n`
  }
  if (contactInfo.ticketingUrls.length > 0) {
    text += `Billetterie: ${contactInfo.ticketingUrls[0]}\n`
  }

  // Données Open Graph
  const og = extraction.openGraph
  if (Object.keys(og).length > 0) {
    text += '\n=== Métadonnées Open Graph ===\n'
    if (og.title) text += `og:title: ${og.title}\n`
    if (og.description) text += `og:description: ${og.description}\n`
    if (og.image) text += `og:image: ${og.image}\n`
    if (og.siteName) text += `og:site_name: ${og.siteName}\n`
  }

  // Données JSON-LD Event (très précieuses)
  if (extraction.jsonLdEvents.length > 0) {
    text += '\n=== Données structurées Event (JSON-LD) ===\n'
    for (const event of extraction.jsonLdEvents) {
      if (event.name) text += `Nom: ${event.name}\n`
      if (event.startDate) text += `Date début: ${event.startDate}\n`
      if (event.endDate) text += `Date fin: ${event.endDate}\n`
      if (event.location) {
        if (typeof event.location === 'object') {
          if (event.location.name) text += `Lieu: ${event.location.name}\n`
          if (typeof event.location.address === 'string') {
            text += `Adresse: ${event.location.address}\n`
          } else if (event.location.address) {
            const addr = event.location.address
            const parts = [
              addr.streetAddress,
              addr.postalCode,
              addr.addressLocality,
              addr.addressCountry,
            ].filter(Boolean)
            if (parts.length > 0) text += `Adresse: ${parts.join(', ')}\n`
          }
        }
      }
      if (event.offers?.url) text += `Billetterie: ${event.offers.url}\n`
      if (event.image) {
        const img = Array.isArray(event.image) ? event.image[0] : event.image
        text += `Image: ${img}\n`
      }
    }
  }

  // Navigation du site (en JSON pour l'IA)
  if (extraction.navigation.length > 0) {
    text += '\n=== Navigation du site ===\n'
    text += JSON.stringify(extraction.navigation, null, 2) + '\n'
  }

  // Liens utiles
  if (extraction.links.length > 0) {
    text += `\nLiens utiles à explorer:\n`
    for (const link of extraction.links.slice(0, 5)) {
      text += `  - ${link}\n`
    }
  }

  // Contenu textuel (ce qui reste du budget)
  const remainingBudget = maxContentLength - text.length - 50
  if (remainingBudget > 200 && extraction.textContent) {
    const truncatedText = extraction.textContent.substring(0, remainingBudget)
    text += `\n=== Contenu textuel ===\n${truncatedText}`
    if (extraction.textContent.length > remainingBudget) {
      text += '...'
    }
  }

  return text
}

/**
 * Extrait et formate le contenu d'une page en une seule étape
 */
export function extractAndFormatWebContent(
  html: string,
  url: string,
  maxContentLength: number = 2500
): string {
  const extraction = extractWebContent(html, url)
  return formatExtractionForAI(extraction, maxContentLength)
}
