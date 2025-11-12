# Utilitaire des niveaux de sévérité d'allergie

L'utilitaire `allergy-severity.ts` fournit une gestion centralisée et typée des niveaux de sévérité des allergies dans l'application.

## Fonctionnalités

### Types et Interfaces

- **`AllergySeverityLevel`** : Type union des niveaux (`'LIGHT' | 'MODERATE' | 'SEVERE' | 'CRITICAL'`)
- **`AllergySeverityOption`** : Interface complète avec métadonnées (label, description, couleur, icône, priorité)

### Constantes

- **`ALLERGY_SEVERITY_LEVELS`** : Définition complète de tous les niveaux avec leurs métadonnées

### Fonctions utilitaires

#### Récupération des données

```typescript
// Obtenir toutes les options triées par priorité
getAllergySeverityOptions(): AllergySeverityOption[]

// Obtenir les métadonnées d'un niveau spécifique
getAllergySeverityInfo(level: AllergySeverityLevel): AllergySeverityOption

// Obtenir les options pour composants de sélection
getAllergySeveritySelectOptions(): Array<{ value: AllergySeverityLevel; label: string }>
```

#### Logique métier

```typescript
// Vérifier si un niveau nécessite un contact d'urgence obligatoire
requiresEmergencyContact(level: AllergySeverityLevel): boolean

// Obtenir la couleur de badge pour un niveau
getAllergySeverityBadgeColor(level: AllergySeverityLevel): string

// Obtenir les classes CSS complètes pour un badge de sévérité
getAllergySeverityBadgeClasses(level: AllergySeverityLevel): string

// Obtenir l'icône appropriée pour un niveau
getAllergySeverityIcon(level: AllergySeverityLevel): string

// Obtenir la clé i18n pour la description d'un niveau
getAllergySeverityDescriptionKey(level: AllergySeverityLevel): string

// Valider un niveau de sévérité
isValidAllergySeverityLevel(level: string): level is AllergySeverityLevel
```

## Exemples d'utilisation

### Dans un composant Vue avec i18n

```vue
<template>
  <USelect v-model="selectedSeverity" :options="severityOptions" />

  <UBadge
    v-if="selectedSeverity"
    :color="getBadgeColor(selectedSeverity)"
    :icon="getIcon(selectedSeverity)"
  >
    {{ getSeverityLabel(selectedSeverity) }}
  </UBadge>

  <UAlert v-if="selectedSeverity && needsEmergencyContact(selectedSeverity)" color="orange">
    Contact d'urgence requis pour ce niveau de sévérité
  </UAlert>
</template>

<script setup>
import {
  getAllergySeverityOptions,
  getAllergySeverityBadgeColor,
  getAllergySeverityIcon,
  requiresEmergencyContact,
  getAllergySeverityInfo,
} from '~/utils/allergy-severity'

const { t } = useI18n()

// Options pour le select avec traductions
const severityOptions = computed(() =>
  getAllergySeverityOptions().map((option) => ({
    value: option.value,
    label: t(option.label),
  }))
)

const selectedSeverity = ref(null)

// Fonctions helpers
const getBadgeColor = (level) => getAllergySeverityBadgeColor(level)
const getIcon = (level) => getAllergySeverityIcon(level)
const needsEmergencyContact = (level) => requiresEmergencyContact(level)
const getSeverityLabel = (level) => {
  const info = getAllergySeverityInfo(level)
  return info.label
}

const getSeverityDescription = (level) => {
  const info = getAllergySeverityInfo(level)
  return t(info.description) // Les descriptions sont des clés i18n
}
</script>
```

### Dans un composable

```typescript
// composables/useAllergySeverity.ts
export function useAllergySeverity() {
  const { t } = useI18n()

  const severityOptions = computed(() =>
    getAllergySeverityOptions().map((option) => ({
      value: option.value,
      label: t(option.label),
      description: option.description,
    }))
  )

  const formatSeverityForDisplay = (level: AllergySeverityLevel) => {
    const info = getAllergySeverityInfo(level)
    return {
      label: t(info.label),
      description: info.description,
      color: info.color,
      icon: info.icon,
      requiresEmergencyContact: requiresEmergencyContact(level),
    }
  }

  return {
    severityOptions,
    formatSeverityForDisplay,
    requiresEmergencyContact,
    getAllergySeverityBadgeColor,
    getAllergySeverityIcon,
  }
}
```

### Dans une validation de formulaire

```typescript
import { isValidAllergySeverityLevel, requiresEmergencyContact } from '~/utils/allergy-severity'

const validateAllergyForm = (formData) => {
  const errors = {}

  // Validation du niveau de sévérité
  if (formData.allergySeverity && !isValidAllergySeverityLevel(formData.allergySeverity)) {
    errors.allergySeverity = 'Niveau de sévérité invalide'
  }

  // Validation du contact d'urgence pour niveaux élevés
  if (
    formData.allergySeverity &&
    requiresEmergencyContact(formData.allergySeverity) &&
    (!formData.emergencyContactName || !formData.emergencyContactPhone)
  ) {
    errors.emergencyContact = "Contact d'urgence requis pour ce niveau de sévérité"
  }

  return errors
}
```

## Niveaux de sévérité

| Niveau     | Label    | Description (clé i18n)                  | Couleur   | Contact d'urgence requis |
| ---------- | -------- | --------------------------------------- | --------- | ------------------------ |
| `LIGHT`    | Légère   | `allergy_severity_light_description`    | `neutral` | ❌                       |
| `MODERATE` | Modérée  | `allergy_severity_moderate_description` | `info`    | ❌                       |
| `SEVERE`   | Sévère   | `allergy_severity_severe_description`   | `warning` | ✅                       |
| `CRITICAL` | Critique | `allergy_severity_critical_description` | `error`   | ✅                       |

## Intégration avec l'existant

Cet utilitaire s'intègre parfaitement avec :

- Le système de traduction i18n existant
- Les composants Nuxt UI (USelect, UBadge, UAlert)
- La validation côté client et serveur
- Le schéma Prisma `AllergySeverity`

L'utilisation de cet utilitaire assure la cohérence dans toute l'application concernant la gestion des niveaux de sévérité d'allergie.
