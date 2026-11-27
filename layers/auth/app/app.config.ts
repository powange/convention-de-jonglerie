/**
 * Réglages du layer d'authentification que chaque application peut surcharger dans son propre
 * `app.config.ts`.
 */
export default defineAppConfig({
  auth: {
    /**
     * Où aller après une connexion, quand aucune page n'était demandée (`returnTo`). App1 revient
     * sur l'accueil ; Flowvent ouvre le tableau de bord, sans que l'accueil, lui, y renvoie.
     */
    destinationApresConnexion: '/',
  },
})
