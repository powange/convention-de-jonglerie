// import { getEmailHash } from '@@/server/utils/email-hash'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'

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
      isOnline?: boolean
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

    // Par défaut, filtrer les éditions en ligne uniquement
    // sauf si includeOffline=true est passé explicitement
    if (includeOffline !== 'true') {
      where.isOnline = true
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

      // Filtrer les valeurs vides et les doublons
      countryList = [...new Set(countryList.filter(Boolean))]

      if (countryList.length > 0) {
        where.country = {
          in: countryList,
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
        // Champs essentiels affichés dans les cartes
        id: true,
        name: true,
        description: true,
        country: true,
        city: true,
        latitude: true,
        longitude: true,
        startDate: true,
        endDate: true,
        imageUrl: true,

        // Services et équipements (affichés avec des icônes)
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
        hasLongShow: true,
        hasATM: true,

        // Relations (seuls champs nécessaires)
        creator: {
          select: { id: true, pseudo: true },
        },
        convention: {
          select: { id: true, name: true, logo: true },
        },

        // CHAMPS EXCLUS (visibles uniquement sur la page détail) :
        // - addressLine1, addressLine2, postalCode, region
        // - officialWebsiteUrl, facebookUrl, instagramUrl, ticketingUrl
        // - createdAt, updatedAt, creatorId, conventionId, isOnline
        // - tous les champs volunteers* (20+ champs)
      },
      orderBy: {
        startDate: 'asc', // Tri croissant par date de début (plus proche en premier)
      },
      skip,
      take: limitNumber,
    })

    // Pas de transformation des collaborators ici car ils ne sont pas inclus
    // dans cette requête (contrairement à l'API individuelle)
    const transformedEditions = editions

    // Retourner les résultats avec les métadonnées de pagination
    return {
      data: transformedEditions,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
      },
    }
  },
  { operationName: 'GetEditions' }
)
