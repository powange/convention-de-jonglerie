/**
 * Où poser la frise du planning à l'ouverture.
 *
 * La vue commence au premier jour du montage — ou de l'édition faute de montage — et s'étend
 * jusqu'au démontage. Sur une période de dix jours dont les créneaux ne démarrent qu'au sixième,
 * l'organisateur ouvrait la page sur du vide et faisait défiler à la main pour retrouver son
 * planning. Se poser sur le premier créneau évite ce geste, sans rien changer quand il n'y a
 * encore rien à montrer.
 */

/** Un créneau, réduit à ce qui détermine sa position. */
export interface CreneauPositionnable {
  start: string
  /** Retard appliqué au créneau, en minutes : la frise doit viser l'heure réellement affichée. */
  delayMinutes?: number | null
}

/** Le début effectif d'un créneau, retard compris. */
function debutEffectif(creneau: CreneauPositionnable): number {
  const debut = new Date(creneau.start).getTime()
  if (!Number.isFinite(debut)) return Number.NaN
  return debut + (creneau.delayMinutes ?? 0) * 60_000
}

/**
 * La position de défilement initiale, exprimée comme une durée depuis le début de la vue —
 * c'est ce qu'attend `scrollTime` de FullCalendar, qui accepte plus de 24 heures sur une frise
 * couvrant plusieurs jours.
 *
 * Rend `null` quand il n'y a rien à viser : aucun créneau, une date de début inexploitable, ou
 * un premier créneau antérieur au début de la vue. Le calendrier garde alors sa position par
 * défaut, sur le premier jour de la période.
 */
export function positionInitialeDuPlanning(
  debutDeLaVue: string | undefined | null,
  creneaux: CreneauPositionnable[]
): string | null {
  if (!debutDeLaVue) return null

  const origine = new Date(`${debutDeLaVue}T00:00:00`).getTime()
  if (!Number.isFinite(origine)) return null

  const debuts = creneaux.map(debutEffectif).filter((instant) => Number.isFinite(instant))
  if (debuts.length === 0) return null

  const premier = Math.min(...debuts)
  const ecartMs = premier - origine
  // Un créneau qui précède la vue ne se vise pas : `scrollTime` ne recule pas avant l'origine,
  // et un défilement négatif n'a pas de sens.
  if (ecartMs < 0) return null

  const totalMinutes = Math.floor(ecartMs / 60_000)
  const heures = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}
