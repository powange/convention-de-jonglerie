import { createHash } from 'node:crypto'

import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    const artists = await prisma.editionArtist.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
            phone: true,
            authProvider: true,
          },
        },
        pickupResponsible: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            prenom: true,
            nom: true,
          },
        },
        dropoffResponsible: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            prenom: true,
            nom: true,
          },
        },
        shows: {
          include: {
            show: {
              select: {
                id: true,
                title: true,
                startDateTime: true,
                location: true,
              },
            },
          },
        },
        mealSelections: {
          include: {
            meal: {
              select: {
                id: true,
                date: true,
                mealType: true,
                phases: true,
              },
            },
          },
          orderBy: [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Ajouter le hash de l'email pour chaque artiste
    const artistsWithEmailHash = artists.map((artist) => ({
      ...artist,
      user: {
        ...artist.user,
        emailHash: createHash('md5').update(artist.user.email.toLowerCase().trim()).digest('hex'),
      },
    }))

    return {
      success: true,
      artists: artistsWithEmailHash,
    }
  },
  { operationName: 'GetArtists' }
)
