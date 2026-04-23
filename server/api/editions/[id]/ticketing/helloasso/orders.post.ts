import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { fetchOrdersFromHelloAsso } from '#server/utils/editions/ticketing/helloasso'
import { decrypt } from '#server/utils/encryption'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

// Le body ne contient plus que les paramètres de pagination.
// Les credentials HelloAsso sont chargés côté serveur depuis la BDD (chiffrés)
// pour éviter de les transmettre en clair depuis le navigateur.
const bodySchema = z.object({
  pageIndex: z.number().optional(),
  pageSize: z.number().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette configuration',
      })
    }

    const body = bodySchema.parse(await readBody(event))

    // Charger la configuration HelloAsso côté serveur (clientSecret chiffré en BDD)
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: { helloAssoConfig: true },
    })

    if (!config || !config.helloAssoConfig) {
      throw createError({
        status: 404,
        message: 'Configuration HelloAsso introuvable',
      })
    }

    const haConfig = config.helloAssoConfig

    try {
      const clientSecret = decrypt(haConfig.clientSecret)

      const result = await fetchOrdersFromHelloAsso(
        {
          clientId: haConfig.clientId,
          clientSecret,
        },
        {
          organizationSlug: haConfig.organizationSlug,
          formType: haConfig.formType,
          formSlug: haConfig.formSlug,
        },
        {
          withDetails: true,
          pageIndex: body.pageIndex,
          pageSize: body.pageSize,
        }
      )

      return createSuccessResponse({
        orders: result.data,
        pagination: result.pagination,
      })
    } catch (error: unknown) {
      console.error('HelloAsso orders error:', error)
      throw error
    }
  },
  { operationName: 'POST ticketing helloasso orders' }
)
