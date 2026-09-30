// Middleware pour rediriger les utilisateurs connectés.
//
// `useReturnTo` vit dans la couche application : depuis un layer, l'import passe par `#imports`.
import { useReturnTo } from '#imports'

export default defineNuxtRouteMiddleware(async (to) => {
  // Utiliser le composable useUserSession qui gère automatiquement serveur/client
  const { loggedIn, user, fetch: fetchSession } = useUserSession()

  // IMPORTANT: Forcer un fetch de la session depuis le serveur
  // pour éviter d'utiliser des données cachées après un logout
  if (import.meta.client) {
    try {
      await fetchSession()
    } catch {
      // Ignorer les erreurs de fetch
    }
  }

  // Attendre que l'état de session soit résolu
  await nextTick()

  if (loggedIn.value && user.value) {
    /*
     * ⚠️ VERS `returnTo` QUAND IL Y EN A UN, et non systématiquement vers l'accueil.
     *
     * Le cas se produit quand un middleware a renvoyé ici alors que la session était en fait
     * valide — par exemple parce que le store n'était pas encore hydraté au rechargement d'une
     * page d'administration. On arrivait sur `/login?returnTo=/admin/feedback`, la session était
     * trouvée bonne… et l'on repartait vers l'accueil, en perdant en route la page demandée.
     *
     * La cause de ce renvoi est corrigée par ailleurs (`super-admin` attend désormais la session),
     * mais le rattrapage vaut pour tous les autres chemins qui mènent ici avec une destination :
     * revenir là où l'on allait est toujours le bon comportement.
     *
     * `cleanReturnTo` retire un `returnTo` imbriqué et `isAuthPage` écarte les pages
     * d'authentification : sans ces deux gardes, une adresse forgée ferait tourner en rond.
     */
    const destination = to.query.returnTo
    if (typeof destination === 'string' && destination) {
      const { cleanReturnTo, isAuthPage } = useReturnTo()
      const propre = cleanReturnTo(destination)
      if (propre.startsWith('/') && !propre.startsWith('//') && !isAuthPage(propre)) {
        return navigateTo(propre)
      }
    }

    return navigateTo('/')
  }
})
