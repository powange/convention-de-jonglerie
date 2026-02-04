import { requireAuth, type AuthenticatedUser } from '../auth-utils'

/**
 * Vérifie que l'utilisateur a les permissions pour gérer les bénévoles d'une édition
 * @param event L'événement Nuxt/Nitro
 * @param editionId L'ID de l'édition
 * @returns L'utilisateur authentifié
 * @throws createError si pas autorisé
 */
export async function requireVolunteerManagementAccess(
  event: any,
  editionId: number
): Promise<AuthenticatedUser> {
  const user = requireAuth(event)

  // Super Admin en mode admin
  if (user.isGlobalAdmin) {
    return user
  }

  // Récupérer l'édition avec toutes les informations de permissions
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          organizers: {
            where: { userId: user.id },
            include: {
              perEditionPermissions: {
                where: { editionId },
              },
            },
          },
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      status: 404,
      message: 'Édition non trouvée',
    })
  }

  // Créateur de l'édition
  if (edition.creatorId === user.id) {
    return user
  }

  // Auteur de la convention
  if (edition.convention?.authorId === user.id) {
    return user
  }

  // Organisateur avec droit global de gérer les bénévoles
  const organizer = edition.convention?.organizers?.[0]
  if (organizer) {
    // Droit global sur la convention
    if (organizer.canManageVolunteers) {
      return user
    }

    // Droit spécifique à cette édition
    const perEditionPermission = organizer.perEditionPermissions?.[0]
    if (perEditionPermission?.canManageVolunteers) {
      return user
    }
  }

  throw createError({
    status: 403,
    message: 'Accès non autorisé - permissions de gestion des bénévoles requises',
  })
}

/**
 * Vérifie que l'utilisateur peut voir les informations de bénévoles d'une édition
 * (permissions plus permissives que la gestion)
 * @param event L'événement Nuxt/Nitro
 * @param editionId L'ID de l'édition
 * @returns L'utilisateur authentifié
 * @throws createError si pas autorisé
 */
export async function requireVolunteerReadAccess(
  event: any,
  editionId: number
): Promise<AuthenticatedUser> {
  const user = requireAuth(event)

  // Super Admin en mode admin
  if (user.isGlobalAdmin) {
    return user
  }

  // Récupérer l'édition avec toutes les informations de permissions
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          organizers: {
            where: { userId: user.id },
            include: {
              perEditionPermissions: {
                where: { editionId },
              },
            },
          },
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      status: 404,
      message: 'Édition non trouvée',
    })
  }

  // Créateur de l'édition
  if (edition.creatorId === user.id) {
    return user
  }

  // Auteur de la convention
  if (edition.convention?.authorId === user.id) {
    return user
  }

  // Organisateur avec accès à l'édition (même sans permissions spécifiques aux bénévoles)
  const organizer = edition.convention?.organizers?.[0]
  if (organizer) {
    // Si c'est un organisateur de la convention, il peut au moins voir
    return user
  }

  throw createError({
    status: 403,
    message: 'Accès non autorisé',
  })
}

/**
 * Vérifie si l'utilisateur est un bénévole accepté pour l'édition
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns true si l'utilisateur est un bénévole accepté
 */
export async function isAcceptedVolunteer(userId: number, editionId: number): Promise<boolean> {
  const application = await prisma.editionVolunteerApplication.findFirst({
    where: {
      userId,
      editionId,
      status: 'ACCEPTED',
    },
  })

  return !!application
}

/**
 * Vérifie que l'utilisateur peut voir le planning des bénévoles
 * Autorisé pour : les gestionnaires de bénévoles ET les bénévoles acceptés
 * @param event L'événement Nuxt/Nitro
 * @param editionId L'ID de l'édition
 * @returns L'utilisateur authentifié
 * @throws createError si pas autorisé
 */
export async function requireVolunteerPlanningAccess(
  event: any,
  editionId: number
): Promise<AuthenticatedUser> {
  const user = requireAuth(event)

  // Vérifier si l'utilisateur est un bénévole accepté
  const isVolunteer = await isAcceptedVolunteer(user.id, editionId)
  if (isVolunteer) {
    return user
  }

  // Sinon, vérifier les permissions de lecture classiques (organisateurs, etc.)
  try {
    return await requireVolunteerReadAccess(event, editionId)
  } catch {
    throw createError({
      status: 403,
      message: 'Accès non autorisé - vous devez être bénévole accepté ou gestionnaire',
    })
  }
}
