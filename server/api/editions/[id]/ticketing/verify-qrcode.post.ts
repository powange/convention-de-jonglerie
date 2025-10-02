import { z } from 'zod'

import { findTicketByQRCode } from '../../../../utils/editions/ticketing/helloasso'

const bodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  organizationSlug: z.string().min(1),
  formType: z.string().min(1),
  formSlug: z.string().min(1),
  qrCode: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const body = bodySchema.parse(await readBody(event))

  try {
    const result = await findTicketByQRCode(
      {
        clientId: body.clientId,
        clientSecret: body.clientSecret,
      },
      {
        organizationSlug: body.organizationSlug,
        formType: body.formType,
        formSlug: body.formSlug,
      },
      body.qrCode
    )

    if (result.found) {
      return {
        success: true,
        found: true,
        ticket: result.ticket,
        message: `Billet trouvé pour ${result.ticket?.user.firstName} ${result.ticket?.user.lastName}`,
      }
    } else {
      return {
        success: true,
        found: false,
        message: 'Aucun billet trouvé avec ce QR code',
      }
    }
  } catch (error: any) {
    console.error('HelloAsso verify QR code error:', error)
    throw error
  }
})
