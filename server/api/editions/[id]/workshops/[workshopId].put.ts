import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditWorkshop } from '@@/server/utils/permissions/workshop-permissions'
import { buildUpdateData, fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { updateWorkshopSchema, validateAndSanitize } from '@@/server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const workshopId = validateResourceId(event, 'workshopId', 'atelier')

    // Vérifier que le workshop existe et appartient à l'édition
    const workshop = await fetchResourceOrFail(
      prisma.workshop,
      { id: workshopId, editionId },
      {
        include: {
          edition: {
            select: {
              startDate: true,
              endDate: true,
              workshopLocationsFreeInput: true,
            },
          },
        },
        errorMessage: 'Workshop non trouvé',
      }
    )

    // Vérifier les permissions pour modifier le workshop
    const hasPermission = await canEditWorkshop(user.id, workshopId)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message:
          "Vous n'êtes pas autorisé à modifier ce workshop. Seuls le créateur ou les organisateurs peuvent le faire.",
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(updateWorkshopSchema, {
      ...body,
      editionStartDate: workshop.edition.startDate.toISOString(),
      editionEndDate: workshop.edition.endDate.toISOString(),
    })

    // Préparer les données de mise à jour
    const updateData = buildUpdateData(validatedData, {
      trimStrings: true,
      transform: {
        startDateTime: (val) => new Date(val),
        endDateTime: (val) => new Date(val),
      },
      exclude: ['locationName'], // Géré séparément
    })

    // Gérer le lieu du workshop
    if (validatedData.locationName && workshop.edition.workshopLocationsFreeInput) {
      // Si un nom de lieu est fourni (mode libre), créer ou récupérer le lieu
      const locationName = validatedData.locationName.trim()

      // Chercher si le lieu existe déjà
      const existingLocation = await prisma.workshopLocation.findFirst({
        where: {
          editionId,
          name: locationName,
        },
      })

      if (existingLocation) {
        updateData.locationId = existingLocation.id
      } else {
        // Créer le nouveau lieu
        const newLocation = await prisma.workshopLocation.create({
          data: {
            editionId,
            name: locationName,
          },
        })
        updateData.locationId = newLocation.id
      }
    }

    // Mettre à jour le workshop
    const updatedWorkshop = await prisma.workshop.update({
      where: { id: workshopId },
      data: updateData,
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

    return updatedWorkshop
  },
  { operationName: 'UpdateWorkshop' }
)
