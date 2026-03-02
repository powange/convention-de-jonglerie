# Migration `future.compatibilityVersion: 5` — Résultat

## Statut : TERMINÉ (2 mars 2026) — Aucune modification de code nécessaire

```ts
future: {
  compatibilityVersion: 5,
  typescriptBundlerResolution: true,
}
```

## Ce que ça active

- `useAsyncData`/`useFetch` utilisent `shallowRef` au lieu de `ref` (plus performant)
- Les valeurs par défaut de `data`/`error` deviennent `undefined` au lieu de `null`
- `noUncheckedIndexedAccess: true` en TypeScript
- Normalisation des noms de composants et scanning des index dans les middleware

## Contexte du projet

- **37 usages** de `useFetch`/`useAsyncData` dans `app/`
- **Audit réalisé le 2 mars 2026**

---

## Analyse d'impact — Faux positifs

L'analyse initiale (automatisée) avait identifié ~8 checks `=== null` et ~10 mutations profondes comme potentiellement incompatibles. La vérification manuelle a révélé que **tous les cas étaient des faux positifs**.

### Axe 1 : `shallowRef` au lieu de `ref` — AUCUN IMPACT

Les mutations profondes identifiées (`push()`, assignation par index, spread imbriqué) concernent toutes des **`ref()` locaux**, pas des données `useFetch` :

| Fichier            | Variable         | Type réel                                                                   | Impact |
| ------------------ | ---------------- | --------------------------------------------------------------------------- | ------ |
| `artist-space.vue` | `artistResponse` | `useFetch` — mais mutations via `.value = { ... }` (réassignation complète) | Aucun  |
| `lost-found.vue`   | `lostFoundItems` | `ref<LostFoundItem[]>([])` — ref local                                      | Aucun  |
| `commentaires.vue` | `posts`          | `ref<Record<string, unknown>[]>([])` — ref local                            | Aucun  |

### Axe 2 : `undefined` au lieu de `null` — AUCUN IMPACT

Les checks `=== null` identifiés portent sur des **champs nullable de la base de données** ou des **refs locaux initialisés à `null`**, pas sur les valeurs par défaut de `useFetch` :

| Fichier            | Pattern                              | Type réel                                        | Impact |
| ------------------ | ------------------------------------ | ------------------------------------------------ | ------ |
| `artist-space.vue` | `artist.payment !== null`            | Champ BDD nullable (`Decimal?`)                  | Aucun  |
| `artist-space.vue` | `artist.reimbursementMax !== null`   | Champ BDD nullable (`Decimal?`)                  | Aucun  |
| `artist-space.vue` | `savingMealId !== null`              | `ref<number \| null>(null)` — ref local          | Aucun  |
| `artist-space.vue` | `artist` computed                    | Utilise `?? null` fallback — gère `undefined`    | Aucun  |
| `apply.vue`        | `existingApplication.value !== null` | `ref<ShowApplication \| null>(null)` — ref local | Aucun  |

### Axe 3 : `noUncheckedIndexedAccess` — AUCUNE ERREUR

Aucune erreur TypeScript détectée lors de l'activation. Les tests passent sans modification.

---

## Résultat

- **Activation directe** de `compatibilityVersion: 5` + `typescriptBundlerResolution: true`
- **0 fichier modifié** (hors `nuxt.config.ts`)
- **367 tests unitaires** : tous passent
- **1605 tests Nuxt** : tous passent
