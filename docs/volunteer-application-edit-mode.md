# Mode Édition pour la Modal ApplicationModal

## Vue d'ensemble

La modal `ApplicationModal` a été étendue pour supporter un mode édition qui permet de modifier une candidature existante au lieu de créer une nouvelle candidature. Cette fonctionnalité est utile pour:

1. **Utilisateurs**: Modifier leur propre candidature
2. **Organisateurs**: Modifier la candidature d'un utilisateur

## Utilisation

### Props supplémentaires

```typescript
interface Props {
  // Props existantes...
  modelValue: boolean
  volunteersInfo: VolunteerInfo | null
  edition: any
  user: User | null
  applying: boolean

  // Nouvelles props pour le mode édition
  isEditing?: boolean // Active le mode édition
  existingApplication?: any // Données de la candidature existante
}
```

### Événements

```typescript
interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', data: ApplicationData): void // Nouvelle candidature
  (e: 'update', data: ApplicationData): void // Modification de candidature
}
```

### Exemple d'implémentation

```vue
<template>
  <div>
    <!-- Bouton pour ouvrir le mode édition -->
    <UButton @click="openEditModal(application)" icon="i-heroicons-pencil">
      Modifier la candidature
    </UButton>

    <!-- Modal en mode édition -->
    <ApplicationModal
      v-model="editModalOpen"
      :volunteers-info="volunteersInfo"
      :edition="edition"
      :user="user"
      :applying="false"
      :is-editing="true"
      :existing-application="currentApplication"
      @update="handleApplicationUpdate"
      @close="closeEditModal"
    />
  </div>
</template>

<script setup>
const editModalOpen = ref(false)
const currentApplication = ref(null)

const openEditModal = (application) => {
  currentApplication.value = application
  editModalOpen.value = true
}

const closeEditModal = () => {
  editModalOpen.value = false
  currentApplication.value = null
}

const handleApplicationUpdate = async (data) => {
  try {
    // Appeler l'API pour sauvegarder les modifications
    await $fetch(`/api/editions/${editionId}/volunteers/applications/${data.applicationId}`, {
      method: 'PATCH',
      body: {
        teamPreferences: data.teamPreferences,
        dietaryPreference: data.dietaryPreference,
        allergies: data.allergies,
        allergySeverity: data.allergySeverity,
        modificationNote: data.modificationNote,
        // Autres champs...
      },
    })

    // Rafraîchir les données
    await refreshApplications()

    toast.add({
      title: 'Candidature modifiée',
      description: 'Les modifications ont été sauvegardées avec succès',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de sauvegarder les modifications',
      color: 'error',
    })
  }
}
</script>
```

## Structure des données

### ApplicationData (émise par l'événement update)

```typescript
interface ApplicationData {
  applicationId: number
  // Présence
  setupAvailability?: boolean
  eventAvailability?: boolean
  teardownAvailability?: boolean
  arrivalDateTime?: string
  departureDateTime?: string

  // Préférences
  teamPreferences?: string[]
  timePreferences?: string[]
  dietaryPreference?: 'NONE' | 'VEGETARIAN' | 'VEGAN'

  // Informations personnelles
  allergies?: string
  allergySeverity?: 'LIGHT' | 'MODERATE' | 'SEVERE' | 'CRITICAL'
  emergencyContactName?: string
  emergencyContactPhone?: string

  // Autres informations
  hasPets?: boolean
  petsDetails?: string
  hasMinors?: boolean
  minorsDetails?: string
  hasVehicle?: boolean
  vehicleDetails?: string
  companionName?: string
  avoidList?: string
  skills?: string
  hasExperience?: boolean
  experienceDetails?: string
  motivation?: string

  // Note de modification
  modificationNote?: string
}
```

## Fonctionnalités du mode édition

### 1. Interface adaptée

- **Titre**: Change de "Postuler comme bénévole" à "Modifier ma candidature"
- **Description**: Texte adapté pour l'édition
- **Bouton**: Change de "Postuler" à "Sauvegarder les modifications"

### 2. Pré-remplissage automatique

- Tous les champs sont pré-remplis avec les données existantes
- Les dates sont formatées correctement
- Les sélections multiples (équipes, créneaux) sont cochées

### 3. Validation

- Mêmes règles de validation que pour une nouvelle candidature
- Validation spéciale pour la sévérité des allergies si allergies renseignées
- Contact d'urgence requis pour allergies SEVERE/CRITICAL

### 4. Note de modification

- Champ optionnel permettant d'expliquer les modifications
- Visible uniquement en mode édition
- Incluse dans les notifications envoyées au bénévole

## API Backend

Le mode édition utilise l'endpoint PATCH existant:

```
PATCH /api/editions/{editionId}/volunteers/applications/{applicationId}
```

Cet endpoint supporte la modification de tous les champs de la candidature et envoie automatiquement une notification au bénévole en cas de modification.

## Intégration avec le tableau existant

Pour intégrer avec le composant Table.vue existant, vous pouvez utiliser cette approche:

```vue
<!-- Dans Table.vue -->
<template>
  <!-- Table existante... -->

  <!-- Modal ApplicationModal en mode édition -->
  <ApplicationModal
    v-model="editApplicationModalOpen"
    :volunteers-info="volunteersInfo"
    :edition="edition"
    :user="currentEditApplication?.user"
    :applying="false"
    :is-editing="true"
    :existing-application="currentEditApplication"
    @update="handleApplicationUpdate"
  />
</template>

<script setup>
// Variables existantes...
const editApplicationModalOpen = ref(false)

// Fonction pour ouvrir la modal ApplicationModal en mode édition
const openApplicationEditModal = (application) => {
  currentEditApplication.value = application
  editApplicationModalOpen.value = true
}

// Gérer la mise à jour de l'application
const handleApplicationUpdate = async (data) => {
  // Même logique que handleEditApplicationSave mais adaptée
  // pour les données venant de ApplicationModal
}
</script>
```

## Avantages du mode édition

1. **Réutilisation de code**: Une seule modal pour création et édition
2. **Interface cohérente**: Même UX pour les deux modes
3. **Flexibilité**: Peut être utilisée par les utilisateurs et les organisateurs
4. **Validation uniforme**: Mêmes règles dans tous les cas
5. **Extensibilité**: Facile d'ajouter de nouveaux champs

## Notes techniques

- La modal détecte automatiquement les changements pour activer/désactiver le bouton de sauvegarde
- Le mode édition émet un événement `update` au lieu de `submit`
- Les données existantes sont chargées via un watcher réactif
- Compatible avec toutes les options de configuration des bénévoles
