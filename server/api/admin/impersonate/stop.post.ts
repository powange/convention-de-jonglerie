import { wrapApiHandler } from '@@/server/utils/api-helpers'
import {
  getImpersonationCookie,
  clearImpersonationCookie,
} from '@@/server/utils/impersonation-helpers'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'

import { setUserSession } from '#imports'

export default wrapApiHandler(
  async (event) => {
    // Vérifier qu'une impersonation est active
    const impersonation = getImpersonationCookie(event)

    if (!impersonation?.active) {
      throw createError({
        statusCode: 400,
        message: "Aucune session d'impersonation active",
      })
    }

    // Récupérer l'utilisateur admin original
    const originalUserId = impersonation.originalUserId
    const originalUser = await fetchResourceOrFail(prisma.user, originalUserId, {
      errorMessage: 'Utilisateur administrateur original non trouvé',
    })

    // Supprimer le cookie d'impersonation
    clearImpersonationCookie(event)

    // Restaurer la session de l'admin original
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
    })

    console.log("[IMPERSONATE] Session restaurée pour l'utilisateur:", originalUser.pseudo)

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
