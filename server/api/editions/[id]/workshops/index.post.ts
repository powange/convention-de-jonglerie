import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canCreateWorkshop } from '@@/server/utils/permissions/workshop-permissions'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { workshopSchema, validateAndSanitize } from '@@/server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe et que les workshops sont activés
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      select: {
        workshopsEnabled: true,
        workshopLocationsFreeInput: true,
        startDate: true,
        endDate: true,
      },
      errorMessage: 'Édition non trouvée',
    })

    if (!edition.workshopsEnabled) {
      throw createError({
        statusCode: 403,
        message: 'Les workshops ne sont pas activés pour cette édition',
      })
    }

    // Vérifier les permissions pour créer un workshop
    const hasPermission = await canCreateWorkshop(user.id, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message:
          'Vous devez être bénévole accepté, organisateur ou participant pour créer un workshop',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(workshopSchema, {
      ...body,
      editionStartDate: edition.startDate.toISOString(),
      editionEndDate: edition.endDate.toISOString(),
    })

    // Gérer le lieu du workshop
    let locationId = validatedData.locationId || null

    // Si un nom de lieu est fourni (mode libre) et pas d'ID, créer ou récupérer le lieu
    if (validatedData.locationName && !locationId && edition.workshopLocationsFreeInput) {
      const locationName = validatedData.locationName.trim()

      // Chercher si le lieu existe déjà
      const existingLocation = await prisma.workshopLocation.findFirst({
        where: {
          editionId,
          name: locationName,
        },
      })

      if (existingLocation) {
        locationId = existingLocation.id
      } else {
        // Créer le nouveau lieu
        const newLocation = await prisma.workshopLocation.create({
          data: {
            editionId,
            name: locationName,
          },
        })
        locationId = newLocation.id
      }
    }

    // Créer le workshop
    const newWorkshop = await prisma.workshop.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        startDateTime: new Date(validatedData.startDateTime),
        endDateTime: new Date(validatedData.endDateTime),
        maxParticipants: validatedData.maxParticipants || null,
        locationId,
        editionId,
        creatorId: user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return newWorkshop
  },
  { operationName: 'CreateWorkshop' }
)
