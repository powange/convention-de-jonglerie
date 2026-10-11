// Câblage jonglerie des ports du module objets trouvés. Lit le modèle concret (Edition) pour
// l'existence et la date de début. Reste côté app ; le layer ne consomme que les interfaces.
import type { LostFoundPorts } from './types'

export function createDefaultLostFoundPorts(): LostFoundPorts {
  return {
    event: {
      // Jonglerie : existence + startDate portés par l'Edition.
      async getEventTiming(editionId) {
        const edition = await prisma.edition.findUnique({
          where: { id: editionId },
          select: {
            startDate: true,
            // Jonglerie : la visibilité d'un événement est celle de l'Edition, et l'auteur de la
            // convention compte parmi ceux qui peuvent la lire hors ligne.
            status: true,
            creatorId: true,
            convention: { select: { authorId: true } },
          },
        })
        if (!edition) return { found: false, startDate: null, visibilite: null }
        return {
          found: true,
          startDate: edition.startDate ?? null,
          visibilite: {
            status: edition.status,
            creatorId: edition.creatorId ?? null,
            conventionAuthorId: edition.convention?.authorId ?? null,
          },
        }
      },
    },
  }
}
