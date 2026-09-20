import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

/**
 * Les éditions auxquelles on peut comparer celle-ci.
 *
 * L'écran de statistiques permet de superposer une édition passée à l'édition courante. Pour
 * peupler ce choix, il ne suffit pas de lister les éditions de la convention : le droit
 * « gérer la billetterie » se donne **par édition** autant qu'au niveau de la convention, si
 * bien qu'on peut parfaitement gérer la billetterie de 2026 sans avoir accès à celle de 2024.
 *
 * Proposer une édition dont les statistiques seront ensuite refusées serait une promesse que
 * l'écran ne peut pas tenir. La liste est donc filtrée ici, à la source, avec exactement la
 * garde que les points d'API de statistiques appliqueront ensuite.
 *
 * Pourquoi `canManageTicketingById` est rappelée par édition plutôt que recalculée en une
 * requête : la règle est déjà écrite, testée et non triviale — elle croise le créateur de
 * l'édition, l'auteur de la convention, les droits d'organisateur et les surcharges par
 * édition. En réécrire une version « en lot » produirait un second exemplaire qui finirait par
 * diverger, ce que ce dépôt paie ailleurs. Une convention porte quelques éditions, pas des
 * milliers : le coût est celui de quelques lectures.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // On ne peut comparer que depuis une édition qu'on a déjà le droit de lire.
    const autorise = await canManageTicketingById(editionId, user.id, event)
    if (!autorise) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })
    }

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { conventionId: true },
    })
    if (!edition) throw createError({ status: 404, message: 'Édition introuvable' })

    const candidates = await prisma.edition.findMany({
      where: { conventionId: edition.conventionId, id: { not: editionId } },
      select: { id: true, name: true, startDate: true, endDate: true },
      // La plus récente d'abord : on compare presque toujours à l'année précédente.
      orderBy: { startDate: 'desc' },
    })

    const droits = await Promise.all(
      candidates.map((candidate) => canManageTicketingById(candidate.id, user.id, event))
    )

    return createSuccessResponse({
      editions: candidates.filter((_, i) => droits[i]),
    })
  },
  { operationName: 'GetEditionsComparables' }
)
