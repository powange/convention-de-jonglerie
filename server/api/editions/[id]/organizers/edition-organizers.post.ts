import { canManageEditionOrganizers } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { generateVolunteerQrCodeToken } from '@@/server/utils/token-generator'
import { z } from 'zod'

const bodySchema = z.object({
  organizerId: z.number().int().positive(),
})

export default wrapApiHandler(
  async (event) => {
    const session = await requireUserSession(event)
    const user = session.user
    const editionId = validateEditionId(event)

    const body = bodySchema.parse(await readBody(event))

    // Récupérer l'édition avec permissions
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            organizers: {
              where: {
                userId: user.id,
              },
            },
          },
        },
        organizerPermissions: {
          where: {
            organizer: {
              userId: user.id,
            },
          },
          include: {
            organizer: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Edition not found',
      })
    }

    // Vérifier les permissions
    if (!canManageEditionOrganizers(edition, user)) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour gérer les organisateurs",
      })
    }

    try {
      // Vérifier que l'organisateur appartient bien à la convention
      const conventionOrganizer = await prisma.conventionOrganizer.findFirst({
        where: {
          id: body.organizerId,
          conventionId: edition.conventionId,
        },
      })

      if (!conventionOrganizer) {
        throw createError({
          statusCode: 404,
          message: "Cet organisateur n'appartient pas à cette convention",
        })
      }

      // Vérifier qu'il n'existe pas déjà un EditionOrganizer
      const existingEditionOrganizer = await prisma.editionOrganizer.findUnique({
        where: {
          editionId_organizerId: {
            editionId: editionId,
            organizerId: body.organizerId,
          },
        },
      })

      if (existingEditionOrganizer) {
        throw createError({
          statusCode: 400,
          message: 'Cet organisateur est déjà présent sur cette édition',
        })
      }

      // Générer un token unique
      let qrCodeToken = generateVolunteerQrCodeToken()
      let isUnique = false
      let attempts = 0
      const maxAttempts = 10

      while (!isUnique && attempts < maxAttempts) {
        const existingToken = await prisma.editionOrganizer.findUnique({
          where: { qrCodeToken },
        })

        if (!existingToken) {
          isUnique = true
        } else {
          qrCodeToken = generateVolunteerQrCodeToken()
          attempts++
        }
      }

      if (!isUnique) {
        throw createError({
          statusCode: 500,
          message: 'Impossible de générer un token unique',
        })
      }

      // Créer l'EditionOrganizer
      const editionOrganizer = await prisma.editionOrganizer.create({
        data: {
          editionId: editionId,
          organizerId: body.organizerId,
          qrCodeToken,
        },
        select: {
          id: true,
          organizerId: true,
          entryValidated: true,
          entryValidatedAt: true,
          createdAt: true,
          organizer: {
            select: {
              id: true,
              title: true,
              user: {
                select: {
                  id: true,
                  pseudo: true,
                  prenom: true,
                  nom: true,
                  email: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
      })

      return {
        success: true,
        organizer: {
          id: editionOrganizer.id,
          organizerId: editionOrganizer.organizerId,
          entryValidated: editionOrganizer.entryValidated,
          entryValidatedAt: editionOrganizer.entryValidatedAt,
          createdAt: editionOrganizer.createdAt,
          title: editionOrganizer.organizer.title,
          user: {
            id: editionOrganizer.organizer.user.id,
            pseudo: editionOrganizer.organizer.user.pseudo,
            prenom: editionOrganizer.organizer.user.prenom,
            nom: editionOrganizer.organizer.user.nom,
            email: editionOrganizer.organizer.user.email,
            profilePicture: editionOrganizer.organizer.user.profilePicture,
          },
        },
        message: "Organisateur ajouté à l'édition avec succès",
      }
    } catch (error: unknown) {
      // Si c'est déjà une erreur HTTP, la relancer
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }

      console.error('Database error adding organizer to edition:', error)
      throw createError({
        statusCode: 500,
        message: "Erreur lors de l'ajout de l'organisateur à l'édition",
      })
    }
  },
  { operationName: 'POST add organizer to edition' }
)
