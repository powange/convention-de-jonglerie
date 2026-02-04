import type { EventHandlerRequest, H3Event } from 'h3'

/**
 * Vérifie que l'utilisateur est authentifié et possède les droits d'administrateur global
 * Version avec vérification en base de données pour les APIs admin
 * @param event - L'événement H3
 * @returns L'utilisateur admin avec ses informations
 * @throws Une erreur HTTP 401 ou 403 si l'accès est refusé
 */
export async function requireGlobalAdminWithDbCheck(event: H3Event<EventHandlerRequest>) {
  // Vérifier l'authentification
  const { user } = await requireUserSession(event)

  if (!user?.id) {
    throw createError({
      status: 401,
      message: 'Non authentifié',
    })
  }

  // Vérifier les droits admin dans la base de données
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      pseudo: true,
      nom: true,
      prenom: true,
      isGlobalAdmin: true,
    },
  })

  if (!currentUser?.isGlobalAdmin) {
    throw createError({
      status: 403,
      message: 'Accès refusé - Droits super administrateur requis',
    })
  }

  return {
    id: currentUser.id,
    email: currentUser.email,
    pseudo: currentUser.pseudo,
    nom: currentUser.nom,
    prenom: currentUser.prenom,
    isGlobalAdmin: true,
  }
}

/**
 * Version légère qui utilise directement les données de session
 * (plus rapide mais moins sûre, à utiliser uniquement si les données de session sont fiables)
 */
export async function requireGlobalAdminFromSession(event: H3Event<EventHandlerRequest>) {
  const { user } = await requireUserSession(event)

  if (!user?.id) {
    throw createError({
      status: 401,
      message: 'Non authentifié',
    })
  }

  // Vérification directe depuis la session (plus rapide)
  if (!user.isGlobalAdmin) {
    throw createError({
      status: 403,
      message: 'Accès refusé - Droits super administrateur requis',
    })
  }

  return user
}
