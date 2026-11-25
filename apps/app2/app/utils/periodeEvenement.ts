/**
 * Les dates d'un événement en une ligne, dans SON fuseau : « 10 juin 2027 », ou
 * « 10 juin 2027 → 12 juin 2027 » s'il dure plusieurs jours. Chaîne vide sans date de début.
 */
export function periodeEvenement(e: {
  startDate: string | null
  endDate?: string | null
  timezone?: string
}): string {
  if (!e.startDate) return ''
  const format = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: e.timezone,
    })
  const debut = format(e.startDate)
  const fin = e.endDate ? format(e.endDate) : debut
  return debut === fin ? debut : `${debut} → ${fin}`
}
