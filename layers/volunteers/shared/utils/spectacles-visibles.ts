/**
 * Règle unique décidant si un créneau empêche un bénévole d'assister à un spectacle.
 *
 * Deux fonctionnalités s'en servent, et elles doivent dire la même chose : l'avertissement
 * affiché sous le planning, qui signale les bénévoles déjà privés, et l'assignation
 * automatique, qui refuse de les priver. Deux implémentations finiraient par se contredire —
 * l'algorithme jugeant acceptable ce que la page dénonce.
 */

/** Un spectacle et ses représentations, tels que les expose l'API. */
export interface SpectacleProgramme {
  id: number
  title: string
  /** Durée en minutes. Absente, la représentation est traitée comme un instant. */
  durationMinutes?: number | null
  performances: { startDateTime: string }[]
}

/** Une représentation ramenée à ses bornes, en millisecondes. */
export interface Representation {
  iso: string
  debut: number
  fin: number
}

/**
 * Les représentations d'un spectacle, bornées et lisibles.
 *
 * Une représentation dont la date est illisible est écartée : mieux vaut l'ignorer que fonder
 * un refus dessus. Faute de durée connue, la représentation est réduite à son instant de début.
 */
export function representationsDe(spectacle: SpectacleProgramme): Representation[] {
  const duree = spectacle.durationMinutes
  const dureeMs = duree && duree > 0 ? duree * 60_000 : 0

  return (spectacle.performances || [])
    .map((passage) => {
      const debut = new Date(passage.startDateTime).getTime()
      return { iso: passage.startDateTime, debut, fin: debut + dureeMs }
    })
    .filter((representation) => !Number.isNaN(representation.debut))
}

/**
 * Le créneau empêche-t-il d'assister à cette représentation ?
 *
 * Le moindre chevauchement suffit : arriver au milieu, ce n'est pas voir le spectacle. Un
 * créneau qui s'achève à l'heure pile du lever de rideau ne bloque donc pas, mais un créneau
 * qui mord dix minutes sur la fin, si.
 *
 * Quand la durée du spectacle est inconnue, la représentation vaut pour un instant : seul un
 * créneau déjà en cours à cette heure-là la bloque.
 */
export function empeche(
  creneauDebut: number,
  creneauFin: number,
  representation: Pick<Representation, 'debut' | 'fin'>
): boolean {
  return representation.fin > representation.debut
    ? creneauDebut < representation.fin && creneauFin > representation.debut
    : creneauDebut <= representation.debut && creneauFin > representation.debut
}

/** Un créneau ramené à ses bornes, en millisecondes. */
export interface CreneauBorne {
  debut: number
  fin: number
}

/**
 * Les représentations qu'aucun des créneaux ne laisse voir.
 *
 * Un tableau vide en retour signifie que le spectacle reste accessible : il suffit d'un seul
 * passage libre.
 */
export function representationsBloquees(
  representations: Representation[],
  creneaux: CreneauBorne[]
): Representation[] {
  return representations.filter((representation) =>
    creneaux.some((creneau) => empeche(creneau.debut, creneau.fin, representation))
  )
}

/**
 * Le spectacle devient-il inaccessible ? Vrai seulement si toutes ses représentations sont
 * prises — et il faut au moins une représentation pour qu'il y ait quelque chose à manquer.
 */
export function spectacleInaccessible(
  representations: Representation[],
  creneaux: CreneauBorne[]
): boolean {
  return (
    representations.length > 0 &&
    representationsBloquees(representations, creneaux).length === representations.length
  )
}
