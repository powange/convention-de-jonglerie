import { requireGlobalAdminWithDbCheck } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin
  await requireGlobalAdminWithDbCheck(event)

  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid edition ID',
    })
  }

  // Récupérer l'édition avec toutes les informations nécessaires
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        select: {
          name: true,
          email: true,
          description: true,
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Edition not found',
    })
  }

  // Formater les données pour l'export selon le format attendu par l'import
  const exportData = {
    convention: {
      name: edition.convention.name,
      email: edition.convention.email,
      description: edition.convention.description || undefined,
    },
    edition: {
      name: edition.name || undefined,
      description: edition.description || undefined,
      startDate: edition.startDate,
      endDate: edition.endDate,
      addressLine1: edition.addressLine1,
      addressLine2: edition.addressLine2 || undefined,
      city: edition.city,
      region: edition.region || undefined,
      country: edition.country,
      postalCode: edition.postalCode,
      latitude: edition.latitude || undefined,
      longitude: edition.longitude || undefined,
      ticketingUrl: edition.ticketingUrl || undefined,
      facebookUrl: edition.facebookUrl || undefined,
      instagramUrl: edition.instagramUrl || undefined,
      officialWebsiteUrl: edition.officialWebsiteUrl || undefined,
      // Services et caractéristiques
      hasFoodTrucks: edition.hasFoodTrucks,
      hasKidsZone: edition.hasKidsZone,
      acceptsPets: edition.acceptsPets,
      hasTentCamping: edition.hasTentCamping,
      hasTruckCamping: edition.hasTruckCamping,
      hasGym: edition.hasGym,
      hasCantine: edition.hasCantine,
      hasShowers: edition.hasShowers,
      hasToilets: edition.hasToilets,
      hasWorkshops: edition.hasWorkshops,
      hasOpenStage: edition.hasOpenStage,
      hasConcert: edition.hasConcert,
      hasGala: edition.hasGala,
      hasAccessibility: edition.hasAccessibility,
      hasAerialSpace: edition.hasAerialSpace,
      hasFamilyCamping: edition.hasFamilyCamping,
      hasSleepingRoom: edition.hasSleepingRoom,
      hasFireSpace: edition.hasFireSpace,
      hasSlacklineSpace: edition.hasSlacklineSpace,
      hasCashPayment: edition.hasCashPayment,
      hasCreditCardPayment: edition.hasCreditCardPayment,
      hasAfjTokenPayment: edition.hasAfjTokenPayment,
      hasATM: edition.hasATM,
      hasLongShow: edition.hasLongShow,
    },
  }

  // Nettoyer les undefined pour avoir un JSON plus propre
  const cleanedData = JSON.parse(
    JSON.stringify(exportData, (key, value) => (value === undefined ? undefined : value))
  )

  return cleanedData
})