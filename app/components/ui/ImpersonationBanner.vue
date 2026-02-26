<template>
  <UBanner
    v-if="impersonationActive"
    id="impersonation"
    color="warning"
    icon="i-heroicons-exclamation-triangle"
  >
    <template #title>
      <div class="flex items-center gap-3 min-w-0">
        <span class="font-medium truncate">
          {{
            $t('admin.impersonating_as', {
              pseudo: impersonationStore.targetUserInfo?.pseudo || '',
              email: impersonationStore.targetUserInfo?.email || '',
            })
          }}
        </span>
        <UBadge color="neutral" variant="solid" size="sm" class="shrink-0">
          {{ $t('admin.impersonation_mode') }}
        </UBadge>
      </div>
    </template>

    <template #actions>
      <div class="hidden lg:flex items-center gap-4">
        <div class="text-sm opacity-90">
          {{ $t('admin.original_user') }}:
          <span class="font-semibold">
            {{ impersonationStore.originalUserInfo?.pseudo }}
          </span>
        </div>

        <UButton
          color="neutral"
          variant="solid"
          size="xs"
          icon="i-heroicons-arrow-left-circle"
          :loading="stopping"
          @click="stopImpersonation"
        >
          {{ $t('admin.stop_impersonation') }}
        </UButton>
      </div>

      <!-- Version mobile : seulement le bouton -->
      <UButton
        class="lg:hidden"
        color="neutral"
        variant="solid"
        size="xs"
        icon="i-heroicons-arrow-left-circle"
        :loading="stopping"
        @click="stopImpersonation"
      >
        {{ $t('admin.stop_impersonation') }}
      </UButton>
    </template>
  </UBanner>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useImpersonationStore } from '~/stores/impersonation'

const { t } = useI18n()
const authStore = useAuthStore()
const impersonationStore = useImpersonationStore()

// Utiliser directement le store pour vérifier l'état
const impersonationActive = computed(() => impersonationStore.isActive)

// Charger le fichier de langue admin avant le rendu (nécessaire pour les traductions admin.*)
await useLazyI18n('admin')

// Fonction pour arrêter l'impersonation
const { execute: stopImpersonation, loading: stopping } = useApiAction(
  '/api/admin/impersonate/stop',
  {
    method: 'POST',
    successMessage: {
      title: t('common.success'),
      description: t('admin.impersonation_stopped'),
    },
    errorMessages: { default: t('admin.stop_impersonation_error') },
    onSuccess: (result: { user?: Record<string, unknown> }) => {
      // Arrêter l'impersonation dans le store AVANT de mettre à jour l'auth
      impersonationStore.stopImpersonation()

      // Mettre à jour le store d'authentification avec l'utilisateur original
      if (result.user) {
        authStore.user = result.user
      }

      // Recharger complètement la page pour que le nouveau cookie soit pris en compte
      window.location.href = '/admin/users'
    },
  }
)
</script>
