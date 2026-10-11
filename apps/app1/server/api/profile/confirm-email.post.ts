import { z } from 'zod'

import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { confirmerChangementDAdresse } from '#server/utils/changement-d-adresse'
import { verificationCodeRateLimiter } from '#server/utils/rate-limiter'
import { validateAndSanitize } from '#server/utils/validation-schemas'

const schema = z.object({
  code: z.string().trim().min(1, 'Code requis'),
})

/**
 * POST /api/profile/confirm-email — le second temps du changement d'adresse (constat B2).
 *
 * Le premier temps (`PUT /api/profile/update`) n'a fait qu'enregistrer la demande et envoyer un
 * code à la NOUVELLE adresse. C'est ici que l'adresse bascule, et seulement si le code arrive.
 *
 * 📍 Le limiteur est celui des codes de vérification, pas celui des courriels : ce point d'API
 * n'envoie rien, il en VÉRIFIE un — et c'est le forçage à six chiffres qu'il faut ralentir.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    await verificationCodeRateLimiter(event)

    const { code } = validateAndSanitize(schema, await readBody(event))

    const { email, emailHash } = await confirmerChangementDAdresse({ userId: user.id, code })

    /*
     * ⚠️ LA SESSION N'EST PAS RÉÉCRITE ICI, et c'est délibéré : elle porte une copie du compte, et
     * son rafraîchissement après une modification du profil est le sujet entier du constat B5 —
     * un lot à part. Ce que ce point d'API garantit, c'est que la réponse porte l'adresse NEUVE,
     * de sorte que l'écran puisse mettre son magasin à jour sans attendre un rechargement.
     */
    return createSuccessResponse({ email, emailHash })
  },
  { operationName: 'ConfirmProfileEmail' }
)
