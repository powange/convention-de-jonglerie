<template>
  <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
    <h1 class="flex items-center gap-2 text-2xl font-bold">
      <UIcon name="i-heroicons-shield-check" class="text-primary" />
      Administration
    </h1>
    <!-- Sur téléphone, les cinq entrées ne tiennent pas sur une ligne (166 px de trop à 390 px) :
         elles passent à la ligne, libellés entiers, au lieu d'élargir la page ou d'être tronquées. -->
    <UNavigationMenu
      :items="items"
      highlight
      class="max-w-full"
      :ui="{ list: 'flex-wrap', linkLabel: 'overflow-visible whitespace-nowrap' }"
    />
  </div>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const items: NavigationMenuItem[] = [
  { label: 'Tableau de bord', icon: 'i-heroicons-chart-bar', to: '/admin', exact: true },
  { label: 'Utilisateurs', icon: 'i-heroicons-users', to: '/admin/utilisateurs' },
  { label: 'Événements', icon: 'i-heroicons-calendar-days', to: '/admin/evenements' },
  { label: 'Codes promo', icon: 'i-heroicons-ticket', to: '/admin/codes-promo' },
  { label: 'Base de données', icon: 'i-heroicons-circle-stack', to: '/admin/backup' },
]
</script>
