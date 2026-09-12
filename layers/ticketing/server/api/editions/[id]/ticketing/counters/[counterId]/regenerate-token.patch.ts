import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

/**
 * Régénère le jeton d'un compteur — celui que porte le QR code affiché à l'entrée.
 *
 * Le compteur est désigné par son **identifiant**, comme partout sous `[counterId]`. Cet endpoint
 * faisait exception : il cherchait par `token`, dans une variable pourtant nommée `counterId`. Rien
 * dans la route ne le signalait, et six voisins immédiats résolvaient par id. Ce n'était pas un
 * bug — l'écran appelait bien avec un jeton — mais un piège posé pour le prochain endpoint ajouté
 * ici, dont le symptôme aurait été un 404 inexplicable.
 *
 * La règle est maintenant sans exception : sous `counters/[counterId]`, c'est un identifiant ;
 * sous `counters/token/[token]`, c'est un jeton.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const counterId = validateResourceId(event, 'counterId', 'compteur')

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour régénérer le token de ce compteur',
      })
    }

    const counter = await prisma.ticketingCounter.findFirst({
      where: {
        id: counterId,
        editionId,
      },
    })

    if (!counter) {
      throw createError({
        status: 404,
        message: 'Compteur introuvable',
      })
    }

    // Générer un nouveau token unique
    const newToken = crypto.randomUUID()

    // Mettre à jour le token du compteur existant
    const updatedCounter = await prisma.ticketingCounter.update({
      where: {
        id: counter.id,
      },
      data: {
        token: newToken,
        updatedAt: new Date(),
      },
    })

    return createSuccessResponse({ token: newToken, counter: updatedCounter })
  },
  { operationName: 'PATCH regenerate ticketing counter token' }
)
