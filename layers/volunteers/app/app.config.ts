/**
 * Réglages d'interface du layer bénévoles, que chaque app peut surcharger dans son propre
 * `app.config.ts` (Nuxt fusionne les configurations des layers, celle de l'app l'emporte).
 */
export default defineAppConfig({
  benevoles: {
    /**
     * Le mode de gestion « externe » : les candidatures se font sur un outil tiers, dont
     * l'édition ne donne que le lien. App1 l'offre (des conventions gèrent leurs bénévoles
     * ailleurs) ; Flowvent le retire, puisque son objet est précisément l'outil interne.
     *
     * Éteint, la configuration n'affiche plus le choix du mode : tout se fait en interne.
     */
    modeExterne: true,
    /**
     * Une billetterie qui contrôle les entrées : la liste des candidatures montre alors le
     * statut du billet de chaque bénévole (colonne et filtre). Flowvent n'en a pas.
     */
    billetterie: true,
    /**
     * Des organisateurs déclarés sur l'événement, qu'on peut rattacher aux équipes de bénévoles.
     * Flowvent n'offre aucun moyen d'en déclarer : l'option ne pourrait qu'afficher une liste vide.
     */
    organisateurs: true,
    /**
     * Une messagerie : le bénévole accepté peut écrire aux responsables depuis sa candidature.
     * Flowvent n'en a pas, le bouton « Contacter » y mènerait à une page absente.
     */
    messagerie: true,
  },
})

declare module 'nuxt/schema' {
  interface AppConfigInput {
    benevoles?: {
      modeExterne?: boolean
      billetterie?: boolean
      organisateurs?: boolean
      messagerie?: boolean
    }
  }
  interface AppConfig {
    benevoles: {
      modeExterne: boolean
      billetterie: boolean
      organisateurs: boolean
      messagerie: boolean
    }
  }
}
