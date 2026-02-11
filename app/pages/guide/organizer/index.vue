<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink
        v-for="section in sections"
        :key="section.slug"
        :to="`/guide/organizer/${section.slug}`"
        class="block group"
      >
        <UCard class="h-full transition-shadow group-hover:shadow-lg">
          <div class="flex flex-col items-center text-center gap-3 py-2">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center"
              :class="section.bgClass"
            >
              <UIcon :name="section.icon" class="w-6 h-6" :class="section.iconClass" />
            </div>
            <div>
              <h2 class="text-base font-semibold mb-1">{{ section.title }}</h2>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                {{ section.description }}
              </p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' })

definePageMeta({
  layout: 'guide',
  title: 'Guide - Organisateur',
})

useHead({
  title: 'Guide Organisateur | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        'Guide complet pour les organisateurs : conventions, éditions, bénévoles, artistes, billetterie et plus.',
    },
  ],
})

const sections = computed(() => [
  {
    slug: 'conventions',
    title: t('sections.conventions.title'),
    description: t('sections.conventions.description'),
    icon: 'i-heroicons-calendar-days',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    iconClass: 'text-purple-600 dark:text-purple-400',
  },
  {
    slug: 'organizers',
    title: t('sections.organizers.title'),
    description: t('sections.organizers.description'),
    icon: 'i-heroicons-user-group',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    iconClass: 'text-purple-600 dark:text-purple-400',
  },
  {
    slug: 'volunteers',
    title: t('sections.volunteers.title'),
    description: t('sections.volunteers.description'),
    icon: 'i-heroicons-hand-raised',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  {
    slug: 'artists',
    title: t('sections.artists.title'),
    description: t('sections.artists.description'),
    icon: 'i-heroicons-star',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconClass: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    slug: 'meals',
    title: t('sections.meals.title'),
    description: t('sections.meals.description'),
    icon: 'cbi:mealie',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    iconClass: 'text-orange-600 dark:text-orange-400',
  },
  {
    slug: 'ticketing',
    title: t('sections.ticketing.title'),
    description: t('sections.ticketing.description'),
    icon: 'i-heroicons-ticket',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    slug: 'map',
    title: t('sections.map.title'),
    description: t('sections.map.description'),
    icon: 'i-heroicons-map',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  {
    slug: 'others',
    title: t('sections.other.title'),
    description: t('sections.other.description'),
    icon: 'i-heroicons-squares-plus',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    iconClass: 'text-green-600 dark:text-green-400',
  },
])
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Guide Organisateur",
    "subtitle": "Créez et gérez vos conventions, éditions et événements.",
    "sections": {
      "conventions": {
        "title": "Conventions & Éditions",
        "description": "Créer, configurer et publier vos événements."
      },
      "organizers": {
        "title": "Co-organisateurs",
        "description": "Inviter des collaborateurs et gérer les permissions."
      },
      "volunteers": {
        "title": "Bénévoles",
        "description": "Appel, équipes, planning et notifications."
      },
      "artists": {
        "title": "Artistes & Spectacles",
        "description": "Appels à spectacles, candidatures et programme."
      },
      "meals": {
        "title": "Repas",
        "description": "Configuration, synchronisation et validation."
      },
      "ticketing": {
        "title": "Billetterie",
        "description": "Tarifs, commandes, contrôle d'accès et stats."
      },
      "map": {
        "title": "Carte interactive",
        "description": "Zones, marqueurs et plan du site."
      },
      "other": {
        "title": "Autres",
        "description": "Workshops, objets trouvés, publications."
      }
    }
  }
}
</i18n>
