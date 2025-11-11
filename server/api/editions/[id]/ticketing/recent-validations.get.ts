import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      // Récupérer les validations de billets (externes et manuels)
      const ticketValidations = await prisma.ticketingOrderItem.findMany({
        where: {
          state: { in: ['Processed', 'Pending'] }, // Exclure les billets remboursés
          order: {
            editionId: editionId,
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

      // Récupérer les validations d'artistes
      const artistValidations = await prisma.editionArtist.findMany({
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

      // Récupérer les validations d'organisateurs
      const organizerValidations = await prisma.editionOrganizer.findMany({
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
          organizer: {
            select: {
              title: true,
              user: {
                select: {
                  prenom: true,
                  nom: true,
                  email: true,
                },
              },
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
        ...artistValidations.map((v) => ({
          id: v.id,
          type: 'artist' as const,
          firstName: v.user.prenom,
          lastName: v.user.nom,
          email: v.user.email,
          name: 'Artiste',
          entryValidatedAt: v.entryValidatedAt,
          entryValidatedBy: v.entryValidatedBy,
        })),
        ...organizerValidations.map((v) => ({
          id: v.id,
          type: 'organizer' as const,
          firstName: v.organizer.user.prenom,
          lastName: v.organizer.user.nom,
          email: v.organizer.user.email,
          name: v.organizer.title || 'Organisateur',
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
      const validationsWithValidators = allValidations.map((v) => {
        const validator = v.entryValidatedBy ? validatorMap.get(v.entryValidatedBy) : null
        return {
          ...v,
          validator: validator
            ? {
                id: validator.id,
                pseudo: validator.pseudo,
                prenom: validator.prenom,
                nom: validator.nom,
                email: validator.email,
                emailHash: getEmailHash(validator.email),
              }
            : null,
        }
      })

      return {
        success: true,
        validations: validationsWithValidators,
      }
    } catch (error: unknown) {
      console.error('Database recent validations error:', error)
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des validations',
      })
    }
  },
  { operationName: 'GET ticketing recent-validations' }
)
