import { z } from 'zod'

import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { deduplicateCountries } from '#server/utils/countries'
import { filtreStatutEdition } from '~~/shared/utils/visibilite-edition'

/**
 * Les filtres acceptés, VALIDÉS — constat A8.
 *
 * ## ⚠️ DEUX DÉFAUTS, SUR UNE ROUTE PUBLIQUE
 *
 * 1. `new Date(startDate)` n'était pas validé : `?startDate=abc` donnait une `Invalid Date` que
 *    Prisma refuse — un **500 journalisé** sur une saisie d'URL.
 * 2. `?name[]=a` passait un **tableau** à `contains`, que Prisma refuse également.
 *
 * ⚠️ LES DRAPEAUX RESTENT DES CHAÎNES `'true'`/`'false'`, et ce n'est pas de la paresse : le corps
 * du handler distingue TROIS états — coché, décoché, absent. « Aucun filtre temporel coché » n'est
 * pas la même chose que « aucun filtre temporel fourni », et le second rend tous les pays. Les
 * convertir en booléens écraserait cette distinction.
 */
const schemaDesFiltres = z.object({
  name: z.string().max(200).optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  showPast: z.enum(['true', 'false']).optional(),
  showCurrent: z.enum(['true', 'false']).optional(),
  showFuture: z.enum(['true', 'false']).optional(),
  hasFoodTrucks: z.enum(['true', 'false']).optional(),
  hasKidsZone: z.enum(['true', 'false']).optional(),
  acceptsPets: z.enum(['true', 'false']).optional(),
  hasTentCamping: z.enum(['true', 'false']).optional(),
  hasTruckCamping: z.enum(['true', 'false']).optional(),
  hasFamilyCamping: z.enum(['true', 'false']).optional(),
  hasSleepingRoom: z.enum(['true', 'false']).optional(),
  hasGym: z.enum(['true', 'false']).optional(),
  hasFireSpace: z.enum(['true', 'false']).optional(),
  hasGala: z.enum(['true', 'false']).optional(),
  hasOpenStage: z.enum(['true', 'false']).optional(),
  hasConcert: z.enum(['true', 'false']).optional(),
  hasCantine: z.enum(['true', 'false']).optional(),
  hasAerialSpace: z.enum(['true', 'false']).optional(),
  hasSlacklineSpace: z.enum(['true', 'false']).optional(),
  hasToilets: z.enum(['true', 'false']).optional(),
  hasShowers: z.enum(['true', 'false']).optional(),
  hasPrmAccess: z.enum(['true', 'false']).optional(),
  // Voir `editions/index.get.ts` : l'ancien nom reste accepté pour les liens déjà partagés.
  hasAccessibility: z.enum(['true', 'false']).optional(),
  hasSignLanguage: z.enum(['true', 'false']).optional(),
  hasWorkshops: z.enum(['true', 'false']).optional(),
  hasCashPayment: z.enum(['true', 'false']).optional(),
  hasCreditCardPayment: z.enum(['true', 'false']).optional(),
  hasAfjTokenPayment: z.enum(['true', 'false']).optional(),
  hasLongShow: z.enum(['true', 'false']).optional(),
  hasATM: z.enum(['true', 'false']).optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Cette API est publique, pas besoin d'authentification
    const query = schemaDesFiltres.parse(getQuery(event))
    const {
      name,
      startDate,
      endDate,
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
      hasToilets,
      hasShowers,
      hasPrmAccess,
      // Voir `editions/index.get.ts` : l'ancien nom reste accepté pour les liens déjà partagés.
      hasAccessibility,
      hasSignLanguage,
      hasWorkshops,
      hasCashPayment,
      hasCreditCardPayment,
      hasAfjTokenPayment,
      hasLongShow,
      hasATM,
    } = query

    // Construire la clause where en fonction des filtres
    const where: Record<string, unknown> = {}

    // Statut des éditions : uniquement celles qu'un visiteur peut voir. Comme pour
    // /api/editions, aucun paramètre ne lève ce filtre.
    where.status = filtreStatutEdition()

    // Filtre par nom
    if (name) {
      where.name = { contains: name }
    }

    // Filtre par dates
    if (startDate) {
      where.startDate = { gte: new Date(startDate) }
    }
    if (endDate) {
      where.endDate = { lte: new Date(endDate) }
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
    if (hasPrmAccess === 'true' || hasAccessibility === 'true') where.hasPrmAccess = true
    if (hasSignLanguage === 'true') where.hasSignLanguage = true
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
        // Aucun pays si aucune édition ne correspond
        return createSuccessResponse<string[]>([])
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
    /*
     * ⚠️ SOUS ENVELOPPE, comme 449 des 574 handlers. Le tableau partait nu : le client devait
     * deviner, point d'API par point d'API, s'il lit `res` ou `res.data` — et ce doute a déjà
     * produit des appels voués à l'échec dans ce dépôt. Le seul appelant de cette route est dans
     * le dépôt, donc les deux côtés bougent ensemble.
     */
    return createSuccessResponse(deduplicateCountries(rawCountries))
  },
  { operationName: 'GetCountries' }
)
