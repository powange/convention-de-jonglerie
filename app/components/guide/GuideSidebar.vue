<template>
  <nav>
    <NuxtLink
      to="/guide"
      class="flex items-center gap-2 text-sm font-semibold mb-4 px-2"
      @click="emit('navigate')"
    >
      <UIcon name="i-heroicons-book-open" class="w-5 h-5 text-primary-500" />
      {{ t('title') }}
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
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { t } = useI18n({ useScope: 'local' })

const emit = defineEmits<{
  navigate: []
}>()

const isOrganizerSection = computed(() => route.path.startsWith('/guide/organizer'))

const items = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: t('nav.user'),
      icon: 'i-heroicons-user',
      to: '/guide/user',
      onSelect: () => emit('navigate'),
    },
    {
      label: t('nav.artist'),
      icon: 'i-heroicons-star',
      to: '/guide/artist',
      onSelect: () => emit('navigate'),
    },
    {
      label: t('nav.organizer'),
      icon: 'i-heroicons-building-office',
      defaultOpen: isOrganizerSection.value,
      children: [
        {
          label: t('nav.orgOverview'),
          to: '/guide/organizer',
          onSelect: () => emit('navigate'),
        },
        {
          label: t('nav.conventions'),
          to: '/guide/organizer/conventions',
          onSelect: () => emit('navigate'),
        },
        {
          label: t('nav.organizers'),
          to: '/guide/organizer/organizers',
          onSelect: () => emit('navigate'),
        },
        {
          label: t('nav.volunteers'),
          to: '/guide/organizer/volunteers',
          onSelect: () => emit('navigate'),
        },
        {
          label: t('nav.artists'),
          to: '/guide/organizer/artists',
          onSelect: () => emit('navigate'),
        },
        {
          label: t('nav.meals'),
          to: '/guide/organizer/meals',
          onSelect: () => emit('navigate'),
        },
        {
          label: t('nav.ticketing'),
          to: '/guide/organizer/ticketing',
          onSelect: () => emit('navigate'),
        },
        {
          label: t('nav.map'),
          to: '/guide/organizer/map',
          onSelect: () => emit('navigate'),
        },
        {
          label: t('nav.other'),
          to: '/guide/organizer/others',
          onSelect: () => emit('navigate'),
        },
      ],
    },
    {
      label: t('nav.volunteer'),
      icon: 'i-heroicons-hand-raised',
      to: '/guide/volunteer',
      onSelect: () => emit('navigate'),
    },
  ],
])
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Guide d'utilisation",
    "nav": {
      "user": "Utilisateur",
      "artist": "Artiste",
      "organizer": "Organisateur",
      "orgOverview": "Vue d'ensemble",
      "conventions": "Conventions & Éditions",
      "organizers": "Co-organisateurs",
      "volunteers": "Bénévoles",
      "artists": "Artistes & Spectacles",
      "meals": "Repas",
      "ticketing": "Billetterie",
      "map": "Carte interactive",
      "other": "Autres",
      "volunteer": "Bénévole"
    }
  }
}
</i18n>
