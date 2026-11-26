<template>
  <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
    <h1 class="flex items-center gap-2 text-2xl font-bold">
      <UIcon name="i-heroicons-shield-check" class="text-primary" />
      Administration
    </h1>
    <UNavigationMenu :items="items" highlight />
  </div>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const items: NavigationMenuItem[] = [
  { label: 'Tableau de bord', icon: 'i-heroicons-chart-bar', to: '/admin', exact: true },
  { label: 'Utilisateurs', icon: 'i-heroicons-users', to: '/admin/utilisateurs' },
  { label: 'Événements', icon: 'i-heroicons-calendar-days', to: '/admin/evenements' },
  { label: 'Base de données', icon: 'i-heroicons-circle-stack', to: '/admin/backup' },
]
</script>
