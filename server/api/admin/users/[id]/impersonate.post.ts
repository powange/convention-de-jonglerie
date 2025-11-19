import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { setImpersonationCookie } from '@@/server/utils/impersonation-helpers'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'

import { getUserSession, setUserSession } from '#imports'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits super admin
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({
        statusCode: 401,
        message: 'Non authentifié',
      })
    }

    if (!session.user.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        message: 'Accès refusé. Seuls les super administrateurs peuvent utiliser cette fonction.',
      })
    }

    const userId = validateResourceId(event, 'id', 'utilisateur')

    // Récupérer l'utilisateur cible
    const targetUser = await fetchResourceOrFail(prisma.user, userId, {
      errorMessage: 'Utilisateur non trouvé',
    })

    // Ne pas permettre l'impersonation d'un autre super admin
    if (targetUser.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        message: "Impossible de se connecter en tant qu'un autre super administrateur",
      })
    }

    // Stocker les informations d'impersonation dans un cookie séparé
    setImpersonationCookie(event, {
      active: true,
      originalUserId: session.user.id,
      originalUserEmail: session.user.email,
      originalUserPseudo: session.user.pseudo,
      originalUserNom: session.user.nom,
      originalUserPrenom: session.user.prenom,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      startedAt: new Date().toISOString(),
    })

    // Basculer vers l'utilisateur cible dans la session
    await setUserSession(event, {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        pseudo: targetUser.pseudo,
        nom: targetUser.nom,
        prenom: targetUser.prenom,
        phone: targetUser.phone,
        isGlobalAdmin: targetUser.isGlobalAdmin,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
        isEmailVerified: targetUser.isEmailVerified,
      },
    })

    return {
      success: true,
      message: `Connecté en tant que ${targetUser.pseudo}`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        pseudo: targetUser.pseudo,
        nom: targetUser.nom,
        prenom: targetUser.prenom,
        phone: targetUser.phone,
        profilePicture: targetUser.profilePicture,
        isGlobalAdmin: targetUser.isGlobalAdmin,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
        isEmailVerified: targetUser.isEmailVerified,
      },
      impersonation: {
        active: true,
        originalUser: {
          id: session.user.id,
          pseudo: session.user.pseudo,
          email: session.user.email,
        },
      },
    }
  },
  { operationName: 'ImpersonateUser' }
)
