/**
 * Ce qu'il reste à verser à un artiste.
 *
 * ⚠️ TROIS DETTES INDÉPENDANTES, et chacune a son propre drapeau « versé ». Un artiste peut avoir
 * reçu son cachet mais pas son défraiement, et c'est le cas courant : le cachet se règle souvent
 * avant l'événement, les frais de trajet après, sur présentation des billets.
 *
 * 📍 LE RÉEL, JAMAIS LE PLAFOND. Le défraiement et les consommables portent un maximum autorisé et
 * un montant réel. On ne doit que le réel : le plafond est une enveloppe annoncée, pas une somme
 * promise. Additionner les plafonds gonflerait la dette de tout ce qui n'a pas été dépensé.
 *
 * 📍 Les montants sont en UNITÉS COURANTES, comme le reste de cet écran — le point d'API des
 * artistes les convertit déjà avec `fromCents`. Les additionner en centimes donnerait un total
 * cent fois trop grand, et parfaitement plausible à l'œil.
 */

/** Ce qu'il faut d'un artiste pour savoir ce qu'on lui doit. Tout est facultatif. */
export interface ArtisteAPayer {
  payment?: number | string | null
  paymentPaid?: boolean
  reimbursementActual?: number | string | null
  reimbursementActualPaid?: boolean
  consumablesActual?: number | string | null
  consumablesActualPaid?: boolean
}

/** La dette, détaillée — pour que la liste dise de quoi le total est fait. */
export interface DetteDUnArtiste {
  cachet: number
  defraiement: number
  consommables: number
  total: number
}

/**
 * Un montant exploitable, à partir de ce que l'API rend.
 *
 * ⚠️ `Number()` ET NON UNE ADDITION DIRECTE : Prisma rend ses décimaux en CHAÎNES dans le JSON
 * (« 150.00 »), et `'150.00' + '12.50'` concatène au lieu d'additionner. Le reste de cet écran
 * emploie la même précaution.
 *
 * Un montant négatif est ramené à zéro : il ne décrit rien de réel, et le laisser passer le
 * retrancherait des autres dettes.
 */
function montant(valeur: number | string | null | undefined): number {
  const nombre = Number(valeur)
  return Number.isFinite(nombre) && nombre > 0 ? nombre : 0
}

/**
 * Ce qu'on doit encore à cet artiste, dette par dette.
 *
 * Une dette déjà marquée versée vaut zéro, quel que soit son montant : c'est le drapeau qui
 * tranche, pas la présence d'une somme.
 */
export function detteDUnArtiste(artiste: ArtisteAPayer | null | undefined): DetteDUnArtiste {
  const cachet = artiste?.paymentPaid ? 0 : montant(artiste?.payment)
  const defraiement = artiste?.reimbursementActualPaid ? 0 : montant(artiste?.reimbursementActual)
  const consommables = artiste?.consumablesActualPaid ? 0 : montant(artiste?.consumablesActual)

  return { cachet, defraiement, consommables, total: cachet + defraiement + consommables }
}

/** Lui doit-on quelque chose ? */
export function resteAPayer(artiste: ArtisteAPayer | null | undefined): boolean {
  return detteDUnArtiste(artiste).total > 0
}

/** Le total de ce qui reste à verser, sur un ensemble d'artistes. */
export function resteAVerserEnTout(artistes: readonly ArtisteAPayer[]): number {
  return artistes.reduce((total, artiste) => total + detteDUnArtiste(artiste).total, 0)
}

/**
 * Les drapeaux à poser pour solder la dette de cet artiste.
 *
 * ⚠️ SEULS LES DRAPEAUX DES DETTES RÉELLEMENT DUES. Poser `consumablesActualPaid` sur un artiste
 * qui n'a aucun consommable écrirait « remboursé » sur une somme qui n'existe pas : la fiche
 * annoncerait un remboursement jamais fait, et rien ne distinguerait plus les deux cas.
 *
 * Rend un objet VIDE quand il n'y a rien à solder, ce qui permet à l'appelant de ne pas appeler.
 */
export function drapeauxDeSolde(artiste: ArtisteAPayer | null | undefined): {
  paymentPaid?: true
  reimbursementActualPaid?: true
  consumablesActualPaid?: true
} {
  const dette = detteDUnArtiste(artiste)
  const drapeaux: {
    paymentPaid?: true
    reimbursementActualPaid?: true
    consumablesActualPaid?: true
  } = {}

  if (dette.cachet > 0) drapeaux.paymentPaid = true
  if (dette.defraiement > 0) drapeaux.reimbursementActualPaid = true
  if (dette.consommables > 0) drapeaux.consumablesActualPaid = true

  return drapeaux
}
