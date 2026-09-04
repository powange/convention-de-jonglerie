import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

const updateQuotaSchema = z.object({
  title: z.string().min(1, 'Le titre est obligatoire'),
  description: z.string().optional().nullable(),
  quantity: z.number().int().positive('La quantité doit être un nombre positif'),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const quotaId = validateResourceId(event, 'quotaId', 'quota')

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    // Vérifier que le quota existe et appartient à cette édition
    const existingQuota = await prisma.ticketingQuota.findUnique({
      where: { id: quotaId },
    })

    if (!existingQuota) {
      throw createError({ status: 404, message: 'Quota introuvable' })
    }

    if (existingQuota.editionId !== editionId) {
      throw createError({
        status: 403,
        message: "Ce quota n'appartient pas à cette édition",
      })
    }

    const body = await readBody(event)
    const validation = updateQuotaSchema.safeParse(body)

    if (!validation.success) {
      throw createError({
        status: 400,
        // `issues` et non `errors` : depuis Zod 4, `errors` n'existe plus. On lisait donc
        // `undefined[0]`, et une saisie invalide levait une TypeError — l'utilisateur
        // recevait un 500 au lieu du message qui lui disait quoi corriger.
        message: validation.error.issues[0]?.message ?? 'Données invalides',
      })
    }

    try {
      const quota = await prisma.ticketingQuota.update({
        where: { id: quotaId },
        data: {
          title: validation.data.title,
          description: validation.data.description || null,
          quantity: validation.data.quantity,
        },
      })

      return createSuccessResponse(quota)
    } catch (error: unknown) {
      console.error('Failed to update quota:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la modification du quota',
      })
    }
  },
  { operationName: 'PUT ticketing quotas resource' }
)
