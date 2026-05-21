import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock, stockItemLocationInclude } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-groups
 *
 * Liste les groupes de stock d'une édition avec leurs items.
 * Accessible aux organisateurs avec `canManageStock` et aux team leaders bénévoles.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!(await canAccessStock(edition, user))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const now = new Date()
    const groups = await prisma.stockGroup.findMany({
      where: { editionId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            ...stockItemLocationInclude,
            _count: { select: { reservations: true } },
            // Réservations à exposer pour les colonnes "Prochaine réservation"
            // et "Emplacement actuel". On retourne :
            // - les RESERVED non terminées (endsAt > now) — utilisées pour
            //   "prochaine" + le retard PICKED_UP éventuel
            // - toutes les PICKED_UP (sorties non encore rendues) — utilisées
            //   pour la colonne "Emplacement actuel"
            // L'ordre asc sur startsAt place les en-cours/retard en tête.
            reservations: {
              where: {
                OR: [{ status: 'RESERVED', endsAt: { gt: now } }, { status: 'PICKED_UP' }],
              },
              orderBy: { startsAt: 'asc' },
              // Borne pour éviter un sur-fetch sur les items avec un long
              // historique de PICKED_UP. La colonne "Emplacement actuel" et
              // l'aperçu "prochaine réservation" sont couverts par les
              // premières entrées triées par startsAt.
              take: 20,
              select: {
                id: true,
                status: true,
                startsAt: true,
                endsAt: true,
                quantityReserved: true,
                location: true,
                zone: { select: { id: true, name: true, color: true } },
                marker: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    return createSuccessResponse({ groups })
  },
  { operationName: 'GetStockGroups' }
)
