import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canCreateWorkshop } from '#server/utils/permissions/workshop-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { workshopSchema, validateAndSanitize } from '#server/utils/validation-schemas'
import { useWorkshopsPorts } from '#server/workshops/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Existence + activation + dates via le port (le layer ne lit pas Edition directement)
    const cfg = await useWorkshopsPorts().event.getConfig(editionId)
    if (!cfg.found) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    if (!cfg.enabled) {
      throw createError({
        status: 403,
        message: 'Les workshops ne sont pas activés pour cette édition',
      })
    }

    // Vérifier les permissions pour créer un workshop
    const hasPermission = await canCreateWorkshop(user.id, editionId)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message:
          'Vous devez être bénévole accepté, organisateur ou participant pour créer un workshop',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(workshopSchema, {
      ...body,
      editionStartDate: cfg.startDate?.toISOString(),
      editionEndDate: cfg.endDate?.toISOString(),
    })

    // Gérer le lieu du workshop
    let locationId = validatedData.locationId || null

    // Si un nom de lieu est fourni (mode libre) et pas d'ID, créer ou récupérer le lieu
    if (validatedData.locationName && !locationId && cfg.locationsFreeInput) {
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

    return createSuccessResponse(newWorkshop)
  },
  { operationName: 'CreateWorkshop' }
)
