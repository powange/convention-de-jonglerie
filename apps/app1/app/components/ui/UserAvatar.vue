<template>
  <!--
    ⚠️ `@error` EST LE DERNIER RECOURS, ET IL MANQUAIT. `getUserAvatarWithCache` mémorise dans le
    navigateur, pour 24 h, qu'une image s'est chargée — et court-circuite alors toute reprise. Si le
    fichier disparaît entre-temps (photo supprimée du disque, hébergeur tiers qui cesse de servir),
    la décision mise en cache reste « succès », aucune erreur n'est traitée, et l'on affiche le
    texte de remplacement sur fond vide : « Avatar de BEN SOLAR SOUND CIRKLE » au lieu d'un rond.
    Constaté le 07/10/2026 sur la liste des artistes à payer.

    📍 Celui-ci ne dépend d'aucun cache : il se déclenche sur l'échec RÉEL du chargement, quelle que
    soit la raison, et quelle que soit ce que le cache croyait savoir.
  -->
  <img
    :src="displayUrl"
    :alt="altText"
    :class="avatarClasses"
    :style="customSizeStyle"
    @error="auxInitiales"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAvatar } from '~/utils/avatar'

interface User {
  id?: number
  email?: string
  // Facultative : plusieurs vues affichent un utilisateur dont on n'a pas l'empreinte
  // d'e-mail (statistiques de bénévolat, réservations). L'avatar sait déjà s'en passer.
  emailHash?: string | null
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

const { getUserAvatarWithCache, generateInitialsAvatar } = useAvatar()

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

// Avatar réactif : recalculer quand l'utilisateur change (ex: impersonation)
const avatarState = shallowRef(getUserAvatarWithCache(props.user, pixelSize.value))

watch(
  () => [props.user.id, props.user.emailHash, props.user.profilePicture, pixelSize.value] as const,
  () => {
    // Nouvelle personne, nouvelle chance : le repli de la précédente ne la concerne pas.
    repliSurInitiales.value = null
    avatarState.value = getUserAvatarWithCache(props.user, pixelSize.value)
  }
)

/**
 * Le repli posé par `@error`, quand le chargement a VRAIMENT échoué.
 *
 * Il prime sur l'URL calculée : c'est la seule information qui vienne du navigateur lui-même, et
 * non d'un cache ou d'une déduction.
 */
const repliSurInitiales = ref<string | null>(null)

/**
 * Passer aux initiales dessinées.
 *
 * ⚠️ On ne repose pas le repli s'il est déjà en place : si l'image de repli échouait à son tour —
 * elle ne le peut pas, c'est une `data:` URI, mais une version future pourrait changer cela —, le
 * gestionnaire se rappellerait indéfiniment.
 */
function auxInitiales() {
  const initiales = generateInitialsAvatar(props.user.pseudo || '?', pixelSize.value)
  if (repliSurInitiales.value !== initiales) repliSurInitiales.value = initiales
}

// URL finale à afficher
const displayUrl = computed(() => repliSurInitiales.value ?? avatarState.value.currentUrl.value)

const altText = computed(() => {
  if (props.user.pseudo) {
    return `Avatar de ${props.user.pseudo}`
  }
  return 'Avatar utilisateur'
})

const avatarClasses = computed(() => {
  const classes = ['rounded-full', 'object-cover']

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
