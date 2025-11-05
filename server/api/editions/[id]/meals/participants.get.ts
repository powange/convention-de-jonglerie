import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId, validatePagination } from '@@/server/utils/validation-helpers'

const DEFAULT_PAGE_SIZE = 20

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    // Paramètres de pagination et filtres
    const query = getQuery(event)
    const { page } = validatePagination(event)
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt((query.pageSize as string) || `${DEFAULT_PAGE_SIZE}`))
    )
    const search = (query.search as string)?.trim()
    const phaseFilter = query.phase as string | undefined
    const typeFilter = query.type as string | undefined
    const mealTypeFilter = query.mealType as string | undefined
    const dateFilter = query.date as string | undefined

    // Récupérer tous les repas activés avec les sélections
    const meals = await prisma.volunteerMeal.findMany({
      where: {
        editionId,
        enabled: true,
      },
      include: {
        mealSelections: {
          where: {
            accepted: true,
          },
          include: {
            volunteer: {
              include: {
                user: {
                  select: {
                    id: true,
                    nom: true,
                    prenom: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        artistMealSelections: {
          where: {
            accepted: true,
          },
          include: {
            artist: {
              include: {
                user: {
                  select: {
                    id: true,
                    nom: true,
                    prenom: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        tiers: {
          include: {
            tier: {
              include: {
                orderItems: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    customFields: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    // Construire la liste plate de tous les participants avec leurs repas
    let participants: Array<{
      userId: number | null
      nom: string
      prenom: string
      email: string
      phone: string | null
      type: 'volunteer' | 'artist' | 'participant'
      mealId: number
      mealDate: Date
      mealType: string
      mealPhases: string[]
      dietaryPreference: string | null
      allergies: string | null
      allergySeverity: string | null
      afterShow: boolean
    }> = []

    meals.forEach((meal) => {
      // Ajouter les bénévoles
      meal.mealSelections.forEach((selection) => {
        participants.push({
          userId: selection.volunteer.user.id,
          nom: selection.volunteer.user.nom,
          prenom: selection.volunteer.user.prenom,
          email: selection.volunteer.user.email,
          phone: selection.volunteer.user.phone,
          type: 'volunteer',
          mealId: meal.id,
          mealDate: meal.date,
          mealType: meal.mealType,
          mealPhases: meal.phases,
          dietaryPreference: selection.volunteer.dietaryPreference,
          allergies: selection.volunteer.allergies,
          allergySeverity: selection.volunteer.allergySeverity,
          afterShow: false,
        })
      })

      // Ajouter les artistes
      meal.artistMealSelections.forEach((selection) => {
        participants.push({
          userId: selection.artist.user.id,
          nom: selection.artist.user.nom,
          prenom: selection.artist.user.prenom,
          email: selection.artist.user.email,
          phone: selection.artist.user.phone,
          type: 'artist',
          mealId: meal.id,
          mealDate: meal.date,
          mealType: meal.mealType,
          mealPhases: meal.phases,
          dietaryPreference: selection.artist.dietaryPreference,
          allergies: selection.artist.allergies,
          allergySeverity: selection.artist.allergySeverity,
          afterShow: selection.afterShow,
        })
      })

      // Ajouter les participants avec billets (via les tiers)
      meal.tiers.forEach((tierMeal) => {
        tierMeal.tier.orderItems.forEach((orderItem) => {
          const customFields = orderItem.customFields as any
          participants.push({
            userId: null,
            nom: orderItem.lastName || '',
            prenom: orderItem.firstName || '',
            email: orderItem.email || '',
            phone: null,
            type: 'participant',
            mealId: meal.id,
            mealDate: meal.date,
            mealType: meal.mealType,
            mealPhases: meal.phases,
            dietaryPreference: customFields?.dietaryPreference || null,
            allergies: customFields?.allergies || null,
            allergySeverity: customFields?.allergySeverity || null,
            afterShow: false,
          })
        })
      })
    })

    // Appliquer les filtres
    if (search) {
      const searchLower = search.toLowerCase()
      participants = participants.filter(
        (p) =>
          p.nom?.toLowerCase().includes(searchLower) ||
          p.prenom?.toLowerCase().includes(searchLower) ||
          p.email?.toLowerCase().includes(searchLower)
      )
    }

    if (phaseFilter) {
      participants = participants.filter((p) => p.mealPhases.includes(phaseFilter))
    }

    if (typeFilter) {
      participants = participants.filter((p) => p.type === typeFilter)
    }

    if (mealTypeFilter) {
      participants = participants.filter((p) => p.mealType === mealTypeFilter)
    }

    if (dateFilter) {
      participants = participants.filter((p) => {
        const participantDate = new Date(p.mealDate).toISOString().split('T')[0]
        return participantDate === dateFilter
      })
    }

    // Trier par nom puis prénom
    participants.sort((a, b) => {
      const nameA = `${a.nom || ''} ${a.prenom || ''}`
      const nameB = `${b.nom || ''} ${b.prenom || ''}`
      return nameA.localeCompare(nameB)
    })

    // Calculer la pagination
    const total = participants.length
    const adjustedSkip = (page - 1) * pageSize
    const paginatedParticipants = participants.slice(adjustedSkip, adjustedSkip + pageSize)

    // Extraire les dates uniques disponibles pour le filtre
    const uniqueDates = Array.from(
      new Set(meals.map((meal) => new Date(meal.date).toISOString().split('T')[0]))
    ).sort()

    // Calculer les statistiques sur les participants filtrés
    const stats = {
      total: participants.length,
      volunteers: participants.filter((p) => p.type === 'volunteer').length,
      artists: participants.filter((p) => p.type === 'artist').length,
      ticketingParticipants: participants.filter((p) => p.type === 'participant').length,
      byMealType: {
        BREAKFAST: participants.filter((p) => p.mealType === 'BREAKFAST').length,
        LUNCH: participants.filter((p) => p.mealType === 'LUNCH').length,
        DINNER: participants.filter((p) => p.mealType === 'DINNER').length,
      },
      byDiet: {
        VEGETARIAN: participants.filter((p) => p.dietaryPreference === 'VEGETARIAN').length,
        VEGAN: participants.filter((p) => p.dietaryPreference === 'VEGAN').length,
        standard: participants.filter((p) => !p.dietaryPreference).length,
      },
      withAllergies: participants.filter((p) => p.allergies && p.allergies.trim() !== '').length,
      afterShow: participants.filter((p) => p.afterShow).length,
    }

    return {
      ...createPaginatedResponse(paginatedParticipants, total, page, pageSize),
      availableDates: uniqueDates,
      stats,
    }
  },
  { operationName: 'GetMealParticipants' }
)
