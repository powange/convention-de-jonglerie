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

| Fichier                                     | Raison                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `app/pages/editions/[id]/workshops.vue`     | Logique créer/modifier conditionnelle, `confirm()` natif, updates optimistes   |
| `app/pages/editions/[id]/commentaires.vue`  | Mises à jour locales des données après succès, plusieurs paramètres dynamiques |
| `app/pages/editions/[id]/lost-found.vue`    | Mises à jour locales des données après succès, plusieurs paramètres dynamiques |
| `app/pages/admin/index.vue`                 | Logique de redirection 401 personnalisée, valeurs par défaut en cas d'erreur   |
| `app/components/feedback/FeedbackModal.vue` | Loading doit commencer avant l'appel API (validation reCAPTCHA)                |

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

## Fichiers déjà migrés

| Fichier                                                    | Date       | Patterns migrés                                                            |
| ---------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `app/components/ticketing/OptionModal.vue`                 | -          | create, update                                                             |
| `app/components/ticketing/QuotasList.vue`                  | -          | delete, create, reorder                                                    |
| `app/components/ticketing/TierModal.vue`                   | -          | create, update                                                             |
| `app/components/ticketing/CustomFieldModal.vue`            | -          | create, update                                                             |
| `app/components/ticketing/AddParticipantModal.vue`         | -          | submitOrder                                                                |
| `app/components/volunteers/CommentModal.vue`               | -          | save                                                                       |
| `app/components/profile/PushDevicesModal.vue`              | -          | delete by ID                                                               |
| `app/pages/login.vue`                                      | -          | login avec redirect 403                                                    |
| `app/components/artists/ArtistModal.vue`                   | 2026-02-03 | create, update                                                             |
| `app/pages/editions/[id]/gestion/ticketing/orders.vue`     | 2026-02-03 | cancelOrder, updatePaymentMethod, validateEntry                            |
| `app/pages/editions/[id]/gestion/ticketing/external.vue`   | 2026-02-03 | loadTiers, saveConfig, testConnection, disconnect, loadOrders, loadRawJson |
| `app/components/edition/volunteer/planning/DelayModal.vue` | 2026-02-03 | saveDelay, removeDelay                                                     |
| `app/components/shows/ShowModal.vue`                       | 2026-02-03 | create, update                                                             |
| `app/components/organizers/ManageReturnableItemsModal.vue` | 2026-02-03 | addItem, removeItem                                                        |
| `app/components/admin/UserDeletionModal.vue`               | 2026-02-03 | confirmDeletion                                                            |
| `app/components/edition/carpool/FormBase.vue`              | 2026-02-03 | create, update                                                             |
| `app/components/profile/UserCategoriesCard.vue`            | 2026-02-03 | saveCategories                                                             |
| `app/pages/register.vue`                                   | 2026-02-03 | handleRegister                                                             |
| `app/pages/verify-email.vue`                               | 2026-02-03 | handleResendCode (partiel - autres gardent erreur inline)                  |
| `app/pages/auth/complete-profile.vue`                      | 2026-02-03 | saveCategories                                                             |
| `app/pages/auth/forgot-password.vue`                       | 2026-02-03 | handleSubmit                                                               |
| `app/pages/auth/reset-password.vue`                        | 2026-02-03 | handleSubmit                                                               |
| `app/pages/profile.vue`                                    | 2026-02-03 | updateProfile, changePassword, saveNotificationPreferences                 |
| `app/pages/conventions/add.vue`                            | 2026-02-03 | handleAddConvention                                                        |
| `app/pages/editions/[id]/volunteers/.../confirm.vue`       | 2026-02-03 | confirmReading                                                             |
| `app/pages/admin/feedback.vue`                             | 2026-02-03 | resolveFeedback                                                            |
| `app/pages/editions/[id]/gestion/artists/index.vue`        | 2026-02-04 | deleteArtist                                                               |
| `app/pages/editions/[id]/gestion/artists/shows.vue`        | 2026-02-04 | deleteShow                                                                 |

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
   - Une logique de rollback est nécessaire (updates optimistes)

3. **Toujours utiliser `() => formData`** pour le body si les données sont dynamiques au moment de l'appel

4. **Combiner les loading** avec `computed()` quand plusieurs actions partagent le même bouton

5. **Ajouter les clés i18n** manquantes dans le bon fichier de traduction français
