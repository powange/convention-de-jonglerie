<template>
  <img :src="displayUrl" :alt="altText" :class="avatarClasses" :style="customSizeStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useImageLoader } from '~/composables/useImageLoader'
import { useAvatar } from '~/utils/avatar'

interface User {
  email?: string
  emailHash?: string
  profilePicture?: string | null
  updatedAt?: string
  pseudo?: string
}

interface Props {
  user: User
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  border?: boolean
  shrink?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  border: false,
  shrink: false,
})

const { getUserAvatar } = useAvatar()

// Mapping des tailles vers les pixels
const sizeMap = {
  xs: 16,
  sm: 20,
  md: 32,
  lg: 40,
  xl: 120,
} as const

// Mapping des tailles vers les classes CSS
const cssClassMap = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-10 h-10',
  lg: 'w-15 h-15',
  xl: 'w-32 h-32',
} as const

const pixelSize = computed(() => {
  return typeof props.size === 'number' ? props.size : sizeMap[props.size]
})

const avatarUrl = computed(() => {
  return getUserAvatar(props.user, pixelSize.value)
})

// Générer une URL de fallback (avatar avec initiales ou Gravatar)
const fallbackUrl = computed(() => {
  return getUserAvatar(
    {
      ...props.user,
      profilePicture: null, // Force l'utilisation du fallback
    },
    pixelSize.value
  )
})

// Détecter si l'URL est une image externe (Google, etc.)
const isExternalImage = computed(() => {
  const url = avatarUrl.value
  return (
    url.startsWith('http://') ||
    (url.startsWith('https://') && !url.includes('gravatar.com') && !url.startsWith('data:'))
  )
})

// Utiliser le système de cache et retry uniquement pour les images externes
const { currentUrl } = isExternalImage.value
  ? useImageLoader(avatarUrl.value, fallbackUrl.value)
  : { currentUrl: avatarUrl }

// URL finale à afficher
const displayUrl = computed(() => currentUrl.value)

const altText = computed(() => {
  if (props.user.pseudo) {
    return `Avatar de ${props.user.pseudo}`
  }
  return 'Avatar utilisateur'
})

const avatarClasses = computed(() => {
  const classes = ['rounded-full']

  // Taille CSS seulement pour les tailles prédéfinies
  if (typeof props.size === 'string') {
    classes.push(cssClassMap[props.size])
  }

  // Bordure optionnelle
  if (props.border) {
    classes.push('border-2 border-gray-200')
  }

  // Flex-shrink optionnel pour les commentaires
  if (props.shrink) {
    classes.push('flex-shrink-0')
  }

  // Classes personnalisées
  if (props.class) {
    classes.push(props.class)
  }

  return classes.join(' ')
})

// Style inline pour les tailles custom
const customSizeStyle = computed(() => {
  if (typeof props.size === 'number') {
    return {
      width: `${props.size}px`,
      height: `${props.size}px`,
    }
  }
  return {}
})
</script>
