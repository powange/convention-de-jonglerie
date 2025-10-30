import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const targetDate = getRouterParam(event, 'date') || ''

  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })
  if (!targetDate) throw createError({ statusCode: 400, message: 'Date invalide' })

  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })
  }

  // Récupérer les repas configurés pour cette date
  const meals = await prisma.volunteerMeal.findMany({
    where: {
      editionId,
      date: new Date(targetDate),
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
                where: {
                  state: 'Processed',
                },
                include: {
                  order: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      mealType: 'asc',
    },
  })

  // Construire le résultat avec un résumé et les détails par repas
  const summary = {
    totalMeals: meals.length,
    mealCounts: {} as Record<string, { total: number; phases: string[] }>,
    totalParticipants: 0,
    dietaryCounts: {} as Record<string, number>,
    allergies: [] as Array<{
      participantName: string
      participantType: 'volunteer' | 'artist'
      allergies: string
      allergySeverity: string | null
      emergencyContactName?: string | null
      emergencyContactPhone?: string | null
    }>,
  }

  const mealDetails = meals.map((meal) => {
    const volunteers = meal.mealSelections.map((selection) => ({
      type: 'volunteer' as const,
      nom: selection.volunteer.user.nom,
      prenom: selection.volunteer.user.prenom,
      email: selection.volunteer.user.email,
      phone: selection.volunteer.user.phone,
      dietaryPreference: selection.volunteer.dietaryPreference,
      allergies: selection.volunteer.allergies,
      allergySeverity: selection.volunteer.allergySeverity,
      emergencyContactName: selection.volunteer.emergencyContactName,
      emergencyContactPhone: selection.volunteer.emergencyContactPhone,
    }))

    const artists = meal.artistMealSelections.map((selection) => ({
      type: 'artist' as const,
      nom: selection.artist.user.nom,
      prenom: selection.artist.user.prenom,
      email: selection.artist.user.email,
      phone: selection.artist.user.phone,
      dietaryPreference: selection.artist.dietaryPreference,
      allergies: selection.artist.allergies,
      allergySeverity: selection.artist.allergySeverity,
      emergencyContactName: null,
      emergencyContactPhone: null,
      afterShow: selection.afterShow,
    }))

    // Récupérer les participants via les tarifs avec repas
    const ticketParticipants = meal.tiers.flatMap((tierMeal) =>
      tierMeal.tier.orderItems.map((orderItem) => ({
        type: 'ticket' as const,
        nom: orderItem.lastName || orderItem.order.payerLastName || '',
        prenom: orderItem.firstName || orderItem.order.payerFirstName || '',
        email: orderItem.email || orderItem.order.payerEmail || '',
        phone: '',
        dietaryPreference: null,
        allergies: null,
        allergySeverity: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
      }))
    )

    const allParticipants = [...volunteers, ...artists, ...ticketParticipants].sort((a, b) => {
      const nameA = `${a.nom || ''} ${a.prenom || ''}`
      const nameB = `${b.nom || ''} ${b.prenom || ''}`
      return nameA.localeCompare(nameB)
    })

    // Mettre à jour le résumé
    const mealKey = `${meal.mealType}_${meal.phases.join('_')}`
    if (!summary.mealCounts[mealKey]) {
      summary.mealCounts[mealKey] = { total: 0, phases: meal.phases }
    }
    summary.mealCounts[mealKey].total += allParticipants.length
    summary.totalParticipants += allParticipants.length

    // Compter les régimes
    allParticipants.forEach((p) => {
      const diet = p.dietaryPreference || 'NONE'
      summary.dietaryCounts[diet] = (summary.dietaryCounts[diet] || 0) + 1

      // Ajouter les allergies au résumé
      if (p.allergies && p.allergies.trim()) {
        summary.allergies.push({
          participantName: `${p.prenom || ''} ${p.nom || ''}`.trim(),
          participantType: p.type,
          allergies: p.allergies,
          allergySeverity: p.allergySeverity,
          emergencyContactName: p.emergencyContactName,
          emergencyContactPhone: p.emergencyContactPhone,
        })
      }
    })

    return {
      mealId: meal.id,
      mealType: meal.mealType,
      phases: meal.phases,
      totalParticipants: allParticipants.length,
      volunteerCount: volunteers.length,
      artistCount: artists.length,
      ticketParticipantCount: ticketParticipants.length,
      participants: allParticipants,
    }
  })

  return {
    date: targetDate,
    summary,
    meals: mealDetails,
  }
})
