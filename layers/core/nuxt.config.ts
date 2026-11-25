import { fileURLToPath } from 'node:url'

// Layer « core » — utilitaires techniques sans métier, partagés par les applications du dépôt.
//
// Même règle que `layers/ui`, élargie au serveur et au code partagé : rien ici ne parle de
// conventions, de bénévoles ou de billets. Journalisation, jetons, CSV, Markdown, dates et fuseaux,
// adresses e-mail et URL, téléchargements… Ces modules vivaient dans app1 ; les layers métier
// (bénévoles d'abord) s'en servent, et une autre app (Flowvent) doit pouvoir les recevoir sans
// recopier app1. Ils s'importent par l'alias `#core`.
//
// ⚠️ `package.json` voisin (`"type": "module"`) : sans lui, le `package.json` le plus proche est
// celui de la racine, qui ne déclare pas de type — Node et `tsx` traitent alors ces fichiers en
// CommonJS, et un `export *` ESM (les réexports d'app1 et d'app2) ne peut pas en énumérer les noms.
// Le seed de la CI (`tsx scripts/seed-dev.ts`) échouait sur « does not provide an export named
// 'sanitizeEmail' ». Nuxt et Vite, eux, ne voyaient rien : ils traitent tout en ESM.
export default defineNuxtConfig({
  alias: {
    '#core': fileURLToPath(new URL('./', import.meta.url)),
  },
})
