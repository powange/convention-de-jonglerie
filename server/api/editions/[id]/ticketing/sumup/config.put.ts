import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { encrypt } from '#server/utils/encryption'
import { canManageTicketing } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  affiliateKey: z
    .string()
    .trim()
    .min(1, "La clé d'affiliation SumUp est requise")
    .max(200, "La clé d'affiliation est trop longue"),
  appId: z
    .string()
    .trim()
    .min(1, "L'App ID SumUp est requis")
    .max(128, "L'App ID est trop long")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "L'App ID ne peut contenir que des lettres, chiffres, points, tirets et underscores"
    ),
})

/**
 * PUT /api/editions/[id]/ticketing/sumup/config
 *
 * Crée ou met à jour la config SumUp d'une édition (upsert).
 * - `affiliateKey` est chiffrée (AES-256-GCM) avant stockage
 * - `appId` est stocké en clair (pas un secret)
 * - Accessible uniquement aux organisateurs avec droit de gestion billetterie
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event).catch(() => ({}))
    let parsed: z.infer<typeof bodySchema>
    try {
      parsed = bodySchema.parse(body || {})
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
      select: {
        id: true,
        convention: {
          include: {
            organizers: { where: { userId: user.id } },
          },
        },
        organizerPermissions: {
          where: { organizer: { userId: user.id } },
          include: { organizer: { select: { userId: true } } },
        },
      },
    })

    if (!canManageTicketing(edition, user)) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer la billetterie',
      })
    }

    const encryptedKey = encrypt(parsed.affiliateKey)

    const config = await prisma.sumupConfig.upsert({
      where: { editionId },
      create: {
        editionId,
        affiliateKey: encryptedKey,
        appId: parsed.appId,
      },
      update: {
        affiliateKey: encryptedKey,
        appId: parsed.appId,
      },
    })

    return createSuccessResponse({
      config: {
        affiliateKey: parsed.affiliateKey,
        appId: config.appId,
        updatedAt: config.updatedAt,
      },
    })
  },
  { operationName: 'UpdateSumupConfig' }
)
