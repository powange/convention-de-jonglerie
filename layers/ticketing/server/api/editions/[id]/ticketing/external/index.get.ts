import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette configuration',
      })

    // Récupérer la configuration (sans le clientSecret)
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: {
        helloAssoConfig: {
          select: {
            id: true,
            clientId: true,
            organizationSlug: true,
            formType: true,
            formSlug: true,
            createdAt: true,
            updatedAt: true,
            // Ne pas retourner clientSecret
          },
        },
        infomaniakConfig: {
          select: {
            id: true,
            currency: true,
            eventId: true,
            eventName: true,
            createdAt: true,
            updatedAt: true,
            // Ne pas retourner apiKey, apiKeyGuichet, applicationPassword
          },
        },
      },
    })

    if (!config) {
      return createSuccessResponse({
        hasConfig: false,
        config: null,
      })
    }

    // Vérifier l'existence des clés guichet séparément (sans les exposer)
    let hasGuichetKey = false
    let hasApplicationPassword = false
    if (config.infomaniakConfig) {
      const keyCheck = await prisma.infomaniakConfig.findUnique({
        where: { id: config.infomaniakConfig.id },
        select: {
          apiKeyGuichet: true,
          applicationPassword: true,
        },
      })
      hasGuichetKey = !!keyCheck?.apiKeyGuichet
      hasApplicationPassword = !!keyCheck?.applicationPassword
    }

    return createSuccessResponse({
      hasConfig: true,
      config: {
        ...config,
        infomaniakConfig: config.infomaniakConfig
          ? { ...config.infomaniakConfig, hasGuichetKey, hasApplicationPassword }
          : null,
      },
    })
  },
  { operationName: 'GET ticketing external index' }
)
