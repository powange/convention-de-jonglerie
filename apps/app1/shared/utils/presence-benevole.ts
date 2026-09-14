/**
 * La fenêtre pendant laquelle un bénévole est sur place.
 *
 * Le bénévole déclare sa venue par une date et un moment de la journée — « samedi midi » —, et ces
 * deux champs étaient lus par le module repas, jamais par l'assignation automatique. Elle pouvait
 * donc attribuer un créneau du vendredi matin à quelqu'un qui arrive le samedi : un planning
 * manifestement faux, sur une donnée que le bénévole avait lui-même renseignée.
 *
 * ⚠️ Ce fichier est lu par le SERVEUR (le planificateur) et vit dans `shared/` pour cette raison.
 * Il ne doit rien importer : il est aussi chargé tel quel par les tests unitaires, hors Nuxt.
 */

/**
 * Les moments de la journée que propose le formulaire, traduits en heures.
 *
 * Ces heures sont une convention, pas une donnée : le bénévole a dit « j'arrive samedi matin », pas
 * « j'arrive à 8 h 03 ». Elles sont choisies larges du côté de l'arrivée et du départ — mieux vaut
 * laisser le planificateur proposer un créneau que le bénévole refusera, que lui refuser d'office
 * une matinée qu'il aurait pu tenir.
 *
 * Le repli, pour un moment inconnu ou absent, ouvre la journée en grand : c'est la même prudence
 * que celle du module repas, qui rend tous les repas quand il ne sait pas.
 */
const HEURE_ARRIVEE: Record<string, number> = {
  morning: 8,
  noon: 12,
  afternoon: 14,
  evening: 18,
}

const HEURE_DEPART: Record<string, number> = {
  morning: 12,
  noon: 14,
  afternoon: 18,
  evening: 24,
}

/** Une fenêtre de présence, en millisecondes. `null` à une borne signifie « sans limite ». */
export interface FenetrePresence {
  arrivee: number | null
  depart: number | null
}

/**
 * Lit un champ `YYYY-MM-DD_moment` et rend l'instant correspondant.
 *
 * Rend `null` dès que la date est illisible : une donnée qu'on ne comprend pas ne doit pas fonder
 * un refus. Le moment est facultatif — le champ peut ne porter que la date.
 */
function instantDe(
  champ: string | null | undefined,
  heures: Record<string, number>,
  /** L'heure retenue quand le moment est absent ou inconnu : le bord le plus large de la journée. */
  repli: number
): number | null {
  if (!champ) return null

  const [partieDate, moment] = champ.split('_')
  if (!partieDate) return null

  const base = new Date(`${partieDate}T00:00:00.000Z`).getTime()
  if (Number.isNaN(base)) return null

  const heure = moment && moment in heures ? heures[moment]! : repli

  return base + heure * 3_600_000
}

/**
 * La fenêtre de présence d'un bénévole, d'après ce qu'il a déclaré.
 *
 * Les deux bornes sont indépendantes : un bénévole peut n'avoir renseigné que son arrivée.
 */
export function fenetreDe(volunteer: {
  arrivalDateTime?: string | null
  departureDateTime?: string | null
}): FenetrePresence {
  return {
    // Moment inconnu : on ouvre la journée en grand des deux côtés — minuit à l'arrivée, minuit
    // au départ. Une donnée qu'on ne comprend pas ne doit rien interdire.
    arrivee: instantDe(volunteer.arrivalDateTime, HEURE_ARRIVEE, 0),
    depart: instantDe(volunteer.departureDateTime, HEURE_DEPART, 24),
  }
}

/**
 * Le bénévole est-il là pendant tout ce créneau ?
 *
 * La question porte sur le créneau ENTIER, pas sur son début : quelqu'un qui repart samedi midi ne
 * peut pas tenir un créneau de 10 h à 14 h, même s'il est là quand il commence.
 *
 * Une fenêtre sans borne ne s'oppose à rien : le bénévole qui n'a rien déclaré reste disponible
 * partout, comme avant.
 */
export function estPresentPendant(
  fenetre: FenetrePresence,
  creneau: { debut: number; fin: number }
): boolean {
  if (Number.isNaN(creneau.debut) || Number.isNaN(creneau.fin)) return true
  if (fenetre.arrivee !== null && creneau.debut < fenetre.arrivee) return false
  if (fenetre.depart !== null && creneau.fin > fenetre.depart) return false
  return true
}
