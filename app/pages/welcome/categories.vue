<template>
  <div class="py-8">
    <!-- En-tête avec animation -->
    <div class="text-center mb-8">
      <div
        class="mx-auto w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center mb-6 shadow-lg"
      >
        <UIcon name="i-heroicons-user-circle" class="text-white" size="40" />
      </div>
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-3">
        {{ $t('profile.welcome') }}
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-400">
        {{ $t('profile.user_categories.description') }}
      </p>
    </div>

    <!-- Card principale -->
    <div class="max-w-2xl mx-auto">
      <ProfileUserCategoriesCard mode="onboarding" :show-skip="true" />

      <!-- Note de bas de page -->
      <div class="mt-6 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ $t('profile.user_categories.select_description') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

// Middleware pour s'assurer que l'utilisateur est authentifié
definePageMeta({
  middleware: 'authenticated',
})

// Métadonnées de la page
useSeoMeta({
  title: t('profile.welcome'),
  description: t('profile.user_categories.description'),
})
</script>
