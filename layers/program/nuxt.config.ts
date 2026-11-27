import { fileURLToPath } from 'node:url'

// Layer « program » — le programme d'un événement : frise publique (ateliers, représentations de
// spectacles, éléments libres), page de composition, éléments libres et leur API. Sorti d'app1
// pour que Flowvent (app2) l'étende.
//
// Ses modules s'importent par l'alias `#program`. Ce qui diffère d'une app à l'autre (réglages
// de l'événement, ateliers) passe par le port `#server/program/ports/registry`
// (type : `#program/server/ports/types`).
export default defineNuxtConfig({
  alias: {
    '#program': fileURLToPath(new URL('./', import.meta.url)),
  },
})
