import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions de gestion de la billetterie
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour supprimer la configuration de billeterie',
      })

    // Vérifier si une configuration existe
    const existingConfig = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: { helloAssoConfig: true },
    })

    if (!existingConfig) {
      throw createError({ status: 404, message: 'Aucune configuration de billeterie trouvée' })
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

    return createSuccessResponse(null, 'Configuration de billeterie supprimée')
  },
  { operationName: 'DELETE ticketing external index' }
)
