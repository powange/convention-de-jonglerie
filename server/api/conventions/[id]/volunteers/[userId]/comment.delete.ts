import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { handleValidationError } from '#server/utils/validation-schemas'

const paramsSchema = z.object({
  id: z.string().transform(Number),
  userId: z.string().transform(Number),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = await requireAuth(event)

  // Valider les paramètres
  const parseResult = paramsSchema.safeParse(event.context.params)
  if (!parseResult.success) {
    handleValidationError(parseResult.error)
  }

  const { id: editionId, userId } = parseResult.data

  // Récupérer l'édition avec la convention
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          organizers: {
            where: { userId: user.id },
          },
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      status: 404,
      statusText: 'Édition non trouvée',
    })
  }

  // Vérifier que l'utilisateur est organisateur ou auteur de la convention
  const isAuthor = edition.convention.authorId === user.id
  const isOrganizer = edition.convention.organizers.length > 0

  if (!isAuthor && !isOrganizer && !user.isGlobalAdmin) {
    throw createError({
      status: 403,
      statusText: "Vous n'avez pas les permissions nécessaires",
    })
  }

  // Supprimer le commentaire s'il existe
  try {
    await prisma.volunteerComment.delete({
      where: {
        userId_editionId: {
          userId,
          editionId,
        },
      },
    })
  } catch {
    // Si le commentaire n'existe pas, on ignore l'erreur
  }

  return {
    success: true,
  }
})
