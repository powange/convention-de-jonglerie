// Câblage jonglerie des ports du module repas. Lit les modèles concrets (EditionArtist /
// ArtistMealSelection). Reste côté app ; le layer meals ne consomme que les interfaces (types.ts).
import type {
  MealArtistParticipant,
  MealArtistSelectionRow,
  MealConsumptionResult,
  MealsPorts,
  MealTicketConsumptionResult,
  MealTicketParticipant,
  MealTicketValidationRow,
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
    ticketing: {
      // participants.get : participants billetterie (commandes traitées) par repas, dédupliqués.
      async getMealTicketParticipants(mealIds) {
        if (mealIds.length === 0) return {}
        const oiSelect = {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          customFields: true,
        } as const
        const meals = await prisma.volunteerMeal.findMany({
          where: { id: { in: mealIds } },
          select: {
            id: true,
            tiers: {
              select: {
                tier: {
                  select: { orderItems: { where: { state: 'Processed' }, select: oiSelect } },
                },
              },
            },
            options: {
              select: {
                option: {
                  select: {
                    orderItemSelections: {
                      where: { orderItem: { state: 'Processed' } },
                      select: { orderItem: { select: oiSelect } },
                    },
                  },
                },
              },
            },
          },
        })
        const toParticipant = (oi: {
          id: number
          firstName: string | null
          lastName: string | null
          email: string | null
          customFields: unknown
        }): MealTicketParticipant => {
          const cf = (oi.customFields as Record<string, any>) || {}
          return {
            orderItemId: oi.id,
            lastName: oi.lastName,
            firstName: oi.firstName,
            email: oi.email,
            dietaryPreference: cf?.dietaryPreference || null,
            allergies: cf?.allergies || null,
            allergySeverity: cf?.allergySeverity || null,
          }
        }
        const result: Record<number, MealTicketParticipant[]> = {}
        for (const meal of meals) {
          const seen = new Set<number>()
          const list: MealTicketParticipant[] = []
          for (const tm of meal.tiers) {
            for (const oi of tm.tier.orderItems) {
              if (seen.has(oi.id)) continue
              seen.add(oi.id)
              list.push(toParticipant(oi))
            }
          }
          for (const om of meal.options) {
            for (const sel of om.option.orderItemSelections) {
              const oi = sel.orderItem
              if (seen.has(oi.id)) continue
              seen.add(oi.id)
              list.push(toParticipant(oi))
            }
          }
          result[meal.id] = list
        }
        return result
      },
      // search / pending / stats : participants billetterie (entrée validée) d'un repas, dédupliqués.
      async listMealTicketParticipants(mealId): Promise<MealTicketValidationRow[]> {
        const oiSelect = {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          mealAccess: { where: { mealId }, select: { consumedAt: true } },
        } as const
        const meal = await prisma.volunteerMeal.findUnique({
          where: { id: mealId },
          select: {
            tiers: {
              select: {
                tier: {
                  select: { orderItems: { where: { entryValidated: true }, select: oiSelect } },
                },
              },
            },
            options: {
              select: {
                option: {
                  select: {
                    orderItemSelections: {
                      where: { orderItem: { entryValidated: true } },
                      select: { orderItem: { select: oiSelect } },
                    },
                  },
                },
              },
            },
          },
        })
        if (!meal) return []
        const toRow = (oi: {
          id: number
          firstName: string | null
          lastName: string | null
          email: string | null
          mealAccess: { consumedAt: Date | null }[]
        }): MealTicketValidationRow => ({
          orderItemId: oi.id,
          firstName: oi.firstName,
          lastName: oi.lastName,
          email: oi.email,
          consumedAt: oi.mealAccess.find((ma) => ma.consumedAt !== null)?.consumedAt ?? null,
        })
        const seen = new Set<number>()
        const rows: MealTicketValidationRow[] = []
        for (const tm of meal.tiers) {
          for (const oi of tm.tier.orderItems) {
            if (seen.has(oi.id)) continue
            seen.add(oi.id)
            rows.push(toRow(oi))
          }
        }
        for (const om of meal.options) {
          for (const sel of om.option.orderItemSelections) {
            const oi = sel.orderItem
            if (seen.has(oi.id)) continue
            seen.add(oi.id)
            rows.push(toRow(oi))
          }
        }
        return rows
      },
      // validate.post : valide la consommation (remboursement + accès via tarif/option, atomique).
      async validateConsumption(
        editionId,
        mealId,
        orderItemId,
        at
      ): Promise<MealTicketConsumptionResult> {
        const orderItem = await prisma.ticketingOrderItem.findUnique({
          where: { id: orderItemId },
          include: { order: true, tier: true, selectedOptions: { select: { optionId: true } } },
        })
        if (!orderItem || orderItem.order.editionId !== editionId) {
          return { ok: false, reason: 'not_found' }
        }
        if (orderItem.state === 'Refunded' || orderItem.order.status === 'Refunded') {
          return { ok: false, reason: 'refunded' }
        }
        const meal = await prisma.volunteerMeal.findFirst({
          where: { id: mealId, editionId },
          include: { tiers: { select: { tierId: true } }, options: { select: { optionId: true } } },
        })
        const mealTierIds = new Set((meal?.tiers ?? []).map((t) => t.tierId))
        const mealOptionIds = new Set((meal?.options ?? []).map((o) => o.optionId))
        let hasAccess = false
        if (orderItem.tierId && mealTierIds.has(orderItem.tierId)) hasAccess = true
        if (!hasAccess && orderItem.selectedOptions.length > 0) {
          hasAccess = orderItem.selectedOptions.some((so) => mealOptionIds.has(so.optionId))
        }
        if (!hasAccess) return { ok: false, reason: 'no_access' }
        const result = await prisma.ticketingOrderItemMeal.updateMany({
          where: { orderItemId, mealId, consumedAt: null },
          data: { consumedAt: at },
        })
        if (result.count === 0) {
          try {
            await prisma.ticketingOrderItemMeal.create({
              data: { orderItemId, mealId, consumedAt: at },
            })
          } catch (error: any) {
            if (error.code === 'P2002') return { ok: false, reason: 'already' }
            throw error
          }
        }
        return { ok: true }
      },
      // cancel.post : annule la consommation d'un billet.
      async cancelConsumption(editionId, mealId, orderItemId): Promise<MealConsumptionResult> {
        const orderItem = await prisma.ticketingOrderItem.findUnique({
          where: { id: orderItemId },
          include: { order: true },
        })
        if (!orderItem || orderItem.order.editionId !== editionId) {
          return { ok: false, reason: 'not_found' }
        }
        await prisma.ticketingOrderItemMeal.deleteMany({ where: { orderItemId, mealId } })
        return { ok: true }
      },
    },
  }
}
