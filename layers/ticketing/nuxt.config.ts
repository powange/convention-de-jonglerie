// Layer « ticketing » — module billetterie (PR 1 : cœur config/gestion auto-suffisant). Le serveur
// consomme les permissions du cœur via #server (getEditionWithPermissions, canEditEdition…). Les
// endpoints cross-module (validation/contrôle d'accès, *-not-validated) et liés aux champs Edition
// (settings, sumup, external, stats) ainsi que les pages restent en core pour la PR 2.
export default defineNuxtConfig({})
