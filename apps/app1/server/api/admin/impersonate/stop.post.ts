import { wrapApiHandler } from '#server/utils/api-helpers'
import {
  getImpersonationCookie,
  clearImpersonationCookie,
} from '#server/utils/impersonation-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { ouvrirSession } from '#server/utils/session-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier qu'une impersonation est active
    const impersonation = await getImpersonationCookie(event)

    if (!impersonation?.active) {
      throw createError({
        status: 400,
        message: "Aucune session d'impersonation active",
      })
    }

    // Récupérer l'utilisateur admin original
    const originalUserId = impersonation.originalUserId
    const originalUser = await fetchResourceOrFail(prisma.user, originalUserId, {
      errorMessage: 'Utilisateur administrateur original non trouvé',
    })

    // Supprimer la session d'impersonation
    await clearImpersonationCookie(event)

    // Restaurer la session de l'admin original
    await ouvrirSession(
      event,
      {
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
      },
      {
        // La génération courante du compte : sans elle, la session naîtrait avec le
        // numéro 0 et le middleware la rejetterait aussitôt pour tout compte ayant
        // déjà changé de mot de passe.
        sessionVersion: originalUser.sessionVersion,
      }
    )

    console.log("[IMPERSONATE] Session restaurée pour l'utilisateur:", originalUser.pseudo)

    return createSuccessResponse(
      {
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
      },
      "Session d'impersonation terminée"
    )
  },
  { operationName: 'StopImpersonation' }
)
