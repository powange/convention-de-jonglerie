// Implémentation commune : `layers/core/server/socle/upload-validation.ts`, partagée avec Flowvent
// (app2), qui reçoit les photos de profil par le même circuit qu'app1.
//
// Ce fichier reste l'adresse que tout le code importe (`#server/utils/upload-validation`). Il ne
// fait que réexporter — ne rien y ajouter.
//
// ⚠️ CHEMIN RELATIF, et non `#core/…` : les auto-imports de Nitro suivent ce `export *` et ne
// savent pas résoudre un alias (cf. `api-helpers.ts`, où l'alias avait vidé les auto-imports).
export * from '../../../../layers/core/server/socle/upload-validation'
