<template>
  <UModal v-model:open="isOpen" :title="$t('admin.delete_user_account')" size="md">
    <template #body>
      <div v-if="user" class="space-y-4">
        <!-- Information utilisateur -->
        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div class="flex items-center gap-3">
            <UiUserAvatar :user="user" size="md" border />
            <div>
              <p class="font-medium">{{ user.prenom }} {{ user.nom }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">@{{ user.pseudo }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ user.email }}</p>
            </div>
          </div>

          <!-- Statistiques utilisateur -->
          <div class="mt-3 flex gap-4 text-sm">
            <div class="flex items-center gap-1">
              <UIcon name="i-heroicons-building-library" class="w-4 h-4 text-blue-500" />
              <span>{{ user._count.createdConventions }} {{ $t('admin.conventions_count') }}</span>
            </div>
            <div class="flex items-center gap-1">
              <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-green-500" />
              <span>{{ user._count.createdEditions }} {{ $t('admin.editions_count') }}</span>
            </div>
            <div class="flex items-center gap-1">
              <UIcon name="i-heroicons-heart" class="w-4 h-4 text-red-500" />
              <span>{{ user._count.favoriteEditions }} {{ $t('admin.favorites_count') }}</span>
            </div>
          </div>
        </div>

        <!-- Avertissement -->
        <UAlert
          color="error"
          variant="soft"
          :title="$t('admin.deletion_warning_title')"
          :description="$t('admin.deletion_warning_description')"
          icon="i-heroicons-exclamation-triangle"
        />

        <!-- Sélection de la raison -->
        <div class="space-y-3">
          <label class="block text-sm font-medium">
            {{ $t('admin.deletion_reason') }} <span class="text-red-500">*</span>
          </label>

          <USelect
            v-model="selectedReason"
            :items="deletionReasons"
            :placeholder="$t('admin.select_deletion_reason')"
            size="lg"
            class="w-full"
            required
          />

          <!-- Description de la raison sélectionnée -->
          <div v-if="selectedReasonData" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">
              {{ selectedReasonData.title }}
            </p>
            <p class="text-sm text-blue-600 dark:text-blue-300 mt-1">
              {{ selectedReasonData.description }}
            </p>
          </div>
        </div>

        <!-- Confirmation par email -->
        <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div class="flex items-start gap-2">
            <UIcon name="i-heroicons-envelope" class="w-5 h-5 text-yellow-600 mt-0.5" />
            <div class="text-sm">
              <p class="font-medium text-yellow-800 dark:text-yellow-200">
                {{ $t('admin.email_notification') }}
              </p>
              <p class="text-yellow-700 dark:text-yellow-300 mt-1">
                {{ $t('admin.email_notification_description') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Champ de confirmation -->
        <div class="space-y-2">
          <label class="block text-sm font-medium">
            {{ $t('admin.type_pseudo_to_confirm') }}
          </label>
          <UInput v-model="confirmationText" :placeholder="user.pseudo" size="md" />
        </div>
      </div>

      <!-- Boutons d'action -->
      <div class="mt-6 flex justify-end gap-3">
        <UButton variant="ghost" @click="close">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="error" :loading="loading" :disabled="!canConfirm" @click="confirmDeletion">
          {{ $t('admin.delete_account') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useUserDeletion } from '~/composables/useUserDeletion'

interface ModalUser {
  id: number
  email: string
  pseudo: string
  nom: string
  prenom: string
  profilePicture?: string | null
  isEmailVerified: boolean
  isGlobalAdmin: boolean
  createdAt: string
  _count: {
    createdConventions: number
    createdEditions: number
    favoriteEditions: number
  }
}

interface Props {
  user: ModalUser | null
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'deleted', user: ModalUser): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { deleteUser, getDeletionReasons, getDeletionReason } = useUserDeletion()
const toast = useToast()
const { t } = useI18n()

// État réactif
const loading = ref(false)
const selectedReason = ref<
  'NOT_PHYSICAL_PERSON' | 'SPAM_ACTIVITY' | 'INACTIVE_ACCOUNT' | 'POLICY_VIOLATION' | undefined
>(undefined)
const confirmationText = ref('')

// Computed
const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const deletionReasons = computed(() => getDeletionReasons())

const selectedReasonData = computed(() => {
  if (!selectedReason.value) return null
  return getDeletionReason(selectedReason.value as any)
})

const canConfirm = computed(() => {
  return selectedReason.value && confirmationText.value === props.user?.pseudo && !loading.value
})

// Méthodes
const close = () => {
  isOpen.value = false
  resetForm()
}

const resetForm = () => {
  selectedReason.value = undefined
  confirmationText.value = ''
  loading.value = false
}

const confirmDeletion = async () => {
  if (!props.user || !canConfirm.value) return

  loading.value = true

  try {
    const result = await deleteUser(props.user.id, selectedReason.value as any)

    toast.add({
      color: 'success',
      title: t('admin.user_deleted_successfully'),
      description: result.message,
    })

    emit('deleted', props.user)
    close()
  } catch (error: any) {
    console.error('Erreur suppression:', error)
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: error.data?.message || t('admin.deletion_error'),
    })
  } finally {
    loading.value = false
  }
}

// Watchers
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      resetForm()
    }
  }
)
</script>
