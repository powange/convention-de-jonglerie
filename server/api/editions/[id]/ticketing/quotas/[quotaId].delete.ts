import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const quotaId = parseInt(getRouterParam(event, 'quotaId') || '0')

  if (!editionId || !quotaId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  // Vérifier que le quota existe et appartient à cette édition
  const existingQuota = await prisma.ticketingQuota.findUnique({
    where: { id: quotaId },
  })

  if (!existingQuota) {
    throw createError({ statusCode: 404, message: 'Quota introuvable' })
  }

  if (existingQuota.editionId !== editionId) {
    throw createError({
      statusCode: 403,
      message: "Ce quota n'appartient pas à cette édition",
    })
  }

  try {
    await prisma.ticketingQuota.delete({
      where: { id: quotaId },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete quota:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la suppression du quota',
    })
  }
})
