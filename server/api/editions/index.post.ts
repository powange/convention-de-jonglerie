import { z } from 'zod'

import { requireAuth } from '../../utils/auth-utils'
import {
  getConventionForEditionCreation,
  validateConventionId,
} from '../../utils/convention-permissions'
import { normalizeDateToISO } from '../../utils/date-helpers'
import { geocodeEdition } from '../../utils/geocoding'
import { moveTempImageToEdition, moveTempImageFromPlaceholder } from '../../utils/move-temp-image'
import { prisma } from '../../utils/prisma'
import {
  editionSchema,
  validateAndSanitize,
  handleValidationError,
} from '../../utils/validation-schemas'

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

  // Valider l'ID de convention et vérifier les permissions
  const validConventionId = validateConventionId(conventionId)
  await getConventionForEditionCreation(validConventionId, user)

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
