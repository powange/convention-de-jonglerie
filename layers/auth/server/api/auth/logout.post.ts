import { z } from 'zod'

import { clearUserSession } from '#imports'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'

/**
 * Le corps est FACULTATIF, et tout entier.
 *
 * Se déconnecter doit réussir quoi qu'il arrive : un corps absent, illisible ou inattendu ne peut
 * pas empêcher quelqu'un de quitter sa session. C'est l'inverse de `fcm/unsubscribe`, où un corps
 * vide devait être refusé parce qu'il signifiait « coupe tout, partout ». Ici il ne signifie rien
 * de dangereux — seulement « je ne sais pas quel appareil je suis ».
 */
const corpsSchema = z.object({
  deviceId: z.string().min(1).max(200).optional(),
})

export default wrapApiHandler(
  async (event) => {
    /*
     * ⚠️ LE COMPTE SE LIT AVANT QUE LA SESSION SOIT EFFACÉE. Après `clearUserSession`, il n'y a
     * plus de compte à qui rattacher le token — et le désactiver « au mieux » sans identifiant
     * d'utilisateur toucherait la ligne de n'importe qui partage cet appareil.
     *
     * On lit `event.context.user`, que le middleware d'authentification pose, comme le font tous
     * les autres handlers du dépôt — et non `getUserSession`, qui donnerait la même valeur par un
     * second aller-retour. Sans `requireAuth` toutefois : refuser une déconnexion à qui n'a plus
     * de session serait absurde.
     */
    const userId = (event.context.user as { id?: number } | undefined)?.id

    const corps = corpsSchema.safeParse(await readBody(event).catch(() => ({})))
    const deviceId = corps.success ? corps.data.deviceId : undefined

    /*
     * ⚠️ CE QUE LA DÉCONNEXION NE FAISAIT PAS. Le token FCM restait actif : sur un ordinateur
     * partagé — une médiathèque, un poste de bénévoles au guichet —, les notifications du compte
     * qui vient de partir continuaient d'arriver, et la personne suivante les lisait. Titre,
     * message, nom de l'édition : le contenu s'affiche dans la notification système, sans qu'il
     * soit besoin d'être connecté pour la voir.
     *
     * On désactive par `deviceId` seulement. Le token exigerait de charger Firebase au moment de
     * partir, alors que l'identifiant d'appareil couvre déjà TOUTES les lignes de ce navigateur,
     * y compris celles qu'une rotation de token a créées.
     *
     * ⚠️ LIMITE ASSUMÉE : les lignes créées avant la colonne `deviceId` portent `null` et ne sont
     * pas atteintes. Elles le seront au prochain abonnement, qui renseigne la colonne.
     */
    if (userId && deviceId) {
      await prisma.fcmToken
        .updateMany({
          where: { userId, deviceId },
          data: { isActive: false },
        })
        .catch((erreur) => {
          // Une déconnexion qui échoue parce qu'un token n'a pas pu être désactivé serait bien
          // plus grave que le token resté actif : on trace et on continue.
          console.error('[Logout] Désactivation du token FCM impossible:', erreur)
        })
    }

    await clearUserSession(event)
    return createSuccessResponse(null)
  },
  { operationName: 'Logout' }
)
