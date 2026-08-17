import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'
import { validateAndSanitize } from '#server/utils/validation-schemas'

const resolveSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']),
  // Note interne de l'équipe : jamais renvoyée à l'auteur du retour.
  adminNotes: z
    .string()
    .max(2000, 'Les notes admin ne peuvent pas dépasser 2000 caractères')
    .optional(),
  // Réponse adressée à l'auteur, visible sur son suivi.
  adminReply: z
    .string()
    .max(5000, 'La réponse ne peut pas dépasser 5000 caractères')
    .optional()
    .or(z.literal('')),
})

const messagesParStatut: Record<string, string> = {
  NEW: 'Feedback remis en attente',
  IN_PROGRESS: 'Feedback marqué en cours de traitement',
  RESOLVED: 'Feedback marqué comme résolu',
  REJECTED: 'Feedback marqué comme rejeté',
}

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)
    const feedbackId = validateResourceId(event, 'id', 'feedback')

    const body = await readBody(event)
    const validatedData = validateAndSanitize(resolveSchema, body)
    const { status, adminNotes, adminReply } = validatedData

    // Vérifier que le feedback existe
    const existant = await fetchResourceOrFail(prisma.feedback, feedbackId, {
      errorMessage: 'Feedback introuvable',
    })

    // Une réponse vide efface la réponse précédente ; `repliedAt` suit le texte affiché à
    // l'auteur, et n'est donc daté à nouveau que si celui-ci change réellement.
    const reponse = adminReply?.trim() ? adminReply : null
    const reponseModifiee = reponse !== (existant.adminReply ?? null)

    // Mettre à jour le feedback
    const updatedFeedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status,
        adminNotes,
        adminReply: reponse,
        ...(reponseModifiee && { repliedAt: reponse ? new Date() : null }),
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
      },
    })

    return createSuccessResponse({ feedback: updatedFeedback }, messagesParStatut[status])
  },
  { operationName: 'ResolveFeedback' }
)
