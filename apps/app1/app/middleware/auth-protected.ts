import { useAuthStore } from '../stores/auth'

/**
 * Délai avant la seconde tentative, quand le serveur n'a rien répondu du tout.
 *
 * Une webapp installée démarre souvent avant que le système ait rétabli le réseau. Laisser
 * passer un instant et redemander vaut mieux que renvoyer vers la connexion quelqu'un dont le
 * cookie est intact — c'est le défaut signalé sous Windows 11. Le coût est borné : une seule
 * seconde chance, et seulement quand on n'a RIEN, ni réponse du serveur ni copie locale.
 */
const DELAI_SECONDE_CHANCE = 1200

export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  const authStore = useAuthStore()

  // 1. Hydratation rapide depuis storage si disponible (synchronement)
  if (!authStore.user) {
    try {
      const stored = localStorage.getItem('authUser') || sessionStorage.getItem('authUser') || null
      if (stored) {
        authStore.user = JSON.parse(stored)
      }
    } catch {
      // ignore parse errors
    }
  }

  // 2. Tant que le serveur n'a pas tranché, attendre sa réponse.
  //
  // Le greffon `auth.client` a déjà lancé la requête sans l'attendre : `initializeAuth()` rend
  // celle-là plutôt que d'en ouvrir une seconde. Ce middleware en ouvrait une, et chacune coûte
  // deux requêtes en base côté serveur. Mesuré à l'ouverture de `/profile` : deux appels à
  // `/api/session/me` quand le stockage du navigateur est vide — c'est-à-dire pour un visiteur
  // anonyme, et pour toute personne n'ayant pas coché « se souvenir de moi », dont l'`authUser`
  // vit dans le `sessionStorage` et disparaît donc avec l'onglet.
  //
  // La garde porte sur `sessionVerifiee`, et non sur `user` : la copie relue à l'étape 1 n'est
  // qu'une supposition, et la laisser tenir lieu de réponse suffisait à ouvrir une page
  // protégée sur une session morte. Une fois le serveur entendu, les navigations suivantes ne
  // redemandent plus rien.
  //
  // Si le greffon n'a pas encore tourné, l'appel démarre la requête et c'est lui que le greffon
  // récupérera : l'ordre des deux n'a plus d'importance.
  if (!authStore.sessionVerifiee) {
    await authStore.initializeAuth()

    if (!authStore.sessionVerifiee && !authStore.user) {
      await new Promise((resolve) => setTimeout(resolve, DELAI_SECONDE_CHANCE))
      await authStore.initializeAuth()
    }
  }

  // 3. Décision finale.
  //
  // On laisse passer dès qu'on a un utilisateur : confirmé par le serveur, ou tiré de la copie
  // locale quand le réseau n'a rien dit. Un échec de transport n'est pas une déconnexion.
  //
  // Sinon on renvoie vers la connexion : soit le serveur a répondu 401 — et le store vient de
  // purger la copie locale —, soit il n'a jamais répondu et il n'y a rien à afficher.
  if (authStore.user) return

  const { buildLoginUrl } = useReturnTo()
  return navigateTo(buildLoginUrl(to.fullPath))
})
