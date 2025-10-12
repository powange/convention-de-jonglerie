import { requireAuth } from '@@/server/utils/auth-utils'
import { testHelloAssoConnection } from '@@/server/utils/editions/ticketing/helloasso'
import { z } from 'zod'

const bodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  organizationSlug: z.string().min(1),
  formType: z.string().min(1),
  formSlug: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const body = bodySchema.parse(await readBody(event))

  try {
    const result = await testHelloAssoConnection(
      {
        clientId: body.clientId,
        clientSecret: body.clientSecret,
      },
      {
        organizationSlug: body.organizationSlug,
        formType: body.formType,
        formSlug: body.formSlug,
      }
    )

    return {
      ...result,
      message: 'Connexion réussie',
    }
  } catch (error: any) {
    console.error('HelloAsso test error:', error)

    // L'utilitaire gère déjà les erreurs, on les relance simplement
    throw error
  }
})
