import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { userAdminSelect } from '#server/utils/prisma-select-helpers'
import { validateUserId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin
    await requireGlobalAdminWithDbCheck(event)

    // Valider l'ID utilisateur
    const userId = validateUserId(event)

    // Vérifier que l'utilisateur existe
    const existingUser = await fetchResourceOrFail(prisma.user, userId, {
      errorMessage: 'Utilisateur introuvable',
    })

    // Vérifier que l'email n'est pas déjà vérifié
    if (existingUser.isEmailVerified) {
      throw createError({
        status: 400,
        message: "L'email de cet utilisateur est déjà vérifié",
      })
    }

    // Marquer l'email comme vérifié et nettoyer le code de vérification
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
        verificationCodeExpiry: null,
        updatedAt: new Date(),
      },
      select: userAdminSelect,
    })

    return createSuccessResponse({ user: updatedUser }, 'Email validé avec succès.')
  },
  { operationName: 'ValidateUserEmail' }
)
