/**
 * Une seule façon de dire un créneau, pour toute la page des échanges.
 *
 * Elle en comptait quatre, dont une seule montrait l'équipe : on lisait « Toilettes sèches »
 * sans savoir s'il s'agissait de l'équipe Hygiène ou d'une autre, alors que le sélecteur, lui,
 * affichait bien « Hygiène · Toilettes sèches ». Les API renvoient l'équipe partout ; elle était
 * simplement perdue à l'affichage.
 *
 * La langue vient de l'i18n et n'est plus figée à `fr-FR`, comme elle l'était aux quatre endroits.
 */
export interface CreneauLisible {
  title?: string | null
  startDateTime: string
  endDateTime: string
  team?: { name: string; color?: string | null } | null
}

export function useCreneauLisible() {
  const { t, locale } = useI18n()

  /** « samedi 26/09 · 15:00 – 16:00 », ou sa forme courte « sam. 26/09 15:00–16:00 ». */
  const horaire = (creneau: CreneauLisible, forme: 'long' | 'court' = 'long') => {
    const debut = new Date(creneau.startDateTime)
    const fin = new Date(creneau.endDateTime)
    const jour = debut.toLocaleDateString(locale.value, {
      weekday: forme === 'long' ? 'long' : 'short',
      day: '2-digit',
      month: '2-digit',
    })
    const heure = (d: Date) =>
      d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    return forme === 'long'
      ? `${jour} · ${heure(debut)} – ${heure(fin)}`
      : `${jour} ${heure(debut)}–${heure(fin)}`
  }

  /** « Hygiène · Toilettes sèches » — l'équipe d'abord, c'est elle qui situe le créneau. */
  const intitule = (creneau: CreneauLisible) =>
    [creneau.team?.name, creneau.title || t('volunteers.swap_slot_untitled')]
      .filter(Boolean)
      .join(' · ')

  /** Tout sur une ligne, là où un composant ne peut pas passer (un titre, une infobulle). */
  const resume = (creneau: CreneauLisible) =>
    `${intitule(creneau)} · ${horaire(creneau, 'court')}`

  return { horaire, intitule, resume }
}
