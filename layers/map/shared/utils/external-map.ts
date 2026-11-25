/**
 * Carte externe d'une édition.
 *
 * Un organisateur ayant déjà cartographié son terrain ailleurs colle l'adresse de sa carte
 * plutôt que de tout refaire dans le site.
 *
 * Seul Google My Maps est reconnu pour l'instant, mais le stockage ne le suppose pas : on
 * conserve un couple (fournisseur, référence) et non une URL brute. Ajouter uMap ou un autre
 * service demandera un cas ici, pas une migration — et l'URL collée, qui embarque le numéro de
 * compte et un cadrage de vue, n'a pas à être figée en base.
 */

export const EXTERNAL_MAP_PROVIDERS = ['google'] as const

export type ExternalMapProvider = (typeof EXTERNAL_MAP_PROVIDERS)[number]

export interface ExternalMapRef {
  provider: ExternalMapProvider
  /** Identifiant de la carte chez le fournisseur (le `mid` chez Google). */
  ref: string
}

/** Identifiants Google : lettres, chiffres, tiret et souligné. */
const GOOGLE_MID_PATTERN = /^[A-Za-z0-9_-]+$/

/**
 * Domaines Google acceptés. Le motif énumère les formes d'extension plutôt que d'accepter
 * « des lettres et des points » : un `google\.[a-z.]+$` laisserait passer `google.evil.com`,
 * où « google » n'est qu'un sous-domaine d'un domaine tiers.
 */
const GOOGLE_HOST_PATTERN = /^(www\.)?google\.(com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/i

/**
 * Reconnaît une carte externe à partir de ce que l'organisateur a collé, ou `null` si l'adresse
 * ne correspond à aucun fournisseur pris en charge.
 */
export function parseExternalMapUrl(input: string | null | undefined): ExternalMapRef | null {
  const value = input?.trim()
  if (!value) return null

  // Un identifiant Google collé seul, sans URL autour : cas courant quand on recopie à la main.
  if (!value.includes('/') && !value.includes('?') && GOOGLE_MID_PATTERN.test(value)) {
    return { provider: 'google', ref: value }
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (GOOGLE_HOST_PATTERN.test(url.hostname) && url.pathname.includes('/maps/d/')) {
    const mid = url.searchParams.get('mid')
    if (mid && GOOGLE_MID_PATTERN.test(mid)) return { provider: 'google', ref: mid }
  }

  return null
}

/** URL à placer dans un cadre pour afficher la carte. */
export function externalMapEmbedUrl(map: ExternalMapRef): string | null {
  if (map.provider === 'google') {
    return `https://www.google.com/maps/d/embed?mid=${encodeURIComponent(map.ref)}`
  }
  return null
}

/** URL d'ouverture de la carte dans un onglet, et forme réaffichée à l'organisateur. */
export function externalMapViewerUrl(map: ExternalMapRef): string | null {
  if (map.provider === 'google') {
    return `https://www.google.com/maps/d/viewer?mid=${encodeURIComponent(map.ref)}`
  }
  return null
}

/**
 * URL d'export de la carte, utilisée pour l'import des zones. `forcekml=1` évite l'archive
 * compressée que Google renvoie par défaut.
 */
export function externalMapKmlUrl(map: ExternalMapRef): string | null {
  if (map.provider === 'google') {
    return `https://www.google.com/maps/d/kml?mid=${encodeURIComponent(map.ref)}&forcekml=1`
  }
  return null
}
