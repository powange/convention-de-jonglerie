import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'
import { canAccessStock, stockItemLocationInclude } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-items/[itemId]
 *
 * Détail d'un item de stock avec ses réservations actives et futures.
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
        group: { select: { id: true, name: true } },
        ...stockItemLocationInclude,
        // Les responsables de la récupération et du retour : la fiche les affiche avec leur
        // avatar, comme partout ailleurs.
        // Les pastilles suivent le matériel partout où il est listé.
        tags: {
          include: { tag: { select: { id: true, name: true, color: true, displayOrder: true } } },
        },
        pickupResponsible: { select: userWithProfileAndGravatarSelect },
        returnResponsible: { select: userWithProfileAndGravatarSelect },
        reservations: {
          orderBy: { startsAt: 'asc' },
          include: {
            zone: { select: { id: true, name: true, color: true } },
            marker: { select: { id: true, name: true } },
            // Pas l'adresse e-mail : cette fiche est ouverte à qui peut consulter le stock, ce
            // qui inclut les responsables d'équipe bénévole — lesquels n'ont pas à connaître
            // l'adresse des autres participants. Le planning, qui affiche pourtant les mêmes
            // réservations, ne prenait déjà que l'empreinte ; c'est ce choix-là qui vaut.
            // L'empreinte suffit à l'avatar, seul usage qu'en fait l'écran.
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                emailHash: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    })
    if (!item) {
      throw createError({ status: 404, message: 'Objet introuvable' })
    }

    return createSuccessResponse({ item })
  },
  { operationName: 'GetStockItem' }
)
