<template>
  <div class="flex items-center justify-center p-4 min-h-screen">
    <div class="w-full max-w-lg">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div
          class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg"
        >
          <UIcon name="i-heroicons-check-badge" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t('auth.welcome_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('auth.complete_profile_subtitle') }}</p>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <div class="space-y-6">
          <!-- Message de bienvenue -->
          <div
            class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg"
          >
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-check-circle"
                class="text-green-600 dark:text-green-400 mt-0.5"
                size="20"
              />
              <div>
                <p class="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                  {{ $t('auth.account_created_success') }}
                </p>
                <p class="text-xs text-green-700 dark:text-green-300">
                  {{ $t('auth.customize_experience') }}
                </p>
              </div>
            </div>
          </div>

          <!-- Section Catégories -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3
                class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
              >
                {{ $t('profile.user_categories.title') }}
              </h3>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{
                $t('common.optional')
              }}</span>
            </div>
            <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('profile.user_categories.description') }}
              </p>
            </div>

            <UFormField
              :label="$t('profile.user_categories.select_label')"
              :description="$t('profile.user_categories.select_description')"
            >
              <UCheckboxGroup v-model="selectedCategories" :items="categoryItems" />
            </UFormField>
          </div>

          <!-- Boutons -->
          <div class="flex gap-3 pt-4">
            <UButton
              variant="outline"
              size="lg"
              block
              icon="i-heroicons-arrow-right"
              @click="skipCategories"
            >
              {{ $t('common.skip') }}
            </UButton>
            <UButton
              :loading="loading"
              size="lg"
              block
              icon="i-heroicons-check"
              @click="saveCategories"
            >
              {{ loading ? $t('common.saving') : $t('common.continue') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const { t } = useI18n()
const authStore = useAuthStore()

// Middleware pour s'assurer que l'utilisateur est connecté
definePageMeta({
  middleware: 'authenticated',
})

const selectedCategories = ref<string[]>([])

const categoryItems = computed(() => [
  {
    label: t('profile.user_categories.categories.volunteer'),
    description: t('profile.user_categories.categories.volunteer_desc'),
    value: 'volunteer',
  },
  {
    label: t('profile.user_categories.categories.artist'),
    description: t('profile.user_categories.categories.artist_desc'),
    value: 'artist',
  },
  {
    label: t('profile.user_categories.categories.organizer'),
    description: t('profile.user_categories.categories.organizer_desc'),
    value: 'organizer',
  },
])

// Construit le payload pour l'API
const buildPayload = () => ({
  isVolunteer: selectedCategories.value.includes('volunteer'),
  isArtist: selectedCategories.value.includes('artist'),
  isOrganizer: selectedCategories.value.includes('organizer'),
})

// Action pour sauvegarder les catégories
const { execute: executeSave, loading } = useApiAction('/api/profile/categories', {
  method: 'PUT',
  body: buildPayload,
  successMessage: { title: t('profile.user_categories.save_success') },
  errorMessages: { default: t('profile.user_categories.save_error') },
  onSuccess: async (updatedUser) => {
    // Mettre à jour le store
    authStore.updateUser(updatedUser)
    // Rediriger vers la destination finale ou la page d'accueil
    await redirectToFinalDestination()
  },
})

const saveCategories = () => {
  executeSave()
}

const skipCategories = async () => {
  await redirectToFinalDestination()
}

const redirectToFinalDestination = async () => {
  // Le cookie sera lu par le serveur si nécessaire, sinon on redirige vers la page d'accueil
  await navigateTo('/')
}
</script>
