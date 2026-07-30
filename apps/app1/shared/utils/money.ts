/**
 * Montants monétaires.
 *
 * Les montants sont stockés en **centimes entiers**. Les additionner en nombres à virgule
 * flottante ferait apparaître des écarts d'arrondi qui ne se voient qu'au total — le genre de
 * défaut qu'on ne repère qu'en recomptant à la main.
 *
 * La frontière euros/centimes se situe à l'API : les formulaires manipulent des unités
 * courantes (150,50), la base et les totaux des centimes (15050). Toute conversion passe par
 * ici, jamais par un `* 100` disséminé dans le code.
 */

/** Devises proposées. Codes ISO 4217, contrairement au « 1 / 2 » interne à l'API Infomaniak. */
export const SUPPORTED_CURRENCIES = [
  'EUR',
  'CHF',
  'GBP',
  'SEK',
  'DKK',
  'NOK',
  'PLN',
  'CZK',
] as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY: SupportedCurrency = 'EUR'

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
}

/**
 * Unité courante → centimes.
 *
 * Deux imprécisions à neutraliser, dans cet ordre :
 *
 * - `150.55 * 100` vaut `15054.999999999998` : une troncature donnerait 150,54 €, d'où
 *   l'arrondi ;
 * - `1.005` est stocké en binaire comme `1.00499…`, si bien que `Math.round(1.005 * 100)` rend
 *   100 au lieu de 101. Le résultat dépendrait alors de la représentation plutôt que du montant
 *   saisi. Repasser par `toFixed` absorbe cette dérive avant l'arrondi.
 */
export function toCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null
  if (!Number.isFinite(amount)) return null
  return Math.round(Number((amount * 100).toFixed(4)))
}

/** Centimes → unité courante, pour l'affichage et les formulaires. */
export function fromCents(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null
  if (!Number.isFinite(cents)) return null
  return cents / 100
}

/**
 * Met en forme un montant en centimes selon la devise et la langue.
 *
 * Passe par `Intl` plutôt que par une concaténation : la place du symbole, le séparateur
 * décimal et l'espace insécable diffèrent d'une langue à l'autre.
 */
export function formatCents(
  cents: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  locale = 'fr-FR'
): string {
  const amount = fromCents(cents) ?? 0
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY,
  }).format(amount)
}

/** Somme de montants en centimes, en ignorant les valeurs absentes. */
export function sumCents(values: (number | null | undefined)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}
