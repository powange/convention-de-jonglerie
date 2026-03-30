import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { testHelloAssoConnection } from '#server/utils/editions/ticketing/helloasso'
import { decrypt } from '#server/utils/encryption'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  organizationSlug: z.string().min(1),
  formType: z.string().min(1),
  formSlug: z.string().min(1),
})

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    const editionId = validateEditionId(event)

    const body = bodySchema.parse(await readBody(event))

    // Si pas de clientSecret fourni, récupérer le secret chiffré en base
    let clientSecret = body.clientSecret
    if (!clientSecret) {
      const existingConfig = await prisma.helloAssoConfig.findFirst({
        where: { externalTicketing: { editionId } },
        select: { clientSecret: true },
      })
      if (!existingConfig) {
        throw createError({
          status: 400,
          message: 'Client Secret requis (aucune configuration existante)',
        })
      }
      clientSecret = decrypt(existingConfig.clientSecret)
    }

    try {
      const result = await testHelloAssoConnection(
        {
          clientId: body.clientId,
          clientSecret,
        },
        {
          organizationSlug: body.organizationSlug,
          formType: body.formType,
          formSlug: body.formSlug,
        }
      )

      return createSuccessResponse(result, 'Connexion réussie')
    } catch (error: unknown) {
      console.error('HelloAsso test error:', error)

      // L'utilitaire gère déjà les erreurs, on les relance simplement
      throw error
    }
  },
  { operationName: 'POST ticketing helloasso test' }
)
