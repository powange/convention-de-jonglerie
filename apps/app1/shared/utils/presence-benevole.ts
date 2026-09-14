/**
 * La fenêtre pendant laquelle un bénévole est sur place.
 *
 * Le bénévole déclare sa venue par une date et un moment de la journée — « samedi midi » —, et ces
 * deux champs étaient lus par le module repas, jamais par l'assignation automatique. Elle pouvait
 * donc attribuer un créneau du vendredi matin à quelqu'un qui arrive le samedi : un planning
 * manifestement faux, sur une donnée que le bénévole avait lui-même renseignée.
 *
 * ⚠️ Ce fichier est lu par le SERVEUR (le planificateur) et vit dans `shared/` pour cette raison.
 * Il n'importe que Luxon — une dépendance ordinaire, pas un auto-import Nuxt : les tests unitaires
 * le chargent tel quel, hors Nuxt, et Luxon leur est disponible comme au serveur.
 *
 * Luxon plutôt qu'un calcul d'écart à la main, parce que ces instants sont LOCAUX à l'événement :
 * « samedi matin » veut dire 8 h sur place, pas 8 h UTC. Les changements d'heure ne se rattrapent
 * pas à coups de soustractions.
 */

import { DateTime } from 'luxon'

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
  repli: number,
  /** Le fuseau de l'événement. Absent, on retombe sur UTC — un repli, pas une intention. */
  fuseau: string | null | undefined
): number | null {
  if (!champ) return null

  const [partieDate, moment] = champ.split('_')
  if (!partieDate) return null

  const jour = DateTime.fromISO(partieDate, { zone: fuseau || 'utc' }).startOf('day')
  if (!jour.isValid) return null

  const heure = moment && moment in heures ? heures[moment]! : repli

  // 24 h n'existe pas comme heure du jour : c'est minuit du lendemain. `set` plutôt que `plus`
  // pour que l'heure reste celle qu'on lit sur une horloge, y compris un jour de changement
  // d'heure.
  const instant = heure >= 24 ? jour.plus({ days: 1 }).startOf('day') : jour.set({ hour: heure })

  return instant.toMillis()
}

/**
 * La fenêtre de présence d'un bénévole, d'après ce qu'il a déclaré.
 *
 * Les deux bornes sont indépendantes : un bénévole peut n'avoir renseigné que son arrivée.
 */
export function fenetreDe(
  volunteer: {
    arrivalDateTime?: string | null
    departureDateTime?: string | null
  },
  fuseau?: string | null
): FenetrePresence {
  return {
    // Moment inconnu : on ouvre la journée en grand des deux côtés — minuit à l'arrivée, minuit
    // au départ. Une donnée qu'on ne comprend pas ne doit rien interdire.
    arrivee: instantDe(volunteer.arrivalDateTime, HEURE_ARRIVEE, 0, fuseau),
    depart: instantDe(volunteer.departureDateTime, HEURE_DEPART, 24, fuseau),
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
