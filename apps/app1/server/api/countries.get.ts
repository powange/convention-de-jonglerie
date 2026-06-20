import { wrapApiHandler } from '#server/utils/api-helpers'
import { deduplicateCountries } from '#server/utils/countries'

export default wrapApiHandler(
  async (event) => {
    // Cette API est publique, pas besoin d'authentification
    const query = getQuery(event)
    const {
      name,
      startDate,
      endDate,
      showPast,
      showCurrent,
      showFuture,
      includeOffline,
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
      hasLongShow,
      hasATM,
    } = query

    // Construire la clause where en fonction des filtres
    const where: Record<string, unknown> = {}

    // Statut des éditions
    if (includeOffline !== 'true') {
      where.status = { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] }
    } else {
      where.status = { in: ['PUBLISHED', 'OFFLINE', 'PLANNED', 'CANCELLED'] }
    }

    // Filtre par nom
    if (name) {
      where.name = { contains: name as string }
    }

    // Filtre par dates
    if (startDate) {
      where.startDate = { gte: new Date(startDate as string) }
    }
    if (endDate) {
      where.endDate = { lte: new Date(endDate as string) }
    }

    // Filtres par services (booléens)
    if (hasFoodTrucks === 'true') where.hasFoodTrucks = true
    if (hasKidsZone === 'true') where.hasKidsZone = true
    if (acceptsPets === 'true') where.acceptsPets = true
    if (hasTentCamping === 'true') where.hasTentCamping = true
    if (hasTruckCamping === 'true') where.hasTruckCamping = true
    if (hasFamilyCamping === 'true') where.hasFamilyCamping = true
    if (hasSleepingRoom === 'true') where.hasSleepingRoom = true
    if (hasGym === 'true') where.hasGym = true
    if (hasFireSpace === 'true') where.hasFireSpace = true
    if (hasGala === 'true') where.hasGala = true
    if (hasOpenStage === 'true') where.hasOpenStage = true
    if (hasConcert === 'true') where.hasConcert = true
    if (hasCantine === 'true') where.hasCantine = true
    if (hasAerialSpace === 'true') where.hasAerialSpace = true
    if (hasSlacklineSpace === 'true') where.hasSlacklineSpace = true
    if (hasToilets === 'true') where.hasToilets = true
    if (hasShowers === 'true') where.hasShowers = true
    if (hasAccessibility === 'true') where.hasAccessibility = true
    if (hasWorkshops === 'true') where.hasWorkshops = true
    if (hasCashPayment === 'true') where.hasCashPayment = true
    if (hasCreditCardPayment === 'true') where.hasCreditCardPayment = true
    if (hasAfjTokenPayment === 'true') where.hasAfjTokenPayment = true
    if (hasLongShow === 'true') where.hasLongShow = true
    if (hasATM === 'true') where.hasATM = true

    // Construire la condition finale avec les filtres temporels
    let finalWhere: Record<string, unknown> = where

    // Filtres temporels
    if (showPast !== undefined || showCurrent !== undefined || showFuture !== undefined) {
      const now = new Date()
      const timeFilters = []

      if (showPast === 'true') {
        // Éditions terminées: endDate < maintenant
        timeFilters.push({ endDate: { lt: now } })
      }

      if (showCurrent === 'true') {
        // Éditions en cours: startDate <= maintenant AND endDate >= maintenant
        timeFilters.push({
          startDate: { lte: now },
          endDate: { gte: now },
        })
      }

      if (showFuture === 'true') {
        // Éditions à venir: startDate > maintenant
        timeFilters.push({ startDate: { gt: now } })
      }

      // Si au moins un filtre temporel est actif
      if (timeFilters.length > 0) {
        if (Object.keys(where).length > 0) {
          finalWhere = {
            AND: [where, { OR: timeFilters }],
          }
        } else {
          finalWhere = { OR: timeFilters }
        }
      }
      // Si aucun filtre temporel n'est coché, ne rien retourner
      else if (showPast === 'false' && showCurrent === 'false' && showFuture === 'false') {
        return [] // Aucun pays si aucune édition ne correspond
      }
    }

    // Requête DB pour obtenir les pays distincts
    const countriesResult = await prisma.edition.findMany({
      where: finalWhere,
      select: {
        country: true,
      },
      distinct: ['country'],
    })

    // Dédupliquer les pays par code ISO et retourner les noms français
    const rawCountries = countriesResult.map((c) => c.country).filter(Boolean) as string[]
    return deduplicateCountries(rawCountries)
  },
  { operationName: 'GetCountries' }
)
