import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

const bodySchema = z.object({
  handoutItemId: z.number(),
  organizerId: z.number().nullable().optional(), // NULL ou undefined = global, number = organisateur spécifique
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les articles à remettre',
      })

    const body = bodySchema.parse(await readBody(event))

    try {
      // Vérifier que l'article à remettre existe et appartient à l'édition
      const handoutItem = await prisma.ticketingHandoutItem.findFirst({
        where: {
          id: body.handoutItemId,
          editionId,
        },
      })

      if (!handoutItem) {
        throw createError({
          status: 404,
          message: 'Article à remettre introuvable',
        })
      }

      // Si organizerId est fourni, vérifier que l'organisateur existe
      if (body.organizerId) {
        const organizer = await prisma.editionOrganizer.findFirst({
          where: {
            id: body.organizerId,
            editionId,
          },
        })

        if (!organizer) {
          throw createError({
            status: 404,
            message: 'Organisateur introuvable',
          })
        }
      }

      // Vérifier que l'association n'existe pas déjà (même article + même scope)
      // Note: On utilise findFirst au lieu de findUnique car Prisma ne permet pas
      // d'utiliser null dans une contrainte unique composite
      const existing = await prisma.editionOrganizerHandoutItem.findFirst({
        where: {
          editionId,
          handoutItemId: body.handoutItemId,
          organizerId: body.organizerId ?? null,
        },
      })

      if (existing) {
        const scope = body.organizerId ? 'cet organisateur' : 'tous les organisateurs'
        throw createError({
          status: 400,
          message: `Cet article est déjà associé à ${scope}`,
        })
      }

      // Créer l'association
      const item = await prisma.editionOrganizerHandoutItem.create({
        data: {
          editionId,
          handoutItemId: body.handoutItemId,
          organizerId: body.organizerId ?? null,
        },
        include: {
          organizer: {
            select: {
              id: true,
              organizer: {
                select: {
                  user: {
                    select: {
                      id: true,
                      pseudo: true,
                      nom: true,
                      prenom: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      return createSuccessResponse({
        item: {
          id: item.id,
          handoutItemId: item.handoutItemId,
          handoutItemName: handoutItem.name,
          organizerId: item.organizerId,
          organizer: item.organizer
            ? {
                id: item.organizer.id,
                user: item.organizer.organizer.user,
              }
            : null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      })
    } catch (error: unknown) {
      console.error("Erreur lors de l'ajout de l'article pour organisateurs:", error)
      if (isHttpError(error)) throw error
      throw createError({
        status: 500,
        message: "Erreur lors de l'ajout de l'article",
      })
    }
  },
  { operationName: 'POST ticketing organizers handout-items index' }
)
