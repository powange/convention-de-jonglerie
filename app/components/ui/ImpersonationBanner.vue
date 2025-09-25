<template>
  <div v-if="impersonationActive" class="fixed top-0 left-0 right-0 z-50">
    <div class="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 shadow-lg">
      <div class="container mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
          <span class="font-medium">
            {{
              $t('admin.impersonating_as', {
                pseudo: impersonationStore.targetUserInfo?.pseudo || '',
                email: impersonationStore.targetUserInfo?.email || '',
              })
            }}
          </span>
          <UBadge color="neutral" variant="solid" size="sm" class="!text-orange-500 !bg-white">
            {{ $t('admin.impersonation_mode') }}
          </UBadge>
        </div>

        <div class="flex items-center gap-4">
          <div class="text-sm opacity-90">
            {{ $t('admin.original_user') }}:
            <span class="font-semibold">
              {{ impersonationStore.originalUserInfo?.pseudo }}
            </span>
          </div>

          <UButton
            color="neutral"
            variant="solid"
            size="sm"
            icon="i-heroicons-arrow-left-circle"
            :loading="stopping"
            class="!bg-white !text-orange-600"
            @click="stopImpersonation"
          >
            {{ $t('admin.stop_impersonation') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useImpersonationStore } from '~/stores/impersonation'

const toast = useToast()
const { t } = useI18n()
const authStore = useAuthStore()
const impersonationStore = useImpersonationStore()

// Utiliser directement le store pour vérifier l'état
const impersonationActive = computed(() => impersonationStore.isActive)

const stopping = ref(false)

// Fonction pour arrêter l'impersonation
const stopImpersonation = async () => {
  stopping.value = true

  try {
    const result = await $fetch<any>('/api/admin/impersonate/stop', {
      method: 'POST',
    })

    // Arrêter l'impersonation dans le store AVANT de mettre à jour l'auth
    impersonationStore.stopImpersonation()

    // Mettre à jour le store d'authentification avec l'utilisateur original
    if (result.user) {
      authStore.user = result.user
    }

    toast.add({
      title: t('common.success'),
      description: t('admin.impersonation_stopped'),
      color: 'success',
    })

    // Rafraîchir toutes les données Nuxt
    await refreshNuxtData()

    // Naviguer vers la page des utilisateurs admin
    await navigateTo('/admin/users')
  } catch (error: any) {
    console.error("Erreur lors de l'arrêt de l'impersonation:", error)

    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('admin.stop_impersonation_error'),
      color: 'error',
    })
  } finally {
    stopping.value = false
  }
}
</script>
