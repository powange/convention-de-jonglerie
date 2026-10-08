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

/**
 * Le seul symbole d'une devise, pour l'accoler à un champ de saisie.
 *
 * ⚠️ IL N'EXISTE PAS D'API QUI RENDE UN SYMBOLE SEUL. On formate donc zéro dans la devise visée et
 * on retire tout ce qui n'est pas le symbole : chiffres, espaces — y compris l'espace insécable et
 * l'espace fine insécable, que `\s` ne couvre pas en JavaScript —, points et virgules.
 *
 * 📍 La locale compte : le même euro s'écrit « 0,00 € » en français et « €0.00 » en anglais, et
 * certaines devises changent carrément de symbole selon la langue.
 *
 * 📍 Pour AFFICHER un montant, utiliser `formatCents` : il place le symbole au bon endroit selon la
 * locale, ce qu'une concaténation à la main ne fait pas.
 */
export function currencySymbol(code: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code })
    .format(0)
    .replace(/[\d\s.,\u00a0\u202f]/g, '')
}

/**
 * Les caractères qui servent à GROUPER les milliers, et qu'on retire avant toute analyse.
 *
 * L'espace insécable (`U+00A0`) et l'espace fine insécable (`U+202F`) sont ce que produit
 * `Intl.NumberFormat` en français — recopier un montant affiché par l'application le ramènerait
 * donc ici. L'apostrophe est le groupement suisse. Aucun de ces caractères ne porte de sens
 * décimal, dans aucune locale.
 */
const CARACTERES_DE_GROUPEMENT = /[\s\u00a0\u202f'\u2019]/g

/**
 * Le montant qu'une personne a VOULU taper, à partir de ce qu'elle a tapé.
 *
 * ## ⚠️ POURQUOI CETTE FONCTION EXISTE : UN FACTEUR CENT, SILENCIEUX
 *
 * Mesuré le 08/10/2026, sur `UInput type="number"` comme sur `UInputNumber` :
 *
 * | tapé       | obtenu   | enregistré      |
 * | ---------- | -------- | --------------- |
 * | `12,50`    | `1250`   | **1 250 €**     |
 * | `1234,56`  | `123456` | **123 456 €**   |
 *
 * Un champ natif `type="number"` **avale** la virgule et déclare pourtant la saisie valide
 * (`checkValidity()` rend `true`). `UInputNumber`, lui, la lit comme un séparateur de MILLIERS
 * quand la locale est l'anglais. Dans les deux cas : cent fois trop, sur un nombre plausible, sans
 * la moindre alerte — et la virgule est le séparateur décimal de tout francophone.
 *
 * Câbler la locale française dans Nuxt UI ne suffit pas : mesuré aussi, cela **retourne** le
 * défaut sur le point (`12.50` devient `1 250`), or c'est l'habitude que les utilisateurs ont
 * prise faute de mieux. Il faut accepter LES DEUX.
 *
 * ## La règle, et ce qu'elle refuse de deviner
 *
 * 1. Les caractères de groupement sont retirés (voir ci-dessus).
 * 2. Si `,` **et** `.` sont présents, **le dernier des deux est le séparateur décimal** et l'autre
 *    est du groupement : `1.234,56` et `1,234.56` donnent tous deux `1234.56`.
 * 3. Si un seul des deux apparaît **plusieurs fois**, il ne peut pas être décimal : c'est du
 *    groupement. `1.234.567` donne `1234567`.
 * 4. Si un seul apparaît **une seule fois**, il est DÉCIMAL — toujours, quel que soit le nombre de
 *    chiffres qui suit.
 *
 * ⚠️ La règle 4 tranche une ambiguïté réelle : `1.000` peut vouloir dire mille. **On choisit
 * délibérément de lire `1,00`**, parce que les deux erreurs ne se valent pas. Lire mille quand on
 * voulait un euro gonfle un compte de résultat en silence ; lire un euro quand on voulait mille
 * saute aux yeux dès que le champ se reformate en quittant la saisie — et c'est pour cela que
 * `UiMoneyInput` reformate.
 *
 * @returns le montant en unité courante, ou `null` si la saisie ne désigne aucun nombre.
 */
export function parseMontantSaisi(saisie: string | number | null | undefined): number | null {
  if (typeof saisie === 'number') return Number.isFinite(saisie) ? saisie : null

  const brut = (saisie ?? '').replace(CARACTERES_DE_GROUPEMENT, '')
  if (brut.length === 0) return null

  const derniereVirgule = brut.lastIndexOf(',')
  const dernierPoint = brut.lastIndexOf('.')

  let normalise: string
  if (derniereVirgule >= 0 && dernierPoint >= 0) {
    // Règle 2 : le dernier des deux décide, l'autre est du groupement.
    const decimal = derniereVirgule > dernierPoint ? ',' : '.'
    const groupement = decimal === ',' ? '.' : ','
    normalise = brut.split(groupement).join('').replace(decimal, '.')
  } else {
    const separateur = derniereVirgule >= 0 ? ',' : dernierPoint >= 0 ? '.' : null
    if (!separateur) {
      normalise = brut
    } else {
      const occurrences = brut.split(separateur).length - 1
      // Règles 3 et 4 : plusieurs occurrences = groupement, une seule = décimal.
      normalise = occurrences > 1 ? brut.split(separateur).join('') : brut.replace(separateur, '.')
    }
  }

  // Tout ce qui n'est pas un nombre signé est refusé : mieux vaut un champ vide qu'un montant
  // inventé à partir d'une saisie qu'on n'a pas comprise.
  if (!/^-?\d*\.?\d*$/.test(normalise) || !/\d/.test(normalise)) return null

  const valeur = Number(normalise)
  return Number.isFinite(valeur) ? valeur : null
}
