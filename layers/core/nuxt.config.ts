import { fileURLToPath } from 'node:url'

// Layer « core » — utilitaires techniques sans métier, partagés par les applications du dépôt.
//
// Même règle que `layers/ui`, élargie au serveur et au code partagé : rien ici ne parle de
// conventions, de bénévoles ou de billets. Journalisation, jetons, CSV, Markdown, dates et fuseaux,
// adresses e-mail et URL, téléchargements… Ces modules vivaient dans app1 ; les layers métier
// (bénévoles d'abord) s'en servent, et une autre app (Flowvent) doit pouvoir les recevoir sans
// recopier app1. Ils s'importent par l'alias `#core`.
export default defineNuxtConfig({
  alias: {
    '#core': fileURLToPath(new URL('./', import.meta.url)),
  },
})
