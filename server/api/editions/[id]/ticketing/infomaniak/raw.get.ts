import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import {
  getInfomaniakEvent,
  getInfomaniakEvents,
  getInfomaniakEventZones,
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

      // Récupérer l'événement configuré (ou la liste si pas d'événement sélectionné)
      const eventData = ikConfig.eventId
        ? await getInfomaniakEvent(apiKey, ikConfig.eventId, ikConfig.currency)
        : await getInfomaniakEvents(apiKey, ikConfig.currency)

      // Récupérer les zones et tarifs de l'événement configuré
      const zones = ikConfig.eventId
        ? await getInfomaniakEventZones(apiKey, ikConfig.eventId, ikConfig.currency)
        : []

      return createSuccessResponse({
        event: eventData,
        zones,
        config: {
          currency: ikConfig.currency,
          eventId: ikConfig.eventId,
          eventName: ikConfig.eventName,
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
