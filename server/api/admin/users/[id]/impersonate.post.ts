import { setUserSession } from '#imports'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { setImpersonationCookie } from '#server/utils/impersonation-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits super admin avec vérification en BDD
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const userId = validateResourceId(event, 'id', 'utilisateur')

    // Récupérer l'utilisateur cible
    const targetUser = await fetchResourceOrFail(prisma.user, userId, {
      errorMessage: 'Utilisateur non trouvé',
    })

    // Ne pas permettre l'impersonation d'un autre super admin
    if (targetUser.isGlobalAdmin) {
      throw createError({
        status: 403,
        message: "Impossible de se connecter en tant qu'un autre super administrateur",
      })
    }

    // Stocker les informations d'impersonation dans une session scellée
    await setImpersonationCookie(event, {
      active: true,
      originalUserId: adminUser.id,
      originalUserEmail: adminUser.email,
      originalUserPseudo: adminUser.pseudo,
      originalUserNom: adminUser.nom,
      originalUserPrenom: adminUser.prenom,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      startedAt: new Date().toISOString(),
    })

    // Basculer vers l'utilisateur cible dans la session
    await setUserSession(event, {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        emailHash: targetUser.emailHash,
        pseudo: targetUser.pseudo,
        nom: targetUser.nom,
        prenom: targetUser.prenom,
        phone: targetUser.phone,
        isGlobalAdmin: targetUser.isGlobalAdmin,
        isVolunteer: targetUser.isVolunteer,
        isArtist: targetUser.isArtist,
        isOrganizer: targetUser.isOrganizer,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
        isEmailVerified: targetUser.isEmailVerified,
      },
    })

    return createSuccessResponse(
      {
        user: {
          id: targetUser.id,
          email: targetUser.email,
          emailHash: targetUser.emailHash,
          pseudo: targetUser.pseudo,
          nom: targetUser.nom,
          prenom: targetUser.prenom,
          phone: targetUser.phone,
          profilePicture: targetUser.profilePicture,
          isGlobalAdmin: targetUser.isGlobalAdmin,
          isVolunteer: targetUser.isVolunteer,
          isArtist: targetUser.isArtist,
          isOrganizer: targetUser.isOrganizer,
          createdAt: targetUser.createdAt,
          updatedAt: targetUser.updatedAt,
          isEmailVerified: targetUser.isEmailVerified,
        },
        impersonation: {
          active: true,
          originalUser: {
            id: adminUser.id,
            pseudo: adminUser.pseudo,
            email: adminUser.email,
          },
        },
      },
      `Connecté en tant que ${targetUser.pseudo}`
    )
  },
  { operationName: 'ImpersonateUser' }
)
