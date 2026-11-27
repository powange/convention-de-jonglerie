import { fileURLToPath } from 'node:url'

// Layer « faq » — module FAQ modulaire (page publique + gestion + API). Découplé du domaine côté
// serveur via les ports server/faq/ports (visibilité propre à l'événement de l'app hôte), dont
// le type vit ici (`#faq/server/ports/types`) et que chaque app câble (app1, Flowvent).
export default defineNuxtConfig({
  alias: {
    '#faq': fileURLToPath(new URL('./', import.meta.url)),
  },
})
