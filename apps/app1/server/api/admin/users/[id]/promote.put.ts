import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateUserId } from '#server/utils/validation-helpers'
import { donneesDePromotionAdmin } from '~~/shared/utils/promotion-administrateur'

const promoteUserSchema = z.object({
  isGlobalAdmin: z.boolean(),
})

export default wrapApiHandler(
  async (event) => {
    const adminUser = await requireGlobalAdminWithDbCheck(event)
    const userId = validateUserId(event)

    // Empêcher l'auto-modification
    if (userId === adminUser.id) {
      throw createError({
        status: 403,
        message: 'Vous ne pouvez pas modifier vos propres droits administrateur',
      })
    }

    const body = await readBody(event)
    const validatedData = promoteUserSchema.parse(body)

    // Vérifier que l'utilisateur à modifier existe
    await fetchResourceOrFail(prisma.user, userId, {
      errorMessage: 'Utilisateur introuvable',
    })

    // Mettre à jour le statut administrateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        /*
         * La DATE de promotion part avec le drapeau — constat B7. L'écran d'activité de
         * l'administration se fondait jusqu'ici sur `updatedAt`, que tout changement de profil
         * touche, et annonçait donc des promotions qui n'avaient pas eu lieu.
         */
        ...donneesDePromotionAdmin(validatedData.isGlobalAdmin),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        isEmailVerified: true,
        isGlobalAdmin: true,
        promotedAdminAt: true,
        createdAt: true,
        updatedAt: true,
        profilePicture: true,
        _count: {
          select: {
            createdConventions: true,
            createdEditions: true,
            favoriteEditions: true,
          },
        },
      },
    })

    return createSuccessResponse(updatedUser)
  },
  { operationName: 'PromoteUser' }
)
