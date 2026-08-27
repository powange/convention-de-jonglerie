import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { ensureShowGroupConversation } from '#server/utils/messenger-helpers'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'

/**
 * Ouvre le groupe de messagerie d'un spectacle, en le créant au premier appel.
 *
 * Le groupe réunit la distribution du spectacle et les organisateurs habilités sur les
 * artistes : un organisateur absent le jour de l'échange peut ainsi reprendre le fil.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)
    const showId = Number(body?.showId)

    if (!Number.isInteger(showId) || showId <= 0) {
      throw createError({
        status: 400,
        message: "L'ID du spectacle est requis",
      })
    }

    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { editionId: true, _count: { select: { artists: true } } },
    })

    if (!show) {
      throw createError({
        status: 404,
        message: 'Spectacle introuvable',
      })
    }

    if (!(await canManageArtistsById(show.editionId, user.id, event))) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits de gestion des artistes sur cette édition",
      })
    }

    // Un spectacle sans distribution n'a personne à qui écrire : mieux vaut le dire que
    // d'ouvrir un groupe où l'organisateur se retrouverait seul.
    if (show._count.artists === 0) {
      throw createError({
        status: 400,
        message: "Ce spectacle n'a aucun artiste",
      })
    }

    const conversationId = await ensureShowGroupConversation(showId)

    return createSuccessResponse({ conversationId })
  },
  { operationName: 'CreateShowGroupConversation' }
)
