import { canAccessEditionData } from '../../../../utils/edition-permissions'
import { getHelloAssoTiersAndOptions } from '../../../../utils/editions/ticketing/helloasso'
import { decrypt } from '../../../../utils/encryption'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette configuration',
    })

  // Récupérer la configuration HelloAsso
  const config = await prisma.externalTicketing.findUnique({
    where: { editionId },
    include: {
      helloAssoConfig: true,
    },
  })

  if (!config || !config.helloAssoConfig) {
    throw createError({
      statusCode: 404,
      message: 'Configuration HelloAsso introuvable',
    })
  }

  const haConfig = config.helloAssoConfig

  try {
    // Déchiffrer le client secret
    const clientSecret = decrypt(haConfig.clientSecret)

    // Récupérer les tarifs et options via l'utilitaire
    const result = await getHelloAssoTiersAndOptions(
      {
        clientId: haConfig.clientId,
        clientSecret,
      },
      {
        organizationSlug: haConfig.organizationSlug,
        formType: haConfig.formType,
        formSlug: haConfig.formSlug,
      }
    )

    return result
  } catch (error: any) {
    console.error('HelloAsso tiers fetch error:', error)

    // L'utilitaire gère déjà les erreurs, on les relance simplement
    throw error
  }
})
