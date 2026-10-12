/**
 * Le verrou d'exécution unique vit désormais dans `apps/app1/server/utils` — constat O1 de
 * l'administration : la création de sauvegarde en avait besoin, et un point d'API
 * d'administration n'a pas à dépendre d'un layer de billetterie.
 *
 * Ce fichier reste comme porte d'entrée du layer : ses deux points d'API et ses trois fichiers de
 * tests l'importent par ce chemin, et rien ne gagnerait à les faire tous changer. La raison d'être
 * du verrou — la panne du 23 août 2026 — est écrite là-bas.
 */
/*
 * ⚠️ UN CHEMIN RELATIF ET NON `#server/…` : le projet de tests `unit` tourne SANS Nuxt, donc sans
 * les alias. Avec `#server`, les trois fichiers de tests qui importent ce module échouaient au
 * chargement — « Failed to resolve import » —, et aucun test ne s'exécutait.
 */
export {
  synchronisationUnique,
  synchronisationsEnCours,
} from '../../../../apps/app1/server/utils/synchronisation-unique'
