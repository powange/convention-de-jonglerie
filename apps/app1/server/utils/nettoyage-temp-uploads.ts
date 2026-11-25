// Implémentation commune : `layers/core/server/socle/nettoyage-temp-uploads.ts`, partagée avec
// Flowvent (app2), qui dépose ses photos de profil par le même circuit temporaire qu'app1.
//
// Réexport seul, en CHEMIN RELATIF (les auto-imports de Nitro ne résolvent pas un alias, cf.
// `api-helpers.ts`). Ne rien y ajouter.
export * from '../../../../layers/core/server/socle/nettoyage-temp-uploads'
