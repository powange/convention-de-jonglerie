<template>
  <nav>
    <NuxtLink
      to="/profile"
      class="flex items-center gap-2 text-sm font-semibold mb-4 px-2"
      @click="emit('navigate')"
    >
      <UIcon name="i-heroicons-user-circle" class="w-5 h-5 text-primary-500" />
      {{ t('nav.title') }}
    </NuxtLink>

    <UNavigationMenu
      :items="items"
      orientation="vertical"
      color="primary"
      variant="pill"
      highlight
      :collapsible="true"
    />
  </nav>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n({ useScope: 'local' })
const authStore = useAuthStore()

const emit = defineEmits<{
  navigate: []
}>()

const items = computed<NavigationMenuItem[][]>(() => {
  const navItems: NavigationMenuItem[] = [
    {
      label: t('nav.personal_info'),
      icon: 'i-heroicons-user',
      to: '/profile/informations',
      onSelect: () => emit('navigate'),
    },
    {
      label: t('nav.notifications'),
      icon: 'i-heroicons-bell',
      to: '/profile/notifications',
      onSelect: () => emit('navigate'),
    },
    {
      label: t('nav.my_conventions'),
      icon: 'i-heroicons-calendar-days',
      to: '/profile/mes-conventions',
      onSelect: () => emit('navigate'),
    },
  ]

  if (authStore.isVolunteer) {
    navItems.push({
      label: t('nav.my_volunteer_applications'),
      icon: 'i-heroicons-hand-raised',
      to: '/profile/mes-candidatures-benevole',
      onSelect: () => emit('navigate'),
    })
  }

  if (authStore.isArtist) {
    navItems.push({
      label: t('nav.my_artist_applications'),
      icon: 'i-heroicons-sparkles',
      to: '/profile/mes-candidatures-artiste',
      onSelect: () => emit('navigate'),
    })
  }

  navItems.push({
    label: t('nav.security'),
    icon: 'i-heroicons-shield-check',
    to: '/profile/securite',
    onSelect: () => emit('navigate'),
  })

  return [navItems]
})
</script>

<i18n lang="json">
{
  "fr": {
    "nav": {
      "title": "Mon profil",
      "home": "Accueil",
      "personal_info": "Informations personnelles",
      "notifications": "Notifications",
      "my_conventions": "Mes conventions",
      "my_volunteer_applications": "Mes candidatures bénévole",
      "my_artist_applications": "Mes candidatures artiste",
      "security": "Connexion et sécurité"
    }
  }
}
</i18n>
