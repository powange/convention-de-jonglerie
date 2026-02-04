import { requireAuth } from '@@/server/utils/auth-utils'
import { handleValidationError } from '@@/server/utils/validation-schemas'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().transform(Number),
  userId: z.string().transform(Number),
})

const bodySchema = z.object({
  content: z.string().min(1, 'Le commentaire ne peut pas être vide').max(5000),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = await requireAuth(event)

  // Valider les paramètres
  const parseParamsResult = paramsSchema.safeParse(event.context.params)
  if (!parseParamsResult.success) {
    handleValidationError(parseParamsResult.error)
  }

  const { id: editionId, userId } = parseParamsResult.data

  // Valider le body
  const body = await readBody(event)
  const parseBodyResult = bodySchema.safeParse(body)
  if (!parseBodyResult.success) {
    handleValidationError(parseBodyResult.error)
  }

  const { content } = parseBodyResult.data

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
      statusMessage: 'Édition non trouvée',
    })
  }

  // Vérifier que l'utilisateur est organisateur ou auteur de la convention
  const isAuthor = edition.convention.authorId === user.id
  const isOrganizer = edition.convention.organizers.length > 0

  if (!isAuthor && !isOrganizer && !user.isGlobalAdmin) {
    throw createError({
      status: 403,
      statusMessage: "Vous n'avez pas les permissions nécessaires",
    })
  }

  // Vérifier que le bénévole existe
  const volunteer = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!volunteer) {
    throw createError({
      status: 404,
      statusMessage: 'Bénévole non trouvé',
    })
  }

  // Créer ou mettre à jour le commentaire
  const comment = await prisma.volunteerComment.upsert({
    where: {
      userId_editionId: {
        userId,
        editionId,
      },
    },
    create: {
      userId,
      editionId,
      content,
    },
    update: {
      content,
    },
  })

  return {
    comment,
  }
})
