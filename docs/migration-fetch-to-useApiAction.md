# Migration `$fetch` → `useApiAction`

> Analyse des appels `$fetch` directs dans le frontend pour migration progressive vers `useApiAction`/`useApiActionById`.

**Date de l'analyse** : 18 mars 2026
**Total d'appels `$fetch`** : ~228
**Objectif** : Migrer progressivement les appels `$fetch` directs vers `useApiAction` côté front, et les retours bruts vers `createSuccessResponse` côté serveur, pour uniformiser la gestion des réponses API (unwrap automatique, loading, erreurs).

## Résumé

| Catégorie                | Nombre   | %   |
| ------------------------ | -------- | --- |
| Bons candidats           | ~35-40   | 16% |
| Possibles mais complexes | ~45-55   | 22% |
| Pas approprié            | ~135-145 | 62% |

---

## Bons candidats (priorité haute, risque faible)

Appels simples avec pattern try/catch/loading/toast, facilement remplaçables.

### Composants

- [x] **`components/volunteers/AddVolunteerModal.vue`** (2/3 appels migrés)
  - GET recherche user par email — non migré (debounce watch, pas adapté)
  - POST ajout bénévole manuel — migré
  - POST création user + ajout bénévole — migré

- [ ] **`components/show-application/Chat.vue`** (2 appels)
  - GET fetch messages
  - POST créer conversation

- [ ] **`components/feedback/FeedbackModal.vue`** (1 appel)
  - POST soumission feedback

- [ ] **`components/artists/ArtistModal.vue`** (1 appel)
  - GET recherche user par email

- [ ] **`components/ticketing/EmailValidationInput.vue`** (1 appel)
  - POST vérification existence email

- [ ] **`components/notifications/PushNotificationToggle.vue`** (1 appel)
  - GET vérification statut FCM

### Pages

- [ ] **`pages/profile.vue`** (3 appels)
  - PUT mise à jour photo de profil
  - GET chargement préférences notifications
  - GET vérification si l'utilisateur a un mot de passe

- [ ] **`pages/login.vue`** (3 appels)
  - POST vérification existence email
  - POST validation email
  - POST inscription

- [ ] **`pages/verify-email.vue`** (2 appels)
  - POST vérification token email
  - POST renvoi code de vérification

- [ ] **`pages/auth/reset-password.vue`** (1 appel)
  - POST vérification token de reset

- [ ] **`pages/editions/[id]/workshops.vue`** (2 appels)
  - POST toggle favori atelier
  - POST suppression favori atelier

- [ ] **`pages/editions/[id]/gestion/meals/validate.vue`** (2 appels)
  - POST validation repas
  - POST annulation repas

- [ ] **`pages/editions/[id]/gestion/ticketing/access-control.vue`** (2 appels)
  - POST validation entrée
  - POST invalidation entrée

### Composables

- [ ] **`composables/useFirebaseMessaging.ts`** (2 appels)
  - POST subscribe FCM
  - POST unsubscribe FCM

- [ ] **`composables/useMessenger.ts`** (2 appels)
  - PATCH suppression message
  - PATCH marquer message comme lu

- [ ] **`composables/useTypingIndicator.ts`** (2 appels)
  - POST envoi indicateur de frappe
  - DELETE arrêt indicateur de frappe

### Stores

- [ ] **`stores/notifications.ts`** (4 appels)
  - POST marquer notification lue
  - POST marquer notification non lue
  - PUT marquer tout comme lu
  - POST supprimer notification

- [ ] **`stores/favoritesEditions.ts`** (1 appel)
  - POST toggle favori édition

---

## Possibles mais complexes

Appels avec try/catch mais impliquant une gestion d'état plus élaborée. Migration possible mais demande plus d'attention.

### Composables avec état interne

- [ ] **`composables/useVolunteerTeams.ts`** (4 appels) — CRUD équipes avec refs internes
- [ ] **`composables/useVolunteerTimeSlots.ts`** (4 appels) — CRUD créneaux avec refs internes
- [ ] **`composables/useTicketingSettings.ts`** (2 appels) — Chargement/MAJ paramètres
- [ ] **`composables/useAccessControlPermissions.ts`** (1 appel) — Fetch permissions
- [ ] **`composables/useEditionMarkers.ts`** et **`useEditionZones.ts`** — Fetch données carte
- [ ] **`composables/useUserDeletion.ts`** (1 appel) — Suppression compte avec confirmation
- [ ] **`composables/useCarpoolForm.ts`** (1 appel) — Soumission formulaire covoiturage

### Stores Pinia

- [ ] **`stores/editions.ts`** (8 appels) — CRUD éditions, intégration state Pinia
- [ ] **`stores/auth.ts`** (4 appels) — Opérations auth, critique

### Pages admin avec pagination

- [ ] **`pages/admin/users/index.vue`** — Fetch users avec pagination
- [ ] **`pages/admin/backup.vue`** — Liste des sauvegardes (simple GET)
- [ ] **`pages/admin/error-logs.vue`** (2 appels) — Logs avec pagination
- [ ] **`pages/admin/notifications.vue`** (2 appels) — Recherche utilisateurs

### Autres pages

- [ ] **`pages/my-conventions.vue`** (3 appels) — Recherche users, conventions, dashboard
- [ ] **`pages/editions/[id]/gestion/meals/index.vue`** (2 appels) — Fetch données repas

---

## Pas approprié (garder `$fetch`)

Ces appels doivent rester en `$fetch` direct pour des raisons techniques.

| Raison                      | Exemples                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| **SSE / streaming**         | `useTicketingCounter.ts` (SSE temps réel, sync offline), `useImportGeneration.ts` (EventSource) |
| **Middleware / SSR**        | `middleware/auth-protected.ts`, appels dans `useFetch`/`useAsyncData`                           |
| **`Promise.all` parallèle** | `pages/editions/[id]/gestion/ticketing/orders.vue`, `workshops/index.vue`                       |
| **Utilitaires partagés**    | `utils/volunteer-application-api.ts`, `utils/ticketing/orders.ts`, `tiers.ts`, `options.ts`     |
| **Workflows multi-étapes**  | Modales de billetterie, gestion organisateurs, review candidatures                              |
| **Téléchargement / export** | `pages/admin/conventions.vue` (export fichier)                                                  |
| **Pages temps réel**        | `pages/editions/[id]/gestion/ticketing/stats.vue` (rafraîchissement fréquent)                   |
| **Layouts**                 | `layouts/edition-dashboard.vue` (vérification accès)                                            |

---

## Comment migrer

### Côté serveur : vérifier `createSuccessResponse`

Lors de chaque migration, **vérifier systématiquement** que l'endpoint API utilise `createSuccessResponse`. Si l'endpoint retourne des données brutes (ex: `return { users }` au lieu de `return createSuccessResponse({ users })`), le migrer en même temps.

**Pattern avant (serveur) :**

```typescript
// ❌ Retour brut — le front doit typer manuellement response.users
return { users }
```

**Pattern après (serveur) :**

```typescript
// ✅ Format standardisé — useApiAction unwrap automatiquement
return createSuccessResponse({ users })
```

> **Important** : Quand on migre un endpoint serveur vers `createSuccessResponse`, il faut aussi corriger **tous les appels `$fetch` directs** qui consomment cet endpoint (pas seulement celui qu'on est en train de migrer). Chercher tous les usages avec `grep` avant de modifier.

### Côté front : Pattern avant (à remplacer)

```typescript
const loading = ref(false)

const doSomething = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/endpoint', {
      method: 'POST',
      body: { data },
    })
    // Traiter response.data.xxx
    toast.add({ title: 'Succès', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', color: 'error' })
  } finally {
    loading.value = false
  }
}
```

### Côté front : Pattern après (useApiAction)

```typescript
const { execute: doSomething, loading } = useApiAction('/api/endpoint', {
  method: 'POST',
  body: () => ({ data }),
  successMessage: { title: t('success_key') },
  errorMessages: { default: t('error_key') },
  onSuccess: (response) => {
    // response est déjà unwrappé (pas de .data)
  },
})
```

### Points d'attention

- `useApiAction` unwrap automatiquement `createSuccessResponse` — accéder directement à `response.xxx` au lieu de `response.data.xxx`
- Pour les actions par ID, utiliser `useApiActionById`
- Pour les appels silencieux (sans toast), utiliser `silent: true`
- Le `loading` est géré automatiquement
