import { requireAuth } from '@@/server/utils/auth-utils'
import { normalizeDateToISO } from '@@/server/utils/date-helpers'
import { geocodeEdition } from '@@/server/utils/geocoding'
import {
  moveTempImageToEdition,
  moveTempImageFromPlaceholder,
} from '@@/server/utils/move-temp-image'
import { getConventionForEditionCreation } from '@@/server/utils/permissions/convention-permissions'
import { prisma } from '@@/server/utils/prisma'
import {
  editionSchema,
  validateAndSanitize,
  handleValidationError,
} from '@@/server/utils/validation-schemas'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const body = await readBody(event)

  // Validation et sanitisation des données avec Zod
  let validatedData
  try {
    validatedData = validateAndSanitize(editionSchema, body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }
    throw error
  }

  const {
    conventionId,
    name,
    description,
    program,
    imageUrl,
    startDate,
    endDate,
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

  try {
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
        conventionId: validConventionId,
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
        isOnline: false, // Nouvelle édition créée hors ligne par défaut
      },
      include: {
        creator: {
          select: { id: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
        },
      },
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
          include: {
            creator: {
              select: { id: true, pseudo: true },
            },
            favoritedBy: {
              select: { id: true },
            },
          },
        })
        return updatedEdition
      }
    }

    return edition
  } catch (error: unknown) {
    console.error("Erreur lors de la création de l'édition:", error)
    if (typeof error === 'object' && error && 'statusCode' in error) {
      throw error as any
    }
    throw createError({ statusCode: 500, message: "Erreur lors de la création de l'édition" })
  }
})
