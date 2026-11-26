/**
 * Les codes promo de Flowvent — la règle écrite UNE fois, lue par l'API (aperçu public, paiement,
 * administration) comme par les écrans (page tarifs, administration).
 *
 * Décisions de l'utilisateur (rapport « Tarifs de Flowvent », section 7) :
 * - un code accorde un pourcentage de remise, un montant retiré, ou la gratuité ;
 * - il vise une, plusieurs ou toutes les formules, le mensuel, l'annuel ou les deux ;
 * - l'avantage dure le premier paiement, N mois, ou toute la vie de l'abonnement ;
 * - il a une période de validité, un plafond d'utilisations, une seule utilisation par compte, et
 *   peut être réservé à une adresse ;
 * - un seul code par abonnement ; la réduction de l'annuel reste acquise en plus ;
 * - réglages calqués sur les coupons Stripe, pour une reprise directe le jour du paiement réel.
 *
 * ⚠️ Ce fichier se suffit à lui-même (aucun import de valeur) : un test d'app1 le transpile et
 * l'exécute tel quel (cf. apps/app1/test/unit/utils/flowvent-codes-promo.test.ts).
 */

export type Avantage = 'percent' | 'amount' | 'free'
export type Duree = 'once' | 'months' | 'forever'

export const AVANTAGES = ['percent', 'amount', 'free'] as const
export const DUREES = ['once', 'months', 'forever'] as const

/** Ce qu'il faut d'un code pour décider (une ligne `PromoCode`, ou sa forme sérialisée). */
export interface CodePromo {
  code: string
  advantage: string
  /** Pourcentage (1 à 100) pour `percent`, centimes pour `amount`, ignoré pour `free`. */
  value: number
  /** Formules visées ; `null` : toutes. */
  formules: unknown
  /** Périodes visées (`monthly`, `annual`) ; `null` : les deux. */
  periods: unknown
  duration: string
  durationMonths: number | null
  startsAt: Date | string | null
  expiresAt: Date | string | null
  maxRedemptions: number | null
  reservedEmail: string | null
  active: boolean
}

/** Un code s'écrit en majuscules, chiffres, tirets et soulignés. */
export function normaliserCode(saisie: unknown): string {
  return typeof saisie === 'string'
    ? saisie
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 64)
    : ''
}

function liste(valeur: unknown): string[] | null {
  return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === 'string') : null
}

function date(valeur: Date | string | null): Date | null {
  return valeur ? new Date(valeur) : null
}

/** Le code vaut-il pour cette formule et cette période ? */
export function couvre(
  code: Pick<CodePromo, 'formules' | 'periods'>,
  formule: string,
  periode: string
): boolean {
  const formules = liste(code.formules)
  const periodes = liste(code.periods)
  return (
    (!formules || formules.length === 0 || formules.includes(formule)) &&
    (!periodes || periodes.length === 0 || periodes.includes(periode))
  )
}

export interface ContexteUsage {
  formule: string
  periode: string
  maintenant: Date
  /** L'adresse du compte qui l'utilise ; `null` hors connexion. */
  email: string | null
  /** Utilisations déjà comptées pour ce code (tous comptes). */
  utilisations: number
  /** Ce compte l'a-t-il déjà utilisé ? */
  dejaUtiliseParLeCompte: boolean
}

/**
 * Pourquoi ce code ne s'applique pas, ou `null` s'il s'applique. Les messages sont ceux que voit
 * la personne. Un code réservé à une autre adresse se dit « introuvable » : on n'annonce pas qu'il
 * existe pour quelqu'un d'autre.
 */
export function raisonRefus(code: CodePromo, ctx: ContexteUsage): string | null {
  const introuvable = 'Ce code est introuvable ou n’est plus valable'
  if (!code.active) return introuvable
  if (code.reservedEmail) {
    if (!ctx.email || ctx.email.trim().toLowerCase() !== code.reservedEmail.trim().toLowerCase()) {
      return introuvable
    }
  }
  const debut = date(code.startsAt)
  const fin = date(code.expiresAt)
  if (debut && ctx.maintenant < debut) return introuvable
  if (fin && ctx.maintenant > fin) return 'Ce code a expiré'
  if (ctx.dejaUtiliseParLeCompte) return 'Vous avez déjà utilisé ce code'
  if (code.maxRedemptions !== null && ctx.utilisations >= code.maxRedemptions) {
    return "Ce code a atteint son nombre maximal d'utilisations"
  }
  if (!couvre(code, ctx.formule, ctx.periode)) return 'Ce code ne vaut pas pour cette formule'
  return null
}

/** Le prix d'une période facturée une fois le code appliqué, en centimes (jamais négatif). */
export function prixRemise(prixCentimes: number, code: CodePromo): number {
  if (code.advantage === 'free') return 0
  if (code.advantage === 'percent') {
    const pourcentage = Math.min(100, Math.max(0, code.value))
    return Math.max(0, Math.round((prixCentimes * (100 - pourcentage)) / 100))
  }
  if (code.advantage === 'amount') return Math.max(0, prixCentimes - Math.max(0, code.value))
  return prixCentimes
}

function plusMois(depart: Date, mois: number): Date {
  const d = new Date(depart)
  d.setMonth(d.getMonth() + mois)
  return d
}

/**
 * Jusqu'à quand dure l'avantage d'un code appliqué à `debut`, la première période facturée finissant
 * à `finPremierePeriode`. `null` : à vie.
 * - `once` : la première période facturée ;
 * - `months` : N mois, mais jamais moins que la première période (un mois offert sur l'annuel couvre
 *   l'année payée d'avance, comme chez Stripe) ;
 * - `forever` : à vie.
 */
export function finAvantage(code: CodePromo, debut: Date, finPremierePeriode: Date): Date | null {
  if (code.duration === 'forever') return null
  if (code.duration === 'months' && code.durationMonths) {
    const fin = plusMois(debut, code.durationMonths)
    return fin > finPremierePeriode ? fin : finPremierePeriode
  }
  return finPremierePeriode
}

/**
 * La fin de la période d'abonnement ouverte par un paiement avec ce code. Une gratuité de N mois
 * ouvre exactement N mois (aucun paiement à faire entre-temps) ; une gratuité à vie, un siècle. Les
 * autres codes ne changent pas la période facturée. À la fin d'une gratuité, l'abonnement s'arrête
 * et la gestion passe en lecture seule : personne n'est prélevé par surprise.
 */
export function finPeriodeAvecCode(
  code: CodePromo | null,
  debut: Date,
  finPremierePeriode: Date
): Date {
  if (!code || code.advantage !== 'free') return finPremierePeriode
  if (code.duration === 'forever') return plusMois(debut, 1200)
  // « Offert pendant N mois » : exactement N mois, quelle que soit la période choisie.
  if (code.duration === 'months' && code.durationMonths) return plusMois(debut, code.durationMonths)
  return finPremierePeriode
}

/** « −30 % à vie », « −20 € le premier paiement », « Offert pendant 12 mois ». */
export function resumeAvantage(
  code: Pick<CodePromo, 'advantage' | 'value' | 'duration' | 'durationMonths'>
): string {
  const quoi =
    code.advantage === 'free'
      ? 'Offert'
      : code.advantage === 'percent'
        ? `−${code.value} %`
        : `−${(code.value / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}\u00a0€`
  const duree =
    code.duration === 'forever'
      ? 'à vie'
      : code.duration === 'months' && code.durationMonths
        ? `pendant ${code.durationMonths} mois`
        : 'le premier paiement'
  return `${quoi} ${duree}`
}
