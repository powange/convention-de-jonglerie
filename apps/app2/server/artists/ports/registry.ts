/**
 * Câblage du layer artistes pour FLOWVENT (contrat d'hôte, cf. layers/artists/server/ports/types.ts ;
 * app1 a le sien, sur ses éditions).
 *
 * - `event` : le texte d'information des artistes est sur l'événement (`Event.artistInfo`) ; les
 *   appels à spectacles le lisent et l'affichent sous la forme commune d'une édition.
 * - `meals` : le catalogue des repas activés de l'événement (module repas, `VolunteerMeal`), comme
 *   dans app1.
 */
import type { ArtistsPorts } from '#artists/server/ports/types'

const ports: ArtistsPorts = {
  event: {
    setArtistInfo: (editionId, artistInfo) =>
      prisma.event.update({
        where: { id: editionId },
        data: { artistInfo },
        select: { id: true, artistInfo: true },
      }),
    async lireEdition(editionId) {
      const e = await prisma.event.findUnique({
        where: { id: editionId },
        select: { id: true, name: true, status: true, startDate: true, endDate: true },
      })
      return e ? { ...e, nomAffiche: e.name } : null
    },
    // Ce que l'événement a de commun avec une édition d'app1. Ni pays ni image ; le lieu tient lieu
    // de ville, et l'événement de convention (même id, même nom, pas de logo).
    selectionEditionAffichee: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      timezone: true,
      location: true,
    },
    // Sans date de fin, l'événement dure sa journée de début.
    filtreEditionsPasTerminees: (maintenant) => ({
      OR: [{ endDate: { gte: maintenant } }, { endDate: null, startDate: { gte: maintenant } }],
    }),
    editionAffichee(brute) {
      const e = brute as {
        id: number
        name: string
        startDate: Date | null
        endDate: Date | null
        timezone: string | null
        location: string | null
      }
      return {
        id: e.id,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        // Même défaut que l'édition (`/api/events/:id/edition`) : sans fuseau, le serveur (UTC) et
        // le navigateur formataient la date limite chacun dans le sien — écarts d'hydratation.
        timezone: e.timezone ?? 'Europe/Paris',
        city: e.location,
        country: null,
        imageUrl: null,
        convention: { id: e.id, name: e.name, logo: null },
      }
    },
  },
  meals: {
    getEnabledMeals: (editionId) =>
      prisma.volunteerMeal.findMany({
        where: { editionId, enabled: true },
        orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      }),
  },
}

export function useArtistsPorts(): ArtistsPorts {
  return ports
}
