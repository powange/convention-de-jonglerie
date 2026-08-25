/**
 * Les représentations d'un spectacle côté formulaire : ses passages, chacun avec sa date, son
 * lieu et sa publication.
 *
 * La durée n'y figure pas : elle appartient à l'œuvre et ne change pas d'un passage à l'autre.
 */
export interface PerformanceInput {
  /** Heure murale, dans le fuseau de la convention — convertie à l'enregistrement. */
  startDateTime: string
  location: string
  zoneId: number | null
  markerId: number | null
  isPublic: boolean
}

/** Une représentation vierge, non publiée : on annonce une date une fois qu'elle est sûre. */
export const performanceVierge = (): PerformanceInput => ({
  startDateTime: '',
  location: '',
  zoneId: null,
  markerId: null,
  isPublic: false,
})
