import { z } from 'zod'

import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { confirmerChangementDAdresse } from '#server/utils/changement-d-adresse'
import { verificationCodeRateLimiter } from '#server/utils/rate-limiter'
import { rafraichirUtilisateurDeSession } from '#server/utils/session-helpers'
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
     * ⚠⚠ LA SESSION EST RAFRAÎCHIE ICI, ET NULLE PART AILLEURS — constats B2 et B5 réunis.
     *
     * La session porte une COPIE du compte, scellée dans un cookie. Dix-neuf handlers y lisent
     * `user.email`, dont « Mes billets », qui cherche les commandes par cette adresse : sans ce
     * rafraîchissement, un billet acheté avec la NOUVELLE adresse n'apparaîtrait pas, et un billet
     * acheté avec l'ANCIENNE continuerait d'apparaître — des semaines durant pour qui a coché
     * « se souvenir de moi ».
     *
     * 📍 C'est le seul endroit où l'adresse de la session doit changer : la mise à jour du profil,
     * elle, n'écrit plus l'adresse. La rafraîchir là-bas inscrirait dans la session une adresse que
     * le compte n'a pas encore.
     */
    await rafraichirUtilisateurDeSession(event, { email })

    return createSuccessResponse({ email, emailHash })
  },
  { operationName: 'ConfirmProfileEmail' }
)
