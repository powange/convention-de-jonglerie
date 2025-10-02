import { canManageEditionVolunteers } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions (même logique que gestion bénévoles)
  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour supprimer la configuration de billeterie',
    })

  // Vérifier si une configuration existe
  const existingConfig = await prisma.externalTicketing.findUnique({
    where: { editionId },
    include: { helloAssoConfig: true },
  })

  if (!existingConfig) {
    throw createError({ statusCode: 404, message: 'Aucune configuration de billeterie trouvée' })
  }

  // Supprimer la configuration HelloAsso si elle existe
  if (existingConfig.helloAssoConfig) {
    await prisma.helloAssoConfig.delete({
      where: { id: existingConfig.helloAssoConfig.id },
    })
  }

  // Supprimer la configuration principale
  await prisma.externalTicketing.delete({
    where: { id: existingConfig.id },
  })

  return {
    success: true,
    message: 'Configuration de billeterie supprimée',
  }
})
