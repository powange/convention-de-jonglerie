import { versChampLocal } from '#core/shared/utils/fuseau-edition'

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
  startDateTime: string
  /** Retard appliqué au créneau, en minutes : la frise doit viser l'heure réellement affichée. */
  delayMinutes?: number | null
}

/**
 * Le début effectif d'un créneau, retard compris, en HEURE MURALE du lieu — exprimée comme un
 * instant UTC fictif, pour se soustraire simplement à minuit du premier jour.
 *
 * L'heure murale et non l'instant : le calendrier affiche ses journées à l'heure du lieu. Viser
 * l'instant depuis le minuit du NAVIGATEUR décalait la frise de l'écart entre les deux fuseaux
 * pour qui regardait depuis ailleurs. Sans fuseau, l'heure murale est celle de la machine, comme
 * le calendrier dans ce cas.
 */
function debutEffectif(creneau: CreneauPositionnable, fuseau?: string | null): number {
  const debut = new Date(creneau.startDateTime).getTime()
  if (!Number.isFinite(debut)) return Number.NaN
  const mural = versChampLocal(new Date(debut + (creneau.delayMinutes ?? 0) * 60_000), fuseau)
  return mural ? Date.parse(`${mural}:00Z`) : Number.NaN
}

/**
 * La position de défilement initiale, exprimée comme une durée depuis le début de la vue —
 * au-delà de 24 heures sur une frise couvrant plusieurs jours. Le composant `UiLazyEventCalendar`
 * la pose lui-même (`scrollTime` d'EventCalendar est plafonné à la journée).
 *
 * Rend `null` quand il n'y a rien à viser : aucun créneau, une date de début inexploitable, ou
 * un premier créneau antérieur au début de la vue. Le calendrier garde alors sa position par
 * défaut, sur le premier jour de la période.
 */
export function positionInitialeDuPlanning(
  debutDeLaVue: string | undefined | null,
  creneaux: CreneauPositionnable[],
  fuseau?: string | null
): string | null {
  if (!debutDeLaVue) return null

  /*
   * Le JOUR seulement : l'édition peut arriver sous forme complète (« 2027-07-10T00:00:00.000Z »,
   * c'est le cas sous Flowvent). Y accoler « T00:00:00 » donnait une date invalide, et la frise
   * ne se posait jamais sur le premier créneau.
   */
  const origine = Date.parse(`${String(debutDeLaVue).slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(origine)) return null

  const debuts = creneaux
    .map((creneau) => debutEffectif(creneau, fuseau))
    .filter((instant) => Number.isFinite(instant))
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
