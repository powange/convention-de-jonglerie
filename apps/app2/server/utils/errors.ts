// Implémentation commune : `layers/core/server/socle/errors.ts`, partagée avec app1.
//
// App2 en avait une copie réduite, à laquelle manquaient des fonctions que les layers attendent
// (bénévoles notamment). Ce fichier reste l'adresse importée (`#server/utils/errors`) et ne fait
// que réexporter. CHEMIN RELATIF obligatoire : les auto-imports de Nitro suivent ce `export *`,
// et ne savent pas résoudre un alias (`#core/…` faisait disparaître toutes ces fonctions).
export * from '../../../../layers/core/server/socle/errors'
