import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  showPresetSchema,
  validateAndSanitize,
  handleValidationError,
} from '#server/utils/validation-schemas'

const MAX_PRESETS = 20

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

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

    const preset = await prisma.$transaction(async (tx) => {
      // Vérifier la limite de presets
      const count = await tx.showPreset.count({
        where: { userId: user.id },
      })
      if (count >= MAX_PRESETS) {
        throw createError({
          statusCode: 400,
          message: `Nombre maximum de presets atteint (${MAX_PRESETS})`,
        })
      }

      // Vérifier l'unicité du nom
      const existing = await tx.showPreset.findUnique({
        where: { userId_name: { userId: user.id, name: validatedData.name } },
      })
      if (existing) {
        throw createError({
          statusCode: 409,
          message: 'Un preset avec ce nom existe déjà',
        })
      }

      return tx.showPreset.create({
        data: {
          userId: user.id,
          ...validatedData,
        },
      })
    })

    return createSuccessResponse({ preset })
  },
  { operationName: 'CreateShowPreset' }
)
