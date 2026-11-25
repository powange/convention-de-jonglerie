// Implémentation commune : `layers/core/server/socle/errors.ts`, partagée avec Flowvent (app2).
//
// Ce fichier reste l'adresse que tout le code importe (`#server/utils/errors`) : le déplacer aurait
// réécrit des centaines d'imports. Il ne fait que réexporter — ne rien y ajouter.
//
// ⚠️ CHEMIN RELATIF, et non `#core/…` : les auto-imports de Nitro suivent ce `export *` pour
// découvrir les fonctions, et ils ne savent pas résoudre un alias. Avec `#core/…`, toutes les
// fonctions de ce module disparaissaient des auto-imports — `wrapApiHandler is not defined`, et
// chaque route de l'application en 500 — alors que les 4672 tests Nuxt passaient.
export * from '../../../../layers/core/server/socle/errors'
