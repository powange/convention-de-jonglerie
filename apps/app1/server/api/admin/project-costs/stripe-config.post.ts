import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { encrypt } from '#server/utils/encryption'

const bodySchema = z.object({
  publicKey: z.string().min(1).optional(),
  secretKey: z.string().min(1).optional(),
  webhookSecret: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const body = bodySchema.parse(await readBody(event))

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stripeConfig.findFirst()

      if (existing) {
        // Mise à jour partielle : ne chiffrer et mettre à jour que les clés fournies
        const updateData: Record<string, unknown> = {}
        if (body.publicKey) updateData.publicKey = encrypt(body.publicKey)
        if (body.secretKey) updateData.secretKey = encrypt(body.secretKey)
        if (body.webhookSecret) updateData.webhookSecret = encrypt(body.webhookSecret)
        if (body.isActive !== undefined) updateData.isActive = body.isActive

        await tx.stripeConfig.update({
          where: { id: existing.id },
          data: updateData,
        })
      } else {
        // Création : les 3 clés sont obligatoires
        if (!body.publicKey || !body.secretKey || !body.webhookSecret) {
          throw createError({
            status: 400,
            message: 'Les 3 clés Stripe sont requises pour la configuration initiale',
          })
        }
        await tx.stripeConfig.create({
          data: {
            publicKey: encrypt(body.publicKey),
            secretKey: encrypt(body.secretKey),
            webhookSecret: encrypt(body.webhookSecret),
            isActive: body.isActive ?? true,
          },
        })
      }
    })

    return createSuccessResponse({}, 'Configuration Stripe sauvegardée')
  },
  { operationName: 'POST admin stripe-config' }
)
