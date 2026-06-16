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
        // Config billetterie
        ticketingAllowOnsiteRegistration: true,
        ticketingAllowAnonymousOrders: true,
        // Config repas
        mealsEnabled: true,
        // Config artistes
        artistsEnabled: true,
        // Config billetterie
        ticketingEnabled: true,
        // Config workshops
        workshopsEnabled: true,
        workshopLocationsFreeInput: true,
        // Carte
        mapPublic: true,
        // Config bénévole (étape 0bis) : portée par Event/EventVolunteerSettings
        event: { select: { volunteerSettings: true } },
      },
    })

    if (!sourceEdition) {
      throw createError({ statusCode: 404, statusMessage: 'Edition not found' })
    }

    // Vérifier les permissions de création d'édition sur cette convention
    await getConventionForEditionCreation(sourceEdition.conventionId, user)

    // Créer la nouvelle édition avec les champs structurels
    const { conventionId, event: sourceEvent, ...structuralFields } = sourceEdition
    const sourceSettings = sourceEvent?.volunteerSettings

    // Récupérer les zones et marqueurs de la carte
    const [sourceZones, sourceMarkers] = await Promise.all([
      prisma.editionZone.findMany({
        where: { editionId },
        select: {
          name: true,
          description: true,
          color: true,
          coordinates: true,
          zoneTypes: true,
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
          markerTypes: true,
          order: true,
        },
      }),
    ])

    // Transaction pour garantir l'atomicité de la duplication
    const newEdition = await prisma.$transaction(async (tx) => {
      // Ancre Event (l'édition partage son id : invariant Edition.id == eventId)
      const eventAnchor = await tx.event.create({ data: {} })
      const created = await tx.edition.create({
        data: {
          id: eventAnchor.id,
          eventId: eventAnchor.id,
          ...structuralFields,
          conventionId,
          name: sourceEdition.name ? `${sourceEdition.name} (copie)` : null,
          status: 'OFFLINE',
          creatorId: user.id,
          imageUrl: null,
        },
      })

      // Étape 0bis : copier la config bénévole vers la nouvelle EventVolunteerSettings
      // (candidatures fermées + dates de montage/démontage réinitialisées sur la copie).
      if (sourceSettings) {
        const {
          eventId: _srcEventId,
          open: _srcOpen,
          updatedAt: _srcUpdatedAt,
          ...settingsCopy
        } = sourceSettings
        await tx.eventVolunteerSettings.create({
          data: {
            ...settingsCopy,
            eventId: eventAnchor.id,
            open: false,
            setupStartDate: null,
            teardownEndDate: null,
          },
        })
      }

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

    return createSuccessResponse(newEdition)
  },
  { operationName: 'DuplicateEdition' }
)
