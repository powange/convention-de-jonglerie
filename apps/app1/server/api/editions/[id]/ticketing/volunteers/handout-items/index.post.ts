import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { exigerArticlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'

const bodySchema = z.object({
  handoutItemId: z.number(),
  /** Nombre d'exemplaires remis pour cette association */
  quantity: z.number().int().min(1).max(999).optional(),
  teamId: z.string().nullable().optional(), // NULL ou undefined = global, string = équipe spécifique
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

      // Si teamId est fourni, vérifier que l'équipe existe
      if (body.teamId) {
        const team = await prisma.volunteerTeam.findFirst({
          where: {
            id: body.teamId,
            eventId: editionId,
          },
        })

        if (!team) {
          throw createError({
            status: 404,
            message: 'Équipe introuvable',
          })
        }
      }

      /*
       * Vérification puis création, dans une même transaction et derrière un verrou de ligne.
       *
       * L'index unique `(editionId, handoutItemId, teamId)` NE PROTÈGE PAS la portée globale :
       * sous MySQL, deux NULL sont considérés comme distincts, et `(edition, article, NULL)` peut
       * donc être inséré plusieurs fois. Le schéma le signale déjà pour les quotas — « c'est
       * l'écriture qui doit l'empêcher ».
       *
       * Lire puis écrire sans verrou laissait deux requêtes simultanées passer ensemble la
       * vérification et créer un doublon, qui aurait doublé la quantité remise à TOUS les
       * bénévoles. Le verrou porte sur la ligne de l'article : deux écritures sur des articles
       * différents ne se gênent pas, et c'est exactement le cas conflictuel qu'il sérialise.
       *
       * `SELECT … FOR UPDATE` est le motif déjà employé ailleurs dans le dépôt (messagerie,
       * covoiturage, matériel) ; Prisma ne l'exprime qu'en SQL brut.
       */
      const item = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM TicketingHandoutItem WHERE id = ${body.handoutItemId} FOR UPDATE`

        // `findFirst` et non `findUnique` : Prisma n'accepte pas un NULL dans une contrainte
        // unique composite.
        const existing = await tx.editionVolunteerHandoutItem.findFirst({
          where: {
            editionId,
            handoutItemId: body.handoutItemId,
            teamId: body.teamId ?? null,
          },
        })

        if (existing) {
          const scope = body.teamId ? 'cette équipe' : 'tous les bénévoles'
          throw createError({
            status: 400,
            message: `Cet article est déjà associé à ${scope}`,
          })
        }

        return tx.editionVolunteerHandoutItem.create({
          data: {
            editionId,
            handoutItemId: body.handoutItemId,
            teamId: body.teamId ?? null,
            quantity: body.quantity ?? 1,
          },
          include: {
            handoutItem: true,
            team: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        })
      })

      return createSuccessResponse({
        item: {
          id: item.id,
          handoutItemId: item.handoutItemId,
          teamId: item.teamId,
          name: item.handoutItem.name,
          team: item.team,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      })
    } catch (error: unknown) {
      console.error("Erreur lors de l'ajout de l'article pour bénévoles:", error)
      if (isHttpError(error)) throw error
      throw createError({
        status: 500,
        message: "Erreur lors de l'ajout de l'article",
      })
    }
  },
  { operationName: 'POST ticketing volunteers handout-items index' }
)
