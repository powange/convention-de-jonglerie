# Lazy Loading des Traductions i18n

## Vue d'ensemble

Les traductions sont organisées **par domaine fonctionnel** et chargées **à la demande
selon la route**, afin de réduire le bundle initial. Trois mécanismes coexistent :

1. **Fichiers statiques** (toujours chargés) — listés dans `nuxt.config.ts` (`i18n.locales[].files`).
2. **Chargement par route** — middleware global qui charge des domaines supplémentaires
   en fonction de l'URL visitée.
3. **Chargement au niveau composant** — composable `useLazyI18n` (voir
   [`i18n-component-lazy-loading.md`](./i18n-component-lazy-loading.md)).

13 langues : `cs, da, de, en, es, fr, it, nl, pl, pt, ru, sv, uk`.

## Structure des fichiers

```
i18n/locales/{langue}/
├── common.json          # navigation, footer, erreurs, libellés transverses
├── components.json      # composants UI réutilisables
├── app.json             # PWA et services
├── public.json          # pages publiques (homepage, SEO)
├── notifications.json   # notifications
├── feedback.json        # retours / signalements
├── admin.json           # administration
├── auth.json            # authentification
├── profil.json          # profil utilisateur
├── edition.json         # carpool/conventions/diet/organizers (clés racines)
├── gestion.json         # interface de gestion (gestion.*)
├── tasks.json           # module tâches partagé (tasks.*)
├── gestion-tasks.json   # clés de gestion des tâches (gestion.task.*)
├── map.json             # UI carte partagée (map.*)
├── gestion-map.json     # clés d'édition de la carte (gestion.map.*)
├── volunteers.json      # UI bénévoles partagée (volunteers.*)
├── gestion-volunteers.json # clés de gestion bénévoles (gestion.volunteers.*)
├── ticketing.json       # billetterie
├── workshops.json       # ateliers
├── artists.json         # artistes
├── survey.json          # sondages / shows-call
├── messenger.json       # messagerie
├── permissions.json     # droits
└── project-costs.json   # coûts projet
```

> Le **namespace** d'un fichier vient de sa **structure JSON** (clé racine), pas de son
> nom. Ex. `tasks.json` = `{ "tasks": { … } }` → `tasks.*` ; `gestion-tasks.json`
> = `{ "gestion": { "task": { … } } }` → `gestion.task.*`. Deux fichiers peuvent ainsi
> alimenter le même namespace (`gestion.json` + `gestion-tasks.json` + `gestion-map.json`
> partagent `gestion.*`), fusionnés par deep-merge.

## Fichiers chargés par défaut (statiques)

Définis dans `nuxt.config.ts`. Cœur commun à toutes les langues :
`common.json`, `notifications.json`, `components.json`, `app.json`, `public.json`.

> ⚠️ Quirk historique : `fr` charge **en plus** `feedback.json` et `gestion.json`
> statiquement. C'est pourquoi le français a longtemps « marché partout » alors que les
> autres langues manquaient des clés `gestion.*` sur les pages publiques. La règle saine
> est de **router** les domaines plutôt que de les charger statiquement (cf. ci-dessous).

## Chargement par route

Géré par `app/middleware/load-translations.global.ts`, qui appelle
`getTranslationsToLoad(path)` défini dans **`app/utils/translation-loaders.ts`**.
Ce fichier contient deux choses :

- `getTranslationsToLoad(path)` : routes statiques (`startsWith`) + patterns dynamiques (regex).
- `translationLoaders` : map `domaine → { langue → () => import(...) }` (imports **statiques**,
  requis par Vite ; chemins `~~/i18n/locales/...`).

### Routes statiques (`startsWith`)

| Préfixe                             | Domaines chargés    |
| ----------------------------------- | ------------------- |
| `/admin`                            | admin, auth, profil |
| `/editions`                         | edition             |
| `/project-costs`                    | project-costs       |
| `/auth`, `/verify-email`            | auth (+ profil)     |
| `/login`                            | auth                |
| `/register`, `/profile`, `/welcome` | auth, profil        |
| `/messenger`                        | messenger           |

### Routes dynamiques (regex, cumulatives)

| Pattern                              | Domaines                       | Notes                            |
| ------------------------------------ | ------------------------------ | -------------------------------- |
| `/editions/{id}/gestion`             | gestion                        | toutes les sous-pages de gestion |
| `/editions/{id}/gestion` (exact)     | workshops, tasks               | overview (cartes de modules)     |
| `/editions/{id}/gestion/tasks`       | tasks, gestion-tasks           | gestion des tâches               |
| `/editions/{id}/gestion/map`         | map, gestion-map               | édition de la carte              |
| `/editions/{id}/gestion/volunteers`  | volunteers, gestion-volunteers | gestion bénévoles                |
| `/editions/{id}/gestion/ticketing`   | ticketing                      |                                  |
| `/editions/{id}/gestion/workshops`   | workshops                      |                                  |
| `/editions/{id}/gestion/artists`     | artists                        |                                  |
| `/editions/{id}/gestion/shows-call`  | survey                         |                                  |
| `/editions/{id}/my-tasks`            | tasks                          | page utilisateur (lecture)       |
| `/editions/{id}/map`                 | map                            | carte publique                   |
| `/editions/{id}/volunteers`          | volunteers                     | bénévolat public                 |
| `/profile/mes-candidatures-benevole` | volunteers                     | mes candidatures bénévole        |
| `/editions/{id}/artist-space`        | artists                        |                                  |
| `/editions/{id}/workshops`           | workshops                      |                                  |
| `/survey/`                           | survey                         |                                  |

## Motif « partagé / management »

Pour les modules présents à la fois côté **public/utilisateur** et côté **gestion**, les
clés sont séparées en deux domaines afin de ne pas charger les clés d'édition sur les
pages publiques :

| Module    | Partagé (public + gestion)         | Management (gestion uniquement)                    | Libellé de nav (toujours chargé)                             |
| --------- | ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Carte     | `map.*` (`map.json`)               | `gestion.map.*` (`gestion-map.json`)               | `common` → `edition.site_map`                                |
| Tâches    | `tasks.*` (`tasks.json`)           | `gestion.task.*` (`gestion-tasks.json`)            | `common` → `edition.my_tasks`, `edition.tasks`               |
| Bénévoles | `volunteers.*` (`volunteers.json`) | `gestion.volunteers.*` (`gestion-volunteers.json`) | `common` → `edition.volunteers.*` (sous-ensemble transverse) |

Les libellés d'onglets/menu (affichés sur toutes les pages d'édition via `EditionHeader`
et le layout `edition-dashboard`) vivent dans `common.json` (`edition.*`) car ils doivent
être disponibles partout sans charger le domaine complet.

## Ajouter / déplacer un domaine

1. **Créer le fichier** `i18n/locales/{langue}/{domaine}.json` pour les **13 langues**,
   avec la structure JSON donnant le namespace voulu (cf. note plus haut).
2. **Ajouter le loader** dans `app/utils/translation-loaders.ts` → `translationLoaders` :
   une entrée par langue, `() => import('~~/i18n/locales/{langue}/{domaine}.json')`.
3. **Mapper la route** dans `getTranslationsToLoad` (route statique ou pattern dynamique).
4. (Optionnel) ajouter aux `files` de `nuxt.config.ts` seulement si le domaine doit être
   chargé **statiquement** (à éviter sauf cœur commun).

> ⚠️ **Contrainte outillage** : les scripts i18n (`check-i18n.js`,
> `check-i18n-translations.js`, `mark-todo.js`, …) lisent le dossier de langue **à plat**
> (`readdirSync`, non récursif). **Pas de sous-dossiers** dans `i18n/locales/{langue}/` :
> ils seraient invisibles pour ces scripts. Utiliser des fichiers plats à la racine de la
> langue, le namespace étant porté par la structure JSON.

## Vérification

- `npm run check-i18n` : clés manquantes / inutilisées / mal placées.
- `npm run check-translations` : couverture et synchronisation des 13 langues.
- Runtime : DevTools → Network → filtrer `json`, naviguer, vérifier que chaque domaine
  n'est chargé que sur ses routes.

## Débogage (clé manquante / `[intlify] Not found`)

1. Vérifier dans quel fichier/namespace la clé est définie (`grep` dans `i18n/locales/fr`).
2. S'assurer que `getTranslationsToLoad` charge ce domaine pour la route concernée.
3. Si la clé est un **libellé transverse** (nav, menu) affiché hors de ses routes, la
   placer dans `common.json` (`edition.*`).
4. Vérifier la console pour les erreurs de chargement du domaine.
