/**
 * Câblage du layer artistes pour FLOWVENT (contrat d'hôte, cf. layers/artists/server/ports/types.ts ;
 * app1 a le sien, sur ses éditions).
 *
 * - `event` : le texte d'information des artistes est sur l'événement (`Event.artistInfo`).
 * - `meals` : Flowvent n'a pas encore le module repas (lot 7 de docs/flowvent-modules.md) — aucun
 *   repas ouvert. Neutre plutôt qu'en échec : le layer l'appelle au fil d'écrans qui doivent
 *   s'afficher.
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
  },
  meals: {
    getEnabledMeals: async () => [],
  },
}

export function useArtistsPorts(): ArtistsPorts {
  return ports
}
