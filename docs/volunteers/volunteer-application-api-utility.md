# Utilitaire API des Candidatures de Bénévoles

L'utilitaire `volunteer-application-api.ts` fournit des fonctions et interfaces pour interagir avec l'API des candidatures de bénévoles de manière typée et cohérente.

## Interfaces

### `VolunteerApplicationData`

Interface complète pour les données d'une candidature de bénévole, incluant tous les champs du formulaire :

```typescript
interface VolunteerApplicationData {
  // Données personnelles
  phone?: string
  firstName?: string
  lastName?: string

  // Disponibilités
  setupAvailability?: boolean
  teardownAvailability?: boolean
  eventAvailability?: boolean
  arrivalDateTime?: string
  departureDateTime?: string

  // Préférences d'équipes et créneaux
  teamPreferences?: string[]
  timePreferences?: string[]

  // Préférences de covoiturage
  companionName?: string
  avoidList?: string

  // Régime et allergies
  dietaryPreference?: 'NONE' | 'VEGETARIAN' | 'VEGAN'
  allergies?: string
  allergySeverity?: AllergySeverityLevel
  emergencyContactName?: string
  emergencyContactPhone?: string

  // Informations complémentaires
  hasPets?: boolean
  petsDetails?: string
  hasMinors?: boolean
  minorsDetails?: string
  hasVehicle?: boolean
  vehicleDetails?: string
  skills?: string
  hasExperience?: boolean
  experienceDetails?: string
  motivation?: string

  // Note de modification (pour les organisateurs)
  modificationNote?: string
}
```

### `VolunteerApplicationUpdateData`

Interface qui étend `VolunteerApplicationData` avec l'ID de la candidature pour les mises à jour :

```typescript
interface VolunteerApplicationUpdateData extends VolunteerApplicationData {
  applicationId: number
}
```

## Fonctions

### `updateVolunteerApplication()`

Met à jour une candidature de bénévole existante via l'API.

```typescript
import { updateVolunteerApplication } from '~/utils/volunteer-application-api'

const updatedApplication = await updateVolunteerApplication(14, {
  applicationId: 123,
  phone: '+33123456789',
  motivation: 'Nouvelle motivation',
  allergies: 'Aucune allergie',
  modificationNote: 'Mis à jour par un organisateur',
})
```

**Paramètres :**

- `editionId` (number) : ID de l'édition
- `data` (VolunteerApplicationUpdateData) : Données de la candidature avec l'ID

**Route API :** `PATCH /api/editions/{id}/volunteers/applications/{applicationId}`
**Retour :** Promise avec la réponse de l'API

### `submitVolunteerApplication()`

Soumet une nouvelle candidature de bénévole via l'API REST.

```typescript
import { submitVolunteerApplication } from '~/utils/volunteer-application-api'

const newApplication = await submitVolunteerApplication(14, {
  motivation: 'Je souhaite aider',
  setupAvailability: true,
  eventAvailability: true,
  dietaryPreference: 'VEGETARIAN',
})
```

**Paramètres :**

- `editionId` (number) : ID de l'édition
- `data` (VolunteerApplicationData) : Données de la candidature

**Route API :** `POST /api/editions/{id}/volunteers/applications`
**Retour :** Promise avec la réponse de l'API

### `withdrawVolunteerApplication()`

Retire une candidature de bénévole.

```typescript
import { withdrawVolunteerApplication } from '~/utils/volunteer-application-api'

await withdrawVolunteerApplication(14)
```

**Paramètres :**

- `editionId` (number) : ID de l'édition

**Route API :** `DELETE /api/editions/{id}/volunteers/applications`
**Retour :** Promise avec la réponse de l'API

### `updateVolunteerApplicationStatus()`

Change le statut d'une candidature de bénévole.

```typescript
import { updateVolunteerApplicationStatus } from '~/utils/volunteer-application-api'

const updatedStatus = await updateVolunteerApplicationStatus(14, 123, 'ACCEPTED', {
  note: 'Candidature acceptée avec commentaire',
})
```

**Paramètres :**

- `editionId` (number) : ID de l'édition
- `applicationId` (number) : ID de la candidature
- `status` ('ACCEPTED' | 'REJECTED' | 'PENDING') : Nouveau statut
- `options` (object, optionnel) : Options additionnelles
  - `teams` (string[]) : Équipes à assigner
  - `note` (string) : Note de commentaire

**Route API :** `PATCH /api/editions/{id}/volunteers/applications/{applicationId}`
**Retour :** Promise avec la réponse de l'API

### `assignVolunteerTeams()`

Assigne des équipes à une candidature de bénévole.

```typescript
import { assignVolunteerTeams } from '~/utils/volunteer-application-api'

const assignedTeams = await assignVolunteerTeams(14, 123, ['team1', 'team2'])
```

**Paramètres :**

- `editionId` (number) : ID de l'édition
- `applicationId` (number) : ID de la candidature
- `teams` (string[]) : Liste des équipes à assigner

**Route API :** `PATCH /api/editions/{id}/volunteers/applications/{applicationId}/teams`
**Retour :** Promise avec la réponse de l'API

## Utilisation dans les composants

### Table.vue

```typescript
import {
  updateVolunteerApplication,
  updateVolunteerApplicationStatus,
  assignVolunteerTeams,
} from '~/utils/volunteer-application-api'

const handleEditApplicationUpdate = async (data: any) => {
  try {
    await updateVolunteerApplication(props.editionId, data)
    // Rafraîchir les données...
  } catch (error) {
    // Gérer l'erreur...
  }
}

const decideApplication = async (app: any, status: string) => {
  try {
    await updateVolunteerApplicationStatus(props.editionId, app.id, status)
    // Rafraîchir les données...
  } catch (error) {
    // Gérer l'erreur...
  }
}

const confirmTeamsModal = async () => {
  try {
    // Assigner les équipes
    await assignVolunteerTeams(props.editionId, currentApplication.value.id, selectedTeams.value)
    // Puis accepter si nécessaire
    if (modalMode.value === 'accept') {
      await updateVolunteerApplicationStatus(
        props.editionId,
        currentApplication.value.id,
        'ACCEPTED',
        {
          note: acceptNote.value || undefined,
        }
      )
    }
  } catch (error) {
    // Gérer l'erreur...
  }
}
```

### ApplicationModal.vue

Peut être utilisé pour simplifier les appels API dans le modal de candidature.

### volunteers/index.vue

```typescript
import { submitVolunteerApplication } from '~/utils/volunteer-application-api'

// Fonction helper pour transformer les données selon la configuration
const mapFormDataToApplicationData = (formData: any) => {
  return {
    phone: formData?.phone?.trim() || undefined,
    firstName: (authStore.user as any)?.prenom
      ? undefined
      : formData?.firstName?.trim() || undefined,
    lastName: (authStore.user as any)?.nom ? undefined : formData?.lastName?.trim() || undefined,
    motivation: formData?.motivation?.trim() || undefined,
    // ... autres champs selon la configuration de l'édition
  }
}

const applyAsVolunteer = async (formData?: any) => {
  try {
    // Transformer les données selon la configuration de l'édition
    const applicationData = mapFormDataToApplicationData(formData)

    // Appeler l'API via l'utilitaire
    const res = await submitVolunteerApplication(editionId, applicationData)

    // Traitement de la réponse...
  } catch (error) {
    // Gérer l'erreur...
  }
}
```

## Avantages

1. **Type Safety** : Interfaces TypeScript pour tous les champs
2. **Réutilisabilité** : Fonctions centralisées pour les appels API
3. **Cohérence** : Structure identique des données dans toute l'application
4. **Maintenabilité** : Un seul endroit pour modifier la structure des requêtes
5. **Documentation** : Interfaces explicites des données échangées

## Structure des données API

L'utilitaire organise automatiquement les données en sections logiques dans les requêtes :

### Différences entre API POST et PATCH

**API POST (soumission)** : Supporte tous les champs incluant les données personnelles

- **Données personnelles** (phone, nom/prenom)
- Tous les autres champs de candidature

**API PATCH (mise à jour)** : Supporte la modification du téléphone

- **Données personnelles** :
  - `phone` : Modifiable (met à jour userSnapshotPhone et le profil si l'utilisateur n'a pas de téléphone)
  - `nom/prenom` : Non modifiables (stockées dans userSnapshot)
- **Préférences d'équipes et créneaux** (teamPreferences, timePreferences)
- **Disponibilités** (setup, event, teardown, dates)
- **Préférences de covoiturage** (companionName, avoidList)
- **Régime et allergies** (diet, allergies, emergency contacts)
- **Informations complémentaires** (pets, minors, vehicle, skills, experience, motivation)
- **Note de modification** (modificationNote)

## Structure des routes API REST

La nouvelle structure suit les conventions REST :

```
POST   /api/editions/{id}/volunteers/applications           # Créer une candidature
DELETE /api/editions/{id}/volunteers/applications           # Retirer sa candidature
PATCH  /api/editions/{id}/volunteers/applications/{appId}   # Modifier une candidature
PATCH  /api/editions/{id}/volunteers/applications/{appId}/teams  # Assigner des équipes
DELETE /api/editions/{id}/volunteers/applications/{appId}   # Supprimer une candidature (admin)
```

Cet utilitaire assure une gestion cohérente et typée des candidatures de bénévoles dans toute l'application.
