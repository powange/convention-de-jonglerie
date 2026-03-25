import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import {
  getInfomaniakEvent,
  getInfomaniakEventZones,
  getInfomaniakOrders,
  getInfomaniakPassCategories,
  getInfomaniakTickets,
} from '#server/utils/editions/ticketing/infomaniak'
import { decrypt } from '#server/utils/encryption'

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const editionId = validateEditionId(event)

    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: {
        infomaniakConfig: true,
      },
    })

    if (!config || !config.infomaniakConfig) {
      throw createError({
        status: 404,
        message: 'Configuration Infomaniak introuvable',
      })
    }

    const ikConfig = config.infomaniakConfig

    try {
      const apiKey = decrypt(ikConfig.apiKey)
      const apiKeyGuichet = ikConfig.apiKeyGuichet ? decrypt(ikConfig.apiKeyGuichet) : null
      const appPassword = ikConfig.applicationPassword
        ? decrypt(ikConfig.applicationPassword)
        : null
      const { currency } = ikConfig

      // Requêtes shop (clé boutique)
      const shopPromises = Promise.all([
        ikConfig.eventId
          ? getInfomaniakEvent(apiKey, ikConfig.eventId, currency)
          : Promise.resolve(null),
        ikConfig.eventId
          ? getInfomaniakEventZones(apiKey, ikConfig.eventId, currency)
          : Promise.resolve([]),
        getInfomaniakPassCategories(apiKey, currency),
      ])

      // Requêtes guichet (clé guichet + mot de passe applicatif)
      const canAccessGuichet = apiKeyGuichet && appPassword
      const guichetPromises = canAccessGuichet
        ? Promise.all([
            getInfomaniakOrders(apiKeyGuichet, appPassword, currency, { limit: 20 }).catch(
              (e: any) => ({
                error: e.message || 'Erreur lors de la récupération des commandes',
              })
            ),
            getInfomaniakTickets(apiKeyGuichet, appPassword, currency, { limit: 20 }).catch(
              (e: any) => ({
                error: e.message || 'Erreur lors de la récupération des billets',
              })
            ),
          ])
        : Promise.resolve([null, null])

      const [[eventData, zones, passCategories], [orders, tickets]] = await Promise.all([
        shopPromises,
        guichetPromises,
      ])

      return createSuccessResponse({
        event: eventData,
        zones,
        passCategories,
        orders,
        tickets,
        config: {
          currency: ikConfig.currency,
          eventId: ikConfig.eventId,
          eventName: ikConfig.eventName,
          hasGuichetKey: !!canAccessGuichet,
        },
      })
    } catch (error: any) {
      throw createError({
        status: 500,
        message: `Erreur API Infomaniak: ${error.message}`,
      })
    }
  },
  { operationName: 'GET ticketing infomaniak raw' }
)
