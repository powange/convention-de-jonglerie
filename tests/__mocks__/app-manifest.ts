// Mock minimal de #app-manifest pour les tests
// Doit exporter un objet contenant au moins "matcher" consommé par nuxt/dist/app/composables/manifest.js
export default {
  matcher: {
    // Interface minimale attendue par createMatcherFromExport
    // Un objet avec routes/radix matcher exportés; on fournit un fallback neutre
    routes: [],
  },
}
