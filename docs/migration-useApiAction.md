# Migration vers `useApiAction`

## Objectif

Le composable `useApiAction` centralise la gestion des appels API avec :

- Loading state automatique
- Affichage des toasts de succès/erreur
- Gestion des erreurs par code HTTP
- Callbacks et redirections

Il remplace le pattern répétitif try/catch/loading/toast présent dans plus de 60 fichiers.

## Comment utiliser `useApiAction`

### Syntaxe de base

```typescript
const { execute, loading } = useApiAction('/api/endpoint', {
  method: 'POST',
  body: () => formData,
  successMessage: { title: t('success_key') },
  errorMessages: { default: t('error_key') },
  onSuccess: () => {
    /* callback */
  },
})
```

### Options disponibles

| Option              | Type                                              | Description                                            |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| `method`            | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'` | Méthode HTTP (défaut: POST)                            |
| `body`              | `TData \| () => TData`                            | Corps de la requête (fonction pour données dynamiques) |
| `successMessage`    | `{ title: string, description?: string }`         | Toast de succès                                        |
| `errorMessages`     | `{ default?: string, [statusCode]: string }`      | Messages d'erreur par code HTTP                        |
| `silent`            | `boolean`                                         | Désactive tous les toasts                              |
| `silentSuccess`     | `boolean`                                         | Désactive uniquement le toast de succès                |
| `silentError`       | `boolean`                                         | Désactive uniquement le toast d'erreur                 |
| `onSuccess`         | `(result) => void`                                | Callback après succès                                  |
| `onError`           | `(error) => void`                                 | Callback après erreur                                  |
| `redirectOnSuccess` | `string \| (result) => string`                    | Redirection après succès                               |
| `redirectOnError`   | `{ [statusCode]: string }`                        | Redirection conditionnelle sur erreur                  |
| `refreshOnSuccess`  | `() => void`                                      | Fonction de refresh après succès                       |

### Valeurs retournées

```typescript
const {
  execute,  // Fonction pour exécuter l'appel
  loading,  // Ref<boolean> - état de chargement
  error,    // Ref<ApiError | null> - dernière erreur
  data,     // Ref<TResult | null> - dernier résultat
  reset     // Fonction pour réinitialiser l'état
} = useApiAction(...)
```

## Pattern de migration

### Avant (code existant)

```typescript
const loading = ref(false)

const saveData = async () => {
  if (loading.value) return
  loading.value = true

  try {
    await $fetch('/api/endpoint', {
      method: 'POST',
      body: {
        name: form.value.name,
        value: form.value.value,
      },
    })

    toast.add({
      title: t('success_message'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    emit('saved')
    isOpen.value = false
  } catch (error: any) {
    console.error('Error:', error)
    toast.add({
      title: error.data?.message || t('error_message'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
```

### Après (avec useApiAction)

```typescript
const buildFormData = () => ({
  name: form.value.name,
  value: form.value.value,
})

const { execute: saveData, loading } = useApiAction('/api/endpoint', {
  method: 'POST',
  body: buildFormData,
  successMessage: { title: t('success_message') },
  errorMessages: { default: t('error_message') },
  onSuccess: () => {
    emit('saved')
    isOpen.value = false
  },
})
```

## Cas particuliers

### 1. Endpoint dynamique (avec ID)

```typescript
// Endpoint qui dépend d'un prop
const { execute } = useApiAction(
  () => `/api/editions/${props.editionId}/items`,
  { method: 'POST', ... }
)
```

### 2. Création ET modification dans le même composant

```typescript
const buildFormData = () => ({
  /* ... */
})

const onSaveSuccess = () => {
  emit('saved')
  isOpen.value = false
}

// Action pour créer
const { execute: executeCreate, loading: isCreating } = useApiAction(
  () => `/api/editions/${props.editionId}/items`,
  {
    method: 'POST',
    body: buildFormData,
    successMessage: { title: t('items.created') },
    errorMessages: { default: t('items.error_saving') },
    onSuccess: onSaveSuccess,
  }
)

// Action pour modifier
const { execute: executeUpdate, loading: isUpdating } = useApiAction(
  () => `/api/editions/${props.editionId}/items/${props.item?.id}`,
  {
    method: 'PUT',
    body: buildFormData,
    successMessage: { title: t('items.updated') },
    errorMessages: { default: t('items.error_saving') },
    onSuccess: onSaveSuccess,
  }
)

// État de chargement combiné
const saving = computed(() => isCreating.value || isUpdating.value)

// Fonction save qui choisit l'action
const save = () => {
  if (props.item) {
    executeUpdate()
  } else {
    executeCreate()
  }
}
```

### 3. Gestion d'erreur personnalisée (garder l'erreur localement)

```typescript
const error = ref<string | null>(null)

const { execute, loading } = useApiAction('/api/endpoint', {
  method: 'POST',
  body: buildFormData,
  silentError: true, // Pas de toast d'erreur
  onSuccess: () => {
    error.value = null
  },
  onError: (err) => {
    error.value = err.data?.message || t('default_error')
  },
})
```

### 4. Action par ID dans une liste (useApiActionById)

```typescript
const { execute: deleteItem, isLoading } = useApiActionById((id) => `/api/items/${id}`, {
  method: 'DELETE',
  successMessage: { title: t('item_deleted') },
  refreshOnSuccess: () => refresh(),
})

// Dans le template:
// <UButton :loading="isLoading(item.id)" @click="deleteItem(item.id)" />
```

---

## Fichiers non migrables

Ces fichiers ont été analysés mais ne sont pas de bons candidats pour la migration vers `useApiAction` :

### Patterns trop complexes

| Fichier                                                        | Raison                                                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `app/pages/editions/[id]/commentaires.vue`                     | Partiellement migré — addComment/deleteComment/togglePin restent manuels (plusieurs paramètres dynamiques) |
| `app/pages/editions/[id]/lost-found.vue`                       | Partiellement migré — deleteItem/submitEdit/addComment restent manuels (mises à jour locales complexes)    |
| `app/components/feedback/FeedbackModal.vue`                    | Loading doit commencer avant l'appel API (validation reCAPTCHA)                                            |
| `app/pages/editions/[id]/artist-space.vue`                     | Loading non-booléen (`savingMealId`), mutation locale pré-appel, rollback                                  |
| `app/pages/conventions/[id]/editions/add.vue`                  | Appelle `editionStore.addEdition()` (pas `$fetch` direct)                                                  |
| `app/pages/editions/[id]/gestion/meals/list.vue`               | Chargement données GET complexe + génération PDF                                                           |
| `app/pages/editions/[id]/gestion/meals/validate.vue`           | Loading par tableau (`validatingIds`), non-booléen                                                         |
| `app/pages/editions/[id]/gestion/ticketing/access-control.vue` | Majorité de chargements de données                                                                         |
| `app/pages/editions/[id]/gestion/ticketing/tiers.vue`          | Majorité de chargements de données (wraps store)                                                           |
| `app/pages/editions/[id]/gestion/volunteers/planning.vue`      | Utilise composables dédiés (`useTimeSlots`)                                                                |
| `app/components/edition/Form.vue`                              | Formulaire complexe, pas d'actions API directes                                                            |
| `app/components/edition/volunteer/Table.vue`                   | Chargement de données avec filtrage/pagination                                                             |
| `app/components/ticketing/TicketingTiersList.vue`              | Appelle l'utilitaire `deleteTier()` (pas `$fetch` direct)                                                  |
| `app/components/volunteers/AddVolunteerModal.vue`              | Erreurs inline (pas de toast), gestion spécifique 409                                                      |
| `app/components/ui/ImageUpload.vue`                            | Upload fichier, erreurs via emit                                                                           |
| `app/components/workshops/ImportFromImageModal.vue`            | FileReader + Promise.allSettled                                                                            |

### Composables dédiés

- `app/components/edition/volunteer/planning/TeamManagement.vue` - utilise `useVolunteerTeams`

---

## Checklist de migration

Pour chaque fichier à migrer :

1. [ ] Lire le fichier et identifier les patterns try/catch/loading/toast
2. [ ] Créer les fonctions `buildFormData()` si nécessaire
3. [ ] Définir les callbacks communs (`onSuccess`, `onError`)
4. [ ] Remplacer les `ref(false)` de loading par les `loading` retournés par useApiAction
5. [ ] Créer les instances `useApiAction` ou `useApiActionById`
6. [ ] Supprimer les imports inutilisés (si fonctions utilitaires existaient)
7. [ ] Vérifier que les clés i18n existent dans `i18n/locales/fr/`
8. [ ] Tester manuellement les scénarios de succès et d'erreur
9. [ ] Exécuter `npm run lint -- --fix` pour corriger le formatage

---

## Fichiers restants à migrer

### Utilitaires et composables (non candidats ou cas spéciaux)

| Fichier                                  | Appels manuels | Détail                                                                               | Note                                                        |
| ---------------------------------------- | -------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `app/utils/volunteer-application-api.ts` | 5              | PATCH personal data, PATCH status, PATCH teams, POST application, DELETE application | Wrappers $fetch purs sans toast/loading — non candidat      |
| `app/utils/ticketing/tiers.ts`           | 1              | DELETE tier                                                                          | Wrapper $fetch pur sans toast/loading — non candidat        |
| `app/composables/useTypingIndicator.ts`  | 2              | POST typing start/stop                                                               | Fire-and-forget, pas de toast nécessaire                    |
| `app/composables/useTicketingCounter.ts` | 3              | PATCH increment/decrement/reset                                                      | Appels rapides en boucle, useApiAction peut ne pas convenir |

### Stores (migration optionnelle)

| Fichier                       | Appels manuels | Détail                                         | Note                            |
| ----------------------------- | -------------- | ---------------------------------------------- | ------------------------------- |
| `app/stores/auth.ts`          | 3              | POST register, POST login, POST logout         | Store global, pattern différent |
| `app/stores/editions.ts`      | 5              | POST/PUT/DELETE edition, POST/DELETE organizer | Utilisé par plusieurs pages     |
| `app/stores/notifications.ts` | 4              | PATCH read/unread, PATCH mark-all-read, DELETE | Actions silencieuses souvent    |

---

## Fichiers déjà migrés

| Fichier                                                                    | Date       | Patterns migrés                                                                                                             |
| -------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/components/ticketing/OptionModal.vue`                                 | -          | create, update                                                                                                              |
| `app/components/ticketing/QuotasList.vue`                                  | -          | delete, create, reorder                                                                                                     |
| `app/components/ticketing/TierModal.vue`                                   | -          | create, update                                                                                                              |
| `app/components/ticketing/CustomFieldModal.vue`                            | -          | create, update                                                                                                              |
| `app/components/ticketing/AddParticipantModal.vue`                         | -          | submitOrder                                                                                                                 |
| `app/components/volunteers/CommentModal.vue`                               | -          | save                                                                                                                        |
| `app/components/profile/PushDevicesModal.vue`                              | -          | delete by ID                                                                                                                |
| `app/pages/login.vue`                                                      | -          | login avec redirect 403                                                                                                     |
| `app/components/artists/ArtistModal.vue`                                   | 2026-02-03 | create, update                                                                                                              |
| `app/pages/editions/[id]/gestion/ticketing/orders.vue`                     | 2026-02-03 | cancelOrder, updatePaymentMethod, validateEntry                                                                             |
| `app/pages/editions/[id]/gestion/ticketing/external.vue`                   | 2026-02-03 | loadTiers, saveConfig, testConnection, disconnect, loadOrders, loadRawJson                                                  |
| `app/components/edition/volunteer/planning/DelayModal.vue`                 | 2026-02-03 | saveDelay, removeDelay                                                                                                      |
| `app/components/shows/ShowModal.vue`                                       | 2026-02-03 | create, update                                                                                                              |
| `app/components/organizers/ManageReturnableItemsModal.vue`                 | 2026-02-03 | addItem, removeItem                                                                                                         |
| `app/components/admin/UserDeletionModal.vue`                               | 2026-02-03 | confirmDeletion                                                                                                             |
| `app/components/edition/carpool/FormBase.vue`                              | 2026-02-03 | create, update                                                                                                              |
| `app/components/profile/UserCategoriesCard.vue`                            | 2026-02-03 | saveCategories                                                                                                              |
| `app/pages/register.vue`                                                   | 2026-02-03 | handleRegister                                                                                                              |
| `app/pages/verify-email.vue`                                               | 2026-02-03 | handleResendCode (partiel - autres gardent erreur inline)                                                                   |
| `app/pages/auth/complete-profile.vue`                                      | 2026-02-03 | saveCategories                                                                                                              |
| `app/pages/auth/forgot-password.vue`                                       | 2026-02-03 | handleSubmit                                                                                                                |
| `app/pages/auth/reset-password.vue`                                        | 2026-02-03 | handleSubmit                                                                                                                |
| `app/pages/profile.vue`                                                    | 2026-02-03 | updateProfile, changePassword, saveNotificationPreferences                                                                  |
| `app/pages/conventions/add.vue`                                            | 2026-02-03 | handleAddConvention                                                                                                         |
| `app/pages/editions/[id]/volunteers/.../confirm.vue`                       | 2026-02-03 | confirmReading                                                                                                              |
| `app/pages/admin/feedback.vue`                                             | 2026-02-03 | resolveFeedback                                                                                                             |
| `app/pages/editions/[id]/gestion/artists/index.vue`                        | 2026-02-04 | deleteArtist                                                                                                                |
| `app/pages/editions/[id]/gestion/artists/shows.vue`                        | 2026-02-04 | deleteShow                                                                                                                  |
| `app/pages/editions/[id]/gestion/artists/index.vue`                        | 2026-02-25 | saveArtistInfo                                                                                                              |
| `app/components/artists/OrganizerNotesModal.vue`                           | 2026-02-25 | saveNotes                                                                                                                   |
| `app/pages/editions/[id]/artist-space.vue`                                 | 2026-02-25 | saveDiet (saveAccommodation déjà migré)                                                                                     |
| `app/components/edition/carpool/OfferCard.vue`                             | 2026-02-25 | deleteOffer, submitBooking, cancelBooking                                                                                   |
| `app/components/edition/carpool/BookingsList.vue`                          | 2026-02-25 | updateBookingStatus (useApiActionById)                                                                                      |
| `app/components/edition/carpool/RequestCard.vue`                           | 2026-02-25 | deleteRequest                                                                                                               |
| `app/components/edition/volunteer/MealsCard.vue`                           | 2026-02-25 | saveMealSelections                                                                                                          |
| `app/components/edition/volunteer/MyTeamsCard.vue`                         | 2026-02-25 | sendMessageToTeam                                                                                                           |
| `app/components/edition/volunteer/AutoAssignmentPanel.vue`                 | 2026-02-25 | generatePreview, applyAssignments                                                                                           |
| `app/components/edition/volunteer/planning/AssignmentsModal.vue`           | 2026-02-25 | assignVolunteer, unassignVolunteer (useApiActionById)                                                                       |
| `app/components/edition/volunteer/notifications/Modal.vue`                 | 2026-02-25 | confirmSend (silentSuccess + toast dynamique)                                                                               |
| `app/pages/editions/[id]/gestion/volunteers/notifications.vue`             | 2026-02-25 | sendScheduleNotifications                                                                                                   |
| `app/pages/editions/[id]/gestion/shows-call/index.vue`                     | 2026-02-25 | createShowCall, confirmDelete                                                                                               |
| `app/pages/editions/[id]/gestion/shows-call/[showCallId]/index.vue`        | 2026-02-25 | persistSettings (Zod errors via onError)                                                                                    |
| `app/pages/editions/[id]/gestion/shows-call/[showCallId]/applications.vue` | 2026-02-25 | quickUpdateStatus, saveApplicationDetails, updateApplicationStatus                                                          |
| `app/pages/editions/[id]/gestion/index.vue`                                | 2026-02-25 | saveStatus, confirmDeleteEdition                                                                                            |
| `app/components/notifications/PushNotificationToggle.vue`                  | 2026-02-25 | testNotification                                                                                                            |
| `app/pages/editions/[id]/gestion/meals/index.vue`                          | 2026-02-25 | handleMealChange                                                                                                            |
| `app/pages/admin/conventions.vue`                                          | 2026-02-26 | toggleArchive (silentSuccess), deleteConvention                                                                             |
| `app/pages/admin/users/[id].vue`                                           | 2026-02-26 | promoteToAdmin, demoteFromAdmin, saveChanges                                                                                |
| `app/pages/admin/users/index.vue`                                          | 2026-02-26 | startPrivateConversation, promoteToAdmin, demoteFromAdmin, invalidateEmail                                                  |
| `app/pages/admin/error-logs.vue`                                           | 2026-02-26 | cleanupOldLogs, resolveLog, resolveSimilarLogs, updateAdminNotes                                                            |
| `app/pages/admin/notifications.vue`                                        | 2026-02-26 | sendReminders, createNotification, testNotification, testFirebase, toggleRead                                               |
| `app/pages/editions/[id]/gestion/organizers.vue`                           | 2026-02-26 | addOrganizer, saveOrganizerChanges, removeOrganizer, addToEdition, removeFromEdition                                        |
| `app/pages/my-conventions.vue`                                             | 2026-02-26 | saveOrganizerChanges, removeOrganizer, addOrganizer, deleteEdition, deleteConvention, duplicateEdition, updateEditionStatus |
| `app/pages/editions/[id]/gestion/volunteers/applications.vue`              | 2026-02-26 | unassignFromTeam, toggleTeamLeader, directAssign, processMove                                                               |
| `app/pages/editions/[id]/gestion/map.vue`                                  | 2026-02-26 | (déjà migré auparavant — confirmé)                                                                                          |
| `app/components/admin/ProfilePictureUpload.vue`                            | 2026-02-26 | saveChanges                                                                                                                 |
| `app/components/ticketing/CustomFieldsList.vue`                            | 2026-02-26 | deleteCustomField                                                                                                           |
| `app/components/ui/ImpersonationBanner.vue`                                | 2026-02-26 | stopImpersonation                                                                                                           |
| `app/components/artists/MealsModal.vue`                                    | 2026-02-26 | saveMealSelections                                                                                                          |
| `app/components/volunteers/MealsModal.vue`                                 | 2026-02-26 | saveMealSelections                                                                                                          |
| `app/components/ticketing/CustomFieldAssociationsModal.vue`                | 2026-02-26 | save (associations tarifs/quotas/articles)                                                                                  |
| `app/components/ticketing/ReturnableItemsList.vue`                         | 2026-02-26 | deleteItem, handleSave                                                                                                      |
| `app/components/ticketing/TicketingVolunteerReturnableItemsList.vue`       | 2026-02-26 | deleteItem                                                                                                                  |
| `app/pages/conventions/[id]/edit.vue`                                      | 2026-02-26 | handleUpdateConvention (silentSuccess + toast dynamique)                                                                    |
| `app/pages/editions/[id]/index.vue`                                        | 2026-02-26 | publishEdition, toggleAttendance (silentSuccess + toast dynamique)                                                          |
| `app/pages/editions/[id]/gestion/workshops/index.vue`                      | 2026-02-26 | handleToggleWorkshops, addLocation, deleteLocation (useApiActionById), handleToggleLocationMode (rollback onError)          |
| `app/pages/admin/backup.vue`                                               | 2026-02-26 | createBackup (silentSuccess + toast dynamique), confirmRestore, deleteBackup (useApiActionById + confirm)                   |
| `app/pages/admin/crons.vue`                                                | 2026-02-26 | executeTask (useApiActionById + silentSuccess + toast dynamique + résultat stocké)                                          |
| `app/pages/admin/import-edition.vue`                                       | 2026-02-26 | performImport (silent + onSuccess/onError manuels), testUrls (silent + validation pré-appel)                                |
| `app/pages/admin/index.vue`                                                | 2026-02-26 | executeAnonymization (silentSuccess + toast dynamique + résultat stocké)                                                    |
| `app/pages/editions/[id]/gestion/ticketing/access-control.vue`             | 2026-02-26 | syncHelloAsso (silentSuccess + toast dynamique) + nettoyage console.error/imports                                           |
| `app/pages/editions/[id]/gestion/ticketing/counter/[counterId].vue`        | 2026-02-26 | handleRegenerateToken (silentSuccess + redirect window.location) + nettoyage                                                |
| `app/pages/editions/[id]/gestion/ticketing/tiers.vue`                      | 2026-02-26 | refreshData (sync HelloAsso) + nettoyage console.error/imports                                                              |
| `app/pages/editions/[id]/gestion/meals/validate.vue`                       | 2026-02-26 | nettoyage uniquement (validatingIds = loading non-booléen, non migrable)                                                    |
| `app/pages/editions/[id]/gestion/volunteers/planning.vue`                  | 2026-02-26 | nettoyage uniquement (utilise composables dédiés, pas de $fetch direct)                                                     |
| `app/pages/editions/[id]/gestion/ticketing/stats.vue`                      | 2026-02-26 | nettoyage uniquement (que des GET de lecture)                                                                               |
| `app/pages/editions/[id]/commentaires.vue`                                 | 2026-02-26 | submitNewPost, deletePost (useApiActionById) — partiel, addComment/deleteComment/togglePin restent manuels (multi-params)   |
| `app/pages/editions/[id]/lost-found.vue`                                   | 2026-02-26 | toggleStatus (useApiActionById), submitNewItem — partiel, deleteItem/submitEdit/addComment restent manuels                  |
| `app/pages/editions/[id]/workshops.vue`                                    | 2026-02-26 | createWorkshop, updateWorkshop, deleteWorkshop (useApiActionById)                                                           |
| `app/pages/editions/[id]/shows-call/[showCallId]/apply.vue`                | 2026-02-26 | createApplication, updateApplication (2 instances useApiAction pour POST/PUT conditionnel)                                  |
| `app/pages/my-volunteer-applications.vue`                                  | 2026-02-26 | contactOrganizer                                                                                                            |

---

## Notes importantes

1. **Cas idéaux pour `useApiAction`** :
   - Actions simples avec un seul endpoint
   - Résultat = toast + refresh (pas de mise à jour locale des données)
   - Pas de logique conditionnelle complexe (créer vs modifier)
   - Pas d'updates optimistes

2. **Ne pas migrer** les cas où :
   - Le loading doit commencer avant l'appel API (ex: validation reCAPTCHA)
   - Plusieurs paramètres dynamiques sont passés à la fonction
   - La logique post-succès modifie localement les données (sans refresh)
   - Le loading est non-booléen (tableau d'IDs, string, etc.)
   - Le fichier utilise des wrappers (stores, utilitaires) au lieu de `$fetch` direct

3. **Toujours utiliser `() => formData`** pour le body si les données sont dynamiques au moment de l'appel

4. **Combiner les loading** avec `computed()` quand plusieurs actions partagent le même bouton

5. **Ajouter les clés i18n** manquantes dans le bon fichier de traduction français

---

## Pièges et bonnes pratiques (leçons de la code review)

### 1. `useToast()` doit être déclaré au setup level

Si un composant utilise `useApiAction` (qui gère ses propres toasts) ET un `$fetch` manuel dans un `try/catch` (ex: `fetchMeals`), le `toast` doit quand même être déclaré au niveau setup :

```typescript
// CORRECT
const toast = useToast() // Déclaré au setup, disponible partout

const fetchMeals = async () => {
  try {
    /* ... */
  } catch {
    toast.add({
      /* ... */
    }) // ✅ toast est défini
  }
}

const { execute } = useApiAction(/* ... */) // useApiAction gère ses propres toasts
```

### 2. `isLoading()` au lieu de `loadingId ===` pour `useApiActionById`

Toujours utiliser la fonction `isLoading()` retournée par `useApiActionById`, jamais comparer `loadingId` directement :

```typescript
// INCORRECT
const { execute, loadingId } = useApiActionById(/* ... */)
// ❌ :loading="loadingId === item.id"

// CORRECT
const { execute, isLoading } = useApiActionById(/* ... */)
// ✅ :loading="isLoading(item.id)"
```

### 3. Null guard sur les lambdas `body`

Quand le body dépend d'une valeur potentiellement nulle, ajouter un guard dans la fonction appelante :

```typescript
const { execute } = useApiAction(url, {
  body: () => validationResult.value.data, // ⚠️ peut être null
})

// Ajouter un guard avant d'appeler execute
const performAction = () => {
  if (!validationResult.value?.data) return // ✅ null guard
  execute()
}
```

### 4. `navigateTo` au lieu de `router.push` dans `onSuccess`

Dans les callbacks `onSuccess` de `useApiAction`, utiliser `navigateTo` (idiomatique Nuxt) plutôt que `router.push` :

```typescript
// INCORRECT
onSuccess: () => {
  router.push('/my-conventions')
}

// CORRECT
onSuccess: () => {
  navigateTo('/my-conventions')
}
```

### 5. Typer le paramètre `onSuccess`

Toujours typer le paramètre `result` de `onSuccess` pour avoir l'autocomplétion et éviter les `any` :

```typescript
const { execute } = useApiAction(url, {
  onSuccess: (result: { meals?: Meal[] }) => {
    if (result.meals) {
      meals.value = result.meals
    }
  },
})
```

### 6. Spécifier le générique sur `useApiActionById`

Préciser le type générique pour bénéficier du typage dans les callbacks :

```typescript
const { execute, isLoading } = useApiActionById<LostFoundItem>((id) => `/api/items/${id}`, {
  /* ... */
})
```
