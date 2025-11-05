import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'

import { getUserSession, setUserSession, clearUserSession } from '#imports'

export default wrapApiHandler(
  async (event) => {
    // Récupérer la session actuelle
    const session = await getUserSession(event)

    if (!session?.user) {
      throw createError({
        statusCode: 401,
        message: 'Non authentifié',
      })
    }

    // Vérifier qu'une impersonation est active
    if (!session.impersonation?.active) {
      throw createError({
        statusCode: 400,
        message: "Aucune session d'impersonation active",
      })
    }

    // Récupérer l'utilisateur admin original
    const originalUserId = session.impersonation.originalUserId
    const originalUser = await fetchResourceOrFail(prisma.user, originalUserId, {
      errorMessage: 'Utilisateur administrateur original non trouvé',
    })

    // Nettoyer complètement la session et recréer avec l'admin original
    await clearUserSession(event)
    await setUserSession(event, {
      user: {
        id: originalUser.id,
        email: originalUser.email,
        pseudo: originalUser.pseudo,
        nom: originalUser.nom,
        prenom: originalUser.prenom,
        phone: originalUser.phone,
        isGlobalAdmin: originalUser.isGlobalAdmin,
        createdAt: originalUser.createdAt,
        updatedAt: originalUser.updatedAt,
        isEmailVerified: originalUser.isEmailVerified,
      },
      // Explicitement ne pas inclure impersonation
    })

    return {
      success: true,
      message: "Session d'impersonation terminée",
      user: {
        id: originalUser.id,
        email: originalUser.email,
        pseudo: originalUser.pseudo,
        nom: originalUser.nom,
        prenom: originalUser.prenom,
        phone: originalUser.phone,
        profilePicture: originalUser.profilePicture,
        isGlobalAdmin: originalUser.isGlobalAdmin,
        createdAt: originalUser.createdAt,
        updatedAt: originalUser.updatedAt,
        isEmailVerified: originalUser.isEmailVerified,
      },
      impersonationStopped: true,
    }
  },
  { operationName: 'StopImpersonation' }
)
