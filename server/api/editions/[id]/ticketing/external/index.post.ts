import { z } from 'zod'

import { requireAuth } from '../../../../../utils/auth-utils'
import { canManageEditionVolunteers } from '../../../../../utils/collaborator-management'
import { encrypt } from '../../../../../utils/encryption'
import { prisma } from '../../../../../utils/prisma'

const bodySchema = z.object({
  provider: z.enum(['HELLOASSO', 'BILLETWEB', 'WEEZEVENT', 'OTHER']),
  helloAsso: z
    .object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      organizationSlug: z.string().min(1),
      formType: z.string().min(1),
      formSlug: z.string().min(1),
    })
    .optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions (même logique que gestion bénévoles)
  const allowed = await canManageEditionVolunteers(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour configurer la billeterie',
    })

  const body = bodySchema.parse(await readBody(event))

  // Vérifier que l'édition existe
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { id: true },
  })

  if (!edition) throw createError({ statusCode: 404, message: 'Edition introuvable' })

  // Vérifier si une configuration existe déjà
  const existingConfig = await prisma.externalTicketing.findUnique({
    where: { editionId },
    include: { helloAssoConfig: true },
  })

  // Si HelloAsso
  if (body.provider === 'HELLOASSO') {
    if (!body.helloAsso) {
      throw createError({
        statusCode: 400,
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

      return {
        success: true,
        message: 'Configuration HelloAsso mise à jour',
        config: updated,
      }
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

      return {
        success: true,
        message: 'Configuration HelloAsso créée',
        config: created,
      }
    }
  }

  // Autres providers (à implémenter)
  throw createError({
    statusCode: 400,
    message: 'Provider non supporté pour le moment',
  })
})
