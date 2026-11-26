/**
 * Qui décide des candidatures aux appels à spectacles d'un événement Flowvent — contrat d'hôte du
 * layer artistes (app1 a le sien, sur ses éditions et conventions) : le PROPRIÉTAIRE de
 * l'événement et les organisateurs qui ont le droit « gérer les artistes ». Ce sont eux qu'une
 * nouvelle candidature prévient.
 */
type ClientPrisma = Pick<typeof prisma, 'event' | 'editionOrganizer'>

export async function organisateursHabilitesSurLesArtistes(
  editionId: number,
  client: ClientPrisma = prisma
): Promise<number[]> {
  const [evenement, organisateurs] = await Promise.all([
    client.event.findUnique({ where: { id: editionId }, select: { ownerId: true } }),
    client.editionOrganizer.findMany({
      where: { editionId, canManageArtists: true },
      select: { organizer: { select: { userId: true } } },
    }),
  ])
  if (!evenement) throw new Error('Événement introuvable')
  return [...new Set([evenement.ownerId, ...organisateurs.map((o) => o.organizer.userId)])]
}
