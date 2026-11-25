/**
 * Les personnes rattachées à un événement Flowvent — contrat d'hôte du layer stock (choix d'un
 * responsable de retrait ou de retour, cf. layers/stock). App1 a le sien, sur ses conventions,
 * éditions et artistes ; Flowvent n'a ni convention ni artistes (pas encore) : l'événement compte
 * son PROPRIÉTAIRE, ses ORGANISATEURS et ses BÉNÉVOLES ACCEPTÉS.
 *
 * Mêmes signatures qu'app1 : le second paramètre (`conventionId`) n'a pas d'objet ici.
 */
import type { Prisma } from '#server/types/prisma'

/** Plafond des résultats d'une recherche de personne (même valeur qu'app1). */
export const LIMITE_RESULTATS = 20

export function attachesALEdition(
  editionId: number,
  _conventionId?: number
): Prisma.UserWhereInput['OR'] {
  return [
    { events: { some: { id: editionId } } },
    { organizers: { some: { editions: { some: { editionId } } } } },
    { volunteerApplications: { some: { eventId: editionId, status: 'ACCEPTED' } } },
  ]
}

/** Chaque mot doit se trouver dans le pseudo, le prénom ou le nom (même règle qu'app1). */
export function filtreRecherchePersonne(mots: string[]): Prisma.UserWhereInput['AND'] {
  return mots.map((mot) => ({
    OR: [{ pseudo: { contains: mot } }, { prenom: { contains: mot } }, { nom: { contains: mot } }],
  }))
}

/**
 * Refuse un responsable qui ne fait pas partie de l'événement : sans cette garde, on pourrait
 * nommer n'importe quel compte de Flowvent en connaissant son id.
 */
export async function assertResponsablesDeLEdition(
  editionId: number,
  conventionId: number | undefined,
  responsableIds: Array<number | null | undefined>
): Promise<void> {
  const ids = Array.from(
    new Set(responsableIds.filter((id): id is number => typeof id === 'number'))
  )
  if (ids.length === 0) return

  const trouves = await prisma.user.findMany({
    where: { id: { in: ids }, OR: attachesALEdition(editionId, conventionId) },
    select: { id: true },
  })
  if (trouves.length !== ids.length) {
    throw createError({
      status: 400,
      message: "Cette personne ne fait pas partie de l'événement",
    })
  }
}
