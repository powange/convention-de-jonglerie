/**
 * Qui peut prêter main-forte, maintenant.
 *
 * Le lot précédent a donné un nom aux bénévoles volants. Celui-ci répond à la question qu'on se
 * pose réellement le samedi à 18 h, quand une équipe prend du retard : non pas « qui est volant »,
 * mais « qui est volant, **sur place**, et **libre tout de suite** ».
 *
 * Rien n'est demandé à personne pour y répondre : la validation d'entrée dit qui est arrivé, les
 * affectations disent qui est déjà pris. Un bouton « je suis disponible » aurait paru plus fiable
 * et l'aurait été moins — il suppose des gens qui consultent l'application pendant qu'ils
 * travaillent, et une liste vide n'aurait pas distingué l'absence de l'inattention.
 *
 * ⚠️ Ce fichier est lu par le serveur et par l'écran, et ne doit rien importer : il est aussi
 * chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Un créneau tenu par un volant, réduit à ses bornes. */
export interface CreneauDuVolant {
  debut: string | Date
  fin: string | Date
}

/**
 * L'état d'un volant à un instant donné.
 *
 * Trois valeurs, et il en faut bien trois. « Pas disponible » recouvrirait deux situations qui
 * n'appellent pas la même décision : celui qui tient un poste se libérera tout à l'heure, celui
 * qui n'est pas arrivé ne se libérera peut-être jamais.
 */
export type EtatDuVolant = 'disponible' | 'occupe' | 'absent'

/** Un volant, réduit à ce que la règle en lit. */
export interface VolantObservable {
  /** Son entrée a-t-elle été validée&nbsp;? C'est ce qui dit qu'il est physiquement là. */
  entreeValidee?: boolean | null
  creneaux?: readonly CreneauDuVolant[] | null
}

/** Les bornes d'un créneau en millisecondes, ou `null` si elles ne veulent rien dire. */
function bornes(creneau: CreneauDuVolant | null | undefined): [number, number] | null {
  if (!creneau) return null
  const debut = new Date(creneau.debut).getTime()
  const fin = new Date(creneau.fin).getTime()
  if (Number.isNaN(debut) || Number.isNaN(fin) || fin <= debut) return null
  return [debut, fin]
}

/**
 * Le créneau qui mobilise ce volant à l'instant donné, s'il y en a un.
 *
 * Bornes incluse à gauche, exclue à droite : quelqu'un dont le créneau s'achève à 18 h est libre à
 * 18 h. L'inverse le laisserait occupé une minute de trop, tous les jours, à chaque relève.
 */
export function creneauEnCours(
  creneaux: readonly CreneauDuVolant[] | null | undefined,
  maintenant: Date
): CreneauDuVolant | null {
  if (!Array.isArray(creneaux)) return null
  const instant = maintenant.getTime()

  return (
    creneaux.find((creneau) => {
      const bornesDuCreneau = bornes(creneau)
      if (!bornesDuCreneau) return false
      return bornesDuCreneau[0] <= instant && instant < bornesDuCreneau[1]
    }) ?? null
  )
}

/**
 * Le prochain créneau de ce volant, s'il en a un devant lui.
 *
 * Sert à nuancer une disponibilité : « libre, mais attendu ailleurs dans vingt minutes » n'est pas
 * la même offre que « libre pour la soirée », et c'est à l'organisateur d'en juger.
 */
export function prochainCreneau(
  creneaux: readonly CreneauDuVolant[] | null | undefined,
  maintenant: Date
): CreneauDuVolant | null {
  if (!Array.isArray(creneaux)) return null
  const instant = maintenant.getTime()

  const aVenir = creneaux
    .map((creneau) => ({ creneau, bornes: bornes(creneau) }))
    .filter(
      (entree): entree is { creneau: CreneauDuVolant; bornes: [number, number] } =>
        entree.bornes !== null && entree.bornes[0] > instant
    )
    .sort((a, b) => a.bornes[0] - b.bornes[0])

  return aVenir[0]?.creneau ?? null
}

/**
 * Où en est ce volant&nbsp;?
 *
 * L'absence prime sur l'occupation : quelqu'un dont l'entrée n'est pas validée n'est pas sur le
 * site, et le créneau qu'on lui a posé ne dit rien de sa présence. Le déclarer « occupé » ferait
 * croire qu'il travaille quelque part.
 */
export function etatDuVolant(volant: VolantObservable, maintenant: Date): EtatDuVolant {
  if (volant?.entreeValidee !== true) return 'absent'
  return creneauEnCours(volant?.creneaux, maintenant) ? 'occupe' : 'disponible'
}

/** L'ordre d'affichage : d'abord ceux qu'on peut appeler. */
const RANG: Record<EtatDuVolant, number> = { disponible: 0, occupe: 1, absent: 2 }

/**
 * Les volants, rangés du plus mobilisable au moins mobilisable.
 *
 * L'écran est consulté dans l'urgence, souvent d'un téléphone : ce qu'on cherche doit être en
 * haut, sans faire défiler. Les absents ferment la marche sans disparaître — savoir que quelqu'un
 * n'est pas encore arrivé est une information, et l'effacer donnerait à croire qu'il n'existe pas.
 */
export function volantsParDisponibilite<V extends VolantObservable>(
  volants: readonly V[],
  maintenant: Date
): V[] {
  return [...volants].sort(
    (a, b) => RANG[etatDuVolant(a, maintenant)] - RANG[etatDuVolant(b, maintenant)]
  )
}

/** Ce que l'en-tête de l'écran annonce. */
export interface ResumeDesRenforts {
  disponibles: number
  occupes: number
  absents: number
  total: number
}

/** Combien de renforts on peut espérer, et combien il ne faut pas espérer. */
export function resumeDesRenforts(
  volants: readonly VolantObservable[],
  maintenant: Date
): ResumeDesRenforts {
  const resume: ResumeDesRenforts = {
    disponibles: 0,
    occupes: 0,
    absents: 0,
    total: volants.length,
  }

  for (const volant of volants) {
    const etat = etatDuVolant(volant, maintenant)
    if (etat === 'disponible') resume.disponibles += 1
    else if (etat === 'occupe') resume.occupes += 1
    else resume.absents += 1
  }

  return resume
}
