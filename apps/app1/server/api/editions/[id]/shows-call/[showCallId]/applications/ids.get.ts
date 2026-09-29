import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Les identifiants des candidatures d'un appel, dans l'ordre de la liste. Rien d'autre.
 *
 * ⚠️ POURQUOI CET ENDPOINT EXISTE. La fiche d'une candidature a besoin de la SUITE pour ses boutons
 * « précédent » et « suivant ». Elle interrogeait pour cela la liste paginée avec `limit: 1000` —
 * et `validatePagination` borne à 100. La demande était donc silencieusement ramenée à 100 : au-delà
 * de cent candidatures, la navigation sautait tout le reste, sans que rien ne le signale. Elle
 * chargeait au passage, pour chacune de ces cent lignes, le candidat, le décideur, le spectacle lié
 * et le reste de l'`include` — pour n'en garder que l'`id`.
 *
 * D'où un point d'API qui ne rend que ce qui sert, et sans pagination : une liste d'entiers reste
 * légère même à plusieurs milliers, là où cent lignes complètes ne l'étaient pas.
 *
 * ⚠️ MÊME ORDRE que la liste, `createdAt` décroissant : c'est ce qui fait que « suivant » mène bien
 * à la ligne d'en dessous. Si le tri de la liste change un jour, celui-ci doit changer avec — sans
 * quoi les flèches se mettraient à sauter, et rien ne le dirait.
 *
 * ⚠️ AUCUN FILTRE n'est appliqué, délibérément, parce que c'est déjà le comportement actuel : la
 * fiche demandait la liste sans transmettre le statut ni la recherche, donc les flèches parcourent
 * toutes les candidatures de l'appel, y compris celles que la liste filtrée masquait. Les faire
 * suivre le filtre serait une amélioration — pas un effet de bord à glisser dans un lot qui parle
 * de charge.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({
        status: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    // La même garde que la liste, mot pour mot : deux règles d'accès pour une même donnée finissent
    // toujours par diverger.
    const edition = await getEditionWithPermissions(editionId, { userId: user.id })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour voir les candidatures",
      })
    }

    const showCall = await prisma.editionShowCall.findFirst({
      where: { id: showCallId, editionId },
      select: { id: true },
    })

    if (!showCall) {
      throw createError({
        status: 404,
        message: 'Appel à spectacles non trouvé',
      })
    }

    const applications = await prisma.showApplication.findMany({
      where: { showCallId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })

    return createSuccessResponse({ ids: applications.map((a) => a.id) })
  },
  { operationName: 'GetShowApplicationIds' }
)
