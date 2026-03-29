<template>
  <div class="space-y-8">
    <UCard class="shadow-lg border-0">
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-user" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ $t('profile.personal_info') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('profile.manage_profile_info') }}
            </p>
          </div>
        </div>
      </template>

      <UForm :state="state" :schema="schema" @submit="updateProfile">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Colonne 1 : Pseudo et email -->
          <div class="space-y-6">
            <UFormField
              :label="t('auth.username')"
              name="pseudo"
              :help="t('profile.username_help')"
            >
              <UInput
                v-model="state.pseudo"
                icon="i-heroicons-at-symbol"
                required
                :placeholder="t('profile.username_placeholder')"
                size="lg"
                class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
              />
            </UFormField>

            <UFormField :label="t('common.email')" name="email">
              <UInput
                v-model="state.email"
                type="email"
                icon="i-heroicons-envelope"
                required
                placeholder="votre.email@example.com"
                size="lg"
                class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
              />
            </UFormField>
          </div>

          <!-- Colonne 2 : Informations facultatives -->
          <div
            class="border border-gray-100 dark:border-gray-700 rounded-xl p-5 space-y-6 bg-gray-50/50 dark:bg-gray-800/30"
          >
            <div class="flex items-center gap-2 mb-2">
              <UIcon name="i-heroicons-adjustments-horizontal" class="w-5 h-5 text-gray-500" />
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('profile.optional_section_title') }}
              </h3>
              <UBadge variant="soft" color="neutral" size="xs">{{ t('common.optional') }}</UBadge>
            </div>

            <UFormField :label="t('auth.first_name')" name="prenom">
              <UInput
                v-model="state.prenom"
                icon="i-heroicons-user"
                :placeholder="t('profile.first_name_placeholder')"
                size="lg"
                class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
              />
            </UFormField>

            <UFormField :label="t('auth.last_name')" name="nom">
              <UInput
                v-model="state.nom"
                icon="i-heroicons-user"
                :placeholder="t('profile.last_name_placeholder')"
                size="lg"
                class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
              />
            </UFormField>

            <UFormField :label="t('profile.phone')" name="telephone">
              <UInput
                v-model="state.telephone"
                icon="i-heroicons-phone"
                type="tel"
                :placeholder="t('profile.phone_placeholder')"
                size="lg"
                class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
              />
            </UFormField>

            <UFormField :label="t('profile.preferred_language')" name="preferredLanguage">
              <USelect
                v-model="state.preferredLanguage"
                icon="i-heroicons-language"
                :items="languageOptions"
                size="lg"
                class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
              />
            </UFormField>
          </div>
        </div>

        <!-- Actions avec indicateur de modifications -->
        <div class="mt-8">
          <div
            v-if="hasChanges"
            class="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
          >
            <div class="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
              <span class="text-sm font-medium">{{ $t('profile.unsaved_changes') }}</span>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 justify-between">
            <UButton
              type="submit"
              :loading="loading"
              :disabled="!hasChanges"
              icon="i-heroicons-check"
              color="primary"
              size="lg"
              class="transition-all duration-200 hover:transform hover:scale-105"
            >
              {{ loading ? t('profile.saving') : t('profile.save_changes') }}
            </UButton>

            <UButton
              v-if="hasChanges"
              type="button"
              variant="outline"
              color="neutral"
              size="lg"
              icon="i-heroicons-arrow-path"
              class="transition-all duration-200 hover:transform hover:scale-105"
              @click="resetForm"
            >
              {{ $t('common.cancel') }}
            </UButton>
          </div>
        </div>
      </UForm>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import { z } from 'zod'

import { useAuthStore } from '~/stores/auth'
import type { User } from '~/types'
import { LOCALES_CONFIG } from '~/utils/locales'

definePageMeta({
  layout: 'profile',
  middleware: 'auth-protected',
})

const authStore = useAuthStore()
const { t } = useI18n()

const languageOptions = LOCALES_CONFIG.map((locale) => ({
  value: locale.code,
  label: locale.name,
}))

const schema = z.object({
  email: z.string().email(t('errors.invalid_email')),
  pseudo: z.string().min(3, t('profile.username_min_3')),
  nom: z.string().optional(),
  prenom: z.string().optional(),
  telephone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[0-9\s\-()]+$/.test(val), t('errors.invalid_phone_number')),
  preferredLanguage: z.string().optional(),
})

const state = reactive({
  email: authStore.user?.email || '',
  pseudo: authStore.user?.pseudo || '',
  nom: (authStore.user as any)?.nom || '',
  prenom: (authStore.user as any)?.prenom || '',
  telephone: (authStore.user as any)?.telephone || (authStore.user as any)?.phone || '',
  preferredLanguage: (authStore.user as any)?.preferredLanguage || 'fr',
})

const hasChanges = computed(() => {
  return (
    state.email !== (authStore.user?.email || '') ||
    state.pseudo !== (authStore.user?.pseudo || '') ||
    state.nom !== ((authStore.user as any)?.nom || '') ||
    state.prenom !== ((authStore.user as any)?.prenom || '') ||
    state.telephone !==
      ((authStore.user as any)?.telephone || (authStore.user as any)?.phone || '') ||
    state.preferredLanguage !== ((authStore.user as any)?.preferredLanguage || 'fr')
  )
})

const resetForm = () => {
  state.email = authStore.user?.email || ''
  state.pseudo = authStore.user?.pseudo || ''
  state.nom = (authStore.user as any)?.nom || ''
  state.prenom = (authStore.user as any)?.prenom || ''
  state.telephone = (authStore.user as any)?.telephone || (authStore.user as any)?.phone || ''
  state.preferredLanguage = (authStore.user as any)?.preferredLanguage || 'fr'
}

const { execute: executeUpdateProfile, loading } = useApiAction<unknown, User>(
  '/api/profile/update',
  {
    method: 'PUT',
    body: () => ({
      email: state.email,
      pseudo: state.pseudo,
      nom: state.nom || '',
      prenom: state.prenom || '',
      telephone: state.telephone || '',
      preferredLanguage: state.preferredLanguage || 'fr',
    }),
    successMessage: {
      title: t('profile.profile_updated'),
      description: t('profile.info_saved'),
    },
    errorMessages: { default: t('profile.cannot_save_profile') },
    onSuccess: (updatedUser) => {
      authStore.updateUser({ ...authStore.user!, ...updatedUser })
    },
  }
)

const updateProfile = () => {
  if (!hasChanges.value) return
  executeUpdateProfile()
}
</script>
