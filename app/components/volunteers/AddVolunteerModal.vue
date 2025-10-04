<template>
  <UModal v-model:open="isOpen" :title="$t('editions.volunteers.add_volunteer_title')">
    <template #body>
      <div class="space-y-4">
        <UFormField
          :label="$t('editions.volunteers.search_by_email')"
          :description="$t('editions.volunteers.search_by_email_description')"
        >
          <UInput
            v-model="searchEmail"
            type="email"
            :placeholder="$t('editions.volunteers.email_placeholder')"
            icon="i-heroicons-magnifying-glass"
          />
        </UFormField>

        <!-- Résultats de recherche -->
        <div v-if="searching" class="text-center py-4">
          <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin mx-auto text-gray-400" />
          <p class="text-sm text-gray-500 mt-2">{{ $t('common.searching') }}...</p>
        </div>

        <div v-else-if="searchResults.length > 0" class="space-y-2">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('editions.volunteers.users_found') }}
          </p>
          <div class="space-y-2">
            <div
              v-for="user in searchResults"
              :key="user.id"
              class="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              :class="
                selectedUser?.id === user.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              "
              @click="selectUser(user)"
            >
              <div class="flex items-center gap-3">
                <UiUserAvatar :user="user" size="md" />
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ user.pseudo || user.prenom }}
                  </p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ user.prenom }} {{ user.nom }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ user.email }}</p>
                </div>
                <UIcon
                  v-if="selectedUser?.id === user.id"
                  name="i-heroicons-check-circle"
                  class="h-6 w-6 text-primary-500 flex-shrink-0"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="searchEmail && !searching" class="text-center py-4">
          <UIcon name="i-heroicons-user-minus" class="h-12 w-12 text-gray-300 mx-auto mb-2" />
          <p class="text-sm text-gray-500">{{ $t('editions.volunteers.no_user_found') }}</p>
        </div>

        <!-- Utilisateur sélectionné -->
        <div v-if="selectedUser" class="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <p class="text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
            {{ $t('editions.volunteers.selected_user') }}
          </p>
          <div class="flex items-center gap-3">
            <UiUserAvatar :user="selectedUser" size="lg" />
            <div>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ selectedUser.pseudo || selectedUser.prenom }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ selectedUser.prenom }} {{ selectedUser.nom }}
              </p>
            </div>
          </div>
        </div>

        <!-- Message d'erreur -->
        <UAlert v-if="error" color="error" variant="soft" :title="error" />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="closeModal">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :disabled="!selectedUser || loading"
          :loading="loading"
          @click="addVolunteer"
        >
          {{ $t('editions.volunteers.add_volunteer') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface User {
  id: number
  pseudo: string | null
  prenom: string
  nom: string
  email: string
  emailHash?: string
  profilePicture?: string | null
  updatedAt?: string
}

interface Props {
  open: boolean
  editionId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'volunteer-added'): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const searchEmail = ref('')
const searching = ref(false)
const searchResults = ref<User[]>([])
const selectedUser = ref<User | null>(null)
const loading = ref(false)
const error = ref('')

// Fonction de recherche
const performSearch = async (email: string) => {
  if (!email || email.length < 3) {
    searchResults.value = []
    return
  }

  searching.value = true
  error.value = ''

  try {
    const response = await $fetch<{ users: User[] }>('/api/users/search', {
      params: { email },
    })
    searchResults.value = response.users || []
  } catch (err: any) {
    console.error('User search error:', err)
    error.value = t('editions.volunteers.search_error')
  } finally {
    searching.value = false
  }
}

// Watch avec debounce
let debounceTimeout: NodeJS.Timeout
watch(searchEmail, (newEmail) => {
  clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    performSearch(newEmail)
  }, 500)
})

const selectUser = (user: User) => {
  selectedUser.value = user
}

const addVolunteer = async () => {
  if (!selectedUser.value) return

  loading.value = true
  error.value = ''

  try {
    await $fetch(`/api/editions/${props.editionId}/volunteers/add-manually`, {
      method: 'POST',
      body: {
        userId: selectedUser.value.id,
      },
    })

    emit('volunteer-added')
    closeModal()
  } catch (err: any) {
    console.error('Add volunteer error:', err)
    error.value = err.data?.message || t('editions.volunteers.add_error')
  } finally {
    loading.value = false
  }
}

const closeModal = () => {
  isOpen.value = false
  searchEmail.value = ''
  searchResults.value = []
  selectedUser.value = null
  error.value = ''
}
</script>
