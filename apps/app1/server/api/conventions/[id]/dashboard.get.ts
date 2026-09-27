import type { Prisma } from '#server/types/prisma'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { checkAdminMode } from '#server/utils/organizer-management'
import { readConventionRights, readEditionRights } from '#server/utils/permissions/rights-shapes'
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
          artists: true,
          editionOrganizers: true,
        },
      },
      // Candidatures bénévoles : relation portée par Event (étape 0)
      event: {
        select: {
          _count: {
            select: { volunteerApplications: { where: { status: 'ACCEPTED' } } },
          },
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
      const { orders, event: editionEvent, ...editionData } = edition
      const ticketingParticipants = orders.reduce(
        (sum, order) => sum + (order._count?.items ?? 0),
        0
      )
      return {
        ...editionData,
        _count: {
          ...editionData._count,
          // `?? 0` : filet de sécurité, editionEvent existe toujours (invariant Edition.id == eventId)
          volunteerApplications: editionEvent?._count?.volunteerApplications ?? 0,
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
      /*
       * TOUS les droits, dérivés de la source unique — et non une énumération à la main.
       *
       * Cette réponse alimente la modale d'édition d'un organisateur de « Mes conventions », qui la
       * renvoie telle quelle en PUT. Sept droits de convention sur quinze et trois par édition sur
       * onze y étaient recopiés : les huit droits de module par édition arrivaient donc absents,
       * s'affichaient décochés, et le serveur les réécrivait à `false`. Quelqu'un à qui l'on avait
       * confié la billetterie d'une seule édition le perdait dès qu'un responsable changeait son
       * titre, sans message ni trace.
       */
      rights: readConventionRights(collab),
      perEdition: (collab.perEditionPermissions ?? []).map((p) => ({
        editionId: p.editionId,
        ...readEditionRights(p),
      })),
    }))

    return { editions, organizers }
  },
  { operationName: 'GetConventionDashboard' }
)
