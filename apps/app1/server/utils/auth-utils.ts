// Implémentation commune : `layers/core/server/socle/auth-utils.ts`, partagée avec Flowvent (app2).
//
// Elle ne repose que sur un contrat : l'utilisateur connecté est dans `event.context.user`, que le
// middleware d'authentification de chaque app remplit. Ce fichier reste l'adresse importée
// (`#server/utils/auth-utils`) et ne fait que réexporter. CHEMIN RELATIF obligatoire : les
// auto-imports de Nitro suivent ce `export *` et ne savent pas résoudre un alias.
export * from '../../../../layers/core/server/socle/auth-utils'
