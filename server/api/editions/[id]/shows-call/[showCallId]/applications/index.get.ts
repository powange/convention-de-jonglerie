import type { Prisma } from '@prisma/client'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validatePagination } from '#server/utils/validation-helpers'

/**
 * Liste les candidatures d'un appel à spectacles
 * Accessible par les organisateurs ayant les droits de gestion des artistes
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({
        status: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    // Vérifier les permissions
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour voir les candidatures",
      })
    }

    // Vérifier que l'appel existe
    const showCall = await prisma.editionShowCall.findFirst({
      where: {
        id: showCallId,
        editionId,
      },
    })

    if (!showCall) {
      throw createError({
        status: 404,
        message: 'Appel à spectacles non trouvé',
      })
    }

    // Paramètres de filtrage
    const query = getQuery(event)
    const statusFilter = query.status as string | undefined
    const search = (query.search as string)?.trim()

    // Pagination
    const pagination = validatePagination(event)

    // Construction des filtres WHERE
    const where: Prisma.ShowApplicationWhereInput = {
      showCallId: showCall.id,
    }

    if (statusFilter && ['PENDING', 'ACCEPTED', 'REJECTED'].includes(statusFilter)) {
      where.status = statusFilter
    }

    if (search) {
      where.OR = [
        { artistName: { contains: search } },
        { showTitle: { contains: search } },
        { user: { pseudo: { contains: search } } },
        { user: { prenom: { contains: search } } },
        { user: { nom: { contains: search } } },
      ]
    }

    // Compter le total filtré et les statistiques par statut (groupBy optimisé)
    const [total, statsGroupBy] = await Promise.all([
      prisma.showApplication.count({ where }),
      prisma.showApplication.groupBy({
        by: ['status'],
        where: { showCallId: showCall.id },
        _count: true,
      }),
    ])

    // Extraire les stats depuis le groupBy
    const stats = {
      pending: statsGroupBy.find((s) => s.status === 'PENDING')?._count ?? 0,
      accepted: statsGroupBy.find((s) => s.status === 'ACCEPTED')?._count ?? 0,
      rejected: statsGroupBy.find((s) => s.status === 'REJECTED')?._count ?? 0,
    }

    // Récupérer les candidatures
    const applications = await prisma.showApplication.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            emailHash: true,
            profilePicture: true,
          },
        },
        decidedBy: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
            profilePicture: true,
          },
        },
        show: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    return {
      applications,
      showCall: {
        id: showCall.id,
        name: showCall.name,
      },
      total,
      page: pagination.page,
      pageSize: pagination.limit,
      stats,
    }
  },
  { operationName: 'GetShowCallApplications' }
)
