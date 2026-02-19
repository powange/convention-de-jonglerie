import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { invalidateEditionCache } from '#server/utils/cache-helpers'
import { getConventionForEditionCreation } from '#server/utils/permissions/convention-permissions'
import { editionWithFavoritesInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Récupérer les champs structurels de l'édition source
    const sourceEdition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        conventionId: true,
        name: true,
        description: true,
        program: true,
        startDate: true,
        endDate: true,
        timezone: true,
        // Adresse + géolocalisation
        addressLine1: true,
        addressLine2: true,
        city: true,
        region: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        // Liens
        facebookUrl: true,
        instagramUrl: true,
        ticketingUrl: true,
        officialWebsiteUrl: true,
        // Services
        hasFoodTrucks: true,
        hasKidsZone: true,
        acceptsPets: true,
        hasTentCamping: true,
        hasTruckCamping: true,
        hasFamilyCamping: true,
        hasSleepingRoom: true,
        hasGym: true,
        hasFireSpace: true,
        hasGala: true,
        hasOpenStage: true,
        hasConcert: true,
        hasCantine: true,
        hasAerialSpace: true,
        hasSlacklineSpace: true,
        hasToilets: true,
        hasShowers: true,
        hasAccessibility: true,
        hasWorkshops: true,
        hasCashPayment: true,
        hasCreditCardPayment: true,
        hasAfjTokenPayment: true,
        hasATM: true,
        hasLongShow: true,
        // Config bénévoles
        volunteersDescription: true,
        volunteersExternalUrl: true,
        volunteersMode: true,
        volunteersAskDiet: true,
        volunteersAskAllergies: true,
        volunteersAskTimePreferences: true,
        volunteersAskTeamPreferences: true,
        volunteersAskPets: true,
        volunteersAskMinors: true,
        volunteersAskVehicle: true,
        volunteersAskCompanion: true,
        volunteersAskAvoidList: true,
        volunteersAskSkills: true,
        volunteersAskExperience: true,
        volunteersAskEmergencyContact: true,
        volunteersAskSetup: true,
        volunteersAskTeardown: true,
        volunteersSetupStartDate: true,
        volunteersTeardownEndDate: true,
        // Config billetterie
        ticketingAllowOnsiteRegistration: true,
        ticketingAllowAnonymousOrders: true,
        // Config workshops
        workshopsEnabled: true,
        workshopLocationsFreeInput: true,
        // Carte
        mapPublic: true,
      },
    })

    if (!sourceEdition) {
      throw createError({ statusCode: 404, statusMessage: 'Edition not found' })
    }

    // Vérifier les permissions de création d'édition sur cette convention
    await getConventionForEditionCreation(sourceEdition.conventionId, user)

    // Créer la nouvelle édition avec les champs structurels
    const { conventionId, ...structuralFields } = sourceEdition

    // Récupérer les zones et marqueurs de la carte
    const [sourceZones, sourceMarkers] = await Promise.all([
      prisma.editionZone.findMany({
        where: { editionId },
        select: {
          name: true,
          description: true,
          color: true,
          coordinates: true,
          zoneType: true,
          order: true,
        },
      }),
      prisma.editionMarker.findMany({
        where: { editionId },
        select: {
          name: true,
          description: true,
          color: true,
          latitude: true,
          longitude: true,
          markerType: true,
          order: true,
        },
      }),
    ])

    // Transaction pour garantir l'atomicité de la duplication
    const newEdition = await prisma.$transaction(async (tx) => {
      const created = await tx.edition.create({
        data: {
          ...structuralFields,
          conventionId,
          name: sourceEdition.name ? `${sourceEdition.name} (copie)` : null,
          status: 'OFFLINE',
          creatorId: user.id,
          imageUrl: null,
          volunteersOpen: false,
        },
      })

      // Copier les zones et marqueurs vers la nouvelle édition
      await Promise.all([
        sourceZones.length > 0
          ? tx.editionZone.createMany({
              data: sourceZones.map((z) => ({ ...z, editionId: created.id })),
            })
          : Promise.resolve(),
        sourceMarkers.length > 0
          ? tx.editionMarker.createMany({
              data: sourceMarkers.map((m) => ({ ...m, editionId: created.id })),
            })
          : Promise.resolve(),
      ])

      return tx.edition.findUniqueOrThrow({
        where: { id: created.id },
        include: editionWithFavoritesInclude,
      })
    })

    await invalidateEditionCache(newEdition.id)

    return newEdition
  },
  { operationName: 'DuplicateEdition' }
)
