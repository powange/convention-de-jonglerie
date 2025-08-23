# Système d'Upload d'Images

Ce guide explique comment utiliser le nouveau système d'upload d'images centralisé et réutilisable.

## Vue d'ensemble

Le système d'upload d'images comprend :

- **Composable `useImageUpload`** : Logique métier et gestion d'état
- **Composant `ImageUpload`** : Interface utilisateur réutilisable
- **Types TypeScript** : Définitions de types pour la sécurité de type
- **Traductions** : Support i18n complet

## Fonctionnalités

### ✅ Sécurité

- Validation des types MIME (protection contre exécutables, scripts, SVG/XSS)
- Validation des tailles de fichier (protection DoS)
- Nettoyage des noms de fichiers (protection path traversal)
- Validation des extensions de fichiers

### ✅ UX/UI

- Drag & drop
- Prévisualisation d'images
- Barre de progression
- Messages d'erreur localisés
- Interface responsive

### ✅ Développeur

- TypeScript complet
- Composable réutilisable
- Configuration flexible
- Gestion d'état réactive
- Tests automatisés

## Utilisation

### Composable `useImageUpload`

```typescript
import { useImageUpload } from '~/composables/useImageUpload'

// Configuration basique
const {
  uploading,
  progress,
  selectedFile,
  previewUrl,
  error,
  selectFile,
  uploadFile,
  deleteImage,
  reset,
} = useImageUpload()

// Configuration personnalisée
const customUpload = useImageUpload({
  validation: {
    maxSize: 2 * 1024 * 1024, // 2MB au lieu de 5MB
    allowedTypes: ['image/png'], // PNG seulement
    allowedExtensions: ['.png'],
  },
  showToast: false, // Désactiver les notifications
  resetAfterUpload: true, // Réinitialiser après upload
})
```

### Composant `ImageUpload`

```vue
<template>
  <ImageUpload
    v-model="logoUrl"
    :endpoint="{ type: 'convention', id: conventionId }"
    :options="{
      validation: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      },
    }"
    alt="Logo de la convention"
    placeholder="Sélectionnez le logo de votre convention"
    :auto-upload="true"
    @uploaded="onUploaded"
    @deleted="onDeleted"
    @error="onError"
  />
</template>

<script setup>
const logoUrl = ref('')
const conventionId = ref(123)

const onUploaded = (result) => {
  console.log('Image uploadée:', result.imageUrl)
}

const onDeleted = () => {
  console.log('Image supprimée')
  logoUrl.value = ''
}

const onError = (error) => {
  console.error('Erreur:', error)
}
</script>
```

## Types d'endpoints

### Convention

```typescript
// Upload vers une convention existante
{ type: 'convention', id: conventionId }

// Upload générique (nouvelle convention)
{ type: 'convention' }
```

### Édition

```typescript
// Upload vers une édition existante
{ type: 'edition', id: editionId }

// Upload générique (nouvelle édition)
{ type: 'edition' }
```

### Objets trouvés

```typescript
// Upload pour les objets trouvés (ID d'édition requis)
{ type: 'lost-found', id: editionId }
```

### Profil utilisateur

```typescript
// Upload de photo de profil
{
  type: 'profile'
}
```

### Générique

```typescript
// Upload générique vers /api/upload/image
{
  type: 'generic'
}
```

## Configuration avancée

### Validation personnalisée

```typescript
const customValidation = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
}

const upload = useImageUpload({
  validation: customValidation,
  showToast: false, // Gérer les notifications manuellement
  resetAfterUpload: false, // Garder le fichier sélectionné
})
```

### Gestion d'erreurs

```typescript
const upload = useImageUpload({
  showToast: false, // Désactiver les toasts automatiques
})

// Gérer les erreurs manuellement
watch(upload.error, (error) => {
  if (error) {
    // Logique personnalisée d'erreur
    console.error("Erreur d'upload:", error)

    // Afficher une notification personnalisée
    toast.add({
      title: "Erreur d'upload",
      description: error,
      color: 'red',
    })
  }
})
```

## Migration depuis l'ancien système

### Avant (code dupliqué)

```vue
<template>
  <input ref="fileInput" type="file" accept="image/jpeg,image/png" @change="handleFileSelect" />
  <button @click="$refs.fileInput?.click()">Choisir un fichier</button>
  <div v-if="uploading">Upload en cours...</div>
</template>

<script setup>
const uploading = ref(false)
const selectedFile = ref(null)

const handleFileSelect = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  // Validation manuelle
  if (file.size > 5 * 1024 * 1024) {
    alert('Fichier trop volumineux')
    return
  }

  // Upload manuel
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)

    const result = await $fetch('/api/upload/image', {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    emit('update:modelValue', result.imageUrl)
  } catch (error) {
    console.error('Erreur:', error)
  } finally {
    uploading.value = false
  }
}
</script>
```

### Après (avec le nouveau système)

```vue
<template>
  <ImageUpload
    v-model="imageUrl"
    :endpoint="{ type: 'generic' }"
    @uploaded="onUploaded"
    @error="onError"
  />
</template>

<script setup>
const imageUrl = ref('')

const onUploaded = (result) => {
  console.log('Upload réussi:', result)
}

const onError = (error) => {
  console.error('Erreur:', error)
}
</script>
```

## Tests

### Tests du composable

```typescript
import { useImageUpload } from '~/composables/useImageUpload'

test('validation de fichier', () => {
  const upload = useImageUpload()
  const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

  const result = upload.validateFile(file)
  expect(result.valid).toBe(true)
})
```

### Tests du composant

```vue
<template>
  <ImageUpload v-model="url" :endpoint="{ type: 'generic' }" data-testid="image-upload" />
</template>
```

## API Reference

### `useImageUpload(options?)`

#### Paramètres

- `options.validation` - Configuration de validation
- `options.showToast` - Afficher les notifications (défaut: true)
- `options.resetAfterUpload` - Réinitialiser après upload (défaut: true)

#### Retour

- `uploading` - État d'upload (readonly)
- `progress` - Progression 0-100 (readonly)
- `selectedFile` - Fichier sélectionné (readonly)
- `previewUrl` - URL de prévisualisation (readonly)
- `error` - Message d'erreur (readonly)
- `selectFile(file)` - Sélectionner un fichier
- `uploadFile(endpoint, data?)` - Uploader le fichier
- `deleteImage(endpoint)` - Supprimer une image
- `reset()` - Réinitialiser l'état
- `validateFile(file)` - Valider un fichier

### Props du composant `ImageUpload`

- `modelValue` - URL de l'image actuelle
- `endpoint` - Configuration de l'endpoint
- `options` - Options d'upload
- `alt` - Texte alternatif
- `placeholder` - Texte de placeholder
- `autoUpload` - Upload automatique (défaut: true)
- `allowDelete` - Autoriser la suppression (défaut: true)

### Événements du composant `ImageUpload`

- `@update:modelValue` - Nouvelle URL d'image
- `@uploaded` - Upload réussi
- `@deleted` - Image supprimée
- `@error` - Erreur survenue

## Sécurité

Le système inclut plusieurs protections de sécurité :

1. **Validation des types MIME** - Prévient l'upload de fichiers exécutables
2. **Validation des extensions** - Double vérification de sécurité
3. **Limites de taille** - Protection contre les attaques DoS
4. **Nettoyage des noms** - Protection contre path traversal
5. **Rejection SVG** - Prévention des attaques XSS via SVG

## Performance

- **Lazy loading** des images
- **Compression automatique** (via API backend)
- **Streaming upload** avec progression
- **Nettoyage automatique** des URLs blob
- **Validation côté client** pour feedback immédiat
