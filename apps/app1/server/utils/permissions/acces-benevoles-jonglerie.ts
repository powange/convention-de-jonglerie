import { requireAuth, type AuthenticatedUser } from '#server/utils/auth-utils'

/**
 * Qui peut gérer, ou seulement consulter, les bénévoles d'une édition — règle PROPRE À LA
 * JONGLERIE : créateur de l'édition, auteur de la convention, organisateurs et leurs droits par
 * édition.
 *
 * Ces fonctions vivaient dans `layers/volunteers`, qui lisait ainsi `Edition` et `Convention`
 * directement — ce que l'étape 0bis avait proscrit, et ce qui empêchait une autre app (Flowvent)
 * d'étendre le layer. Le layer passe désormais par le port `organizers`
 * (`useVolunteerPorts().organizers`), dont le câblage jonglerie
 * (`server/volunteers/ports/default-binding.ts`) délègue ici.
 */

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
