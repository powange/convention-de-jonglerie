// Câblage jonglerie des ports du module repas. Lit les modèles concrets (EditionArtist /
// ArtistMealSelection). Reste côté app ; le layer meals ne consomme que les interfaces (types.ts).
import type {
  MealArtistParticipant,
  MealArtistSelectionRow,
  MealConsumptionResult,
  MealsPorts,
} from './types'

const artistUserSelect = {
  id: true,
  nom: true,
  prenom: true,
  pseudo: true,
  email: true,
  phone: true,
} as const

export function createDefaultMealsPorts(): MealsPorts {
  return {
    artists: {
      // participants.get : sélections artistes ACCEPTÉES par repas.
      async getMealParticipants(mealIds) {
        if (mealIds.length === 0) return {}
        const selections = await prisma.artistMealSelection.findMany({
          where: { mealId: { in: mealIds }, accepted: true },
          select: {
            mealId: true,
            afterShow: true,
            artist: {
              select: {
                dietaryPreference: true,
                allergies: true,
                allergySeverity: true,
                user: { select: artistUserSelect },
              },
            },
          },
        })
        const result: Record<number, MealArtistParticipant[]> = {}
        for (const sel of selections) {
          ;(result[sel.mealId] ??= []).push({
            userId: sel.artist.user.id,
            nom: sel.artist.user.nom,
            prenom: sel.artist.user.prenom,
            pseudo: sel.artist.user.pseudo,
            email: sel.artist.user.email,
            phone: sel.artist.user.phone,
            dietaryPreference: sel.artist.dietaryPreference,
            allergies: sel.artist.allergies,
            allergySeverity: sel.artist.allergySeverity,
            afterShow: sel.afterShow,
          })
        }
        return result
      },
      // search / pending / stats : TOUTES les sélections du repas (pas seulement « accepted »).
      async listMealSelections(editionId, mealId): Promise<MealArtistSelectionRow[]> {
        const selections = await prisma.artistMealSelection.findMany({
          where: { mealId, artist: { editionId } },
          select: {
            id: true,
            consumedAt: true,
            artist: { select: { user: { select: artistUserSelect } } },
          },
        })
        return selections.map((sel) => ({
          selectionId: sel.id,
          userId: sel.artist.user.id,
          nom: sel.artist.user.nom,
          prenom: sel.artist.user.prenom,
          pseudo: sel.artist.user.pseudo,
          email: sel.artist.user.email,
          phone: sel.artist.user.phone,
          consumedAt: sel.consumedAt,
        }))
      },
      // validate.post : marque la consommation (atomique sur consumedAt null).
      async markConsumed(editionId, mealId, selectionId, at): Promise<MealConsumptionResult> {
        const selection = await prisma.artistMealSelection.findUnique({
          where: { id: selectionId },
          include: { artist: true },
        })
        if (!selection || selection.artist.editionId !== editionId || selection.mealId !== mealId) {
          return { ok: false, reason: 'not_found' }
        }
        const result = await prisma.artistMealSelection.updateMany({
          where: { id: selectionId, consumedAt: null },
          data: { consumedAt: at },
        })
        return result.count === 0 ? { ok: false, reason: 'already' } : { ok: true }
      },
      // cancel.post : annule la consommation.
      async cancelConsumed(editionId, mealId, selectionId): Promise<MealConsumptionResult> {
        const selection = await prisma.artistMealSelection.findUnique({
          where: { id: selectionId },
          include: { artist: true },
        })
        if (!selection || selection.artist.editionId !== editionId || selection.mealId !== mealId) {
          return { ok: false, reason: 'not_found' }
        }
        await prisma.artistMealSelection.update({
          where: { id: selectionId },
          data: { consumedAt: null },
        })
        return { ok: true }
      },
    },
  }
}
