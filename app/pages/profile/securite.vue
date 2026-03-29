<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
    <!-- Changement de mot de passe -->
    <UCard class="shadow-lg border-0">
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-key" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ $t('profile.change_password') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('profile.manage_password') }}
            </p>
          </div>
        </div>
      </template>

      <UForm
        :state="passwordState"
        :schema="passwordSchema"
        class="space-y-6"
        @submit="changePassword"
      >
        <UFormField
          v-if="userHasPassword"
          :label="t('profile.current_password')"
          name="currentPassword"
        >
          <UInput
            v-model="passwordState.currentPassword"
            type="password"
            icon="i-heroicons-lock-closed"
            required
            :placeholder="t('profile.current_password_placeholder')"
            size="lg"
            class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
          />
        </UFormField>

        <UAlert
          v-else
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          class="mb-4"
        >
          <template #title>
            {{ $t('profile.no_password_set') }}
          </template>
          <template #description>
            {{ $t('profile.oauth_password_info') }}
          </template>
        </UAlert>

        <UFormField :label="t('profile.new_password')" name="newPassword">
          <UInput
            v-model="passwordState.newPassword"
            type="password"
            icon="i-heroicons-key"
            required
            :placeholder="t('profile.new_password_placeholder')"
            size="lg"
            class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
          />
        </UFormField>

        <UFormField :label="t('auth.confirm_new_password')" name="confirmPassword">
          <UInput
            v-model="passwordState.confirmPassword"
            type="password"
            icon="i-heroicons-shield-check"
            required
            :placeholder="t('profile.confirm_new_password_placeholder')"
            size="lg"
            class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
          />
        </UFormField>

        <div class="flex justify-end">
          <UButton
            type="submit"
            :loading="passwordLoading"
            color="primary"
            size="lg"
            icon="i-heroicons-key"
            class="transition-all duration-200 hover:transform hover:scale-105"
          >
            {{ passwordLoading ? t('profile.changing') : t('profile.change_password') }}
          </UButton>
        </div>
      </UForm>
    </UCard>

    <!-- Suppression du compte -->
    <UCard class="shadow-lg border-0 border-red-200 dark:border-red-800">
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-trash" class="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ $t('profile.delete_account.title') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('profile.delete_account.description') }}
            </p>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <UAlert icon="i-heroicons-exclamation-triangle" color="error" variant="soft">
          <template #title>
            {{ $t('profile.delete_account.warning') }}
          </template>
          <template #description>
            {{ $t('profile.delete_account.warning_details') }}
          </template>
        </UAlert>

        <UButton
          icon="i-heroicons-trash"
          color="error"
          variant="soft"
          size="lg"
          class="transition-all duration-200 hover:transform hover:scale-105"
          @click="showDeleteModal = true"
        >
          {{ $t('profile.delete_account.title') }}
        </UButton>
      </div>
    </UCard>

    <!-- Modal de confirmation de suppression -->
    <UModal v-model:open="showDeleteModal" size="md">
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-exclamation-triangle"
              class="w-5 h-5 text-red-600 dark:text-red-400"
            />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('profile.delete_account.confirm_title') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{
                $t('profile.delete_account.confirm_description', { pseudo: authStore.user?.pseudo })
              }}
            </p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('profile.delete_account.confirm_placeholder')">
            <UInput
              v-model="confirmPseudo"
              icon="i-heroicons-user"
              :placeholder="authStore.user?.pseudo"
              size="lg"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="outline" color="neutral" @click="showDeleteModal = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            :loading="deleteLoading"
            :disabled="confirmPseudo !== authStore.user?.pseudo"
            color="error"
            icon="i-heroicons-trash"
            @click="deleteAccount"
          >
            {{
              deleteLoading
                ? t('profile.delete_account.deleting')
                : t('profile.delete_account.confirm_button')
            }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { z } from 'zod'

import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'profile',
  middleware: 'auth-protected',
})

const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const userHasPassword = ref(true)
const showDeleteModal = ref(false)
const confirmPseudo = ref('')
const deleteLoading = ref(false)

// --- Mot de passe ---

const passwordSchema = computed(() => {
  const baseSchema = {
    newPassword: z
      .string()
      .min(8, t('errors.password_too_short'))
      .regex(/(?=.*[A-Z])/, t('profile.password_uppercase_required'))
      .regex(/(?=.*\d)/, t('profile.password_digit_required')),
    confirmPassword: z.string(),
  }

  if (userHasPassword.value) {
    return z
      .object({
        currentPassword: z.string().min(1, t('profile.current_password_required')),
        ...baseSchema,
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: t('profile.passwords_dont_match'),
        path: ['confirmPassword'],
      })
  }

  return z.object(baseSchema).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('profile.passwords_dont_match'),
    path: ['confirmPassword'],
  })
})

const passwordState = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const buildPasswordPayload = () => {
  const body: Record<string, string> = {
    newPassword: passwordState.newPassword,
    confirmPassword: passwordState.confirmPassword,
  }
  if (userHasPassword.value) {
    body.currentPassword = passwordState.currentPassword
  }
  return body
}

const { execute: executeChangePassword, loading: passwordLoading } = useApiAction(
  '/api/profile/change-password',
  {
    method: 'POST',
    body: buildPasswordPayload,
    successMessage: {
      title: t('profile.password_changed'),
      description: t('profile.password_updated'),
    },
    errorMessages: { default: t('profile.cannot_change_password') },
    onSuccess: () => {
      passwordState.currentPassword = ''
      passwordState.newPassword = ''
      passwordState.confirmPassword = ''
      userHasPassword.value = true
    },
  }
)

const changePassword = () => {
  executeChangePassword()
}

// --- Suppression de compte ---

const deleteAccount = async () => {
  if (confirmPseudo.value !== authStore.user?.pseudo) return

  deleteLoading.value = true

  try {
    await $fetch('/api/profile/delete-account', {
      method: 'DELETE',
      body: { confirmPseudo: confirmPseudo.value },
    })

    toast.add({
      title: t('profile.delete_account.success'),
      description: t('profile.delete_account.success_description'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Nettoyer l'état d'authentification côté client et rediriger
    await authStore.logout()
  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error)
    toast.add({
      title: t('common.error'),
      description: t('profile.delete_account.error'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    deleteLoading.value = false
  }
}

onMounted(async () => {
  try {
    const response = await $fetch<{ data: { hasPassword: boolean } }>('/api/profile/has-password')
    userHasPassword.value = response.data.hasPassword
  } catch (error) {
    console.error('Erreur lors de la vérification du mot de passe:', error)
    userHasPassword.value = true
  }
})
</script>
