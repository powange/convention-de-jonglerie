/**
 * Les horaires RÉELS d'un créneau, une fois son retard appliqué.
 *
 * Un créneau peut être décalé après coup — le montage a pris du retard, une équipe finit plus
 * tard. Le décalage vit dans `delayMinutes` ; les heures enregistrées, elles, ne bougent pas.
 * C'est donc à l'affichage de faire l'addition, et chaque écran qui l'oublie annonce une heure
 * qui n'a plus cours.
 *
 * Ce module dit la règle une fois. Elle était jusqu'ici recopiée dans le calendrier et dans la
 * carte « mes créneaux », et absente des quatre autres surfaces — ce qui se voyait à l'écran :
 * selon l'endroit où on regardait, le même créneau n'avait pas la même heure.
 *
 * Ne dépend ni du réseau ni de la base : se teste sur des chaînes.
 */

export interface HorairesEffectifs {
  /** Début réel, retard compris. */
  debut: Date
  /** Fin réelle, retard compris. */
  fin: Date
  /** Début tel qu'il était prévu — ce qu'on barre pour montrer le déplacement. */
  debutPrevu: Date
  finPrevue: Date
  /** Vrai si le créneau est effectivement déplacé. */
  decale: boolean
  /**
   * Le décalage appliqué, en minutes, SIGNÉ : positif pour un retard, négatif pour une avance.
   *
   * Les deux sens comptent, et ce n'était pas le cas avant. Le champ de saisie annonce pourtant
   * « positif pour un retard, négatif pour une avance », le serveur accepte les deux
   * (`z.number().int()`, sans borne) et la modale en montre l'aperçu — mais le calendrier et la
   * carte « mes créneaux » testaient `> 0`. Une avance était donc enregistrée, prévisualisée,
   * puis ignorée partout.
   */
  decalageMinutes: number
}

/**
 * @returns `null` quand l'une des bornes est illisible — l'appelant retombe alors sur son propre
 *   rendu vide, plutôt que d'afficher une date inventée.
 */
export function horairesEffectifs(
  debut: string | Date | null | undefined,
  fin: string | Date | null | undefined,
  retardMinutes?: number | null
): HorairesEffectifs | null {
  if (!debut || !fin) return null

  const debutPrevu = new Date(debut)
  const finPrevue = new Date(fin)
  if (Number.isNaN(debutPrevu.getTime()) || Number.isNaN(finPrevue.getTime())) return null

  const minutes =
    typeof retardMinutes === 'number' && Number.isFinite(retardMinutes) ? retardMinutes : 0
  const decalage = minutes * 60_000

  return {
    debut: new Date(debutPrevu.getTime() + decalage),
    fin: new Date(finPrevue.getTime() + decalage),
    debutPrevu,
    finPrevue,
    decale: minutes !== 0,
    decalageMinutes: minutes,
  }
}

/**
 * Le décalage, prêt à traduire : « +30 min », « -1h 15min »…
 *
 * Rend une clé et ses valeurs plutôt qu'une chaîne, comme `dureeTraduisible` : cet utilitaire ne
 * connaît pas l'i18n, et c'est ce qui le rend testable sans monter de composant.
 *
 * La mise en forme vivait uniquement dans la modale de retard, qui est le seul écran à ne PAS en
 * avoir besoin pour afficher un créneau — les cinq autres n'avaient rien.
 *
 * @returns `null` quand il n'y a pas de décalage : il n'y a alors rien à annoncer.
 */
export function decalageTraduisible(
  minutes: number | null | undefined
): { cle: string; valeurs: Record<string, number> } | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes === 0) return null

  const retard = minutes > 0
  const absolu = Math.abs(minutes)
  const heures = Math.floor(absolu / 60)
  const reste = absolu % 60

  /**
   * Les six clés sont écrites EN TOUTES LETTRES, et non composées avec le sens.
   *
   * Une clé construite à l'exécution est invisible pour l'outillage i18n : elle passe pour
   * inutilisée, et le jour où quelqu'un lance la suppression automatique, l'écran se met à
   * afficher « volunteers.advance_hours » au lieu d'une heure. Le prix est six lignes.
   */
  if (absolu < 60) {
    return retard
      ? { cle: 'volunteers.delay_minutes', valeurs: { minutes: absolu } }
      : { cle: 'volunteers.advance_minutes', valeurs: { minutes: absolu } }
  }

  if (reste > 0) {
    return retard
      ? { cle: 'volunteers.delay_hours_minutes', valeurs: { hours: heures, minutes: reste } }
      : { cle: 'volunteers.advance_hours_minutes', valeurs: { hours: heures, minutes: reste } }
  }

  return retard
    ? { cle: 'volunteers.delay_hours', valeurs: { hours: heures } }
    : { cle: 'volunteers.advance_hours', valeurs: { hours: heures } }
}
