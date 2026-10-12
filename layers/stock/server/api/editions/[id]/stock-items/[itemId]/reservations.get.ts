import {
  RESERVATIONS_PAR_PAGE,
  reservationDeLaFicheSelect,
} from '../../../../../utils/reservations-de-la-fiche'

import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock } from '#server/utils/stock-helpers'
import { validateEditionId, validatePagination } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-items/[itemId]/reservations
 *
 * Les réservations d'un objet, PAGE PAR PAGE — constat E3.
 *
 * ⚠️ La fiche de l'objet les chargeait toutes d'un bloc. Elle n'en prend plus que la première
 * page ; celle-ci sert les suivantes, avec le même tri et le même `select` — partagés dans
 * `reservations-de-la-fiche.ts` pour que la page 2 ne puisse pas afficher autre chose que la
 * page 1, ni exposer un champ que celle-ci cachait.
 *
 * 📍 Les mêmes droits que la fiche, et non un contrôle allégé : ce point d'API rend exactement
 * les mêmes données, et un garde plus permissif ici suffirait à contourner celui de la fiche.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = Number(getRouterParam(event, 'itemId'))
    if (isNaN(itemId)) {
      throw createError({ status: 400, message: 'Identifiant invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!(await canAccessStock(edition, user))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    /*
     * ⚠️ L'OBJET EST VÉRIFIÉ AVANT DE LIRE SES RÉSERVATIONS, et pas seulement l'édition. Sans
     * cela, un identifiant d'objet appartenant à une AUTRE édition rendrait une liste vide — donc
     * un 200 qui se lit comme « cet objet n'a pas de réservation », là où la réponse juste est
     * « cet objet n'existe pas ici ». C'est aussi ce que fait la fiche.
     */
    const objet = await prisma.stockItem.findFirst({
      where: { id: itemId, group: { editionId } },
      select: { id: true },
    })
    if (!objet) {
      throw createError({ status: 404, message: 'Objet introuvable' })
    }

    const { page, limit, skip, take } = validatePagination(event, {
      defaultLimit: RESERVATIONS_PAR_PAGE,
    })

    const [reservations, total] = await Promise.all([
      prisma.stockReservation.findMany({
        where: { stockItemId: itemId },
        orderBy: { startsAt: 'asc' },
        skip,
        take,
        include: reservationDeLaFicheSelect,
      }),
      prisma.stockReservation.count({ where: { stockItemId: itemId } }),
    ])

    return createPaginatedResponse(reservations, total, page, limit)
  },
  { operationName: 'GetStockItemReservations' }
)
