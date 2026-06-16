import prisma from './prisma'

// Client Prisma OU client transactionnel (tx) — assez large pour les deux usages.
type PrismaLike = Pick<typeof prisma, 'edition' | 'event'>

/**
 * Étape 0bis — synchronise les métadonnées génériques de l'`Event` depuis son `Edition` (jonglerie).
 *
 * `Event` porte désormais `name`/`startDate`/`endDate`/`status` pour que les modules (bénévoles…)
 * n'aient plus à lire `Edition`/`Convention`. L'app jonglerie reste la source de vérité et maintient
 * ces champs en miroir : à appeler après toute création/màj d'édition (ou de nom de convention).
 *
 * Nom d'affichage côté jonglerie : « Convention - Edition » (ou juste « Convention » si l'édition
 * n'a pas de nom propre).
 */
export async function syncEventMetadataFromEdition(
  editionId: number,
  client: PrismaLike = prisma
): Promise<void> {
  const edition = await client.edition.findUnique({
    where: { id: editionId },
    select: {
      eventId: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      convention: { select: { name: true } },
    },
  })
  if (!edition) return

  const displayName = `${edition.convention.name}${edition.name ? ` - ${edition.name}` : ''}`

  await client.event.update({
    where: { id: edition.eventId },
    data: {
      name: displayName,
      startDate: edition.startDate,
      endDate: edition.endDate,
      status: edition.status,
    },
  })
}

/**
 * Re-synchronise toutes les éditions d'une convention (ex. après renommage de la convention).
 */
export async function syncEventsForConvention(
  conventionId: number,
  client: PrismaLike & Pick<typeof prisma, 'edition'> = prisma
): Promise<void> {
  const editions = await client.edition.findMany({
    where: { conventionId },
    select: { id: true },
  })
  for (const edition of editions ?? []) {
    await syncEventMetadataFromEdition(edition.id, client)
  }
}
