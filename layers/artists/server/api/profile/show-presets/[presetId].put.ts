import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  showPresetSchema,
  validateAndSanitize,
  handleValidationError,
} from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const presetId = getRouterParam(event, 'presetId')

    if (!presetId || isNaN(Number(presetId))) {
      throw createError({ statusCode: 400, message: 'ID de preset invalide' })
    }

    // Vérifier que le preset appartient à l'utilisateur
    const existing = await prisma.showPreset.findUnique({
      where: { id: Number(presetId) },
    })
    if (!existing || existing.userId !== user.id) {
      throw createError({ statusCode: 404, message: 'Preset non trouvé' })
    }

    const body = await readBody(event)

    let validatedData
    try {
      validatedData = validateAndSanitize(showPresetSchema, body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

    // Vérifier l'unicité du nom si changé
    if (validatedData.name !== existing.name) {
      const duplicate = await prisma.showPreset.findUnique({
        where: { userId_name: { userId: user.id, name: validatedData.name } },
      })
      if (duplicate) {
        throw createError({
          statusCode: 409,
          message: 'Un preset avec ce nom existe déjà',
        })
      }
    }

    const preset = await prisma.showPreset.update({
      where: { id: Number(presetId) },
      data: validatedData,
    })

    return createSuccessResponse({ preset })
  },
  { operationName: 'UpdateShowPreset' }
)
