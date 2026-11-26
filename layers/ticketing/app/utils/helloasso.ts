/**
 * Utilitaires pour gérer les URLs HelloAsso côté client
 */

export interface HelloAssoUrlParts {
  organizationSlug: string
  formType: string
  formSlug: string
}

/** Segment d'URL public HelloAsso → valeur de l'énumération `FormType` de l'API v5. */
const TYPES_DEPUIS_URL: Record<string, string> = {
  evenements: 'Event',
  // Une « billetterie » HelloAsso est un formulaire `Event` : l'API ne connaît pas `Ticketing`.
  billetteries: 'Event',
  adhesions: 'Membership',
  formulaires: 'PaymentForm',
  collectes: 'CrowdFunding',
  crowdfundings: 'CrowdFunding',
  boutiques: 'Shop',
  dons: 'Donation',
}

/** L'inverse, plus les deux types hérités qu'on a enregistrés à tort. */
const URL_DEPUIS_TYPE: Record<string, string> = {
  Event: 'evenements',
  Membership: 'adhesions',
  PaymentForm: 'formulaires',
  CrowdFunding: 'collectes',
  Shop: 'boutiques',
  Donation: 'dons',
  Ticketing: 'evenements',
  Form: 'formulaires',
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

    // Type d'URL (français) → type de l'API v5. Seules les valeurs de son énumération `FormType`
    // sont acceptées par HelloAsso : `Ticketing` et `Form`, produits ici auparavant, n'en sont pas,
    // et un type inconnu se replie plus sur `Event` en silence — l'URL est refusée, ce qui se voit.
    const formType = TYPES_DEPUIS_URL[formTypeRaw.toLowerCase()]
    if (!formType) return null

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
  // Les types hérités (`Ticketing`, `Form`) d'anciennes configurations sont reconstruits vers
  // l'URL qui leur correspond : la relire les convertit en type valide.
  const formTypeUrl = URL_DEPUIS_TYPE[parts.formType] || 'evenements'

  return `https://www.helloasso.com/associations/${parts.organizationSlug}/${formTypeUrl}/${parts.formSlug}`
}

/**
 * Ramène un type enregistré à une valeur que l'API accepte : `Ticketing` et `Form`, proposés à tort
 * par d'anciens écrans, deviennent `Event` et `PaymentForm`. Le serveur fait la même traduction à
 * l'appel ; ici, elle évite qu'une ancienne configuration s'affiche avec un type vide.
 */
export function normaliserTypeHelloAsso(formType: string): string {
  return (
    ({ Ticketing: 'Event', Form: 'PaymentForm' } as Record<string, string>)[formType] ?? formType
  )
}
