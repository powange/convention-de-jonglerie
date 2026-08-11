/**
 * Vérifie qu'une zone ou un repère appartient bien à l'édition visée.
 *
 * Sans ce contrôle, un organisateur pourrait rattacher un élément de son programme à une zone
 * d'une autre convention en devinant un identifiant : la carte afficherait alors un créneau chez
 * quelqu'un d'autre, et une suppression de zone à l'autre bout du site viderait ce lieu sans que
 * personne comprenne pourquoi. Les clés étrangères ne protègent de rien ici — elles garantissent
 * que la zone existe, pas qu'elle est la bonne.
 */
export async function assurerLieuDeLEdition(
  editionId: number,
  zoneId?: number | null,
  markerId?: number | null
): Promise<void> {
  if (zoneId) {
    const zone = await prisma.editionZone.findFirst({
      where: { id: zoneId, editionId },
      select: { id: true },
    })
    if (!zone) {
      throw createError({ status: 400, message: 'Cette zone n’appartient pas à l’édition' })
    }
  }

  if (markerId) {
    const marker = await prisma.editionMarker.findFirst({
      where: { id: markerId, editionId },
      select: { id: true },
    })
    if (!marker) {
      throw createError({ status: 400, message: 'Ce repère n’appartient pas à l’édition' })
    }
  }
}
