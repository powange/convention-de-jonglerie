import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { encrypt } from '#server/utils/encryption'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'

const bodySchema = z.object({
  provider: z.enum(['HELLOASSO', 'INFOMANIAK', 'BILLETWEB', 'WEEZEVENT', 'OTHER']),
  helloAsso: z
    .object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      organizationSlug: z.string().min(1),
      formType: z.string().min(1),
      formSlug: z.string().min(1),
    })
    .optional(),
  infomaniak: z
    .object({
      apiKey: z.string().optional(),
      apiKeyGuichet: z.string().optional(),
      applicationPassword: z.string().optional(),
      currency: z.string().default('2'),
      eventId: z.number().optional(),
      eventName: z.string().optional(),
    })
    .optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (même logique que gestion bénévoles)
    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour configurer la billeterie',
      })

    const body = bodySchema.parse(await readBody(event))

    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true },
    })

    if (!edition) throw createError({ status: 404, message: 'Edition introuvable' })

    // Vérifier si une configuration existe déjà
    const existingConfig = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: { helloAssoConfig: true },
    })

    // Si HelloAsso
    if (body.provider === 'HELLOASSO') {
      if (!body.helloAsso) {
        throw createError({
          status: 400,
          message: 'Configuration HelloAsso requise',
        })
      }

      // Chiffrer le client secret
      const encryptedSecret = encrypt(body.helloAsso.clientSecret)

      if (existingConfig) {
        // Mettre à jour la configuration existante
        const updated = await prisma.externalTicketing.update({
          where: { id: existingConfig.id },
          data: {
            provider: body.provider,
            status: 'ACTIVE',
            updatedAt: new Date(),
            helloAssoConfig: {
              upsert: {
                create: {
                  clientId: body.helloAsso.clientId,
                  clientSecret: encryptedSecret,
                  organizationSlug: body.helloAsso.organizationSlug,
                  formType: body.helloAsso.formType,
                  formSlug: body.helloAsso.formSlug,
                },
                update: {
                  clientId: body.helloAsso.clientId,
                  clientSecret: encryptedSecret,
                  organizationSlug: body.helloAsso.organizationSlug,
                  formType: body.helloAsso.formType,
                  formSlug: body.helloAsso.formSlug,
                },
              },
            },
          },
          include: {
            helloAssoConfig: {
              select: {
                id: true,
                organizationSlug: true,
                formType: true,
                formSlug: true,
                createdAt: true,
                updatedAt: true,
                // Ne pas retourner le clientSecret
              },
            },
          },
        })

        return createSuccessResponse({ config: updated }, 'Configuration HelloAsso mise à jour')
      } else {
        // Créer une nouvelle configuration
        const created = await prisma.externalTicketing.create({
          data: {
            editionId,
            provider: body.provider,
            status: 'ACTIVE',
            helloAssoConfig: {
              create: {
                clientId: body.helloAsso.clientId,
                clientSecret: encryptedSecret,
                organizationSlug: body.helloAsso.organizationSlug,
                formType: body.helloAsso.formType,
                formSlug: body.helloAsso.formSlug,
              },
            },
          },
          include: {
            helloAssoConfig: {
              select: {
                id: true,
                organizationSlug: true,
                formType: true,
                formSlug: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        })

        return createSuccessResponse({ config: created }, 'Configuration HelloAsso créée')
      }
    }

    // Infomaniak
    if (body.provider === 'INFOMANIAK') {
      if (!body.infomaniak) {
        throw createError({
          status: 400,
          message: 'Configuration Infomaniak requise',
        })
      }

      // La clé API est obligatoire pour une nouvelle configuration
      if (!existingConfig && !body.infomaniak.apiKey) {
        throw createError({
          status: 400,
          message: 'Clé API requise pour une nouvelle configuration Infomaniak',
        })
      }

      const encryptedApiKey = body.infomaniak.apiKey ? encrypt(body.infomaniak.apiKey) : undefined
      const encryptedApiKeyGuichet = body.infomaniak.apiKeyGuichet
        ? encrypt(body.infomaniak.apiKeyGuichet)
        : undefined // undefined = ne pas modifier la valeur existante
      const encryptedAppPassword = body.infomaniak.applicationPassword
        ? encrypt(body.infomaniak.applicationPassword)
        : undefined

      if (existingConfig) {
        const updateData: Record<string, unknown> = {
          currency: body.infomaniak.currency,
          eventId: body.infomaniak.eventId,
          eventName: body.infomaniak.eventName,
        }
        // Ne mettre à jour les clés que si elles sont fournies
        if (encryptedApiKey !== undefined) {
          updateData.apiKey = encryptedApiKey
        }
        if (encryptedApiKeyGuichet !== undefined) {
          updateData.apiKeyGuichet = encryptedApiKeyGuichet
        }
        if (encryptedAppPassword !== undefined) {
          updateData.applicationPassword = encryptedAppPassword
        }

        const updated = await prisma.externalTicketing.update({
          where: { id: existingConfig.id },
          data: {
            provider: body.provider,
            status: 'ACTIVE',
            updatedAt: new Date(),
            infomaniakConfig: {
              upsert: {
                create: {
                  apiKey: encryptedApiKey ?? '',
                  apiKeyGuichet: encryptedApiKeyGuichet ?? null,
                  applicationPassword: encryptedAppPassword ?? null,
                  currency: body.infomaniak.currency,
                  eventId: body.infomaniak.eventId,
                  eventName: body.infomaniak.eventName,
                },
                update: updateData,
              },
            },
          },
          include: {
            infomaniakConfig: {
              select: {
                id: true,
                currency: true,
                eventId: true,
                eventName: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        })

        return createSuccessResponse({ config: updated }, 'Configuration Infomaniak mise à jour')
      } else {
        const created = await prisma.externalTicketing.create({
          data: {
            editionId,
            provider: body.provider,
            status: 'ACTIVE',
            infomaniakConfig: {
              create: {
                apiKey: encryptedApiKey!, // Garanti non-undefined par la validation ci-dessus
                apiKeyGuichet: encryptedApiKeyGuichet ?? null,
                applicationPassword: encryptedAppPassword ?? null,
                currency: body.infomaniak.currency,
                eventId: body.infomaniak.eventId,
                eventName: body.infomaniak.eventName,
              },
            },
          },
          include: {
            infomaniakConfig: {
              select: {
                id: true,
                currency: true,
                eventId: true,
                eventName: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        })

        return createSuccessResponse({ config: created }, 'Configuration Infomaniak créée')
      }
    }

    // Autres providers (à implémenter)
    throw createError({
      status: 400,
      message: 'Provider non supporté pour le moment',
    })
  },
  { operationName: 'POST ticketing external index' }
)
