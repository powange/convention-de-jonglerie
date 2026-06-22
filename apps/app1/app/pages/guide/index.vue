<template>
  <div>
    <h1 class="text-3xl font-bold mb-4">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('description') }}
    </p>

    <UAlert
      icon="i-heroicons-wrench-screwdriver"
      color="warning"
      variant="subtle"
      title="Guide under construction"
      description="This guide is currently only available in French. Translations to other languages will be added later."
      class="mb-8"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <NuxtLink
        v-for="role in roles"
        :key="role.slug"
        :to="`/guide/${role.slug}`"
        class="block group"
      >
        <UCard class="h-full transition-shadow group-hover:shadow-lg">
          <div class="flex flex-col items-center text-center gap-4 py-4">
            <div
              class="w-16 h-16 rounded-full flex items-center justify-center"
              :class="role.bgClass"
            >
              <UIcon :name="role.icon" class="w-8 h-8" :class="role.iconClass" />
            </div>
            <div>
              <h2 class="text-xl font-semibold mb-2">{{ role.title }}</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ role.description }}
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
  title: "Guide d'utilisation",
})

useHead({
  title: "Guide d'utilisation | Convention de Jonglerie",
  meta: [
    {
      name: 'description',
      content:
        'Découvrez toutes les fonctionnalités de Convention de Jonglerie selon votre rôle : utilisateur, artiste, organisateur ou bénévole.',
    },
  ],
})

const roles = computed(() => [
  {
    slug: 'user',
    title: t('roles.user.title'),
    description: t('roles.user.description'),
    icon: 'i-heroicons-user',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    slug: 'artist',
    title: t('roles.artist.title'),
    description: t('roles.artist.description'),
    icon: 'i-heroicons-star',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconClass: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    slug: 'organizer',
    title: t('roles.organizer.title'),
    description: t('roles.organizer.description'),
    icon: 'i-heroicons-user-group',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    iconClass: 'text-purple-600 dark:text-purple-400',
  },
  {
    slug: 'volunteer',
    title: t('roles.volunteer.title'),
    description: t('roles.volunteer.description'),
    icon: 'i-heroicons-hand-raised',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    iconClass: 'text-green-600 dark:text-green-400',
  },
])
</script>

<i18n lang="json">
{
  "fr": {
    "title": "Guide d'utilisation",
    "description": "Découvrez toutes les fonctionnalités de Convention de Jonglerie selon votre rôle.",
    "roles": {
      "user": {
        "title": "Utilisateur",
        "description": "Découvrez les conventions de jonglerie, gérez vos favoris et participez à la communauté."
      },
      "artist": {
        "title": "Artiste",
        "description": "Proposez vos spectacles aux conventions et suivez vos candidatures artistiques."
      },
      "organizer": {
        "title": "Organisateur",
        "description": "Créez et gérez vos conventions, éditions, bénévoles et billetterie."
      },
      "volunteer": {
        "title": "Bénévole",
        "description": "Postulez en tant que bénévole, consultez votre planning et gérez vos créneaux."
      }
    }
  }
}
</i18n>
