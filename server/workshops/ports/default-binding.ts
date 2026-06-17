// Câblage jonglerie des ports du module ateliers. Lit le modèle concret (Edition) pour les flags et
// les dates. Reste côté app ; le layer ne consomme que les interfaces (types.ts).
import type { WorkshopsPorts } from './types'

export function createDefaultWorkshopsPorts(): WorkshopsPorts {
  return {
    event: {
      // Jonglerie : flags workshopsEnabled / workshopLocationsFreeInput + dates portés par l'Edition.
      async getConfig(editionId) {
        const edition = await prisma.edition.findUnique({
          where: { id: editionId },
          select: {
            workshopsEnabled: true,
            workshopLocationsFreeInput: true,
            startDate: true,
            endDate: true,
          },
        })
        if (!edition) {
          return {
            found: false,
            enabled: false,
            locationsFreeInput: false,
            startDate: null,
            endDate: null,
          }
        }
        return {
          found: true,
          enabled: edition.workshopsEnabled === true,
          locationsFreeInput: edition.workshopLocationsFreeInput === true,
          startDate: edition.startDate ?? null,
          endDate: edition.endDate ?? null,
        }
      },
    },
  }
}
