import { requireUserSession } from '#imports'

import { envoyerPush } from '../../utils/push'

/**
 * Une notification de test à tous les appareils du compte connecté : de quoi vérifier, depuis le
 * profil, que le push arrive bien sur le téléphone. Rend le nombre d'appareils atteints.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const atteints = await envoyerPush((user as { id: number }).id, {
    titre: 'Notifications activées 🎉',
    message: 'Vous recevrez ici les nouvelles de vos événements.',
    url: '/profile/notifications',
    icone: '/favicons/android-chrome-192x192.png?v=v1',
    tag: 'flowvent-test',
  })
  return { atteints }
})
