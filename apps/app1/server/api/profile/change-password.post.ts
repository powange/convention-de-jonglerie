import bcrypt from 'bcryptjs'

import { clearUserSession } from '#imports'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { oublierSessionDuCompte } from '#server/utils/cache-session'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { suivreLaGenerationDeSession } from '#server/utils/session-helpers'
import { changePasswordSchema, validateAndSanitize } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod
    const validatedData = validateAndSanitize(changePasswordSchema, body)

    const { currentPassword: rawCurrentPassword, newPassword } = validatedData

    // Traiter les chaînes vides comme undefined pour les utilisateurs OAuth
    const currentPassword = rawCurrentPassword === '' ? undefined : rawCurrentPassword

    // Récupérer l'utilisateur avec son mot de passe
    const userWithPassword = await fetchResourceOrFail<{ id: number; password: string | null }>(
      prisma.user,
      user.id,
      {
        select: {
          id: true,
          password: true,
        },
        errorMessage: 'Utilisateur non trouvé',
      }
    )

    // Vérifier le mot de passe actuel (sauf si l'utilisateur n'a pas de mot de passe - OAuth)
    if (userWithPassword.password) {
      // L'utilisateur a déjà un mot de passe, il faut le vérifier
      if (!currentPassword) {
        throw createError({
          status: 400,
          message: 'Mot de passe actuel requis',
        })
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        userWithPassword.password
      )

      if (!isCurrentPasswordValid) {
        throw createError({
          status: 400,
          message: 'Mot de passe actuel incorrect',
        })
      }
    } else {
      // Utilisateur OAuth sans mot de passe - il peut directement définir un nouveau mot de passe
      // Le champ currentPassword est ignoré
    }

    // Hasher le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    /**
     * Le mot de passe ET la génération des sessions, d'une seule écriture.
     *
     * Incrémenter `sessionVersion` ferme TOUTES les sessions du compte, pas seulement celle-ci :
     * changer son mot de passe est le geste par lequel on reprend la main, et il serait vain si
     * l'appareil qu'on soupçonne restait connecté. Le middleware compare ce numéro dans la
     * lecture du compte qu'il fait déjà à chaque requête — aucune requête de plus.
     */
    const compteAJour = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
        sessionVersion: { increment: 1 },
      },
      // La nouvelle génération est lue ici plutôt que recalculée : `increment` est résolu par la
      // base, et une lecture séparée pourrait tomber entre deux changements.
      select: { sessionVersion: true },
    })

    // La génération vient de changer : le cache du middleware doit la relire, sinon les sessions
    // ouvertes ailleurs resteraient acceptées le temps de son expiration.
    oublierSessionDuCompte(user.id)

    /*
     * ⚠️ L'APPAREIL COURANT GARDE SA SESSION — constat F1.
     *
     * Ici se trouvait un `clearUserSession(event)` : la session courante tombait avec les autres,
     * et l'écran ne le disait pas. Il affichait « Mot de passe mis à jour », vidait le formulaire
     * et restait là ; le magasin gardait `user`, donc le middleware laissait passer les
     * navigations suivantes — et chaque appel d'API répondait 401, traduit en « identifiants
     * invalides » sur des écrans sans rapport, jusqu'à un rechargement de la page.
     *
     * On fait donc suivre à CETTE session la nouvelle génération. Les autres appareils portent
     * l'ancienne et restent fermés : l'intention du geste est préservée, sans que la personne qui
     * l'accomplit en fasse les frais.
     *
     * 📍 Le repli n'est pas décoratif : si la session n'a pas pu suivre, la laisser vivre à
     * l'ancienne génération donnerait exactement le défaut d'avant. On ferme alors, comme avant.
     */
    const sessionConservee = await suivreLaGenerationDeSession(event, compteAJour.sessionVersion)
    if (!sessionConservee) await clearUserSession(event)

    return createSuccessResponse(null, 'Mot de passe mis à jour avec succès')
  },
  { operationName: 'ChangePassword' }
)
