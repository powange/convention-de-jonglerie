import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

const bodySchema = z.object({
  returnableItemId: z.number(),
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
        message: 'Droits insuffisants pour gérer les articles à restituer',
      })

    const body = bodySchema.parse(await readBody(event))

    try {
      // Vérifier que l'article à restituer existe et appartient à l'édition
      const returnableItem = await prisma.ticketingReturnableItem.findFirst({
        where: {
          id: body.returnableItemId,
          editionId,
        },
      })

      if (!returnableItem) {
        throw createError({
          status: 404,
          message: 'Article à restituer introuvable',
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
      const existing = await prisma.editionOrganizerReturnableItem.findFirst({
        where: {
          editionId,
          returnableItemId: body.returnableItemId,
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
      const item = await prisma.editionOrganizerReturnableItem.create({
        data: {
          editionId,
          returnableItemId: body.returnableItemId,
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
          returnableItemId: item.returnableItemId,
          returnableItemName: returnableItem.name,
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
  { operationName: 'POST ticketing organizers returnable-items index' }
)
