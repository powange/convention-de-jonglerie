import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { exigerArticlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'

const bodySchema = z.object({
  handoutItemId: z.number(),
  /** Nombre d'exemplaires remis pour cette association */
  quantity: z.number().int().min(1).max(999).optional(),
  organizerId: z.number().nullable().optional(), // NULL ou undefined = global, number = organisateur spécifique
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les articles à remettre',
      })

    // La fonctionnalité éteinte refuse les écritures. Après le contrôle des droits : qui n'a
    // pas le droit d'être là ne doit pas apprendre au passage ce que l'édition a activé.
    await exigerArticlesARemettreActifs(editionId)

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

      /*
       * Vérification puis création, dans une même transaction et derrière un verrou de ligne.
       *
       * L'index unique `(editionId, handoutItemId, organizerId)` NE PROTÈGE PAS la portée
       * globale : sous MySQL, deux NULL sont considérés comme distincts. Le schéma le signale
       * déjà pour les quotas — « c'est l'écriture qui doit l'empêcher ».
       *
       * Sans verrou, deux requêtes simultanées passaient ensemble la vérification et créaient un
       * doublon, qui aurait doublé la quantité remise à TOUS les organisateurs. Le verrou porte
       * sur la ligne de l'article : deux écritures sur des articles différents ne se gênent pas.
       *
       * Même motif que la messagerie, le covoiturage et le matériel ; Prisma ne l'exprime qu'en
       * SQL brut.
       */
      const item = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM TicketingHandoutItem WHERE id = ${body.handoutItemId} FOR UPDATE`

        // `findFirst` et non `findUnique` : Prisma n'accepte pas un NULL dans une contrainte
        // unique composite.
        const existing = await tx.editionOrganizerHandoutItem.findFirst({
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

        return tx.editionOrganizerHandoutItem.create({
          data: {
            editionId,
            handoutItemId: body.handoutItemId,
            organizerId: body.organizerId ?? null,
            quantity: body.quantity ?? 1,
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
      })

      return createSuccessResponse({
        item: {
          id: item.id,
          handoutItemId: item.handoutItemId,
          handoutItemName: handoutItem.name,
          quantity: item.quantity,
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
