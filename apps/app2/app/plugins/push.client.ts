/**
 * Au lancement, et à chaque connexion : si cet appareil est abonné au push, son abonnement est
 * renvoyé au serveur, qui le rattache au compte connecté (cf. usePushNotifications). Rien n'est
 * DEMANDÉ ici : la permission ne se demande que sur un geste (profil, cloche).
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { loggedIn } = useUserSession()
  const { rafraichir } = usePushNotifications()
  const autorise = () => 'Notification' in window && Notification.permission === 'granted'
  nuxtApp.hook('app:mounted', () => {
    if (loggedIn.value && autorise()) rafraichir()
    watch(loggedIn, (connecte) => {
      if (connecte && autorise()) rafraichir()
    })
  })
})
