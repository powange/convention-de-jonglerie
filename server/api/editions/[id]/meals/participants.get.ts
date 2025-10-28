import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

const DEFAULT_PAGE_SIZE = 20

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })
  }

  // Paramètres de pagination et filtres
  const query = getQuery(event)
  const page = Math.max(1, parseInt((query.page as string) || '1'))
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((query.pageSize as string) || `${DEFAULT_PAGE_SIZE}`))
  )
  const search = (query.search as string)?.trim()
  const phaseFilter = query.phase as string | undefined
  const typeFilter = query.type as string | undefined

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
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })

  // Construire la liste plate de tous les participants avec leurs repas
  let participants: Array<{
    userId: number
    nom: string
    prenom: string
    email: string
    phone: string | null
    type: 'volunteer' | 'artist'
    mealId: number
    mealDate: Date
    mealType: string
    mealPhase: string
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
        mealPhase: meal.phase,
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
        mealPhase: meal.phase,
        dietaryPreference: selection.artist.dietaryPreference,
        allergies: selection.artist.allergies,
        allergySeverity: selection.artist.allergySeverity,
        afterShow: selection.afterShow,
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
    participants = participants.filter((p) => p.mealPhase === phaseFilter)
  }

  if (typeFilter) {
    participants = participants.filter((p) => p.type === typeFilter)
  }

  // Trier par nom puis prénom
  participants.sort((a, b) => {
    const nameA = `${a.nom || ''} ${a.prenom || ''}`
    const nameB = `${b.nom || ''} ${b.prenom || ''}`
    return nameA.localeCompare(nameB)
  })

  // Calculer la pagination
  const total = participants.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const skip = (page - 1) * pageSize
  const paginatedParticipants = participants.slice(skip, skip + pageSize)

  return {
    success: true,
    participants: paginatedParticipants,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  }
})
