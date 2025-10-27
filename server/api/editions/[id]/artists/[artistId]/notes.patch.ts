import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  organizerNotes: z.string().nullable(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const artistId = parseInt(getRouterParam(event, 'artistId') || '0')

  if (!editionId || !artistId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: "Droits insuffisants pour modifier les notes de l'organisateur",
    })
  }

  const body = bodySchema.parse(await readBody(event))

  try {
    // Vérifier que l'artiste appartient bien à cette édition
    const artist = await prisma.editionArtist.findFirst({
      where: {
        id: artistId,
        editionId,
      },
    })

    if (!artist) {
      throw createError({
        statusCode: 404,
        message: 'Artiste introuvable pour cette édition',
      })
    }

    // Mettre à jour les notes
    const updatedArtist = await prisma.editionArtist.update({
      where: {
        id: artistId,
      },
      data: {
        organizerNotes: body.organizerNotes,
      },
    })

    return {
      success: true,
      artist: updatedArtist,
    }
  } catch (error: unknown) {
    console.error('Error updating organizer notes:', error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la mise à jour des notes de l'organisateur",
    })
  }
})
