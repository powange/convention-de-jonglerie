/**
 * Règles de l'échange de créneaux entre bénévoles.
 *
 * Isolées des accès à la base : ce qui se décide ici — quels créneaux sont proposables, lesquels
 * créeraient un chevauchement, quand une demande n'a plus d'objet — se teste sans base de données,
 * et c'est là que se logeraient les erreurs coûteuses.
 */

export interface Creneau {
  id: string
  startDateTime: Date | string
  endDateTime: Date | string
}

export interface AffectationCandidate {
  /** Identifiant de l'affectation, pas du créneau. */
  id: string
  userId: number
  timeSlot: Creneau & { teamId?: string | null }
}

const instant = (valeur: Date | string) => new Date(valeur).getTime()

/**
 * Deux créneaux se chevauchent-ils ?
 *
 * Bornes exclusives : un créneau qui finit à 14 h et un autre qui commence à 14 h s'enchaînent,
 * ils ne se chevauchent pas. Les traiter comme un conflit interdirait les relèves, qui sont la
 * norme sur un planning de convention.
 */
export function seChevauchent(a: Creneau, b: Creneau): boolean {
  return (
    instant(a.startDateTime) < instant(b.endDateTime) &&
    instant(b.startDateTime) < instant(a.endDateTime)
  )
}

/**
 * Les affectations qu'un bénévole peut convoiter, parmi celles des autres.
 *
 * Deux exclusions, et une seule raison derrière : ne pas proposer l'impossible.
 *
 * — Ses propres affectations : on n'échange pas avec soi-même.
 * — Tout créneau qui chevaucherait l'un de ceux qu'il GARDE, c'est-à-dire tous les siens sauf
 *   celui qu'il offre. Le créneau offert, lui, se libère par l'échange : le chevaucher est non
 *   seulement permis, c'est le cas le plus courant — on échange souvent un créneau contre un
 *   autre du même moment.
 */
export function creneauxProposables(
  demandeurId: number,
  affectationOfferteId: string,
  toutes: AffectationCandidate[]
): AffectationCandidate[] {
  const siennes = toutes.filter((a) => a.userId === demandeurId)
  const gardees = siennes.filter((a) => a.id !== affectationOfferteId)

  return toutes.filter((candidate) => {
    if (candidate.userId === demandeurId) return false
    return !gardees.some((gardee) => seChevauchent(gardee.timeSlot, candidate.timeSlot))
  })
}

/**
 * Le bénévole visé peut-il, lui, accepter ? Le chevauchement se juge dans les deux sens.
 *
 * Vérifié au moment de répondre et non à l'affichage : entre la proposition et la réponse, la
 * cible a pu recevoir une autre affectation.
 */
export function echangePossiblePourLaCible(
  cibleId: number,
  affectationCedeeId: string,
  creneauRecu: Creneau,
  affectationsDeLaCible: AffectationCandidate[]
): boolean {
  return !affectationsDeLaCible
    .filter((a) => a.userId === cibleId && a.id !== affectationCedeeId)
    .some((gardee) => seChevauchent(gardee.timeSlot, creneauRecu))
}

/**
 * Une demande n'a plus d'objet dès que l'un des deux créneaux est passé.
 *
 * Délai choisi par l'utilisateur plutôt qu'une durée fixe : un échange ne sert plus à rien une
 * fois le service commencé, et aucune valeur arbitraire n'aurait été juste pour toutes les
 * conventions.
 */
export function demandeExpiree(a: Creneau, b: Creneau, maintenant: number = Date.now()): boolean {
  return instant(a.endDateTime) <= maintenant || instant(b.endDateTime) <= maintenant
}

/** Un bénévole tel que l'écran de validation le montre. */
export interface MembreEffectif {
  id: number
  pseudo: string
  /** Mention libre « personnes à éviter », si la candidature la renseigne. */
  avoidList?: string | null
  /** Marqué pour que la différence se lise sans comparer deux listes. */
  arrivant?: boolean
}

/**
 * L'effectif d'un créneau APRÈS l'échange.
 *
 * C'est la situation qu'on valide, pas celle qu'on quitte : deux noms et deux horaires ne disent
 * pas ce que l'échange produit sur le terrain, et c'est précisément ce qu'un tiers est là pour
 * juger.
 *
 * L'entrant n'est ajouté que s'il n'y figure pas déjà — cas possible sur un créneau à plusieurs
 * places, où quelqu'un peut tenir à la fois celui qu'il cède et celui qu'il reçoit. L'échange y
 * est refusé par ailleurs, mais l'affichage ne doit pas montrer deux fois la même personne.
 */
export function effectifApresEchange(
  presents: MembreEffectif[],
  sortantId: number,
  entrant: MembreEffectif | null
): MembreEffectif[] {
  const restants = presents.filter((m) => m.id !== sortantId)
  if (!entrant || restants.some((m) => m.id === entrant.id)) return restants
  return [...restants, { ...entrant, arrivant: true }]
}
