import type { GetEditionsResponse } from '#server/types/api-responses'

import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { getCountryVariants } from '#server/utils/countries'
import { editionListSelect } from '#server/utils/prisma-select-helpers'
import { conditionsMotsCles, motsClesDeLaRequete } from '#server/utils/recherche-mots-cles'
import { validatePagination } from '#server/utils/validation-helpers'
import { filtreStatutEdition, type StatutEdition } from '~~/shared/utils/visibilite-edition'

export default wrapApiHandler<GetEditionsResponse>(
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
      hasUnicycleSpace,
      hasToilets,
      hasShowers,
      hasPrmAccess,
      // L'ancien nom du filtre d'accès PMR, encore porté par les adresses déjà partagées : la
      // page d'accueil écrit la clé du service telle quelle dans l'URL, si bien qu'un lien mis en
      // favori avant le renommage vaut encore. Le retirer ferait cesser le filtre en silence.
      hasAccessibility,
      hasSignLanguage,
      hasWorkshops,
      hasCashPayment,
      hasCreditCardPayment,
      hasAfjTokenPayment,
      hasLongShow,
      hasATM,
      sort,
    } = query

    /*
     * Le plafond est 1000 parce que c'est ce que notre propre client demande : `MAX_ALL_EDITIONS`
     * dans `app/stores/editions.ts` vaut 1000 pour l'agenda et la carte, qui ont besoin de la
     * liste entière. Un plafond plus bas viderait ces deux écrans à moitié, sans erreur.
     *
     * ⚠️ Cette route est PUBLIQUE : sans borne, `?limit=100000` rendait toute la table, créateur
     * et convention joints. Et `?limit=abc` donnait un `NaN` jusqu'à Prisma, donc un 500.
     */
    const { page: pageNumber, limit: limitNumber } = validatePagination(event, {
      defaultLimit: 12,
      max: 1000,
    })

    const where: {
      name?: { contains: string }
      startDate?: { gte: Date }
      endDate?: { lte: Date }
      country?: { in: string[] }
      status?: StatutEdition | { in: StatutEdition[] }
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
      hasUnicycleSpace?: boolean
      hasToilets?: boolean
      hasShowers?: boolean
      hasPrmAccess?: boolean
      hasSignLanguage?: boolean
      hasWorkshops?: boolean
      hasCashPayment?: boolean
      hasCreditCardPayment?: boolean
      hasAfjTokenPayment?: boolean
      hasLongShow?: boolean
      hasATM?: boolean
    } = {}

    // Cette route est publique : elle ne montre que les éditions visibles d'un visiteur.
    // Il n'y a volontairement aucun moyen de lui faire rendre les éditions cachées — le
    // paramètre `includeOffline` le permettait, sans le moindre contrôle.
    where.status = filtreStatutEdition()

    /*
     * La recherche par nom est une recherche par MOTS-CLÉS.
     *
     * « balles 2026 » doit trouver « Festival des Balles Perdues 2026 », et « perdues balles »
     * aussi : on tape ce dont on se souvient, pas ce qui est écrit. Un `contains` d'un bloc
     * exigeait l'ordre exact et ne rendait rien dès qu'un mot manquait au milieu.
     *
     * Les deux champs, et non le seul nom de l'édition : une convention s'appelle souvent
     * autrement que ses éditions, et c'est son nom qu'on retient d'une année sur l'autre.
     *
     * `AND` plutôt que des clés posées sur `where` : chaque mot devient sa propre condition, et
     * les empiler sur la même clé les ferait s'écraser l'une l'autre.
     */
    const motsCles = motsClesDeLaRequete(typeof name === 'string' ? name : null)
    if (motsCles.length > 0) {
      where.AND = conditionsMotsCles(motsCles, ['name', 'convention.name'])
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
    if (hasUnicycleSpace === 'true') {
      where.hasUnicycleSpace = true
    }
    if (hasToilets === 'true') {
      where.hasToilets = true
    }
    if (hasShowers === 'true') {
      where.hasShowers = true
    }
    if (hasPrmAccess === 'true' || hasAccessibility === 'true') {
      where.hasPrmAccess = true
    }
    if (hasSignLanguage === 'true') {
      where.hasSignLanguage = true
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
      // `sort=recent` : la plus récente d'abord. C'est l'ordre d'une RECHERCHE, où le passé est
      // ouvert et où l'édition cherchée est presque toujours la dernière en date — l'ordre par
      // défaut, lui, sert à parcourir ce qui vient, et remonterait une édition de 2019 en tête.
      orderBy: {
        startDate: sort === 'recent' ? 'desc' : 'asc',
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
