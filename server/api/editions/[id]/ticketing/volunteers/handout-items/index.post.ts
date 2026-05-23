import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

const bodySchema = z.object({
  handoutItemId: z.number(),
  teamId: z.string().nullable().optional(), // NULL ou undefined = global, string = équipe spécifique
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

      // Si teamId est fourni, vérifier que l'équipe existe
      if (body.teamId) {
        const team = await prisma.volunteerTeam.findFirst({
          where: {
            id: body.teamId,
            editionId,
          },
        })

        if (!team) {
          throw createError({
            status: 404,
            message: 'Équipe introuvable',
          })
        }
      }

      // Vérifier que l'association n'existe pas déjà (même article + même scope)
      // Note: On utilise findFirst au lieu de findUnique car Prisma ne permet pas
      // d'utiliser null dans une contrainte unique composite
      const existing = await prisma.editionVolunteerHandoutItem.findFirst({
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

      // Créer l'association
      const item = await prisma.editionVolunteerHandoutItem.create({
        data: {
          editionId,
          handoutItemId: body.handoutItemId,
          teamId: body.teamId ?? null,
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
