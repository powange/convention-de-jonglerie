import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { normaliserPhases } from '~~/shared/utils/phases-edition'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      const items = await prisma.editionVolunteerHandoutItem.findMany({
        where: { editionId },
        include: {
          handoutItem: true,
          team: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: [
          {
            teamId: 'asc', // NULL en premier (global), puis les équipes
          },
          {
            handoutItem: {
              name: 'asc',
            },
          },
        ],
      })

      return {
        items: items.map((item) => ({
          id: item.id,
          handoutItemId: item.handoutItemId,
          teamId: item.teamId,
          name: item.handoutItem.name,
          quantity: item.quantity,
          // Normalisé plutôt que rendu brut : la colonne a d'abord reçu le JSON `null` sur les
          // lignes antérieures, et l'écran ne doit pas avoir à connaître cette histoire.
          phases: normaliserPhases(item.phases),
          team: item.team,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      }
    } catch (error: unknown) {
      /*
       * Un refus DÉJÀ ÉCRIT reste lisible — constat D6. Sans ce relais, ce `catch` réécrit en
       * 500 générique les 4xx levés dans le `try`, y compris par les fonctions qu'il appelle :
       * au comptoir, « Erreur lors de la validation » remplace « Ce billet a été remboursé », et
       * la différence est entre comprendre et appeler quelqu'un.
       */
      if (isHttpError(error)) throw error
      console.error('Erreur lors de la récupération des articles à remettre pour bénévoles:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des articles',
      })
    }
  },
  { operationName: 'GET ticketing volunteers handout-items index' }
)
