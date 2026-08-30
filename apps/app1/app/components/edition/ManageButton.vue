<template>
  <ClientOnly>
    <UButton
      v-if="canAccess"
      :to="`/editions/${edition.id}/gestion`"
      icon="i-heroicons-cog-6-tooth"
      :variant="variant"
      :size="size"
      :color="color"
    >
      {{ $t('edition.management') }}
    </UButton>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { Edition } from '~/types'

interface Props {
  edition: Edition
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'ghost',
  size: 'sm',
  color: 'neutral',
})

// Règle partagée avec l'entrée « Gestion » du panneau de navigation mobile.
const { peutAcceder: canAccess } = useAccesGestionEdition(() => props.edition)
</script>
