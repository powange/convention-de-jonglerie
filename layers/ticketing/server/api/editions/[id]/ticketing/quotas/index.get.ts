import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    try {
      /*
       * ⚠️ LE COMPTE DES ASSOCIATIONS, PAR FAMILLE — constat F3.
       *
       * Supprimer un quota emporte **en cascade** tout ce qui s'y rattache : six tables de
       * liaison portent `onDelete: Cascade`. La confirmation, elle, ne nommait que le quota — six
       * cascades, zéro mot — et l'action est **irréversible**.
       *
       * Les comptes sont rendus avec la LISTE plutôt que demandés au moment de la suppression :
       * la confirmation doit s'afficher sans attendre un aller-retour, et un écran qui chargerait
       * le détail au clic laisserait une fraction de seconde où le bouton est actif sans que
       * l'information soit là.
       *
       * 📍 Les six noms sont ceux des relations du modèle, pas une liste à tenir à jour : une
       * septième famille ajoutée au schéma se verra ici, puisqu'elle manquera au `_count`.
       */
      const quotas = await prisma.ticketingQuota.findMany({
        where: { editionId },
        orderBy: { position: 'asc' },
        include: {
          _count: {
            select: {
              tiers: true,
              options: true,
              customFields: true,
              organizers: true,
              volunteers: true,
              artists: true,
            },
          },
        },
      })

      return createSuccessResponse({ quotas })
    } catch (error: unknown) {
      /*
       * Un refus DÉJÀ ÉCRIT reste lisible — constat D6. Sans ce relais, ce `catch` réécrit en
       * 500 générique les 4xx levés dans le `try`, y compris par les fonctions qu'il appelle :
       * au comptoir, « Erreur lors de la validation » remplace « Ce billet a été remboursé », et
       * la différence est entre comprendre et appeler quelqu'un.
       */
      if (isHttpError(error)) throw error
      console.error('Failed to fetch quotas:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des quotas',
      })
    }
  },
  { operationName: 'GET ticketing quotas index' }
)
