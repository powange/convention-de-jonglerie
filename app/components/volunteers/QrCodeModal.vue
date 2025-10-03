<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('editions.ticketing.qr_modal_title')"
    :ui="{ width: 'sm:max-w-md' }"
  >
    <template #body>
      <div v-if="applicationId" class="space-y-4">
        <!-- Instructions -->
        <div
          class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div class="flex items-start gap-3">
            <UIcon
              name="i-heroicons-information-circle"
              class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
            />
            <div class="text-sm text-blue-700 dark:text-blue-300">
              <p class="font-medium mb-1">{{ $t('editions.ticketing.qr_how_to_use') }}</p>
              <p>
                {{ $t('editions.ticketing.qr_instructions') }}
              </p>
            </div>
          </div>
        </div>

        <!-- QR Code -->
        <div class="flex flex-col items-center justify-center p-6">
          <Qrcode :value="qrCodeValue" variant="default" />
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
            {{ qrCodeValue }}
          </p>
        </div>

        <!-- Informations de l'application -->
        <div v-if="application" class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {{ $t('editions.ticketing.qr_details') }}
          </h4>
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
              <span>{{ getEditionDisplayName(application.edition) }}</span>
            </div>
            <div
              v-if="application.assignedTeams && application.assignedTeams.length > 0"
              class="flex items-start gap-2 text-gray-600 dark:text-gray-400"
            >
              <UIcon name="i-heroicons-user-group" class="w-4 h-4 mt-0.5" />
              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="team in application.assignedTeams"
                  :key="team"
                  color="info"
                  variant="subtle"
                  size="sm"
                >
                  {{ team }}
                </UBadge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between">
        <UButton color="neutral" variant="soft" @click="isOpen = false"> Fermer </UButton>
        <UButton color="primary" icon="i-heroicons-arrow-down-tray" @click="downloadQrCode">
          Télécharger
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'

const props = defineProps<{
  open: boolean
  application?: any
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const applicationId = computed(() => props.application?.id)

const qrCodeValue = computed(() => {
  return applicationId.value ? `volunteer-${applicationId.value}` : ''
})

const getEditionDisplayName = (edition: any) => {
  return edition?.name || edition?.convention?.name || 'Édition'
}

const downloadQrCode = async () => {
  await nextTick()

  // Trouver le canvas généré par le composant Qrcode
  const canvas = document.querySelector('canvas')
  if (!canvas) {
    console.error('Canvas QR code introuvable')
    return
  }

  // Créer un lien de téléchargement à partir du canvas
  const link = document.createElement('a')
  link.download = `qr-code-volunteer-${applicationId.value}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
</script>
