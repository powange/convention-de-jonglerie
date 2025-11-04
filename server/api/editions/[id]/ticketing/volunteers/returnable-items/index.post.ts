import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  returnableItemId: z.number(),
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
      statusCode: 403,
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
        statusCode: 404,
        message: 'Article à restituer introuvable',
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
          statusCode: 404,
          message: 'Équipe introuvable',
        })
      }
    }

    // Vérifier que l'association n'existe pas déjà (même article + même scope)
    // Note: On utilise findFirst au lieu de findUnique car Prisma ne permet pas
    // d'utiliser null dans une contrainte unique composite
    const existing = await prisma.editionVolunteerReturnableItem.findFirst({
      where: {
        editionId,
        returnableItemId: body.returnableItemId,
        teamId: body.teamId ?? null,
      },
    })

    if (existing) {
      const scope = body.teamId ? 'cette équipe' : 'tous les bénévoles'
      throw createError({
        statusCode: 400,
        message: `Cet article est déjà associé à ${scope}`,
      })
    }

    // Créer l'association
    const item = await prisma.editionVolunteerReturnableItem.create({
      data: {
        editionId,
        returnableItemId: body.returnableItemId,
        teamId: body.teamId ?? null,
      },
      include: {
        returnableItem: true,
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    return {
      success: true,
      item: {
        id: item.id,
        returnableItemId: item.returnableItemId,
        teamId: item.teamId,
        name: item.returnableItem.name,
        team: item.team,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    }
  } catch (error: unknown) {
    console.error("Erreur lors de l'ajout de l'article pour bénévoles:", error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'ajout de l'article",
    })
  }
  },
  { operationName: 'POST ticketing volunteers returnable-items index' }
)
