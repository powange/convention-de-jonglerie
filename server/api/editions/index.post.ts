import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { invalidateEditionCache } from '#server/utils/cache-helpers'
import { normalizeDateToISO } from '#server/utils/date-helpers'
import { geocodeEdition } from '#server/utils/geocoding'
import { moveTempImageToEdition, moveTempImageFromPlaceholder } from '#server/utils/move-temp-image'
import { getConventionForEditionCreation } from '#server/utils/permissions/convention-permissions'
import { editionWithFavoritesInclude } from '#server/utils/prisma-select-helpers'
import { editionSchema } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod (gérée automatiquement par wrapApiHandler)
    const validatedData = editionSchema.parse(body)

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
      hasCashPayment,
      hasCreditCardPayment,
      hasAfjTokenPayment,
    } = validatedData

    // Vérifier les permissions pour créer une édition
    await getConventionForEditionCreation(conventionId, user)

    // Géocoder l'adresse pour obtenir les coordonnées
    const geoCoords = await geocodeEdition({
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country,
    })

    // Créer l'édition sans l'image d'abord
    const edition = await prisma.edition.create({
      data: {
        conventionId,
        name: name?.trim() || null,
        description,
        program,
        imageUrl: null, // On met null d'abord
        startDate: normalizeDateToISO(startDate) || startDate,
        endDate: normalizeDateToISO(endDate) || endDate,
        addressLine1,
        addressLine2,
        postalCode,
        city,
        region,
        country,
        timezone,
        latitude: geoCoords.latitude,
        longitude: geoCoords.longitude,
        ticketingUrl,
        officialWebsiteUrl,
        facebookUrl,
        instagramUrl,
        hasFoodTrucks: hasFoodTrucks || false,
        hasKidsZone: hasKidsZone || false,
        acceptsPets: acceptsPets || false,
        hasTentCamping: hasTentCamping || false,
        hasTruckCamping: hasTruckCamping || false,
        hasFamilyCamping: hasFamilyCamping || false,
        hasSleepingRoom: hasSleepingRoom || false,
        hasGym: hasGym || false,
        hasFireSpace: hasFireSpace || false,
        hasGala: hasGala || false,
        hasOpenStage: hasOpenStage || false,
        hasConcert: hasConcert || false,
        hasCantine: hasCantine || false,
        hasAerialSpace: hasAerialSpace || false,
        hasSlacklineSpace: hasSlacklineSpace || false,
        hasToilets: hasToilets || false,
        hasShowers: hasShowers || false,
        hasAccessibility: hasAccessibility || false,
        hasWorkshops: hasWorkshops || false,
        hasCashPayment: hasCashPayment || false,
        hasCreditCardPayment: hasCreditCardPayment || false,
        hasAfjTokenPayment: hasAfjTokenPayment || false,
        creatorId: user.id,
        status: 'OFFLINE', // Nouvelle édition créée hors ligne par défaut
      },
      include: editionWithFavoritesInclude,
    })

    // Si une image temporaire a été fournie, la déplacer dans le bon dossier
    if (imageUrl && imageUrl.includes('/temp/')) {
      let newImageUrl: string | null = null

      if (imageUrl.includes('/temp/editions/NEW_EDITION/')) {
        // Gérer les fichiers uploadés avec le placeholder NEW_EDITION
        newImageUrl = await moveTempImageFromPlaceholder(imageUrl, edition.id)
      } else {
        // Gérer les autres images temporaires
        newImageUrl = await moveTempImageToEdition(imageUrl, edition.id)
      }

      if (newImageUrl) {
        // Mettre à jour l'édition avec la nouvelle URL
        const updatedEdition = await prisma.edition.update({
          where: { id: edition.id },
          data: { imageUrl: newImageUrl },
          include: editionWithFavoritesInclude,
        })
        // Invalider le cache après création
        await invalidateEditionCache(updatedEdition.id)

        return updatedEdition
      }
    }

    // Invalider le cache après création
    await invalidateEditionCache(edition.id)

    return edition
  },
  { operationName: 'CreateEdition' }
)
