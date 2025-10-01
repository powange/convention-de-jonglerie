import { z } from 'zod'

import { testHelloAssoConnection } from '../../../../utils/editions/ticketing/helloasso'

const bodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  organizationSlug: z.string().min(1),
  formType: z.string().min(1),
  formSlug: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

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
