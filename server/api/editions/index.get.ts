import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { getCountryVariants } from '@@/server/utils/countries'
import { editionListSelect } from '@@/server/utils/prisma-select-helpers'

// import type { Edition } from '~/types';

export default wrapApiHandler(
  async (event) => {
    const query = getQuery(event)
    const {
      name,
      startDate,
      endDate,
      countries,
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
      page = '1',
      limit = '12',
    } = query

    const pageNumber = parseInt(page as string, 10)
    const limitNumber = parseInt(limit as string, 10)

    const where: {
      name?: { contains: string }
      startDate?: { gte: Date }
      endDate?: { lte: Date }
      country?: { in: string[] }
      status?: 'PUBLISHED' | 'OFFLINE' | { in: ('PUBLISHED' | 'OFFLINE')[] }
      hasFoodTrucks?: boolean
      hasKidsZone?: boolean
      acceptsPets?: boolean
      hasTentCamping?: boolean
      hasTruckCamping?: boolean
      hasFamilyCamping?: boolean
      hasSleepingRoom?: boolean
      hasGym?: boolean
      hasFireSpace?: boolean
      hasGala?: boolean
      hasOpenStage?: boolean
      hasConcert?: boolean
      hasCantine?: boolean
      hasAerialSpace?: boolean
      hasSlacklineSpace?: boolean
      hasToilets?: boolean
      hasShowers?: boolean
      hasAccessibility?: boolean
      hasWorkshops?: boolean
      hasCashPayment?: boolean
      hasCreditCardPayment?: boolean
      hasAfjTokenPayment?: boolean
      hasLongShow?: boolean
      hasATM?: boolean
    } = {}

    // Par défaut, filtrer les éditions visibles publiquement
    // (PUBLISHED, PLANNED, CANCELLED) mais pas OFFLINE
    if (includeOffline !== 'true') {
      where.status = { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] }
    } else {
      // Inclure aussi OFFLINE
      where.status = { in: ['PUBLISHED', 'OFFLINE', 'PLANNED', 'CANCELLED'] }
    }

    if (name) {
      where.name = {
        contains: name as string,
      }
    }

    if (startDate) {
      where.startDate = {
        gte: new Date(startDate as string),
      }
    }

    if (endDate) {
      where.endDate = {
        lte: new Date(endDate as string),
      }
    }

    // Filtre par pays (support multiselect)
    // Inclut les variantes de chaque pays (ex: "Suisse" inclut aussi "Switzerland")
    if (countries) {
      let countryList: string[] = []

      // Gérer le cas où countries peut être une string ou un array
      if (typeof countries === 'string') {
        // Si c'est une string, essayer de la parser comme JSON ou la traiter comme un seul pays
        try {
          const parsed = JSON.parse(countries)
          if (Array.isArray(parsed)) {
            // Si c'est un array d'objets avec une propriété 'value', extraire les valeurs
            countryList = parsed.map((item) =>
              typeof item === 'object' && item !== null && 'value' in item ? item.value : item
            )
          } else {
            countryList = [parsed]
          }
        } catch {
          countryList = [countries]
        }
      } else if (Array.isArray(countries)) {
        // Si c'est déjà un array, extraire les valeurs si ce sont des objets
        countryList = countries.map((item) =>
          typeof item === 'object' && item !== null && 'value' in item ? item.value : item
        )
      }

      // Filtrer les valeurs vides
      countryList = countryList.filter(Boolean)

      // Étendre chaque pays avec ses variantes (français/anglais)
      // Ex: ["Suisse"] → ["Suisse", "Switzerland"]
      const expandedCountryList = countryList.flatMap((country) => getCountryVariants(country))

      // Supprimer les doublons
      const uniqueCountries = [...new Set(expandedCountryList)]

      if (uniqueCountries.length > 0) {
        where.country = {
          in: uniqueCountries,
        }
      }
    }

    // Filtres par services (booléens)
    if (hasFoodTrucks === 'true') {
      where.hasFoodTrucks = true
    }
    if (hasKidsZone === 'true') {
      where.hasKidsZone = true
    }
    if (acceptsPets === 'true') {
      where.acceptsPets = true
    }
    if (hasTentCamping === 'true') {
      where.hasTentCamping = true
    }
    if (hasTruckCamping === 'true') {
      where.hasTruckCamping = true
    }
    if (hasFamilyCamping === 'true') {
      where.hasFamilyCamping = true
    }
    if (hasSleepingRoom === 'true') {
      where.hasSleepingRoom = true
    }
    if (hasGym === 'true') {
      where.hasGym = true
    }
    if (hasFireSpace === 'true') {
      where.hasFireSpace = true
    }
    if (hasGala === 'true') {
      where.hasGala = true
    }
    if (hasOpenStage === 'true') {
      where.hasOpenStage = true
    }
    if (hasConcert === 'true') {
      where.hasConcert = true
    }
    if (hasCantine === 'true') {
      where.hasCantine = true
    }
    if (hasAerialSpace === 'true') {
      where.hasAerialSpace = true
    }
    if (hasSlacklineSpace === 'true') {
      where.hasSlacklineSpace = true
    }
    if (hasToilets === 'true') {
      where.hasToilets = true
    }
    if (hasShowers === 'true') {
      where.hasShowers = true
    }
    if (hasAccessibility === 'true') {
      where.hasAccessibility = true
    }
    if (hasWorkshops === 'true') {
      where.hasWorkshops = true
    }
    if (hasCashPayment === 'true') {
      where.hasCashPayment = true
    }
    if (hasCreditCardPayment === 'true') {
      where.hasCreditCardPayment = true
    }
    if (hasAfjTokenPayment === 'true') {
      where.hasAfjTokenPayment = true
    }
    if (hasLongShow === 'true') {
      where.hasLongShow = true
    }
    if (hasATM === 'true') {
      where.hasATM = true
    }

    // Construire la condition finale avec les filtres temporels
    // Prisma where clause; fallback to unknown and narrow to object
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

      // Si au moins un filtre temporel est actif, créer un filtre AND avec les autres conditions
      if (timeFilters.length > 0) {
        // Si il y a d'autres conditions, combiner avec AND
        if (Object.keys(where).length > 0) {
          finalWhere = {
            AND: [where, { OR: timeFilters }],
          }
        } else {
          // Si pas d'autres conditions, utiliser seulement le filtre temporel
          finalWhere = { OR: timeFilters }
        }
      }
      // Si aucun filtre temporel n'est coché, ne rien afficher
      else if (showPast === 'false' && showCurrent === 'false' && showFuture === 'false') {
        finalWhere = { id: -1 } // Condition impossible pour ne rien retourner
      }
    }

    // Calculer le skip et take pour la pagination
    const skip = (pageNumber - 1) * limitNumber

    // Obtenir le total pour la pagination
    const totalCount = await prisma.edition.count({
      where: finalWhere,
    })

    const editions = await prisma.edition.findMany({
      where: finalWhere,
      select: {
        ...editionListSelect,
        creator: {
          select: {
            id: true,
            pseudo: true,
          },
        },
        convention: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc', // Tri croissant par date de début (plus proche en premier)
      },
      skip,
      take: limitNumber,
    })

    // Pas de transformation des organizers ici car ils ne sont pas inclus
    // dans cette requête (contrairement à l'API individuelle)
    const transformedEditions = editions

    // Retourner les résultats avec les métadonnées de pagination
    return createPaginatedResponse(transformedEditions, totalCount, pageNumber, limitNumber)
  },
  { operationName: 'GetEditions' }
)
