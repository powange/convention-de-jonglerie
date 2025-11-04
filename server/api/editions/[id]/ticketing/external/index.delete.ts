import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/collaborator-management'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
  const user = requireAuth(event)

  const editionId = validateEditionId(event)

  // Vérifier les permissions (même logique que gestion bénévoles)
  const allowed = await canManageEditionVolunteers(editionId, user.id, event)
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
  },
  { operationName: 'DELETE ticketing external index' }
)
