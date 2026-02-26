# Roadmap d'uniformisation des retours API

## État des lieux (26 février 2026)

### Chiffres backend (`server/api/` — 366 endpoints)

| Pattern                                                             | Fichiers | %   |
| ------------------------------------------------------------------- | -------- | --- |
| Utilisent `createSuccessResponse()`                                 | 175      | 48% |
| Utilisent `createPaginatedResponse()`                               | 10       | 3%  |
| Retournent `{ success: true }` manuellement (exclus volontairement) | 3        | <1% |
| Retournent des données brutes (pas de wrapper)                      | ~178     | 49% |

| Infrastructure                             | Fichiers | %   |
| ------------------------------------------ | -------- | --- |
| Utilisent `wrapApiHandler`                 | 355      | 97% |
| Utilisent `defineEventHandler` directement | 11       | 3%  |

### Chiffres frontend (`app/` — fichiers .vue et .ts)

| Pattern                                       | Fichiers |
| --------------------------------------------- | -------- |
| Utilisent `$fetch` directement                | 115      |
| Utilisent `useApiAction` / `useApiActionById` | 83       |

**Note** : Beaucoup de fichiers utilisent les deux (useApiAction pour les mutations, $fetch pour les lectures).

---

## Axes d'uniformisation restants

### Axe 1 — Endpoints sans `defineEventHandler` → `wrapApiHandler` (11 fichiers)

**Effort** : Faible | **Impact** : Moyen (gestion d'erreurs centralisée)

11 endpoints utilisent encore `defineEventHandler` directement au lieu de `wrapApiHandler` :

**Commentaires bénévoles (3 fichiers)** :

- `server/api/conventions/[id]/volunteers/[userId]/comment.delete.ts`
- `server/api/conventions/[id]/volunteers/[userId]/comment.get.ts`
- `server/api/conventions/[id]/volunteers/[userId]/comment.put.ts`

**Messenger (3 fichiers)** :

- `server/api/messenger/organizers-group.post.ts`
- `server/api/messenger/team-conversation.post.ts`
- `server/api/messenger/volunteer-to-organizers.post.ts`

**Notifications FCM (4 fichiers)** :

- `server/api/notifications/fcm/devices.get.ts`
- `server/api/notifications/fcm/devices/[id].delete.ts`
- `server/api/notifications/fcm/subscribe.post.ts`
- `server/api/notifications/fcm/unsubscribe.post.ts`

**Ticketing stats (1 fichier)** :

- `server/api/editions/[id]/ticketing/stats/order-sources.get.ts`

**Bénéfice** : Ces endpoints n'ont pas de gestion d'erreurs centralisée (pas de logging, pas de formatage d'erreur uniforme). Migrer vers `wrapApiHandler` apporte automatiquement le logging structuré et la gestion d'erreurs Prisma.

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

### Axe 3 — `$fetch` directs → `useApiAction` (frontend)

**Effort** : Moyen | **Impact** : Moyen (loading/toast/erreur automatiques)

115 fichiers frontend utilisent `$fetch` directement. Parmi eux, beaucoup gèrent manuellement le loading state, les toasts d'erreur, et les try/catch.

**Candidats prioritaires** — fichiers avec pattern try/catch/loading/toast manuel :

- Pages de gestion avec formulaires (CRUD)
- Modals avec actions de sauvegarde
- Pages admin avec actions destructives

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

| Priorité | Axe                                                         | Effort | Valeur                |
| -------- | ----------------------------------------------------------- | ------ | --------------------- |
| 1        | Axe 1 — 11 fichiers `defineEventHandler` → `wrapApiHandler` | Faible | Sécurité/logging      |
| 2        | Axe 3 — `$fetch` → `useApiAction` (pages CRUD)              | Moyen  | Réduction boilerplate |
| 3        | Axe 2 — Mutations brutes → `createSuccessResponse`          | Moyen  | Uniformité            |
| -        | Axe 4 — 3 fichiers exclus                                   | -      | Pas nécessaire        |

---

## Historique des migrations terminées

| Phase   | Date       | Scope                                                    | Résultat                                                                            |
| ------- | ---------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Phase 1 | 26/02/2026 | 19 fichiers (Groupes C+B) — message-only et data-already | Remplacement mécanique, sans impact frontend                                        |
| Phase 2 | 26/02/2026 | ~94 fichiers (Groupe A) — champs à la racine             | Smart unwrap + migration backend + 13 $fetch directs corrigés + 25 tests mis à jour |

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

**Dernière mise à jour** : 26 février 2026
