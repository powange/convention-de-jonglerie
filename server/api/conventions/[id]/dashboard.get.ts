import type { Prisma } from '@prisma/client'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { checkAdminMode } from '#server/utils/organizer-management'
import { userWithProfileSelect } from '#server/utils/prisma-select-helpers'
import { validateConventionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)

    // Vérifier si l'utilisateur est en mode admin actif
    const isInAdminMode = await checkAdminMode(user.id, event)

    // Vérifier que l'utilisateur a accès à cette convention
    if (!isInAdminMode) {
      const convention = await prisma.convention.findUnique({
        where: { id: conventionId },
        select: {
          authorId: true,
          organizers: {
            where: { userId: user.id },
            select: { id: true },
          },
        },
      })

      if (!convention) {
        throw createError({ status: 404, message: 'Convention introuvable' })
      }

      const isAuthor = convention.authorId === user.id
      const isOrganizer = convention.organizers.length > 0

      if (!isAuthor && !isOrganizer) {
        throw createError({ status: 403, message: 'Accès non autorisé à cette convention' })
      }
    }

    // Sélection des éditions avec compteurs
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
          volunteerApplications: {
            where: { status: 'ACCEPTED' },
          },
          artists: true,
          editionOrganizers: true,
        },
      },
      orders: {
        where: {
          status: { not: 'Refunded' },
        },
        select: {
          _count: {
            select: {
              items: {
                where: {
                  state: { in: ['Processed', 'Pending'] },
                  tier: { countAsParticipant: true },
                },
              },
            },
          },
        },
      },
    }

    // Récupérer la convention avec éditions et organisateurs
    const convention = await prisma.convention.findUnique({
      where: { id: conventionId },
      include: {
        editions: {
          select: editionsSelect,
          orderBy: { startDate: 'asc' },
        },
        organizers: {
          include: {
            user: {
              select: {
                ...userWithProfileSelect,
                emailHash: true,
              },
            },
            perEditionPermissions: true,
          },
          orderBy: { addedAt: 'asc' },
        },
      },
    })

    if (!convention) {
      throw createError({ status: 404, message: 'Convention introuvable' })
    }

    // Transformer les éditions (calculer ticketingParticipants)
    const editions = convention.editions.map((edition) => {
      const { orders, ...editionData } = edition
      const ticketingParticipants = orders.reduce(
        (sum, order) => sum + (order._count?.items ?? 0),
        0
      )
      return {
        ...editionData,
        _count: {
          ...editionData._count,
          ticketingParticipants,
        },
      }
    })

    // Transformer les organisateurs
    const organizers = convention.organizers.map((collab) => ({
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
      perEdition: (collab.perEditionPermissions ?? []).map((p) => ({
        editionId: p.editionId,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canManageVolunteers: p.canManageVolunteers,
      })),
    }))

    return { editions, organizers }
  },
  { operationName: 'GetConventionDashboard' }
)
