// Câblage jonglerie des ports du module covoiturage. Lit le modèle concret (Edition) pour
// l'existence. Reste côté app ; le layer ne consomme que les interfaces (types.ts).
import type { CarpoolPorts } from './types'

export function createDefaultCarpoolPorts(): CarpoolPorts {
  return {
    event: {
      // Jonglerie : l'événement est une Edition.
      async eventExists(editionId) {
        const edition = await prisma.edition.findUnique({
          where: { id: editionId },
          select: { id: true },
        })
        return !!edition
      },
    },
  }
}
