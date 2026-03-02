# Audit nuxt.config.ts — Mars 2026

Analyse de la configuration Nuxt 4.3.1 du projet.

## Résumé

La config est globalement saine : aucune option dépréciée, structure `app/` en place, bonnes pratiques de base respectées (runtimeConfig, compression, lazy hydration).

## Points d'amélioration identifiés

### ~~1. Ajouter `future.compatibilityVersion: 5`~~ CORRIGÉ

Activé avec `typescriptBundlerResolution: true`. L'analyse d'impact initiale avait identifié des incompatibilités potentielles (mutations profondes, checks `=== null`), mais la vérification manuelle a révélé que tous les cas étaient des **faux positifs** : les mutations profondes concernent des `ref()` locaux (pas des données `useFetch`), et les checks `=== null` portent sur des champs nullable de la BDD (pas sur les valeurs par défaut de `useFetch`). Aucune modification de code nécessaire. Tous les tests passent (367 unit + 1605 nuxt).

Voir [docs/migration-compatibility-v5.md](migration-compatibility-v5.md) pour le détail de l'analyse.

### ~~2. `experimental.appManifest: false` — à reconsidérer (priorité haute)~~ CORRIGÉ

Ligne supprimée — `appManifest` reprend sa valeur par défaut (`true`). Le client respecte maintenant les route rules côté navigation.

### ~~3. `compatibilityDate` potentiellement dans le futur (mineur)~~ CORRIGÉ

Mis à jour à `'2026-03-02'` (date courante).

### 4. Options expérimentales à considérer (priorité moyenne)

| Option                      | Intérêt pour le projet                                             |
| --------------------------- | ------------------------------------------------------------------ |
| `buildCache: true`          | Cache les artefacts de build — accélère les rebuilds en dev Docker |
| `viewTransition: true`      | Transitions de navigation fluides via View Transition API          |
| `typedPages: true`          | Router typé — meilleure DX avec TypeScript                         |
| `crossOriginPrefetch: true` | Prefetch via Speculation Rules API — améliore la navigation        |

### ~~5. Import de `@vitejs/plugin-vue` (priorité basse)~~ VÉRIFIÉ — correct

Utilisé dans `nitro.rollupConfig.plugins` pour compiler 6 templates Vue d'emails côté serveur (`server/emails/*.vue`). Nécessaire car Nitro doit compiler ces SFC pour le rendu des emails.

### ~~6. Import de `vite-tsconfig-paths` (priorité basse)~~ CORRIGÉ

Import et `vite.plugins: [tsconfigPaths()]` supprimés de `nuxt.config.ts`. Nuxt résout nativement les alias `~/` et `@/`. La dépendance reste dans le projet car utilisée par `vitest.config.ts`.

### ~~7. `vite.resolve.alias: {}` vide (cosmétique)~~ CORRIGÉ

Bloc `resolve.alias` vide supprimé.

### ~~8. i18n : `bundle.runtimeOnly: false` (à vérifier)~~ VÉRIFIÉ — correct

Configuration nécessaire : le projet utilise la pluralisation avec `|` (20+ occurrences) et le lazy loading JSON. Le compilateur de messages est requis au runtime pour parser ces syntaxes. `runtimeOnly: false` et `dropMessageCompiler: false` sont corrects.

## Ce qui est déjà bien fait

- **`lazyHydration: true`** — bonne optimisation des performances
- **`emitRouteChunkError: 'automatic'`** — gestion propre des erreurs de chunks
- **`compressPublicAssets`** avec gzip + brotli — bon pour la production
- **`icon.serverBundle: 'remote'`** — réduit la taille du bundle serveur
- **Séparation `runtimeConfig` privé/public** — conforme aux bonnes pratiques de sécurité
- **Lazy loading i18n** — optimise le chargement des traductions
- **`devtools` conditionnel** — pas de surcharge en production
- **Module test-utils conditionnel** — pas chargé en production
- **`nitro.compressPublicAssets`** — compression gzip et brotli des assets
- **`nitro.publicAssets` avec maxAge** — cache HTTP de 30 jours sur les assets statiques
- **`nitro.esbuild.options.target: 'es2020'`** — support BigInt et fonctionnalités modernes
