/**
 * Les formules d'abonnement de Flowvent — la grille écrite UNE fois, lue par l'API (quotas,
 * paiement) comme par les écrans (page tarifs, gestion, profil).
 *
 * Décisions de l'utilisateur (rapport « Tarifs de Flowvent », version 2, 26/11/2026) :
 * - le prix suit la TAILLE de l'organisation, plus les modules : tous les modules sont inclus dans
 *   toutes les formules ;
 * - quatre formules : Découverte (gratuite, celle de tout compte sans abonnement payant),
 *   Association, Festival, Grand festival ; au-delà, sur devis ;
 * - quatre compteurs : les événements EN COURS (non archivés) du propriétaire, et par événement les
 *   bénévoles acceptés, les artistes et les co-organisateurs ;
 * - à la limite : alerte à 80 %, tolérance de 10 % au-delà, puis les AJOUTS sont refusés. Rien de
 *   ce qui existe n'est jamais retiré.
 *
 * ⚠️ Ce fichier se suffit à lui-même (aucun import de valeur) : un test d'app1 le transpile et
 * l'exécute tel quel (cf. apps/app1/test/unit/utils/flowvent-formules.test.ts).
 */

export type CleFormule = 'decouverte' | 'association' | 'festival' | 'grand'
/** Les formules que l'on SOUSCRIT (payantes) : celles du paiement et des codes promo. */
export type CleFormulePayante = Exclude<CleFormule, 'decouverte'>
export type Periode = 'monthly' | 'annual'

export const FORMULE_GRATUITE = 'decouverte' as const
export const CLES_FORMULES = ['association', 'festival', 'grand'] as const
export const PERIODES = ['monthly', 'annual'] as const

/** Ce que l'on compte. */
export type Compteur = 'evenements' | 'benevoles' | 'artistes' | 'organisateurs'
export const COMPTEURS: readonly {
  cle: Compteur
  libelle: string
  /** Libellé d'un plafond : « 75 bénévoles par événement ». */
  unite: (n: number) => string
  parEvenement: boolean
}[] = [
  {
    cle: 'evenements',
    libelle: 'Événements en cours',
    unite: (n) => `${n} événement${n > 1 ? 's' : ''} en cours`,
    parEvenement: false,
  },
  {
    cle: 'benevoles',
    libelle: 'Bénévoles acceptés',
    unite: (n) => `${n} bénévole${n > 1 ? 's' : ''} par événement`,
    parEvenement: true,
  },
  {
    cle: 'artistes',
    libelle: 'Artistes',
    unite: (n) => `${n} artiste${n > 1 ? 's' : ''} par événement`,
    parEvenement: true,
  },
  {
    cle: 'organisateurs',
    libelle: 'Co-organisateurs',
    unite: (n) => `${n} co-organisateur${n > 1 ? 's' : ''} par événement`,
    parEvenement: true,
  },
]

/** `null` : illimité. */
export type Plafonds = Record<Compteur, number | null>

export interface DefinitionFormule {
  cle: CleFormule
  libelle: string
  /** Prix TTC en centimes, par période facturée (un mois, ou un an). 0 : gratuite. */
  prix: Record<Periode, number>
  plafonds: Plafonds
  accroche: string
}

export const FORMULES: readonly DefinitionFormule[] = [
  {
    cle: 'decouverte',
    libelle: 'Découverte',
    prix: { monthly: 0, annual: 0 },
    plafonds: { evenements: 1, benevoles: 15, artistes: 5, organisateurs: 1 },
    accroche: 'Pour essayer Flowvent sur un petit événement, sans carte bancaire.',
  },
  {
    cle: 'association',
    libelle: 'Association',
    prix: { monthly: 900, annual: 8400 },
    plafonds: { evenements: 1, benevoles: 75, artistes: 20, organisateurs: 3 },
    accroche: 'Une convention, une rencontre, un premier festival.',
  },
  {
    cle: 'festival',
    libelle: 'Festival',
    prix: { monthly: 1900, annual: 18000 },
    plafonds: { evenements: 5, benevoles: 250, artistes: 60, organisateurs: 10 },
    accroche: 'Un festival qui tourne, ou plusieurs événements dans l’année.',
  },
  {
    cle: 'grand',
    libelle: 'Grand festival',
    prix: { monthly: 3900, annual: 37200 },
    plafonds: { evenements: 15, benevoles: 1000, artistes: 200, organisateurs: null },
    accroche: 'Des centaines de bénévoles et une grosse programmation.',
  },
]

/** Les formules que l'on souscrit, dans l'ordre de la grille. */
export const FORMULES_PAYANTES = FORMULES.filter(
  (f): f is DefinitionFormule & { cle: CleFormulePayante } => estFormulePayante(f.cle)
)

/** Seuil d'alerte, et marge tolérée au-delà du plafond (en part du plafond). */
export const SEUIL_ALERTE = 0.8
export const TOLERANCE = 0.1

export function formule(cle: unknown): DefinitionFormule | null {
  return FORMULES.find((f) => f.cle === cle) ?? null
}

export function estFormulePayante(cle: unknown): cle is CleFormulePayante {
  return typeof cle === 'string' && (CLES_FORMULES as readonly string[]).includes(cle)
}

/**
 * Le plafond réellement appliqué : le plafond, plus la tolérance arrondie à l'inférieur (75 → 82,
 * 250 → 275, 3 → 3). `null` : illimité.
 */
export function plafondTolere(plafond: number | null): number | null {
  return plafond === null ? null : plafond + Math.floor(plafond * TOLERANCE)
}

export type EtatQuota = 'ok' | 'alerte' | 'atteint' | 'tolerance' | 'bloque'

/**
 * Où en est un compteur :
 * - `ok` : sous 80 % ; `alerte` : de 80 % au plafond exclu ; `atteint` : pile au plafond ;
 * - `tolerance` : au-delà du plafond, dans la marge — on peut encore ajouter ;
 * - `bloque` : la marge est épuisée (ou dépassée, après une descente de formule) : plus d'ajout.
 */
export function etatQuota(usage: number, plafond: number | null): EtatQuota {
  if (plafond === null) return 'ok'
  const tolere = plafondTolere(plafond)!
  if (usage >= tolere && tolere > plafond) return 'bloque'
  if (usage >= plafond)
    return tolere > plafond ? (usage === plafond ? 'atteint' : 'tolerance') : 'bloque'
  return usage >= Math.ceil(plafond * SEUIL_ALERTE) ? 'alerte' : 'ok'
}

/** Peut-on ajouter `nombre` éléments à un compteur qui en est à `usage` ? */
export function peutAjouter(usage: number, plafond: number | null, nombre = 1): boolean {
  const tolere = plafondTolere(plafond)
  return tolere === null || usage + nombre <= tolere
}

/** La plus petite formule PAYANTE dont les plafonds couvrent ce besoin ; `null` : sur devis. */
export function formulePourTaille(
  besoin: Partial<Record<Compteur, number>>
): CleFormulePayante | null {
  const f = FORMULES.filter((x) => estFormulePayante(x.cle)).find((x) =>
    (Object.keys(besoin) as Compteur[]).every((c) => {
      const p = x.plafonds[c]
      return p === null || (besoin[c] ?? 0) <= p
    })
  )
  return (f?.cle as CleFormulePayante | undefined) ?? null
}

/** La formule payante au-dessus de `cle` (Découverte → Association…) ; `null` en haut de grille. */
export function formuleSuperieure(cle: CleFormule): CleFormulePayante | null {
  const i = FORMULES.findIndex((f) => f.cle === cle)
  const suivante = FORMULES[i + 1]
  return suivante && estFormulePayante(suivante.cle) ? suivante.cle : null
}

/**
 * La première formule payante au-dessus de `cle` qui relève VRAIMENT le plafond de ce compteur
 * (Découverte et Association ont tous deux 1 événement : pour les événements, c'est Festival).
 * `null` : aucune — formule sur devis.
 */
export function formuleQuiReleve(cle: CleFormule, compteur: Compteur): CleFormulePayante | null {
  const actuel = formule(cle)?.plafonds[compteur]
  if (actuel === null || actuel === undefined) return null
  const i = FORMULES.findIndex((f) => f.cle === cle)
  const f = FORMULES.slice(i + 1).find((x) => {
    const p = x.plafonds[compteur]
    return estFormulePayante(x.cle) && (p === null || p > actuel)
  })
  return (f?.cle as CleFormulePayante | undefined) ?? null
}

/** « 75 », ou « illimités ». */
export function libellePlafond(plafond: number | null): string {
  return plafond === null ? 'illimités' : plafond.toLocaleString('fr-FR')
}

/** Prix ramené au mois, en centimes (l'annuel divisé par 12), pour l'affichage. */
export function prixMensuel(cleFormule: CleFormule, periode: Periode): number {
  const f = formule(cleFormule)
  if (!f) return 0
  return periode === 'annual' ? Math.round(f.prix.annual / 12) : f.prix.monthly
}

/** « 7 € », « 12,50 € » — centimes en euros, à la française. */
export function euros(centimes: number): string {
  const valeur = centimes / 100
  return `${valeur.toLocaleString('fr-FR', {
    minimumFractionDigits: Number.isInteger(valeur) ? 0 : 2,
    maximumFractionDigits: 2,
  })}\u00a0€`
}

/** La fin d'une période facturée qui commence à `debut`. */
export function finDePeriode(debut: Date, periode: Periode): Date {
  const fin = new Date(debut)
  if (periode === 'annual') fin.setFullYear(fin.getFullYear() + 1)
  else fin.setMonth(fin.getMonth() + 1)
  return fin
}
