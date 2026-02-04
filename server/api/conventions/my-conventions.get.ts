import type { Prisma } from '@prisma/client'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { checkAdminMode } from '#server/utils/organizer-management'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    // Editions must include status (EditionStatus enum with default OFFLINE)
    const editionsSelect: Prisma.EditionSelect = {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      city: true,
      country: true,
      imageUrl: true,
      status: true,
      _count: {
        select: {
          volunteerApplications: true,
        },
      },
      orders: {
        select: {
          _count: {
            select: {
              items: true,
            },
          },
        },
      },
    }
    // Vérifier si l'utilisateur est en mode admin actif
    const isInAdminMode = await checkAdminMode(user.id, event)

    // Récupérer les conventions selon les permissions utilisateur
    const whereClause = isInAdminMode
      ? {
          // Mode admin actif : toutes les conventions non archivées
          isArchived: false,
        }
      : {
          // Utilisateur normal ou admin pas en mode admin : conventions où il est auteur OU organisateur
          isArchived: false,
          OR: [{ authorId: user.id }, { organizers: { some: { userId: user.id } } }],
        }

    const conventions = await prisma.convention.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
          },
        },
        organizers: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                emailHash: true,
              },
            },
            perEditionPermissions: true,
          },
          orderBy: {
            addedAt: 'asc',
          },
        },
        editions: {
          select: editionsSelect,
          orderBy: {
            startDate: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transformer les organisateurs pour construire l'objet rights
    const transformedConventions = conventions.map((convention) => ({
      ...convention,
      organizers: convention.organizers.map((collab) => ({
        id: collab.id,
        title: collab.title,
        addedAt: collab.addedAt,
        user: collab.user,
        rights: {
          editConvention: collab.canEditConvention,
          deleteConvention: collab.canDeleteConvention,
          manageOrganizers: collab.canManageOrganizers,
          manageVolunteers: collab.canManageVolunteers,
          addEdition: collab.canAddEdition,
          editAllEditions: collab.canEditAllEditions,
          deleteAllEditions: collab.canDeleteAllEditions,
        },
        perEdition: (collab.perEditionPermissions || []).map((p) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canManageVolunteers: p.canManageVolunteers,
        })),
      })),
    }))

    return transformedConventions
  },
  { operationName: 'GetMyConventions' }
)
