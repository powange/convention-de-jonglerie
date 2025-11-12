# Lazy Loading des traductions au niveau composant

## Vue d'ensemble

Le composable `useLazyI18n()` permet de charger dynamiquement des fichiers de traduction uniquement quand un composant spécifique est utilisé, au lieu de les charger globalement au démarrage de l'application.

## Utilisation

### Exemple basique

```vue
<template>
  <div>
    <p>{{ $t('permissions.editConvention') }}</p>
  </div>
</template>

<script setup lang="ts">
// Charge permissions.json AVANT le rendu du composant
await useLazyI18n('permissions')
</script>
```

**Important** : Utiliser `await` permet de charger les traductions **avant** le rendu du composant, évitant ainsi tout flash de clé non traduite.

### Avec vérification du chargement

```vue
<script setup lang="ts">
const { isLoaded } = await useLazyI18n('permissions')

// isLoaded sera true immédiatement après l'await
console.log(isLoaded.value) // true
</script>
```

## Fonctionnement

1. **Avant le rendu** : Grâce à `await`, le fichier de traduction est chargé **avant** le rendu du composant
2. **Changement de langue** : Si l'utilisateur change de langue, le composable recharge automatiquement le fichier pour la nouvelle locale
3. **Fusion des messages** : Les traductions sont fusionnées avec les traductions existantes via `mergeLocaleMessage()`
4. **Pas de flash** : Contrairement au chargement dans `onMounted`, utiliser `await` garantit qu'aucun flash de clé non traduite n'apparaît

## Quand utiliser le lazy loading au niveau composant ?

### ✅ Cas d'usage recommandés

- **Traductions spécifiques à un composant** : Vocabulaire utilisé uniquement dans un composant particulier
- **Composants peu utilisés** : Composants accessibles uniquement dans certains contextes (ex: admin, settings)
- **Gros fichiers de traduction** : Fichiers volumineux qui augmenteraient inutilement la taille du bundle initial

### ❌ Cas où éviter

- **Traductions communes** : Vocabulaire utilisé partout dans l'application (boutons, messages d'erreur)
- **Composants fréquents** : Composants affichés sur presque toutes les pages
- **Petits fichiers** : Le coût du lazy loading dépasse le bénéfice pour de petits fichiers

## Configuration

### 1. Créer le fichier de traduction

Créer le fichier dans la structure i18n habituelle :

```
i18n/locales/
  fr/
    permissions.json
  en/
    permissions.json
  ...
```

### 2. Déclarer dans SPLIT_CONFIG

Ajouter la clé dans `scripts/translation/shared-config.js` :

```javascript
export const SPLIT_CONFIG = {
  // ...
  permissions: ['permissions'], // Chargé au niveau composant via useLazyI18n('permissions')
}
```

### 3. Ne PAS l'ajouter à nuxt.config.ts

Le fichier ne doit **PAS** être dans la liste `files` des locales dans `nuxt.config.ts`, sinon il serait chargé globalement.

### 4. Utiliser le composable dans le composant

```vue
<script setup lang="ts">
// Important: utiliser await pour charger avant le rendu
await useLazyI18n('permissions')
</script>
```

## Exemples complets

### Exemple 1 : permissions.json

**Fichier de traduction** - `i18n/locales/fr/permissions.json` :

```json
{
  "permissions": {
    "editConvention": "Modifier la convention",
    "deleteConvention": "Supprimer la convention",
    "manageOrganizers": "Gérer les organisateurs"
  }
}
```

**Composant** - `app/components/organizer/RightsFields.vue` :

```vue
<template>
  <div>
    <span>{{ $t('permissions.editConvention') }}</span>
  </div>
</template>

<script setup lang="ts">
// Charge permissions.json AVANT le rendu du composant
await useLazyI18n('permissions')
</script>
```

### Exemple 2 : feedback.json

**Fichier de traduction** - `i18n/locales/fr/feedback.json` :

```json
{
  "feedback": {
    "title": "Nous faire un retour",
    "description": "Vos retours nous aident à améliorer l'application",
    "submit": "Envoyer"
  }
}
```

**Composant** - `app/components/feedback/FeedbackModal.vue` :

```vue
<template>
  <UModal :title="t('feedback.title')" :description="t('feedback.description')">
    <!-- Contenu du formulaire -->
  </UModal>
</template>

<script setup lang="ts">
// Charge feedback.json AVANT le rendu du composant
await useLazyI18n('feedback')

const { t } = useI18n()
</script>
```

## Avantages

1. **Réduction du bundle initial** : Les traductions ne sont pas incluses dans le bundle JS principal
2. **Chargement à la demande** : Les traductions sont chargées uniquement quand nécessaire
3. **Meilleure organisation** : Permet de garder les traductions organisées par domaine même pour des composants spécifiques
4. **Support multilingue automatique** : Le changement de langue est géré automatiquement
5. **Pas de flash** : Grâce à `await`, les traductions sont garanties d'être disponibles avant le premier rendu

## Limitations

- **Requête réseau supplémentaire** : Un fichier JSON à charger (mais avec cache navigateur)
- **Délai de rendu** : Le composant attend le chargement du fichier avant de s'afficher (mais c'est généralement très rapide)
- **Complexité accrue** : Plus complexe que le chargement global, à utiliser avec discernement

## API du composable

### async useLazyI18n(namespace: string)

**Paramètres** :

- `namespace` : Nom du fichier de traduction (sans `.json`)

**Retour** :

- Une promesse qui se résout en `{ isLoaded: Ref<boolean> }`
- `isLoaded` : Ref booléen indiquant si le fichier est chargé (sera `true` après l'`await`)

**Exemple** :

```typescript
// Utilisation avec await (recommandé)
await useLazyI18n('permissions')

// Utilisation avec récupération du statut
const { isLoaded } = await useLazyI18n('permissions')
console.log(isLoaded.value) // true
```
