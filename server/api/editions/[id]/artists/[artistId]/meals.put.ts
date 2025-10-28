import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const artistId = parseInt(getRouterParam(event, 'artistId') || '0')

  if (!editionId || !artistId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  const body = await readBody(event)

  // Valider le body
  if (!body.selections || !Array.isArray(body.selections)) {
    throw createError({
      statusCode: 400,
      message: 'Format de données invalide',
    })
  }

  try {
    // Vérifier que l'utilisateur a les permissions pour éditer cette édition
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            collaborators: true,
          },
        },
        collaboratorPermissions: {
          include: {
            collaborator: true,
          },
        },
      },
    })

    if (!edition) {
      throw createError({ statusCode: 404, message: 'Édition introuvable' })
    }

    if (!canEditEdition(edition, user)) {
      throw createError({
        statusCode: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    // Vérifier que l'artiste existe
    const artist = await prisma.editionArtist.findUnique({
      where: {
        id: artistId,
        editionId,
      },
    })

    if (!artist) {
      throw createError({
        statusCode: 404,
        message: 'Artiste introuvable',
      })
    }

    // Mettre à jour les sélections
    const updatePromises = body.selections.map((selection: any) => {
      if (!selection.selectionId) {
        throw createError({
          statusCode: 400,
          message: 'ID de sélection manquant',
        })
      }

      return prisma.artistMealSelection.update({
        where: {
          id: selection.selectionId,
          artistId: artist.id, // Sécurité : vérifier que la sélection appartient à cet artiste
        },
        data: {
          accepted: selection.accepted ?? undefined,
          afterShow: selection.afterShow ?? undefined,
        },
      })
    })

    await Promise.all(updatePromises)

    // Récupérer toutes les sélections mises à jour avec les repas associés
    const updatedSelections = await prisma.artistMealSelection.findMany({
      where: {
        artistId: artist.id,
      },
      include: {
        meal: true,
      },
      orderBy: [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }],
    })

    // Formater le résultat
    const mealsWithSelections = updatedSelections.map((selection) => ({
      id: selection.meal.id,
      date: selection.meal.date,
      mealType: selection.meal.mealType,
      phase: selection.meal.phase,
      selectionId: selection.id,
      accepted: selection.accepted,
      afterShow: selection.afterShow,
    }))

    return {
      success: true,
      meals: mealsWithSelections,
    }
  } catch (error: unknown) {
    console.error('Failed to update artist meal selections:', error)

    // Propager les erreurs HTTP existantes
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la mise à jour des repas',
    })
  }
})
