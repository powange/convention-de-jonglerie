// Câblage jonglerie des ports du module artistes. Écrit le bloc d'infos sur l'Edition et lit le
// catalogue des repas (VolunteerMeal). Reste côté app ; le layer ne consomme que les interfaces.
import type { ArtistsPorts } from './types'

import { invalidateEditionCache } from '#server/utils/cache-helpers'

export function createDefaultArtistsPorts(): ArtistsPorts {
  return {
    event: {
      // Jonglerie : le bloc d'infos artistes est un champ de l'Edition.
      async setArtistInfo(editionId, artistInfo) {
        const updated = await prisma.edition.update({
          where: { id: editionId },
          data: { artistInfo },
          select: { id: true, artistInfo: true },
        })
        await invalidateEditionCache(editionId)
        return updated
      },
    },
    meals: {
      // Jonglerie : le catalogue des repas activés vient du module repas (VolunteerMeal).
      async getEnabledMeals(editionId) {
        return prisma.volunteerMeal.findMany({
          where: { editionId, enabled: true },
          orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
        })
      },
    },
  }
}
