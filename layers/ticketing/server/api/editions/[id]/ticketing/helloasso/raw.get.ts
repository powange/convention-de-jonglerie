import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { getHelloAssoAccessToken } from '#server/utils/editions/ticketing/helloasso'
import { decrypt } from '#server/utils/encryption'

const HELLOASSO_API_URL = process.env.HELLOASSO_API_URL || 'https://api.helloasso.com'

export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est admin global (avec vérification en BDD)
    await requireGlobalAdminWithDbCheck(event)

    const editionId = validateEditionId(event)

    // Récupérer la configuration HelloAsso
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: {
        helloAssoConfig: true,
      },
    })

    if (!config || !config.helloAssoConfig) {
      throw createError({
        status: 404,
        message: 'Configuration HelloAsso introuvable',
      })
    }

    const haConfig = config.helloAssoConfig

    try {
      // Déchiffrer le client secret
      const clientSecret = decrypt(haConfig.clientSecret)

      // Obtenir un token d'accès
      const accessToken = await getHelloAssoAccessToken({
        clientId: haConfig.clientId,
        clientSecret,
      })

      // Récupérer le formulaire brut
      const formUrl = `${HELLOASSO_API_URL}/v5/organizations/${haConfig.organizationSlug}/forms/${haConfig.formType}/${haConfig.formSlug}/public`
      const formResponse = await fetch(formUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!formResponse.ok) {
        throw new Error(`HTTP ${formResponse.status}: ${await formResponse.text()}`)
      }

      const formData = await formResponse.json()

      // Récupérer les commandes brutes (première page seulement pour éviter trop de données)
      const ordersUrl = `${HELLOASSO_API_URL}/v5/organizations/${haConfig.organizationSlug}/forms/${haConfig.formType}/${haConfig.formSlug}/orders?pageIndex=1&pageSize=10&withDetails=true&withCount=true`
      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      let ordersData = null
      if (ordersResponse.ok) {
        ordersData = await ordersResponse.json()
      }

      return createSuccessResponse({
        form: formData,
        orders: ordersData,
      })
    } catch (error: unknown) {
      console.error('Failed to fetch raw HelloAsso data:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des données HelloAsso',
      })
    }
  },
  { operationName: 'GET helloasso raw data' }
)
