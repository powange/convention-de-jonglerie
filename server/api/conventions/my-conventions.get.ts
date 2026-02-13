import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { checkAdminMode } from '#server/utils/organizer-management'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Vérifier si l'utilisateur est en mode admin actif
    const isInAdminMode = await checkAdminMode(user.id, event)

    // Récupérer les conventions selon les permissions utilisateur
    const whereClause = isInAdminMode
      ? {
          isArchived: false,
        }
      : {
          isArchived: false,
          OR: [{ authorId: user.id }, { organizers: { some: { userId: user.id } } }],
        }

    const conventions = await prisma.convention.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        logo: true,
        description: true,
        email: true,
        createdAt: true,
        authorId: true,
        _count: {
          select: {
            editions: true,
          },
        },
        // Récupérer uniquement l'entrée de l'utilisateur courant pour les droits
        organizers: {
          where: { userId: user.id },
          select: {
            canEditConvention: true,
            canDeleteConvention: true,
            canManageOrganizers: true,
            canManageVolunteers: true,
            canAddEdition: true,
            canEditAllEditions: true,
            canDeleteAllEditions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transformer pour aplatir les droits du user courant
    return conventions.map((conv) => {
      const userOrganizer = conv.organizers[0]
      return {
        id: conv.id,
        name: conv.name,
        logo: conv.logo,
        description: conv.description,
        email: conv.email,
        createdAt: conv.createdAt,
        authorId: conv.authorId,
        _count: conv._count,
        currentUserRights: userOrganizer
          ? {
              editConvention: userOrganizer.canEditConvention,
              deleteConvention: userOrganizer.canDeleteConvention,
              manageOrganizers: userOrganizer.canManageOrganizers,
              manageVolunteers: userOrganizer.canManageVolunteers,
              addEdition: userOrganizer.canAddEdition,
              editAllEditions: userOrganizer.canEditAllEditions,
              deleteAllEditions: userOrganizer.canDeleteAllEditions,
            }
          : null,
      }
    })
  },
  { operationName: 'GetMyConventions' }
)
