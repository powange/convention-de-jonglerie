# Roadmap d'uniformisation des retours API

## État des lieux (26 février 2026)

### Chiffres backend (`server/api/` — 366 endpoints)

| Pattern                                                             | Fichiers | %   |
| ------------------------------------------------------------------- | -------- | --- |
| Utilisent `createSuccessResponse()`                                 | 175      | 48% |
| Utilisent `createPaginatedResponse()`                               | 10       | 3%  |
| Retournent `{ success: true }` manuellement (exclus volontairement) | 3        | <1% |
| Retournent des données brutes (pas de wrapper)                      | ~178     | 49% |

| Infrastructure                             | Fichiers | %    |
| ------------------------------------------ | -------- | ---- |
| Utilisent `wrapApiHandler`                 | 366      | 100% |
| Utilisent `defineEventHandler` directement | 0        | 0%   |

### Chiffres frontend (`app/` — fichiers .vue et .ts)

| Pattern                                       | Fichiers |
| --------------------------------------------- | -------- |
| Utilisent `$fetch` directement                | 115      |
| Utilisent `useApiAction` / `useApiActionById` | 83       |

**Note** : Beaucoup de fichiers utilisent les deux (useApiAction pour les mutations, $fetch pour les lectures).

---

## Axes d'uniformisation restants

### Axe 1 — Endpoints sans `defineEventHandler` → `wrapApiHandler` (11 fichiers) ✅ TERMINÉ

**Effort** : Faible | **Impact** : Moyen (gestion d'erreurs centralisée)

~~11 endpoints utilisaient `defineEventHandler` directement au lieu de `wrapApiHandler`.~~

**Migré le 26/02/2026** : Les 11 endpoints ont été migrés vers `wrapApiHandler` avec `requireAuth`. Les `try/catch` manuels avec `console.error` ont été supprimés (gérés par `wrapApiHandler`). 4 fichiers de tests FCM mis à jour pour utiliser le mock `requireAuth` au lieu de `getUserSession`.

---

### Axe 2 — Endpoints bruts → `createSuccessResponse` (~178 fichiers)

**Effort** : Élevé | **Impact** : Moyen (uniformité, typage)

~178 endpoints retournent des données brutes sans wrapper `{ success, data }`. Principalement des GET qui retournent directement les données Prisma.

**Exemples typiques** :

```typescript
// Retour direct d'objet
return updatedOffer

// Retour direct de tableau
return markers

// Retour d'objet composé
return { conventions, total }
```

**Sous-catégories estimées** :

| Type                              | ~Fichiers | Exemple                   |
| --------------------------------- | --------- | ------------------------- |
| GET retournant un objet Prisma    | ~60       | `return edition`          |
| GET retournant un tableau         | ~40       | `return markers`          |
| GET retournant un objet composé   | ~30       | `return { stats, dates }` |
| Mutations (POST/PUT/PATCH/DELETE) | ~48       | `return updatedOffer`     |

**Points à considérer avant de migrer** :

- Le frontend accède déjà à `response.field` directement — changer vers `response.data.field` impacte tous les consommateurs
- Le smart unwrap dans `useApiAction` gère la transition pour les appels via `useApiAction`, mais les `$fetch` directs doivent être mis à jour manuellement
- Les endpoints GET simples (retour direct) n'apportent pas de valeur ajoutée avec `createSuccessResponse` — le code HTTP 200 suffit
- **Recommandation** : Ne migrer que les mutations (POST/PUT/PATCH/DELETE) pour uniformité avec les endpoints déjà migrés. Laisser les GET bruts.

---

### Axe 3 — `$fetch` directs → `useApiAction` (frontend) — Batch 1+2 ✅ TERMINÉ

**Effort** : Moyen | **Impact** : Moyen (loading/toast/erreur automatiques)

115 fichiers frontend utilisent `$fetch` directement. Parmi eux, beaucoup gèrent manuellement le loading state, les toasts d'erreur, et les try/catch.

**Batch 1+2 migré le 26/02/2026** : 9 fichiers migrés (~15 appels `$fetch`), −57 lignes de boilerplate.

| Batch | Fichier                                         | Fonctions migrées                                               |
| ----- | ----------------------------------------------- | --------------------------------------------------------------- |
| 1     | `components/edition/volunteer/MealsCard.vue`    | `fetchMyMeals()`                                                |
| 1     | `components/edition/carpool/CommentsModal.vue`  | `fetchComments()`                                               |
| 1     | `components/artists/MealsModal.vue`             | `fetchMeals()`                                                  |
| 1     | `components/volunteers/MealsModal.vue`          | `fetchMeals()`                                                  |
| 1     | `components/notifications/PushDevicesModal.vue` | `loadDevices()`                                                 |
| 2     | `pages/editions/[id]/artist-space.vue`          | `toggleAfterShow()`                                             |
| 2     | `pages/editions/[id]/commentaires.vue`          | `loadPosts()`, `addComment()`, `deleteComment()`, `togglePin()` |
| 2     | `pages/editions/[id]/lost-found.vue`            | `fetchLostFoundItems()`, `postComment()`                        |
| 2     | `pages/admin/users/index.vue`                   | `impersonateUser()`                                             |

**Fichiers skipés (3)** :

- `Table.vue` — logique trop complexe (refreshApplications avec multi-state)
- `workshops.vue` — méthode HTTP dynamique POST/DELETE selon l'état (incompatible useApiAction)
- `profile.vue` — toast conditionnel de succès, `useToast()` toujours nécessaire ailleurs

**Batch 3 — GETs avec loading+toast** (5 fichiers) ✅ TERMINÉ le 26/02/2026 :

| Fichier                                         | Fonction                | Statut                                                     |
| ----------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| `pages/editions/[id]/workshops.vue`             | `fetchWorkshops()`      | ✅ Migré                                                   |
| `pages/editions/[id]/gestion/artists/index.vue` | `fetchArtists()`        | ✅ Migré                                                   |
| `pages/editions/[id]/gestion/artists/shows.vue` | `fetchShows()`          | ✅ Migré                                                   |
| `pages/editions/[id]/gestion/meals/list.vue`    | `generateCateringPdf()` | ❌ Skip — $fetch = 1 étape dans génération PDF             |
| `pages/admin/error-logs.vue`                    | `loadLogs()`            | ❌ Skip — réponse paginée complexe (data+stats+pagination) |

**Batch 4 — Pages complexes** (5 fichiers) ✅ TERMINÉ le 26/02/2026 :

| Fichier                                                    | Fonctions migrées                                                                                              | Statut                                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pages/editions/[id]/gestion/meals/validate.vue`           | `fetchMeals()`, `searchPeople()`, `fetchPendingList()`                                                         | ✅ 3 GETs migrés                                                                       |
| `pages/editions/[id]/gestion/ticketing/access-control.vue` | `loadVolunteersNotValidated()`, `loadArtistsNotValidated()`, `loadOrganizersNotValidated()`, `searchTickets()` | ✅ 4 fonctions migrées                                                                 |
| `pages/conventions/[id]/editions/add.vue`                  | —                                                                                                              | ❌ Skip — `editionStore.addEdition()` (store, pas $fetch) + onMounted throw 403 manuel |
| `pages/verify-email.vue`                                   | —                                                                                                              | ❌ Skip — loading partagé, erreurs inline (pas toast), auth state + sessionStorage     |
| `pages/login.vue`                                          | —                                                                                                              | ❌ Skip — loading partagé entre 3 fonctions, `authStore.login()`, erreurs 401/403/409  |

**Note** : Pour `validate.vue`, les fonctions `validateMeal()`/`cancelMeal()` (prévues initialement) utilisent un loading per-item (`validatingIds` array), incompatible avec `useApiAction`. Les 3 GETs ont été migrés à la place.

**Batch 5 — Cas optionnels, bas impact** (6 fichiers) :

| Fichier                                               | Fonctions                                         | Notes                         |
| ----------------------------------------------------- | ------------------------------------------------- | ----------------------------- |
| `pages/admin/index.vue`                               | `loadStats()`, `loadActivity()`                   | GETs admin                    |
| `pages/admin/notifications.vue`                       | `loadRecentNotifications()`                       | GET admin                     |
| `pages/admin/feedback.vue`                            | `loadFeedback()`                                  | GET paginé                    |
| `pages/admin/conventions.vue`                         | `exportEdition()`                                 | Mutation admin                |
| `components/workshops/ImportFromImageModal.vue`       | `extractWorkshops()`, `importSelectedWorkshops()` | `Promise.allSettled` complexe |
| `components/notifications/PushNotificationToggle.vue` | `toggleNotifications()`                           | Logique browser avant $fetch  |

**Non-candidats** — `$fetch` à garder tel quel :

- `useAsyncData(() => $fetch(...))` — pattern Nuxt pour le SSR/hydration
- Composables utilitaires (useMessenger, useTypingIndicator) — logique complexe avec state management
- Appels fire-and-forget (mark-read, typing indicators)
- Stores Pinia — gestion d'état globale

**Bénéfice** : Réduction du code boilerplate, comportement uniforme des toasts et du loading.

---

### Axe 4 — `{ success: true }` manuels (3 fichiers exclus)

**Effort** : Négligeable | **Impact** : Nul

3 fichiers retournent manuellement `{ success: true }` et sont volontairement exclus :

- `admin/generate-import-json.post.ts` — retour interne d'une fonction, pas une réponse API directe
- `admin/generate-import-json-agent.post.ts` — idem
- `admin/notifications/push-test.post.ts` — champ `success` dynamique (booléen variable selon le résultat du test)

**Recommandation** : Ne pas migrer. Ces cas sont légitimes.

---

## Priorités recommandées

| Priorité | Axe                                                         | Effort | Valeur                | Statut       |
| -------- | ----------------------------------------------------------- | ------ | --------------------- | ------------ |
| ~~1~~    | Axe 1 — 11 fichiers `defineEventHandler` → `wrapApiHandler` | Faible | Sécurité/logging      | ✅ Terminé   |
| 1        | Axe 3 — `$fetch` → `useApiAction` (pages CRUD)              | Moyen  | Réduction boilerplate | Batch 1-4 ✅ |
| 2        | Axe 2 — Mutations brutes → `createSuccessResponse`          | Moyen  | Uniformité            | À faire      |
| -        | Axe 4 — 3 fichiers exclus                                   | -      | Pas nécessaire        | -            |

---

## Historique des migrations terminées

| Phase      | Date       | Scope                                                               | Résultat                                                                            |
| ---------- | ---------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Phase 1    | 26/02/2026 | 19 fichiers (Groupes C+B) — message-only et data-already            | Remplacement mécanique, sans impact frontend                                        |
| Phase 2    | 26/02/2026 | ~94 fichiers (Groupe A) — champs à la racine                        | Smart unwrap + migration backend + 13 $fetch directs corrigés + 25 tests mis à jour |
| Axe 1      | 26/02/2026 | 11 fichiers `defineEventHandler` → `wrapApiHandler`                 | Migration + suppression try/catch manuels + 4 tests FCM mis à jour                  |
| Axe 3 B1+2 | 26/02/2026 | 9 fichiers `$fetch` → `useApiAction` (composants + pages mutations) | ~15 appels migrés, −57 lignes boilerplate, 3 fichiers skipés                        |
| Axe 3 B3   | 26/02/2026 | 3 fichiers `$fetch` GET → `useApiAction` (pages gestion)            | 3 appels migrés, −20 lignes boilerplate, 2 fichiers skipés                          |
| Axe 3 B4   | 26/02/2026 | 2 fichiers `$fetch` → `useApiAction` (validate + access-control)    | 7 appels migrés, −60 lignes boilerplate, 3 fichiers skipés                          |

Détails dans `docs/migration-createSuccessResponse.md`.

---

## Fichiers clés

| Fichier                                   | Rôle                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `server/utils/api-helpers.ts`             | Helpers `createSuccessResponse`, `createPaginatedResponse`, `wrapApiHandler` |
| `server/types/api.ts`                     | Types `ApiSuccessResponse`, `ApiPaginatedResponse`                           |
| `app/composables/useApiAction.ts`         | Composable frontend + `unwrapApiResponse()`                                  |
| `docs/migration-createSuccessResponse.md` | Détail des Phases 1 et 2                                                     |
| `docs/migration-useApiAction.md`          | Guide de migration `$fetch` → `useApiAction`                                 |

---

**Dernière mise à jour** : 26 février 2026 (Axe 3 Batch 1-4 terminé)
