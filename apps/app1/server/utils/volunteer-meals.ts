import type { VolunteerMealType } from '#server/types/prisma'

/**
 * Détermine quels types de repas sont disponibles selon l'heure d'arrivée
 * Règles :
 * - Arrivée matin (morning) → petit-déj + déjeuner + dîner
 * - Arrivée midi (noon) → déjeuner + dîner
 * - Arrivée après-midi (afternoon) → dîner seulement
 * - Arrivée soir (evening) → dîner seulement
 */
// `string | undefined` : le moment vient d'un `split('_')`, qui ne garantit rien.
// Le `default` ci-dessous traite déjà toute valeur inconnue — l'absence en fait partie.
export function getAvailableMealsOnArrival(timeOfDay: string | undefined): VolunteerMealType[] {
  switch (timeOfDay) {
    case 'morning':
      return ['BREAKFAST', 'LUNCH', 'DINNER']
    case 'noon':
      return ['LUNCH', 'DINNER']
    case 'afternoon':
    case 'evening':
      return ['DINNER']
    default:
      return ['BREAKFAST', 'LUNCH', 'DINNER']
  }
}

/**
 * Détermine quels types de repas sont disponibles selon l'heure de départ
 * Règles inverses :
 * - Départ matin (morning) → petit-déj
 * - Départ midi (noon) → petit-déj + déjeuner
 * - Départ après-midi (afternoon) → petit-déj + déjeuner
 * - Départ soir (evening) → petit-déj + déjeuner + dîner
 */
// `string | undefined` : le moment vient d'un `split('_')`, qui ne garantit rien.
// Le `default` ci-dessous traite déjà toute valeur inconnue — l'absence en fait partie.
export function getAvailableMealsOnDeparture(timeOfDay: string | undefined): VolunteerMealType[] {
  switch (timeOfDay) {
    case 'morning':
      return ['BREAKFAST']
    case 'noon':
    case 'afternoon':
      return ['BREAKFAST', 'LUNCH']
    case 'evening':
      return ['BREAKFAST', 'LUNCH', 'DINNER']
    default:
      return ['BREAKFAST', 'LUNCH', 'DINNER']
  }
}

/**
 * Vérifie si un bénévole est éligible à un repas spécifique
 * en fonction de ses disponibilités et dates d'arrivée/départ
 */
export function isVolunteerEligibleForMeal(
  meal: { date: Date; mealType: VolunteerMealType; phases: string[] },
  volunteer: {
    // Nullable en base : une disponibilité jamais renseignée vaut `null`, que les tests
    // ci-dessous traitent déjà comme « non disponible ».
    setupAvailability: boolean | null
    teardownAvailability: boolean | null
    eventAvailability: boolean | null
    arrivalDateTime: string | null
    departureDateTime: string | null
  }
): boolean {
  // Filtrer par phases selon les disponibilités
  // Le bénévole est éligible si AU MOINS UNE des phases correspond à ses disponibilités
  const hasSetup = meal.phases.includes('SETUP')
  const hasEvent = meal.phases.includes('EVENT')
  const hasTeardown = meal.phases.includes('TEARDOWN')

  // Si le repas a une phase SETUP, le bénévole doit être disponible pour le montage
  // Si le repas a une phase EVENT, le bénévole doit être disponible pour l'événement
  // Si le repas a une phase TEARDOWN, le bénévole doit être disponible pour le démontage
  const isEligibleForPhases =
    (hasSetup && volunteer.setupAvailability) ||
    (hasEvent && volunteer.eventAvailability) ||
    (hasTeardown && volunteer.teardownAvailability)

  if (!isEligibleForPhases) return false

  // Filtrer par dates d'arrivée et de départ si renseignées
  const mealDate = new Date(meal.date)
  mealDate.setUTCHours(0, 0, 0, 0)

  if (volunteer.arrivalDateTime) {
    // Format: YYYY-MM-DD_timeOfDay
    const [arrivalDatePart, arrivalTimeOfDay] = volunteer.arrivalDateTime.split('_')
    const arrivalDate = new Date(arrivalDatePart ?? '')
    arrivalDate.setUTCHours(0, 0, 0, 0)

    if (mealDate < arrivalDate) return false

    // Si c'est le jour d'arrivée, vérifier l'heure
    if (mealDate.getTime() === arrivalDate.getTime()) {
      const availableMeals = getAvailableMealsOnArrival(arrivalTimeOfDay)
      if (!availableMeals.includes(meal.mealType)) return false
    }
  }

  if (volunteer.departureDateTime) {
    // Format: YYYY-MM-DD_timeOfDay
    const [departureDatePart, departureTimeOfDay] = volunteer.departureDateTime.split('_')
    const departureDate = new Date(departureDatePart ?? '')
    departureDate.setUTCHours(0, 0, 0, 0)

    if (mealDate > departureDate) return false

    // Si c'est le jour de départ, vérifier l'heure
    if (mealDate.getTime() === departureDate.getTime()) {
      const availableMeals = getAvailableMealsOnDeparture(departureTimeOfDay)
      if (!availableMeals.includes(meal.mealType)) return false
    }
  }

  return true
}

/**
 * Le moment de la journée d'un instant — « morning », « noon », « afternoon », « evening ».
 *
 * Les bénévoles le déclarent explicitement, à côté de leur date. Les artistes donnent une heure
 * précise : on en déduit le moment plutôt que de leur demander deux fois la même chose.
 */
function momentDeLaJournee(instant: Date): string {
  const heure = instant.getUTCHours()
  if (heure < 11) return 'morning'
  if (heure < 14) return 'noon'
  if (heure < 18) return 'afternoon'
  return 'evening'
}

/**
 * Un artiste est-il éligible à ce repas, vu ses horaires d'arrivée et de départ ?
 *
 * ⚠️ Cette fonction découpait la valeur sur un `_`, attendant le format `AAAA-MM-JJ_moment` des
 * BÉNÉVOLES. Les artistes n'ont jamais stocké cela : le découpage rendait donc toujours un moment
 * `undefined`, et le repli « tous les repas » s'appliquait. Un artiste arrivant à 23 h était
 * réputé éligible au petit-déjeuner du matin même.
 *
 * Depuis que ces champs sont des INSTANTS, `.split` planterait en plus. Le moment se déduit
 * désormais de l'heure, ce qui est à la fois juste et plus simple.
 *
 * L'heure est lue en UTC, comme la date du repas juste au-dessus : ce module ne connaît pas le
 * fuseau de l'édition. Pour un repas, la marge d'une heure ou deux ne change le résultat qu'aux
 * bornes — mais c'est une approximation, et elle est assumée ici plutôt que cachée.
 */
export function isArtistEligibleForMeal(
  meal: { date: Date; mealType: VolunteerMealType },
  artist: {
    arrivalDateTime: Date | string | null
    departureDateTime: Date | string | null
  }
): boolean {
  const mealDate = new Date(meal.date)
  mealDate.setUTCHours(0, 0, 0, 0)

  /** L'instant, et la journée à laquelle il appartient. */
  const journeeDe = (valeur: Date | string) => {
    const instant = new Date(valeur)
    if (Number.isNaN(instant.getTime())) return null
    const journee = new Date(instant)
    journee.setUTCHours(0, 0, 0, 0)
    return { instant, journee }
  }

  if (artist.arrivalDateTime) {
    const arrivee = journeeDe(artist.arrivalDateTime)
    if (arrivee) {
      if (mealDate < arrivee.journee) return false

      if (mealDate.getTime() === arrivee.journee.getTime()) {
        const repasPossibles = getAvailableMealsOnArrival(momentDeLaJournee(arrivee.instant))
        if (!repasPossibles.includes(meal.mealType)) return false
      }
    }
  }

  if (artist.departureDateTime) {
    const depart = journeeDe(artist.departureDateTime)
    if (depart) {
      if (mealDate > depart.journee) return false

      if (mealDate.getTime() === depart.journee.getTime()) {
        const repasPossibles = getAvailableMealsOnDeparture(momentDeLaJournee(depart.instant))
        if (!repasPossibles.includes(meal.mealType)) return false
      }
    }
  }

  return true
}
