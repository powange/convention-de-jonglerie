import { canAccessEditionData } from '../../../../utils/permissions/edition-permissions'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    // Récupérer les validations de billets
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
    })

    const ticketValidations = config
      ? await prisma.helloAssoOrderItem.findMany({
          where: {
            order: {
              externalTicketingId: config.id,
            },
            entryValidated: true,
            entryValidatedAt: {
              not: null,
            },
          },
          orderBy: {
            entryValidatedAt: 'desc',
          },
          take: 10,
          select: {
            id: true,
            helloAssoItemId: true,
            firstName: true,
            lastName: true,
            email: true,
            name: true,
            entryValidatedAt: true,
            entryValidatedBy: true,
          },
        })
      : []

    // Récupérer les validations de bénévoles
    const volunteerValidations = await prisma.editionVolunteerApplication.findMany({
      where: {
        editionId: editionId,
        entryValidated: true,
        entryValidatedAt: {
          not: null,
        },
      },
      orderBy: {
        entryValidatedAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        entryValidatedAt: true,
        entryValidatedBy: true,
        user: {
          select: {
            prenom: true,
            nom: true,
            email: true,
          },
        },
      },
    })

    // Fusionner et trier les validations
    const allValidations = [
      ...ticketValidations.map((v) => ({
        id: v.id,
        type: 'ticket' as const,
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        name: v.name,
        entryValidatedAt: v.entryValidatedAt,
        entryValidatedBy: v.entryValidatedBy,
      })),
      ...volunteerValidations.map((v) => ({
        id: v.id,
        type: 'volunteer' as const,
        firstName: v.user.prenom,
        lastName: v.user.nom,
        email: v.user.email,
        name: 'Bénévole',
        entryValidatedAt: v.entryValidatedAt,
        entryValidatedBy: v.entryValidatedBy,
      })),
    ]
      .sort((a, b) => {
        const dateA = a.entryValidatedAt ? new Date(a.entryValidatedAt).getTime() : 0
        const dateB = b.entryValidatedAt ? new Date(b.entryValidatedAt).getTime() : 0
        return dateB - dateA
      })
      .slice(0, 10)

    // Récupérer les infos des validateurs
    const validatorIds = allValidations
      .map((v) => v.entryValidatedBy)
      .filter((id): id is number => id !== null && id !== undefined)
    const validators = await prisma.user.findMany({
      where: { id: { in: validatorIds } },
      select: {
        id: true,
        pseudo: true,
        prenom: true,
        nom: true,
        email: true,
      },
    })
    const validatorMap = new Map(validators.map((v) => [v.id, v]))

    // Ajouter les infos des validateurs aux validations
    const validationsWithValidators = allValidations.map((v) => ({
      ...v,
      validator: v.entryValidatedBy ? validatorMap.get(v.entryValidatedBy) : null,
    }))

    return {
      success: true,
      validations: validationsWithValidators,
    }
  } catch (error: any) {
    console.error('Database recent validations error:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des validations',
    })
  }
})
