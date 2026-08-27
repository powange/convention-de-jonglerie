<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="p-2 bg-primary-100 dark:bg-primary-900 rounded-full">
              <UIcon
                name="i-heroicons-bell"
                class="text-primary-600 dark:text-primary-400 h-6 w-6"
              />
            </div>
            <div class="min-w-0">
              <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ $t('gestion.artists.notifications.confirm_page_title') }}
              </h1>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ envoi?.title }}</p>
            </div>
          </div>
        </template>

        <div v-if="chargement" class="flex items-center justify-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400 h-5 w-5" />
          <span class="ml-2 text-gray-500">{{ $t('common.loading') }}</span>
        </div>

        <UAlert
          v-else-if="erreur"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="subtle"
          :title="$t('gestion.artists.notifications.confirm_page_error')"
          :description="erreur"
        />

        <div v-else-if="envoi" class="space-y-4">
          <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
              {{ envoi.message }}
            </p>
          </div>

          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatDate(envoi.sentAt) }}
          </p>

          <UAlert
            icon="i-heroicons-check-circle"
            color="success"
            variant="subtle"
            :title="
              envoi.alreadyConfirmed
                ? $t('gestion.artists.notifications.already_confirmed')
                : $t('gestion.artists.notifications.confirmed_now')
            "
            :description="formatDate(envoi.confirmedAt)"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~/utils/date'

/**
 * La lecture est confirmée dès l'ouverture de la page : c'est le clic sur le lien de la
 * notification qui vaut accusé, demander un second clic n'apporterait rien.
 */
definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()

interface Envoi {
  alreadyConfirmed: boolean
  confirmedAt: string
  title: string
  message: string
  sentAt: string
}

const envoi = ref<Envoi | null>(null)
const chargement = ref(true)
const erreur = ref('')

onMounted(async () => {
  try {
    const reponse = await $fetch<{ data: Envoi }>(
      `/api/editions/${route.params.id}/artists/notification/${route.params.groupId}/confirm`,
      { method: 'POST' }
    )
    envoi.value = reponse.data
  } catch (e: any) {
    erreur.value = e?.data?.message || e?.message || ''
  } finally {
    chargement.value = false
  }
})
</script>
