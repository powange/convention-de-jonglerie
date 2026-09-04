import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditWorkshop } from '#server/utils/permissions/workshop-permissions'
import { buildUpdateData } from '#server/utils/prisma-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { updateWorkshopSchema, validateAndSanitize } from '#server/utils/validation-schemas'
import { useWorkshopsPorts } from '#server/workshops/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const workshopId = validateResourceId(event, 'workshopId', 'atelier')

    // Vérifier que le workshop existe et appartient à l'édition (modèle propre du layer).
    //
    // `findFirst` et non `fetchResourceOrFail` : ce helper attend un identifiant scalaire et
    // construit `where: { id }`. En lui passant `{ id, editionId }`, la requête devenait
    // `where: { id: { id, editionId } }` — Prisma refusait un objet là où il attend un entier, et
    // toute modification d'atelier répondait 500. `findUnique` ne conviendrait pas davantage :
    // le couple (id, editionId) n'est pas une clé unique déclarée.
    const atelier = await prisma.workshop.findFirst({
      where: { id: workshopId, editionId },
      select: { id: true },
    })
    if (!atelier) {
      throw createError({ statusCode: 404, message: 'Workshop non trouvé' })
    }

    // Vérifier les permissions pour modifier le workshop
    const hasPermission = await canEditWorkshop(user.id, workshopId)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message:
          "Vous n'êtes pas autorisé à modifier ce workshop. Seuls le créateur ou les organisateurs peuvent le faire.",
      })
    }

    // Dates + mode lieu libre via le port (plus de traversée workshop.edition dans le layer)
    const cfg = await useWorkshopsPorts().event.getConfig(editionId)

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(updateWorkshopSchema, {
      ...body,
      editionStartDate: cfg.startDate?.toISOString(),
      editionEndDate: cfg.endDate?.toISOString(),
    })

    // Préparer les données de mise à jour
    const updateData = buildUpdateData(validatedData, {
      trimStrings: true,
      transform: {
        startDateTime: (val) => new Date(val),
        // `null` explicite : c'est ainsi qu'on retire une heure de fin déjà enregistrée.
        endDateTime: (val) => (val ? new Date(val as string) : null),
      },
      // `editionStartDate` et `editionEndDate` sont injectées plus haut pour que le schéma
      // vérifie que l'atelier tient dans les dates de l'édition. Ce ne sont pas des colonnes de
      // l'atelier : laissées ici, Prisma refusait la mise à jour entière. La création, elle,
      // construit ses données champ par champ et n'a jamais été touchée.
      exclude: ['locationName', 'editionStartDate', 'editionEndDate'],
    })

    // Gérer le lieu du workshop
    if (validatedData.locationName && cfg.locationsFreeInput) {
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

    return createSuccessResponse(updatedWorkshop)
  },
  { operationName: 'UpdateWorkshop' }
)
