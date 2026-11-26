// Câblage jonglerie des ports du module artistes. Écrit le bloc d'infos sur l'Edition et lit le
// catalogue des repas (VolunteerMeal). Reste côté app ; le layer ne consomme que les interfaces.
import type { ArtistsPorts, EditionAffichee } from '#artists/server/ports/types'

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
      async lireEdition(editionId) {
        const e = await prisma.edition.findUnique({
          where: { id: editionId },
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            convention: { select: { name: true } },
          },
        })
        if (!e) return null
        return {
          id: e.id,
          name: e.name,
          status: e.status,
          startDate: e.startDate,
          endDate: e.endDate,
          nomAffiche: e.name || e.convention?.name || '',
        }
      },
      selectionEditionAffichee: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        timezone: true,
        city: true,
        country: true,
        imageUrl: true,
        convention: { select: { id: true, name: true, logo: true } },
      },
      filtreEditionsPasTerminees: (maintenant) => ({ endDate: { gte: maintenant } }),
      // Dans app1, la forme sélectionnée EST la forme commune.
      editionAffichee: (brute) => brute as EditionAffichee,
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
