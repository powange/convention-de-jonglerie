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
          select: { startDate: true },
        })
        return { found: !!edition, startDate: edition?.startDate ?? null }
      },
    },
  }
}
