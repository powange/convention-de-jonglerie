import { fuseauUtilisable } from '~~/shared/utils/fuseau-edition'

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

/**
 * Une heure à la française : « 15h », ou « 15h05 » quand les minutes comptent.
 *
 * `fuseau` est FACULTATIF, et c'est délibéré : ces deux fonctions servent aussi aux pages
 * programme, qu'aucune demande ne couvre. Sans fuseau, le comportement reste celui d'avant —
 * l'heure de la machine. Avec, l'heure est celle du LIEU, la seule qui vaille pour un créneau :
 * « accueil à 14 h » veut dire 14 h sur place, que le planning soit lu de Paris ou de Tokyo.
 */
export function formatHeure(
  date: string | Date | null | undefined,
  fuseau?: string | null
): string {
  if (!date) return ''
  const valeur = new Date(date)
  if (Number.isNaN(valeur.getTime())) return ''

  const zone = fuseauUtilisable(fuseau)
  // `Intl` plutôt que `getHours()` : c'est ce qui permet de lire l'heure AILLEURS que sur la
  // machine. Le découpage manuel qui suit garde le rendu « 15h05 », qu'aucun format standard
  // ne produit.
  const [heures, minutes] = zone
    ? new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: zone,
      })
        .format(valeur)
        .split(':')
        .map(Number)
    : [valeur.getHours(), valeur.getMinutes()]

  return minutes === 0 ? `${heures}h` : `${heures}h${String(minutes).padStart(2, '0')}`
}

/** « 15h - 16h ». Vide si l'une des bornes manque. */
export function formatPlage(
  debut: string | Date | null | undefined,
  fin: string | Date | null | undefined,
  fuseau?: string | null
): string {
  const depart = formatHeure(debut, fuseau)
  const arrivee = formatHeure(fin, fuseau)
  if (!depart || !arrivee) return depart || arrivee
  return `${depart} - ${arrivee}`
}
