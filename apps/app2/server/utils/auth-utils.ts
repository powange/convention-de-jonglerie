// Implémentation commune : `layers/core/server/socle/auth-utils.ts`, partagée avec app1.
//
// Contrat : l'utilisateur connecté est dans `event.context.user` — rempli par
// `server/middleware/contexte-utilisateur.ts`. CHEMIN RELATIF obligatoire : les auto-imports de
// Nitro suivent ce `export *` et ne savent pas résoudre un alias.
export * from '../../../../layers/core/server/socle/auth-utils'
