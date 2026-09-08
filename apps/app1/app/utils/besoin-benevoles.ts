/**
 * Combien de bénévoles manquent pour tenir l'édition.
 *
 * La question se pose au moment de décider s'il faut recruter, et elle n'a de réponse qu'une fois
 * posée la contribution attendue de chacun : dire « il reste 120 heures à pourvoir » ne se traduit
 * en effectif que si l'on sait ce qu'un bénévole doit faire.
 */
import { personnesDuCreneau, type TimeSlotWithAssignments } from './volunteer-stats'

/** Le dimensionnement de l'édition, pour une contribution attendue donnée. */
export interface BesoinEnBenevoles {
  /** Effectif nécessaire, arrondi au bénévole supérieur : on ne recrute pas une fraction. */
  besoin: number
  /** Bénévoles manquants. Zéro si l'effectif suffit. */
  manque: number
  /** Bénévoles au-delà du nécessaire. Zéro s'il en manque. */
  surplus: number
}

/**
 * Les heures déjà tenues par les organisateurs.
 *
 * Elles se retranchent de ce qu'il y a à pourvoir, parce qu'un organisateur couvre un poste sans
 * appartenir à l'effectif qu'on dimensionne : il n'a pas de nombre d'heures à faire.
 */
export function heuresDesOrganisateurs(timeSlots: TimeSlotWithAssignments[]): number {
  let heures = 0

  for (const slot of timeSlots) {
    const organisateurs = personnesDuCreneau(slot).filter((personne) => personne.estOrganisateur)
    if (organisateurs.length === 0) continue

    const duree = (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / (1000 * 60 * 60)
    heures += duree * organisateurs.length
  }

  return heures
}

/**
 * L'effectif nécessaire, et l'écart avec les bénévoles déjà acceptés.
 *
 * Seules les heures des organisateurs se retranchent des heures à pourvoir. Celles déjà faites
 * par les bénévoles restent dans le calcul : les retirer compterait deux fois un bénévole déjà
 * affecté à une partie de ses heures — une fois dans l'effectif accepté, une fois dans le reste
 * à couvrir.
 *
 * Rend `null` tant que la contribution attendue n'est pas un nombre d'heures exploitable : sans
 * elle, la question n'a pas de réponse, et afficher un zéro laisserait croire le contraire.
 */
export function calculerBesoinEnBenevoles(params: {
  heuresAPourvoir: number
  heuresDesOrganisateurs: number
  heuresParBenevole: number
  benevolesAcceptes: number
}): BesoinEnBenevoles | null {
  const { heuresAPourvoir, heuresParBenevole, benevolesAcceptes } = params

  if (!Number.isFinite(heuresParBenevole) || heuresParBenevole <= 0) return null

  // Un planning tenu en totalité par les organisateurs ne demande aucun bénévole ; sans ce
  // plancher, l'excédent d'heures organisateur creuserait un besoin négatif.
  const aCouvrirParLesBenevoles = Math.max(0, heuresAPourvoir - params.heuresDesOrganisateurs)
  const besoin = Math.ceil(aCouvrirParLesBenevoles / heuresParBenevole)
  const ecart = besoin - benevolesAcceptes

  return {
    besoin,
    manque: Math.max(0, ecart),
    surplus: Math.max(0, -ecart),
  }
}
