import { getUserSession, setUserSession } from '#imports'

import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
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

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'ID utilisateur requis',
    })
  }

  // Récupérer l'utilisateur cible
  const targetUser = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
  })

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      message: 'Utilisateur non trouvé',
    })
  }

  // Ne pas permettre l'impersonation d'un autre super admin
  if (targetUser.isGlobalAdmin) {
    throw createError({
      statusCode: 403,
      message: "Impossible de se connecter en tant qu'un autre super administrateur",
    })
  }

  // Sauvegarder les informations de l'admin original dans la session
  // et basculer vers l'utilisateur cible
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
    // Stocker les informations d'impersonation
    impersonation: {
      active: true,
      originalUserId: session.user.id,
      originalUserEmail: session.user.email,
      originalUserPseudo: session.user.pseudo,
      originalUserNom: session.user.nom,
      originalUserPrenom: session.user.prenom,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      startedAt: new Date().toISOString(),
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
})
