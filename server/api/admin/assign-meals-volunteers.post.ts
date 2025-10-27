import { requireGlobalAdmin } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { createVolunteerMealSelections } from '@@/server/utils/volunteer-meals'

/**
 * API pour assigner automatiquement les repas aux bénévoles acceptés
 * Réservé aux administrateurs uniquement
 */
export default defineEventHandler(async (event) => {
  // Vérifier que l'utilisateur est administrateur
  requireGlobalAdmin(event)

  try {
    // Récupérer tous les bénévoles avec statut ACCEPTED
    const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
      where: {
        status: 'ACCEPTED',
      },
      select: {
        id: true,
        editionId: true,
        user: {
          select: {
            pseudo: true,
            email: true,
          },
        },
        edition: {
          select: {
            name: true,
            convention: {
              select: {
                name: true,
              },
            },
          },
        },
        mealSelections: {
          select: {
            id: true,
          },
        },
      },
    })

    // Filtrer ceux qui n'ont aucune sélection de repas
    const volunteersWithoutMeals = acceptedVolunteers.filter((v) => v.mealSelections.length === 0)

    if (volunteersWithoutMeals.length === 0) {
      return {
        success: true,
        message: 'Tous les bénévoles acceptés ont déjà des sélections de repas',
        stats: {
          total: acceptedVolunteers.length,
          processed: 0,
          success: 0,
          errors: 0,
        },
        volunteers: [],
      }
    }

    const results: Array<{
      volunteerId: number
      editionId: number
      userName: string
      userEmail: string
      editionName: string
      success: boolean
      error?: string
    }> = []

    let successCount = 0
    let errorCount = 0

    // Traiter chaque bénévole
    for (const volunteer of volunteersWithoutMeals) {
      const editionName = volunteer.edition.name
        ? `${volunteer.edition.convention.name} - ${volunteer.edition.name}`
        : volunteer.edition.convention.name

      try {
        await createVolunteerMealSelections(volunteer.id, volunteer.editionId)

        results.push({
          volunteerId: volunteer.id,
          editionId: volunteer.editionId,
          userName: volunteer.user.pseudo,
          userEmail: volunteer.user.email,
          editionName,
          success: true,
        })

        successCount++
      } catch (error: any) {
        console.error(
          `Erreur pour ${volunteer.user.pseudo} (${volunteer.user.email}):`,
          error.message
        )

        results.push({
          volunteerId: volunteer.id,
          editionId: volunteer.editionId,
          userName: volunteer.user.pseudo,
          userEmail: volunteer.user.email,
          editionName,
          success: false,
          error: error.message || 'Erreur inconnue',
        })

        errorCount++
      }
    }

    return {
      success: true,
      message: `Traitement terminé: ${successCount} succès, ${errorCount} erreurs`,
      stats: {
        total: acceptedVolunteers.length,
        processed: volunteersWithoutMeals.length,
        success: successCount,
        errors: errorCount,
      },
      volunteers: results,
    }
  } catch (error: any) {
    console.error("Erreur lors de l'assignation des repas:", error)
    throw createError({
      statusCode: 500,
      message: error.message || "Erreur lors de l'assignation des repas",
    })
  }
})
