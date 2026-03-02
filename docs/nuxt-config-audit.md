# Audit nuxt.config.ts — Mars 2026

Analyse de la configuration Nuxt 4.3.1 du projet.

## Résumé

La config est globalement saine : aucune option dépréciée, structure `app/` en place, bonnes pratiques de base respectées (runtimeConfig, compression, lazy hydration).

## Points d'amélioration identifiés

### 1. Ajouter `future.compatibilityVersion: 5` (priorité haute)

Recommandation principale de Nuxt 4 pour préparer la migration vers Nuxt 5. Actuellement absent.

```ts
future: {
  compatibilityVersion: 5,
  typescriptBundlerResolution: true,
}
```

**Ce que ça active :**

- `useAsyncData`/`useFetch` utilisent `shallowRef` au lieu de `ref` (plus performant)
- Les valeurs par défaut de `data`/`error` deviennent `undefined` au lieu de `null`
- `noUncheckedIndexedAccess: true` en TypeScript
- Normalisation des noms de composants et scanning des index dans les middleware

**Attention** : nécessite de vérifier que le code existant n'utilise pas `data.value === null` ou des accès indexés non vérifiés. Passage progressif avec tests recommandé.

### 2. `experimental.appManifest: false` — à reconsidérer (priorité haute)

Ligne 392 — désactivé alors qu'activé par défaut et recommandé. Permet au client de respecter les route rules côté navigation. Sans elle, les `routeRules` (comme le layout `edition-dashboard`) ne sont appliquées que côté serveur.

Sauf raison spécifique connue, supprimer cette ligne ou remettre à `true`.

### 3. `compatibilityDate` potentiellement dans le futur (mineur)

Ligne 7 — `compatibilityDate: '2025-07-15'` est une date future par rapport à la version de Nuxt utilisée au moment de sa configuration. Normalement cette date correspond au jour de la mise à jour, pour verrouiller les comportements de Nitro. Peut être mis à jour à la date courante.

### 4. Options expérimentales à considérer (priorité moyenne)

| Option                         | Intérêt pour le projet                                          |
| ------------------------------ | --------------------------------------------------------------- |
| `buildCache: true`             | Cache les artefacts de build — accélère les rebuilds en dev Docker |
| `viewTransition: true`         | Transitions de navigation fluides via View Transition API       |
| `typedPages: true`             | Router typé — meilleure DX avec TypeScript                      |
| `crossOriginPrefetch: true`    | Prefetch via Speculation Rules API — améliore la navigation     |

### 5. Import inutile de `@vitejs/plugin-vue` (priorité basse)

Ligne 1 — utilisé dans `nitro.rollupConfig.plugins`. Inhabituel car Nuxt gère déjà la compilation Vue via Vite. Ce plugin est normalement nécessaire uniquement pour compiler des SFC dans des fichiers serveur Nitro. Si ce n'est pas le cas, cette ligne et la config `rollupConfig` peuvent être supprimées.

### 6. Import de `vite-tsconfig-paths` (priorité basse)

Ligne 3 — utilisé dans `vite.plugins`. Nuxt gère nativement les alias de paths. Avec `future.typescriptBundlerResolution: true`, ce plugin pourrait devenir redondant. À vérifier si sa suppression casse quelque chose.

### 7. `vite.resolve.alias: {}` vide (cosmétique)

Ligne 379-381 — objet alias vide qui ne fait rien. Peut être supprimé.

### 8. i18n : `bundle.runtimeOnly: false` (à vérifier)

Ligne 301 — désactivé, ce qui inclut le compilateur de messages dans le bundle. Cohérent avec `dropMessageCompiler: false` (ligne 304), mais augmente la taille du JS client. Si les messages ne contiennent pas de syntaxe complexe ICU nécessitant une compilation runtime, `runtimeOnly: true` réduirait la taille du bundle.

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
