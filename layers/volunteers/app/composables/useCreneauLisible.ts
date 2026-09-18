import { decalageTraduisible, horairesEffectifs } from '../utils/retard-creneau'

import { fuseauUtilisable } from '~~/shared/utils/fuseau-edition'

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
  /** Décalage appliqué après coup, en minutes. Signé : positif en retard, négatif en avance. */
  delayMinutes?: number | null
  team?: { name: string; color?: string | null } | null
}

/**
 * @param fuseau Fuseau de l'édition. Un créneau s'annonce à l'heure du LIEU : sans lui, deux
 *   bénévoles en déplacement lisaient deux horaires différents pour le même échange — et le JOUR
 *   lui-même pouvait changer sur un créneau de fin de soirée.
 */
export function useCreneauLisible(fuseau?: MaybeRefOrGetter<string | null | undefined>) {
  const { t, locale } = useI18n()

  /** « samedi 26/09 · 15:00 – 16:00 », ou sa forme courte « sam. 26/09 15:00–16:00 ». */
  const horaire = (creneau: CreneauLisible, forme: 'long' | 'court' = 'long') => {
    // Les heures RÉELLES : un créneau décalé après coup ne se tient pas à l'heure enregistrée.
    // Proposer un échange sur un horaire périmé, c'est faire prendre un engagement sur une heure
    // qui n'existe plus.
    const horaires = horairesEffectifs(
      creneau.startDateTime,
      creneau.endDateTime,
      creneau.delayMinutes
    )
    if (!horaires) return ''

    const zone = fuseauUtilisable(toValue(fuseau))
    const jour = horaires.debut.toLocaleDateString(locale.value, {
      weekday: forme === 'long' ? 'long' : 'short',
      day: '2-digit',
      month: '2-digit',
      timeZone: zone,
    })
    const heure = (d: Date) =>
      d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', timeZone: zone })

    const plage =
      forme === 'long'
        ? `${jour} · ${heure(horaires.debut)} – ${heure(horaires.fin)}`
        : `${jour} ${heure(horaires.debut)}–${heure(horaires.fin)}`

    // Le décalage est annoncé, et non appliqué en silence : sans lui, deux personnes qui
    // comparent leurs créneaux ne comprendraient pas d'où vient l'heure affichée.
    const decalage = decalageTraduisible(horaires.decalageMinutes)
    return decalage ? `${plage} (${t(decalage.cle, decalage.valeurs)})` : plage
  }

  /** « Hygiène · Toilettes sèches » — l'équipe d'abord, c'est elle qui situe le créneau. */
  const intitule = (creneau: CreneauLisible) =>
    [creneau.team?.name, creneau.title || t('volunteers.swap_slot_untitled')]
      .filter(Boolean)
      .join(' · ')

  /** Tout sur une ligne, là où un composant ne peut pas passer (un titre, une infobulle). */
  const resume = (creneau: CreneauLisible) => `${intitule(creneau)} · ${horaire(creneau, 'court')}`

  return { horaire, intitule, resume }
}
