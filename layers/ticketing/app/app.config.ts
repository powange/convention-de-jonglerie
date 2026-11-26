/**
 * Réglages d'interface du layer billetterie, que chaque app peut surcharger dans son propre
 * `app.config.ts` (Nuxt fusionne les configurations des layers, celle de l'app l'emporte).
 */
export default defineAppConfig({
  billetterie: {
    /** Billetterie externe Infomaniak. Flowvent ne propose que HelloAsso (décision du 25/11/2026). */
    infomaniak: true,
    /** Encaissement par carte via SumUp au guichet. Flowvent ne le propose pas. */
    sumup: true,
    /** Logo affiché pour un billet vendu sur place (sans fournisseur externe). */
    logoDuSite: '/logos/logo-jc.svg',
  },
})
