import countries from 'i18n-iso-countries'

/**
 * Utilitaires serveur pour la gestion des noms de pays avec i18n-iso-countries.
 * Les locales sont initialisées par le plugin server/plugins/countries.ts
 */

// Cache partagé entre toutes les requêtes (module-level singleton)
const variantsCache = new Map<string, string[]>()
const codeCache = new Map<string, string | null>()

// Locales dans lesquelles chercher les noms de pays
const SEARCH_LOCALES = [
  'fr',
  'en',
  'de',
  'es',
  'it',
  'nl',
  'pl',
  'pt',
  'ru',
  'sv',
  'uk',
  'cs',
  'da',
]

// Alias pour les noms de pays courants qui diffèrent des noms officiels ISO
// Permet la rétrocompatibilité avec les données existantes
const COUNTRY_ALIASES: Record<string, string> = {
  // Noms français courts → code ISO
  'États-Unis': 'US',
  'Etats-Unis': 'US',
  "Côte d'Ivoire": 'CI',
  "Cote d'Ivoire": 'CI',
  USA: 'US',
  Czechia: 'CZ',
  'République tchèque': 'CZ',
  // Noms anglais courants
  'United States': 'US',
  'United States of America': 'US',
  'Ivory Coast': 'CI',
  'Czech Republic': 'CZ',
  'South Korea': 'KR',
  'North Korea': 'KP',
  UK: 'GB',
  'United Kingdom': 'GB',
  'Great Britain': 'GB',
}

/**
 * Trouve le code ISO alpha-2 d'un pays à partir de son nom (dans n'importe quelle locale)
 * Utilise un cache pour optimiser les performances.
 *
 * @param countryName - Nom de pays dans n'importe quelle langue supportée
 * @returns Code ISO alpha-2 en majuscules, ou null si non trouvé
 */
function findCountryCode(countryName: string): string | null {
  if (!countryName) return null

  // Vérifier le cache
  if (codeCache.has(countryName)) {
    return codeCache.get(countryName)!
  }

  // Vérifier d'abord les alias (noms courants non-officiels)
  const alias = COUNTRY_ALIASES[countryName]
  if (alias) {
    codeCache.set(countryName, alias)
    return alias
  }

  // Chercher dans toutes les locales avec i18n-iso-countries
  for (const locale of SEARCH_LOCALES) {
    const code = countries.getAlpha2Code(countryName, locale)
    if (code) {
      codeCache.set(countryName, code)
      return code
    }
  }

  // Non trouvé
  codeCache.set(countryName, null)
  return null
}

/**
 * Retourne toutes les variantes connues d'un nom de pays (toutes les locales)
 * Utile pour le filtrage : si on cherche "Suisse", on trouve aussi "Switzerland", "Schweiz", etc.
 *
 * @param countryName - Nom de pays (dans n'importe quelle langue supportée)
 * @returns Tableau de tous les noms équivalents (incluant le nom original)
 */
export function getCountryVariants(countryName: string): string[] {
  if (!countryName) return [countryName]

  // Vérifier le cache
  const cached = variantsCache.get(countryName)
  if (cached) return cached

  const variants = new Set<string>([countryName])

  // Trouver le code ISO
  const isoCode = findCountryCode(countryName)

  if (isoCode) {
    // Ajouter les noms dans toutes les locales supportées
    for (const locale of SEARCH_LOCALES) {
      const name = countries.getName(isoCode, locale)
      if (name) {
        variants.add(name)
      }
    }
  }

  const result = Array.from(variants)
  variantsCache.set(countryName, result)
  return result
}

/**
 * Traduit un nom de pays vers le français
 *
 * @param countryName - Nom de pays (dans n'importe quelle langue supportée)
 * @returns Le nom français du pays, ou le nom original si non reconnu
 */
export function translateToFrench(countryName: string): string {
  if (!countryName) return countryName

  const isoCode = findCountryCode(countryName)
  if (isoCode) {
    const frenchName = countries.getName(isoCode, 'fr')
    if (frenchName) return frenchName
  }

  return countryName
}

/**
 * Traduit un nom de pays vers l'anglais
 *
 * @param countryName - Nom de pays (dans n'importe quelle langue supportée)
 * @returns Le nom anglais du pays, ou le nom original si non reconnu
 */
export function translateToEnglish(countryName: string): string {
  if (!countryName) return countryName

  const isoCode = findCountryCode(countryName)
  if (isoCode) {
    const englishName = countries.getName(isoCode, 'en')
    if (englishName) return englishName
  }

  return countryName
}

// Alias pour compatibilité
export const normalizeCountryName = translateToFrench
