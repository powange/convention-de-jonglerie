<template>
  <nav>
    <NuxtLink
      to="/profile"
      class="flex items-center gap-2 text-base font-semibold mb-4 px-2"
      @click="emit('navigate')"
    >
      <UIcon name="i-heroicons-user-circle" class="size-5 text-primary-500" />
      {{ t('profile.sidebar.title') }}
    </NuxtLink>

    <!-- Le menu dépend des rôles (isVolunteer/isArtist) du store d'auth, peuplé
         uniquement côté client → ClientOnly évite un mismatch d'hydratation. -->

    <!-- Cibles tactiles : ces valeurs sont CELLES DU PANNEAU DE GESTION
         (`layouts/edition-dashboard.vue`), reprises à l'identique. Les entrées y faisaient 36 px
         de haut dans le tiroir mobile — sous le seuil confortable, et deux fois moins que celles
         de la gestion, mesurées côte à côte.
         Le seuil `lg` est le même des deux côtés, et c'est ce qui rend la reprise exacte : c'est
         précisément là que `layouts/profile.vue` passe du tiroir à la colonne permanente, où l'on
         préfère la compacité. -->
    <ClientOnly>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        color="primary"
        variant="pill"
        highlight
        :collapsible="true"
        :ui="{
          link: 'text-base items-start gap-3 py-4 lg:gap-1.5 lg:py-1.5',
          linkLeadingIcon: 'size-6 lg:size-5',
          linkLabel: 'whitespace-normal',
          childLink: 'text-base items-start gap-3 py-4 lg:gap-1.5 lg:py-1.5',
          childLinkIcon: 'size-6 lg:size-5',
          childLinkLabel: 'whitespace-normal',
        }"
      />
    </ClientOnly>
  </nav>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const authStore = useAuthStore()

const emit = defineEmits<{
  navigate: []
}>()

const items = computed<NavigationMenuItem[][]>(() => {
  const navItems: NavigationMenuItem[] = [
    {
      label: t('profile.sidebar.personal_info'),
      icon: 'i-heroicons-user',
      to: '/profile/informations',
      onSelect: () => emit('navigate'),
    },
    {
      label: t('profile.sidebar.notifications'),
      icon: 'i-heroicons-bell',
      to: '/profile/notifications',
      onSelect: () => emit('navigate'),
    },
    {
      label: t('profile.sidebar.my_conventions'),
      icon: 'i-heroicons-calendar-days',
      to: '/profile/mes-conventions',
      onSelect: () => emit('navigate'),
    },
  ]

  if (authStore.isVolunteer) {
    navItems.push({
      label: t('profile.sidebar.my_volunteer_applications'),
      icon: 'i-heroicons-hand-raised',
      to: '/profile/mes-candidatures-benevole',
      onSelect: () => emit('navigate'),
    })
  }

  if (authStore.isArtist) {
    navItems.push({
      label: t('profile.sidebar.my_artist_applications'),
      icon: 'i-heroicons-sparkles',
      to: '/profile/mes-candidatures-artiste',
      onSelect: () => emit('navigate'),
    })
  }

  navItems.push({
    label: t('profile.sidebar.security'),
    icon: 'i-heroicons-shield-check',
    to: '/profile/securite',
    onSelect: () => emit('navigate'),
  })

  return [navItems]
})
</script>
