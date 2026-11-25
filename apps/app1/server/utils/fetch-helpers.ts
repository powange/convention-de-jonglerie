// Implémentation commune : `layers/core/server/socle/fetch-helpers.ts`, partagée entre app1 et
// Flowvent (la carte du site en dépend). Ce fichier reste l'adresse importée
// (`#server/utils/fetch-helpers`). CHEMIN RELATIF obligatoire : les auto-imports de Nitro suivent
// ce `export *` et ne savent pas résoudre un alias.
export * from '../../../../layers/core/server/socle/fetch-helpers'
