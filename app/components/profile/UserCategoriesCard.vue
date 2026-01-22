<template>
  <UCard class="shadow-lg border-0">
    <template #header>
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center"
        >
          <UIcon
            name="i-heroicons-user-group"
            class="w-5 h-5 text-purple-600 dark:text-purple-400"
          />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ $t('profile.user_categories.title') }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('profile.user_categories.description') }}
          </p>
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <div class="space-y-3">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ $t('profile.user_categories.select_label') }}
        </label>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('profile.user_categories.select_description') }}
        </p>

        <div class="grid grid-cols-1 gap-3">
          <label
            v-for="category in categoryItems"
            :key="category.value"
            class="relative flex items-start p-4 cursor-pointer rounded-lg border-2 transition-all hover:border-primary-300 dark:hover:border-primary-700"
            :class="
              selectedCategories.includes(category.value)
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700'
            "
          >
            <div class="flex items-start gap-3 w-full">
              <UCheckbox
                :model-value="selectedCategories.includes(category.value)"
                size="lg"
                class="mt-0.5"
                @update:model-value="toggleCategory(category.value)"
              />
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <UIcon :name="category.icon" size="20" class="text-primary-600" />
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ category.label }}
                  </h3>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ category.description }}
                </p>
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2" :class="mode === 'onboarding' ? 'justify-between' : 'justify-end'">
        <!-- Bouton Passer (mode onboarding uniquement) -->
        <UButton
          v-if="mode === 'onboarding' && showSkip"
          variant="ghost"
          size="lg"
          :disabled="loading"
          @click="handleSkip"
        >
          {{ $t('common.skip') }}
        </UButton>

        <!-- Boutons mode profile -->
        <div v-if="mode === 'profile'" class="flex gap-2">
          <UButton
            v-if="hasCategoryChanges"
            variant="outline"
            color="neutral"
            size="lg"
            icon="i-heroicons-arrow-path"
            class="transition-all duration-200 hover:transform hover:scale-105"
            @click="resetCategories"
          >
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            :loading="loading"
            :disabled="!hasCategoryChanges"
            icon="i-heroicons-check"
            color="primary"
            size="lg"
            class="transition-all duration-200 hover:transform hover:scale-105"
            @click="saveCategories"
          >
            {{ loading ? t('profile.saving') : t('profile.save_changes') }}
          </UButton>
        </div>

        <!-- Bouton Continuer (mode onboarding) -->
        <UButton
          v-if="mode === 'onboarding'"
          :loading="loading"
          :disabled="!canSave"
          icon="i-heroicons-check"
          size="lg"
          class="transition-all duration-200 hover:transform hover:scale-105"
          @click="saveCategories"
        >
          {{ loading ? $t('common.saving') : $t('common.continue') }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import type { User } from '~/types'

interface Props {
  mode?: 'profile' | 'onboarding'
  showSkip?: boolean
  onSuccess?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'profile',
  showSkip: false,
  onSuccess: undefined,
})

const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const selectedCategories = ref<string[]>([
  ...(authStore.user?.isVolunteer ? ['volunteer'] : []),
  ...(authStore.user?.isArtist ? ['artist'] : []),
  ...(authStore.user?.isOrganizer ? ['organizer'] : []),
])

const categoryItems = computed(() => [
  {
    label: t('profile.user_categories.categories.volunteer'),
    description: t('profile.user_categories.categories.volunteer_desc'),
    value: 'volunteer',
    icon: 'i-heroicons-user-group',
  },
  {
    label: t('profile.user_categories.categories.artist'),
    description: t('profile.user_categories.categories.artist_desc'),
    value: 'artist',
    icon: 'i-heroicons-star',
  },
  {
    label: t('profile.user_categories.categories.organizer'),
    description: t('profile.user_categories.categories.organizer_desc'),
    value: 'organizer',
    icon: 'i-heroicons-user-group',
  },
])

const hasCategoryChanges = computed(() => {
  // En mode onboarding, on vérifie juste si au moins une catégorie est sélectionnée
  if (props.mode === 'onboarding') {
    return selectedCategories.value.length > 0
  }

  // En mode profile, on vérifie les changements par rapport aux valeurs originales
  const originalCategories = [
    ...(authStore.user?.isVolunteer ? ['volunteer'] : []),
    ...(authStore.user?.isArtist ? ['artist'] : []),
    ...(authStore.user?.isOrganizer ? ['organizer'] : []),
  ].sort()
  const currentCategories = [...selectedCategories.value].sort()
  return JSON.stringify(originalCategories) !== JSON.stringify(currentCategories)
})

const canSave = computed(() => {
  // En mode onboarding, on peut toujours sauvegarder (les catégories sont optionnelles)
  if (props.mode === 'onboarding') {
    return true
  }

  // En mode profile, on peut sauvegarder seulement s'il y a des changements
  return hasCategoryChanges.value
})

const saveCategories = async () => {
  // En mode profile, ne sauvegarder que s'il y a des changements
  if (props.mode === 'profile' && !hasCategoryChanges.value) return

  loading.value = true
  try {
    const updatedUser = await $fetch<User>('/api/profile/categories', {
      method: 'PUT',
      body: {
        isVolunteer: selectedCategories.value.includes('volunteer'),
        isArtist: selectedCategories.value.includes('artist'),
        isOrganizer: selectedCategories.value.includes('organizer'),
      },
    })

    // Mettre à jour les données utilisateur dans le store
    authStore.updateUser({ ...authStore.user!, ...updatedUser })

    toast.add({
      title: t('profile.user_categories.save_success'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Callback personnalisé après succès (pour redirection en mode onboarding)
    if (props.onSuccess) {
      props.onSuccess()
    } else if (props.mode === 'onboarding') {
      // Redirection par défaut en mode onboarding
      router.push('/')
    }
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string }
    toast.add({
      title: t('profile.user_categories.save_error'),
      description: httpError.data?.message || httpError.message,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const handleSkip = () => {
  if (props.mode === 'onboarding') {
    router.push('/')
  }
}

const resetCategories = () => {
  selectedCategories.value = [
    ...(authStore.user?.isVolunteer ? ['volunteer'] : []),
    ...(authStore.user?.isArtist ? ['artist'] : []),
    ...(authStore.user?.isOrganizer ? ['organizer'] : []),
  ]
}

const toggleCategory = (categoryValue: string) => {
  const index = selectedCategories.value.indexOf(categoryValue)
  if (index > -1) {
    selectedCategories.value.splice(index, 1)
  } else {
    selectedCategories.value.push(categoryValue)
  }
}

// Watcher pour mettre à jour les catégories si l'utilisateur change
watch(
  () => authStore.user,
  (newUser) => {
    if (newUser && !hasCategoryChanges.value) {
      selectedCategories.value = [
        ...(newUser.isVolunteer ? ['volunteer'] : []),
        ...(newUser.isArtist ? ['artist'] : []),
        ...(newUser.isOrganizer ? ['organizer'] : []),
      ]
    }
  },
  { deep: true }
)
</script>
