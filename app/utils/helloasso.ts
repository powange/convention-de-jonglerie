/**
 * Utilitaires pour gérer les URLs HelloAsso côté client
 */

export interface HelloAssoUrlParts {
  organizationSlug: string
  formType: string
  formSlug: string
}

/**
 * Parse une URL HelloAsso pour extraire les informations
 * Format attendu: https://www.helloasso.com/associations/{organizationSlug}/{formType}/{formSlug}
 */
export function parseHelloAssoUrl(url: string): HelloAssoUrlParts | null {
  if (!url) return null

  try {
    const urlObj = new URL(url)

    // Vérifier que c'est bien une URL HelloAsso
    if (!urlObj.hostname.includes('helloasso.com')) {
      return null
    }

    // Extraire les parties du chemin
    const pathParts = urlObj.pathname.split('/').filter(Boolean)

    // Format attendu: associations/{organizationSlug}/{formType}/{formSlug}
    if (pathParts.length < 4 || pathParts[0] !== 'associations') {
      return null
    }

    const organizationSlug = pathParts[1]
    const formTypeRaw = pathParts[2]
    const formSlug = pathParts[3]

    // Mapper les types d'URL français vers les types API anglais
    const formTypeMapping: Record<string, string> = {
      evenements: 'Event',
      billetteries: 'Ticketing',
      adhesions: 'Membership',
      formulaires: 'Form',
      crowdfundings: 'CrowdFunding',
      boutiques: 'Shop',
      dons: 'Donation',
    }

    const formType = formTypeMapping[formTypeRaw.toLowerCase()] || 'Event'

    return {
      organizationSlug,
      formType,
      formSlug,
    }
  } catch (error) {
    console.error("Erreur lors du parsing de l'URL HelloAsso:", error)
    return null
  }
}

/**
 * Construit une URL HelloAsso à partir des composants
 */
export function buildHelloAssoUrl(parts: HelloAssoUrlParts): string {
  // Mapper les types API anglais vers les types d'URL français
  const formTypeMapping: Record<string, string> = {
    Event: 'evenements',
    Ticketing: 'billetteries',
    Membership: 'adhesions',
    Form: 'formulaires',
    CrowdFunding: 'crowdfundings',
    Shop: 'boutiques',
    Donation: 'dons',
  }

  const formTypeUrl = formTypeMapping[parts.formType] || 'evenements'

  return `https://www.helloasso.com/associations/${parts.organizationSlug}/${formTypeUrl}/${parts.formSlug}`
}
