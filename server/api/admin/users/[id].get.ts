import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateUserId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)
    const userId = validateUserId(event)

    const user = await fetchResourceOrFail(prisma.user, userId, {
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        isEmailVerified: true,
        isGlobalAdmin: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        profilePicture: true,
        _count: {
          select: {
            createdConventions: true,
            createdEditions: true,
            favoriteEditions: true,
          },
        },
      },
      errorMessage: 'Utilisateur introuvable',
    })

    return user
  },
  { operationName: 'GetAdminUser' }
)
