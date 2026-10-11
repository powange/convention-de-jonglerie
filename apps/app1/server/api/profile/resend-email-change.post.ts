import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { renvoyerCodeDeChangement } from '#server/utils/changement-d-adresse'
import { emailRateLimiter } from '#server/utils/rate-limiter'

/**
 * POST /api/profile/resend-email-change — un nouveau code pour une demande en cours (constat B2).
 *
 * 📍 Le limiteur est celui des COURRIELS, contrairement à la confirmation : ici on en envoie un, et
 * ce qu'il faut empêcher est d'inonder une adresse qui n'appartient pas forcément au demandeur.
 * C'est le même raisonnement que la revendication d'une convention.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    /*
     * ⚠️ Le limiteur de courriels lit l'adresse dans `event.context.body` : sans cette ligne il
     * retombe sur l'IP, ce qui compte ensemble tous les comptes derrière une même connexion.
     * L'adresse visée est celle de la demande en cours, que seul le serveur connaît — on lui donne
     * donc celle du compte, qui identifie la personne tout aussi bien.
     */
    event.context.body = { email: user.email }
    await emailRateLimiter(event)

    const { pendingEmail } = await renvoyerCodeDeChangement(user.id)

    return createSuccessResponse({ pendingEmail })
  },
  { operationName: 'ResendProfileEmailChange' }
)
