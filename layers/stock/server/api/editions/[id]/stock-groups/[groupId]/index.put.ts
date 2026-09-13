import { z } from 'zod'

import {
  fermetureBloqueePar,
  FERMETURE_IMPOSSIBLE,
} from '../../../../../../app/utils/reservations-du-groupe'
import { reservationsActivesDuGroupe } from '../../../../../utils/reservations-ouvertes'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  displayOrder: z.number().int().optional(),
  reservationsEnabled: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    if (isNaN(groupId)) {
      throw createError({ status: 400, message: 'Identifiant de groupe invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageStock(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const existing = await prisma.stockGroup.findFirst({
      where: { id: groupId, editionId },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    // Fermer les réservations d'un groupe qui en a encore est refusé, et c'est délibéré.
    //
    // Les masquer en les gardant en base laisserait des gens compter sur du matériel réservé qui
    // ne s'affiche plus nulle part, sans que rien ne le signale — le pire des deux mondes. Le
    // refus, lui, se voit et se répare.
    //
    // Même règle que la fermeture des échanges de créneaux, et le message dit le nombre : sans
    // lui, on ne saurait pas l'ampleur de ce qu'il reste à solder.
    if (data.reservationsEnabled === false) {
      const actives = await reservationsActivesDuGroupe(groupId)
      if (fermetureBloqueePar(actives)) {
        throw createError({
          status: 409,
          message: `Ce groupe a encore ${actives} réservation(s). Supprimez-les avant de désactiver les réservations.`,
          data: { code: FERMETURE_IMPOSSIBLE, reservations: actives },
        })
      }
    }

    const group = await prisma.stockGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description?.trim() || null,
        }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        ...(data.reservationsEnabled !== undefined && {
          reservationsEnabled: data.reservationsEnabled,
        }),
      },
    })

    return createSuccessResponse({ group })
  },
  { operationName: 'UpdateStockGroup' }
)
