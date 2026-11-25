<template>
  <nav>
    <NuxtLink
      to="/profile"
      class="mb-4 flex items-center gap-2 px-2 text-base font-semibold"
      @click="emit('navigate')"
    >
      <UIcon name="i-heroicons-user-circle" class="size-5 text-primary" />
      Mon profil
    </NuxtLink>
    <!-- Cibles tactiles reprises d'app1 : larges dans le tiroir mobile, compactes en colonne. -->
    <UNavigationMenu
      :items="items"
      orientation="vertical"
      color="primary"
      variant="pill"
      highlight
      :ui="{
        link: 'text-base items-start gap-3 py-4 lg:gap-1.5 lg:py-1.5',
        linkLeadingIcon: 'size-6 lg:size-5',
        linkLabel: 'whitespace-normal',
      }"
    />
  </nav>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const emit = defineEmits<{ navigate: [] }>()

const items: NavigationMenuItem[] = [
  {
    label: 'Vue d’ensemble',
    icon: 'i-heroicons-home',
    to: '/profile',
    exact: true,
    onSelect: () => emit('navigate'),
  },
  {
    label: 'Informations personnelles',
    icon: 'i-heroicons-user',
    to: '/profile/informations',
    onSelect: () => emit('navigate'),
  },
  {
    label: 'Sécurité',
    icon: 'i-heroicons-shield-check',
    to: '/profile/securite',
    onSelect: () => emit('navigate'),
  },
]
</script>
