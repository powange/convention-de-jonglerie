import { fileURLToPath } from 'node:url'

// Layer « auth » : pages + endpoints d'authentification (login, register, vérification email,
// réinitialisation de mot de passe, OAuth Google/Facebook).
//
// Deux sortes de dépendances, et la frontière compte :
//
// - ce qui est PROPRE à l'authentification vit ici et s'importe par l'alias `#auth` — règles de mot
//   de passe, forme de la session, cache de génération de session, formule de salutation. Ces
//   modules vivaient dans app1 alors que le layer les importait : app2 (Flowvent), qui étend ce
//   layer, ne se construisait plus du tout — « Could not load …/shared/utils/regles-mot-de-passe ».
//   Rien ne le signalait, app2 n'ayant ni build ni test en CI à l'époque ;
// - ce qui appartient à l'app hôte (Prisma, emailService, helpers d'API, store, middleware) reste
//   chez elle et se résout par `#server` / `~` — app1 et app2 en fournissent chacune leur version.
export default defineNuxtConfig({
  alias: {
    '#auth': fileURLToPath(new URL('./', import.meta.url)),
  },
})
