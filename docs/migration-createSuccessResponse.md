# Migration vers `createSuccessResponse`

## Objectif

Uniformiser les retours API côté backend en utilisant le helper `createSuccessResponse()` au lieu de construire manuellement `{ success: true, ... }` dans chaque endpoint.

**Statut : Phase 2 terminée (26 février 2026)**

---

## État actuel (analyse du 2026-02-26)

### Chiffres

| Catégorie                                      | Fichiers | %    |
| ---------------------------------------------- | -------- | ---- |
| Total endpoints API                            | 366      | 100% |
| Utilisent `createSuccessResponse()`            | ~160     | 44%  |
| Utilisent `createPaginatedResponse()`          | 10       | 3%   |
| Retournent `{ success: true }` manuellement    | 3        | <1%  |
| Retournent des données brutes (pas de wrapper) | ~193     | 53%  |

### Helper existant

**Fichier** : `server/utils/api-helpers.ts`

```typescript
export function createSuccessResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    ...(message && { message }),
    data,
  }
}
```

**Type** : `server/types/api.ts`

```typescript
export interface ApiSuccessResponse<T = unknown> {
  success: true
  message?: string
  data: T
}
```

Le helper retourne `{ success: true, data: T }` — il **wrappe dans `data`**.

---

## Les 4 groupes de fichiers

### Groupe C — Message-only (18 fichiers) ✅ MIGRÉ (Phase 1 — 26/02/2026)

Retournent uniquement `{ success: true }` ou `{ success: true, message: '...' }` sans données.

**Fichiers migrés** :

1. `server/api/editions/[id]/shows/[showId].delete.ts`
2. `server/api/editions/[id]/markers/[markerId].delete.ts`
3. `server/api/editions/[id]/zones/[zoneId].delete.ts`
4. `server/api/editions/[id]/ticketing/invalidate-entry.post.ts`
5. `server/api/notifications/fcm/devices/[id].delete.ts`
6. `server/api/editions/[id]/organizers/edition-organizers/[editionOrganizerId].delete.ts`
7. `server/api/notifications/fcm/subscribe.post.ts`
8. `server/api/notifications/[id]/delete.delete.ts`
9. `server/api/messenger/conversations/[conversationId]/mark-read.patch.ts`
10. `server/api/admin/fix-session.post.ts`
11. `server/api/conventions/[id]/volunteers/[userId]/comment.delete.ts`
12. `server/api/editions/[id]/artists/[artistId].delete.ts`
13. `server/api/editions/[id]/meals/[mealId]/cancel.post.ts`
14. `server/api/editions/[id]/ticketing/orders/[orderId]/payment-method.patch.ts`
15. `server/api/editions/[id]/ticketing/orders/[orderId]/index.delete.ts`
16. `server/api/editions/[id]/ticketing/counters/[counterId].delete.ts`
17. `server/api/editions/[id]/ticketing/external/index.delete.ts`
18. `server/api/admin/backup/delete.delete.ts`

---

### Groupe B — Déjà au format data (1 fichier) ✅ MIGRÉ (Phase 1 — 26/02/2026)

Retournait déjà `{ success: true, data: result }` manuellement.

**Fichier migré** :

- `server/api/messenger/private.post.ts` → `createSuccessResponse(result)`

---

### Groupe A — Champs à la racine (~94 fichiers) ✅ MIGRÉ (Phase 2 — 26/02/2026)

Retournaient `{ success: true, field1: ..., field2: ... }` avec des champs **à la racine** (pas wrappés dans `data`).

**Approche utilisée** : Smart unwrap dans `useApiAction` — la fonction `unwrapApiResponse()` détecte automatiquement le format `createSuccessResponse` et extrait `data` avant de le passer aux callbacks. Cela rend la migration backend transparente pour le frontend.

**Changements clés** :

1. **`app/composables/useApiAction.ts`** : Ajout de `unwrapApiResponse()` appliquée dans `useApiAction` (3 endroits) et `useApiActionById` (2 endroits)
2. **`app/components/edition/volunteer/MealsCard.vue`** : Seul callback frontend modifié (retrait de `response.success &&` redondant)
3. **~94 fichiers `server/api/**/\*.ts`** : `{ success: true, ... }`→`createSuccessResponse(...)`
4. **25 fichiers de tests** : Assertions mises à jour pour le nouveau format `result.data.field`

**3 fichiers légitimement exclus** :

- `generate-import-json.post.ts` / `generate-import-json-agent.post.ts` — retours internes (pas des réponses API)
- `push-test.post.ts` — champ `success` dynamique (booléen variable)

---

### Groupe D — Déjà migrés (~28 fichiers) ✅ TERMINÉ

Utilisent déjà `createSuccessResponse()` ou `createPaginatedResponse()`.

**Fichiers utilisant `createSuccessResponse`** (18) :

- `server/api/editions/[id]/shows/index.get.ts`
- `server/api/admin/anonymize-users.post.ts`
- `server/api/editions/[id]/posts/[postId]/comments/[commentId]/index.delete.ts`
- `server/api/editions/[id]/posts/[postId]/index.delete.ts`
- `server/api/auth/logout.post.ts`
- `server/api/profile/change-password.post.ts`
- `server/api/editions/[id]/ticketing/custom-fields/[customFieldId]/associations.put.ts`
- `server/api/editions/[id]/ticketing/tiers/reorder.put.ts`
- `server/api/editions/[id]/volunteers/applications/[applicationId]/index.delete.ts`
- `server/api/editions/[id]/volunteers/applications/index.delete.ts`
- `server/api/editions/[id]/posts/[postId]/pin.patch.ts`
- `server/api/editions/[id]/workshops/[workshopId]/favorite.delete.ts`
- `server/api/editions/[id]/workshops/locations/[locationId].delete.ts`
- `server/api/editions/[id]/workshops/[workshopId].delete.ts`
- `server/api/editions/[id]/ticketing/volunteers/returnable-items/[itemId].delete.ts`
- `server/api/editions/[id]/ticketing/quotas/[quotaId].delete.ts`
- `server/api/editions/[id]/ticketing/custom-fields/[customFieldId].delete.ts`
- `server/api/editions/[id]/ticketing/organizers/returnable-items/[itemId].delete.ts`

**Fichiers utilisant `createPaginatedResponse`** (10) :

- `server/api/editions/index.get.ts`
- `server/api/admin/users/index.get.ts`
- `server/api/editions/[id]/volunteers/applications.get.ts`
- `server/api/messenger/conversations/[conversationId]/messages/index.get.ts`
- `server/api/notifications/index.get.ts`
- `server/api/editions/[id]/ticketing/orders.get.ts`
- `server/api/editions/[id]/meals/participants.get.ts`
- `server/api/admin/notifications/recent.get.ts`
- `server/api/admin/error-logs.get.ts`
- `server/api/admin/feedback/index.get.ts`

---

## Plan de migration

### Phase 1 : Groupes C + B (19 fichiers) — Sans impact frontend ✅ TERMINÉ

**Effort** : Faible. Remplacement mécanique.

**Résultat** : 19 fichiers migrés (18 Group C + 1 Group B). Tests globaux de test setup mis à jour pour exposer `createSuccessResponse` comme global Nitro (`test/setup.ts`, `test/setup-mocks.ts`). 2 assertions de tests mises à jour pour inclure `data: null`.

### Phase 2 : Groupe A (~94 fichiers) — Smart unwrap ✅ TERMINÉ (26/02/2026)

**Effort** : Moyen. Migration backend mécanique, 1 seule modification frontend.

**Approche retenue** : Smart unwrap dans `useApiAction` via `unwrapApiResponse()`.

La fonction détecte le format `createSuccessResponse` (objet avec uniquement les clés `success`, `data`, `message` et `success === true`) et extrait automatiquement `data` avant de le passer aux callbacks. Cela rend la migration backend transparente pour le frontend existant.

**Résultat** : ~94 fichiers backend migrés, 25 fichiers de tests mis à jour, 1 fichier frontend corrigé (`MealsCard.vue`). Tous les tests passent (367 unit + 1614 nuxt).

### Phase 3 (optionnelle) : Endpoints sans wrapper (~196 fichiers)

Les endpoints GET qui retournent des données brutes. Décision à prendre :

- Les laisser sans wrapper (plus simple, réponse plus légère)
- Les wrapper aussi pour uniformité totale

**Recommandation** : Les laisser tels quels. Les GET de lecture n'ont pas besoin de `success: true` — les erreurs sont gérées par `wrapApiHandler` et le code HTTP suffit.

---

## Vérification

Après chaque phase :

1. `npm run lint` — 0 erreur
2. `npm run test:unit:run` — tous les tests passent
3. `npm run test:nuxt:run` — tous les tests passent
4. Test manuel des pages concernées

---

## Fichiers clés

| Fichier                           | Rôle                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `server/utils/api-helpers.ts`     | Helper `createSuccessResponse` et `createPaginatedResponse`  |
| `server/types/api.ts`             | Types `ApiSuccessResponse`, `ApiPaginatedResponse`           |
| `app/composables/useApiAction.ts` | Consommateur principal côté frontend + `unwrapApiResponse()` |

---

**Dernière mise à jour** : 26 février 2026
