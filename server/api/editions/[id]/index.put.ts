import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { invalidateEditionCache } from '@@/server/utils/cache-helpers'
import { normalizeDateToISO } from '@@/server/utils/date-helpers'
import { handleFileUpload } from '@@/server/utils/file-helpers'
import { geocodeEdition } from '@@/server/utils/geocoding'
import { getEditionForEdit } from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { updateEditionSchema } from '@@/server/utils/validation-schemas'

import type { Prisma } from '@prisma/client'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod (gérée automatiquement par wrapApiHandler)
    const validatedData = updateEditionSchema.parse(body)

    const {
      conventionId,
      name,
      description,
      program,
      imageUrl,
      startDate,
      endDate,
      timezone,
      addressLine1,
      addressLine2,
      postalCode,
      city,
      region,
      country,
      ticketingUrl,
      officialWebsiteUrl,
      facebookUrl,
      instagramUrl,
      hasFoodTrucks,
      hasKidsZone,
      acceptsPets,
      hasTentCamping,
      hasTruckCamping,
      hasFamilyCamping,
      hasSleepingRoom,
      hasGym,
      hasFireSpace,
      hasGala,
      hasOpenStage,
      hasConcert,
      hasCantine,
      hasAerialSpace,
      hasSlacklineSpace,
      hasToilets,
      hasShowers,
      hasAccessibility,
      hasWorkshops,
      workshopsEnabled,
      workshopLocationsFreeInput,
      hasCashPayment,
      hasCreditCardPayment,
      hasAfjTokenPayment,
    } = validatedData

    // Récupère l'édition et vérifie les permissions d'édition
    const edition = await getEditionForEdit(editionId, user)

    // Si une convention est spécifiée, vérifier qu'elle existe et que l'utilisateur a les droits
    if (conventionId && conventionId !== edition.conventionId) {
      const convention = await prisma.convention.findUnique({
        where: { id: conventionId },
        include: {
          organizers: {
            where: {
              userId: user.id,
              canManageOrganizers: true,
            },
          },
        },
      })

      if (!convention) {
        throw createError({
          status: 404,
          message: 'Convention introuvable',
        })
      }

      // Seuls l'auteur, les administrateurs, ou les admins globaux peuvent changer la convention d'une édition
      const canChangeConvention =
        convention.authorId === user.id || convention.organizers.length > 0 || user.isGlobalAdmin

      if (!canChangeConvention) {
        throw createError({
          status: 403,
          message: "Vous ne pouvez assigner des éditions qu'aux conventions que vous gérez",
        })
      }
    }

    // Gérer l'image avec le helper centralisé
    const finalImageFilename = await handleFileUpload(imageUrl, edition.imageUrl, {
      resourceId: editionId,
      resourceType: 'editions',
    })

    const updatedData: Prisma.EditionUpdateInput = {
      name: name !== undefined ? name?.trim() || null : edition.name,
      description: description || edition.description,
      program: program !== undefined ? program : edition.program,
      imageUrl: finalImageFilename !== undefined ? finalImageFilename : edition.imageUrl,
      startDate: startDate ? normalizeDateToISO(startDate) || startDate : edition.startDate,
      endDate: endDate ? normalizeDateToISO(endDate) || endDate : edition.endDate,
      addressLine1: addressLine1 || edition.addressLine1,
      postalCode: postalCode || edition.postalCode,
      city: city || edition.city,
      region: region || edition.region,
      country: country || edition.country,
    }

    // Gérer le changement de convention si spécifié
    if (conventionId !== undefined && conventionId !== edition.conventionId) {
      updatedData.convention = { connect: { id: conventionId } }
    }

    if (timezone !== undefined) updatedData.timezone = timezone
    if (ticketingUrl !== undefined) updatedData.ticketingUrl = ticketingUrl
    if (officialWebsiteUrl !== undefined) updatedData.officialWebsiteUrl = officialWebsiteUrl
    if (facebookUrl !== undefined) updatedData.facebookUrl = facebookUrl
    if (instagramUrl !== undefined) updatedData.instagramUrl = instagramUrl
    if (hasFoodTrucks !== undefined) updatedData.hasFoodTrucks = hasFoodTrucks
    if (hasKidsZone !== undefined) updatedData.hasKidsZone = hasKidsZone
    if (acceptsPets !== undefined) updatedData.acceptsPets = acceptsPets
    if (hasTentCamping !== undefined) updatedData.hasTentCamping = hasTentCamping
    if (hasTruckCamping !== undefined) updatedData.hasTruckCamping = hasTruckCamping
    if (hasFamilyCamping !== undefined) updatedData.hasFamilyCamping = hasFamilyCamping
    if (hasSleepingRoom !== undefined) updatedData.hasSleepingRoom = hasSleepingRoom
    if (hasGym !== undefined) updatedData.hasGym = hasGym
    if (hasFireSpace !== undefined) updatedData.hasFireSpace = hasFireSpace
    if (hasGala !== undefined) updatedData.hasGala = hasGala
    if (hasOpenStage !== undefined) updatedData.hasOpenStage = hasOpenStage
    if (hasConcert !== undefined) updatedData.hasConcert = hasConcert
    if (hasCantine !== undefined) updatedData.hasCantine = hasCantine
    if (hasAerialSpace !== undefined) updatedData.hasAerialSpace = hasAerialSpace
    if (hasSlacklineSpace !== undefined) updatedData.hasSlacklineSpace = hasSlacklineSpace
    if (hasToilets !== undefined) updatedData.hasToilets = hasToilets
    if (hasShowers !== undefined) updatedData.hasShowers = hasShowers
    if (hasAccessibility !== undefined) updatedData.hasAccessibility = hasAccessibility
    if (hasWorkshops !== undefined) updatedData.hasWorkshops = hasWorkshops
    if (workshopsEnabled !== undefined) updatedData.workshopsEnabled = workshopsEnabled
    if (workshopLocationsFreeInput !== undefined)
      updatedData.workshopLocationsFreeInput = workshopLocationsFreeInput
    if (hasCashPayment !== undefined) updatedData.hasCashPayment = hasCashPayment
    if (hasCreditCardPayment !== undefined) updatedData.hasCreditCardPayment = hasCreditCardPayment
    if (hasAfjTokenPayment !== undefined) updatedData.hasAfjTokenPayment = hasAfjTokenPayment

    // Si l'adresse a été modifiée, recalculer les coordonnées
    const addressChanged =
      addressLine1 !== undefined ||
      addressLine2 !== undefined ||
      city !== undefined ||
      postalCode !== undefined ||
      country !== undefined

    if (addressChanged) {
      const geoCoords = await geocodeEdition({
        addressLine1: addressLine1 || edition.addressLine1,
        addressLine2: addressLine2 !== undefined ? addressLine2 : (edition.addressLine2 ?? null),
        city: city || edition.city,
        postalCode: postalCode || edition.postalCode,
        country: country || edition.country,
      })

      updatedData.latitude = geoCoords.latitude
      updatedData.longitude = geoCoords.longitude
    }

    const updatedEdition = await prisma.edition.update({
      where: {
        id: editionId,
      },
      data: updatedData,
      include: {
        creator: {
          select: { id: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
        },
      },
    })

    // Invalider le cache après mise à jour
    await invalidateEditionCache(editionId)

    return updatedEdition
  },
  { operationName: 'UpdateEdition' }
)
