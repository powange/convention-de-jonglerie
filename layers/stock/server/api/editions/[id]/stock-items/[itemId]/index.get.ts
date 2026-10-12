import {
  RESERVATIONS_PAR_PAGE,
  reservationDeLaFicheSelect,
} from '../../../../../utils/reservations-de-la-fiche'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { userWithNameAndAvatarSelect } from '#server/utils/prisma-select-helpers'
import { canAccessStock, stockItemLocationInclude } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-items/[itemId]
 *
 * Détail d'un item de stock avec la PREMIÈRE PAGE de ses réservations.
 *
 * ⚠️ Il les chargeait TOUTES — constat E3 : ni `take`, ni `where`, alors que ce commentaire
 * annonçait « ses réservations actives et futures ». Il n'en lit désormais que
 * `RESERVATIONS_PAR_PAGE`, et rend le total ; la suite se demande à
 * `GET …/stock-items/[itemId]/reservations`.
 *
 * 📍 Mesuré avant d'y toucher : **0 réservation** en base de développement. Ce n'est pas la
 * correction d'une panne mais une échéance — et l'historique est PAGINÉ plutôt que borné aux
 * réservations à venir, parce que cet écran affiche délibérément tout le passé.
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

    const item = await prisma.stockItem.findFirst({
      where: { id: itemId, group: { editionId } },
      include: {
        // `reservationsEnabled` : la fiche s'en sert pour ne pas proposer de réserver sur un
        // groupe qui ne gère pas les réservations — un bouton qui rend un 403 est pire qu'aucun
        // bouton.
        group: { select: { id: true, name: true, reservationsEnabled: true } },
        ...stockItemLocationInclude,
        // Les responsables de la récupération et du retour : la fiche les affiche avec leur
        // avatar, comme partout ailleurs.
        // Les pastilles suivent le matériel partout où il est listé.
        tags: {
          include: { tag: { select: { id: true, name: true, color: true, displayOrder: true } } },
        },
        pickupResponsible: { select: userWithNameAndAvatarSelect },
        returnResponsible: { select: userWithNameAndAvatarSelect },
        reservations: {
          orderBy: { startsAt: 'asc' },
          take: RESERVATIONS_PAR_PAGE,
          // Le select vit dans `reservations-de-la-fiche.ts`, partagé avec la page suivante :
          // deux définitions divergeraient, et la seconde page finirait par afficher autre chose
          // que la première — ou par exposer un champ que celle-ci cachait.
          include: reservationDeLaFicheSelect,
        },
        // Le total, pour que l'écran sache s'il y a une suite à demander. `_count` est une
        // agrégation : il ne ramène pas les lignes.
        _count: { select: { reservations: true } },
      },
    })
    if (!item) {
      throw createError({ status: 404, message: 'Objet introuvable' })
    }

    return createSuccessResponse({ item })
  },
  { operationName: 'GetStockItem' }
)
