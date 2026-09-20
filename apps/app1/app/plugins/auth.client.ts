import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  // On garde l'initialisation du store (UI), mais on n'injecte plus d'Authorization.
  //
  // Volontairement non attendue : le rendu ne doit pas dépendre de la session. Le middleware
  // `auth-protected`, lui, réclame la même requête et reçoit celle-ci — `initializeAuth` la
  // partage tant qu'elle n'est pas retombée.
  const authStore = useAuthStore()
  void authStore.initializeAuth()

  // Une requête qui n'a jamais abouti ne prouve rien : elle laisse `sessionVerifiee` à faux, et
  // c'est ici qu'on la rejoue.
  //
  // Les deux moments choisis sont ceux où une webapp installée a le plus de chances de repartir
  // du bon pied : quand le navigateur annonce le retour du réseau, et quand la fenêtre revient
  // au premier plan. Sans cela, une application ouverte avant que le Wi-Fi ne soit rétabli
  // restait sur son verdict — l'écran de connexion — jusqu'au rechargement suivant.
  const reprendre = () => {
    if (!authStore.sessionVerifiee) void authStore.initializeAuth()
  }
  window.addEventListener('online', reprendre)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reprendre()
  })
})
