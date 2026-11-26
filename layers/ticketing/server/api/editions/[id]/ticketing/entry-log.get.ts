import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import {
  participantsCorrespondants,
  rendreLisibles,
} from '#server/utils/ticketing/mouvements-lisibles'

/**
 * L'historique COMPLET des mouvements d'entrée, paginé, cherchable et filtrable.
 *
 * Distinct de `recent-validations`, qui reste le fil court de la page — dix lignes, sans filtre,
 * lu debout à la porte. Celui-ci alimente la modale d'historique : on y vient pour arbitrer un
 * litige, pas pour surveiller le flux.
 *
 * La pagination est **côté serveur** : l'historique n'a pas de borne, et la recherche doit
 * filtrer avant de découper — sans quoi le compte total serait celui de tout le journal.
 */

const GENRES = {
  ticket: 'TICKET',
  volunteer: 'VOLUNTEER',
  artist: 'ARTIST',
  organizer: 'ORGANIZER',
} as const

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  /**
   * Deux caractères au minimum.
   *
   * Un `contains` se traduit par `LIKE '%x%'`, qui n'utilise aucun index : une seule lettre
   * déclencherait quatre balayages de table à chaque frappe. C'est le reproche que le constat P2
   * adresse déjà à la recherche voisine ; autant ne pas le reproduire ici.
   */
  search: z.string().trim().min(2).optional(),
  movement: z.enum(['VALIDATED', 'INVALIDATED']).optional(),
  kind: z.enum(['ticket', 'volunteer', 'artist', 'organizer']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const params = querySchema.parse(getQuery(event))

    /**
     * Les bornes du journal, pour que les sélecteurs de date ne proposent pas des jours où il
     * ne s'est rien passé.
     *
     * Calculées sur l'édition SANS les filtres : des bornes qui suivraient le filtre courant se
     * resserreraient à chaque choix, et on ne pourrait plus jamais élargir la période. Deux
     * lectures d'index sur `(editionId, createdAt)` — négligeable à côté du comptage qui suit.
     */
    const [premier, dernier] = await Promise.all([
      prisma.entryValidationLog.findFirst({
        where: { editionId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.entryValidationLog.findFirst({
        where: { editionId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])
    const bornes = {
      premiere: premier?.createdAt ?? null,
      derniere: dernier?.createdAt ?? null,
    }

    const where: Record<string, unknown> = { editionId }
    if (params.movement) where.movement = params.movement
    if (params.kind) where.participantKind = GENRES[params.kind]
    if (params.from || params.to) {
      where.createdAt = {
        ...(params.from ? { gte: params.from } : {}),
        // La borne haute est inclusive du jour entier : une période « jusqu'au 6 août » qui
        // s'arrêterait à minuit écarterait toute la journée du 6, ce que personne n'attend.
        ...(params.to ? { lte: new Date(params.to.getTime() + 86_399_999) } : {}),
      }
    }

    if (params.search) {
      const correspondants = await participantsCorrespondants(editionId, params.search)
      const parGenre = Object.entries(correspondants)
        .filter(([, ids]) => ids.length > 0)
        .map(([genre, ids]) => ({ participantKind: genre, participantId: { in: ids } }))

      // Aucune personne ne correspond : inutile d'interroger le journal pour n'en rien tirer.
      if (parGenre.length === 0) {
        return {
          success: true,
          data: [],
          bornes,
          pagination: {
            page: params.page,
            limit: params.pageSize,
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: params.page > 1,
          },
        }
      }
      where.OR = parGenre
    }

    const [total, mouvements] = await Promise.all([
      prisma.entryValidationLog.count({ where }),
      prisma.entryValidationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ])

    return {
      ...createPaginatedResponse(
        await rendreLisibles(mouvements),
        total,
        params.page,
        params.pageSize
      ),
      bornes,
    }
  },
  { operationName: 'GET ticketing entry-log' }
)
