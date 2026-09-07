/**
 * L'heure et la durée d'un créneau, dites d'une seule façon.
 *
 * Ce calcul existait à l'identique — au caractère près — dans la modale d'affectation et dans
 * celle de détail. L'infobulle du planning en aurait fait un troisième exemplaire, et trois
 * copies dérivent tôt ou tard.
 *
 * Les fonctions rendent la clé de traduction plutôt que le texte : la sélection de la clé est
 * précisément ce qui peut se tromper, et on peut la vérifier sans monter l'i18n.
 */

/** Une durée exprimée en heures et minutes, ou `null` si les bornes ne s'y prêtent pas. */
export function decomposerDuree(
  debut: string | Date | null | undefined,
  fin: string | Date | null | undefined
): { heures: number; minutes: number } | null {
  if (!debut || !fin) return null

  const depart = new Date(debut).getTime()
  const arrivee = new Date(fin).getTime()
  if (Number.isNaN(depart) || Number.isNaN(arrivee) || arrivee < depart) return null

  const total = Math.floor((arrivee - depart) / 60000)
  return { heures: Math.floor(total / 60), minutes: total % 60 }
}

/**
 * La clé de traduction et ses valeurs pour dire la durée : « 1h », « 1h30 » ou « 45min ».
 * `null` quand la durée n'est pas calculable — au caller de ne rien afficher.
 */
export function dureeTraduisible(
  debut: string | Date | null | undefined,
  fin: string | Date | null | undefined
): { cle: string; valeurs: Record<string, number> } | null {
  const duree = decomposerDuree(debut, fin)
  if (!duree) return null

  const { heures, minutes } = duree
  if (heures > 0 && minutes > 0) {
    return { cle: 'volunteers.duration_hours_minutes', valeurs: { hours: heures, minutes } }
  }
  if (heures > 0) return { cle: 'volunteers.duration_hours', valeurs: { hours: heures } }
  return { cle: 'volunteers.duration_minutes', valeurs: { minutes } }
}

/** Une heure à la française : « 15h », ou « 15h05 » quand les minutes comptent. */
export function formatHeure(date: string | Date | null | undefined): string {
  if (!date) return ''
  const valeur = new Date(date)
  if (Number.isNaN(valeur.getTime())) return ''

  const minutes = valeur.getMinutes()
  return minutes === 0
    ? `${valeur.getHours()}h`
    : `${valeur.getHours()}h${String(minutes).padStart(2, '0')}`
}

/** « 15h - 16h ». Vide si l'une des bornes manque. */
export function formatPlage(
  debut: string | Date | null | undefined,
  fin: string | Date | null | undefined
): string {
  const depart = formatHeure(debut)
  const arrivee = formatHeure(fin)
  if (!depart || !arrivee) return depart || arrivee
  return `${depart} - ${arrivee}`
}
