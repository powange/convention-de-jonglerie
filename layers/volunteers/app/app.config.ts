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
  },
})

declare module 'nuxt/schema' {
  interface AppConfigInput {
    benevoles?: { modeExterne?: boolean }
  }
  interface AppConfig {
    benevoles: { modeExterne: boolean }
  }
}
