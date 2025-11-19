import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin
    await requireGlobalAdminWithDbCheck(event)

    const editionId = validateResourceId(event, 'id', 'édition')

    // Récupérer l'édition avec toutes les informations nécessaires
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition not found',
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
      JSON.stringify(exportData, (key, value) => (value === undefined ? null : value))
    )

    return cleanedData
  },
  { operationName: 'ExportEdition' }
)
