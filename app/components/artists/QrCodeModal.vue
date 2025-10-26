<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('artists.qr_modal_title')"
    :ui="{ width: 'sm:max-w-md' }"
  >
    <template #body>
      <div v-if="artistId" class="space-y-4">
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
              <p class="font-medium mb-1">{{ $t('artists.qr_how_to_use') }}</p>
              <p>
                {{ $t('artists.qr_instructions') }}
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

        <!-- Informations du profil artiste -->
        <div v-if="artistProfile" class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {{ $t('artists.qr_details') }}
          </h4>
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
              <span>{{ getEditionDisplayName(artistProfile.edition) }}</span>
            </div>
            <div
              v-if="artistProfile.shows && artistProfile.shows.length > 0"
              class="flex items-start gap-2 text-gray-600 dark:text-gray-400"
            >
              <UIcon name="i-heroicons-ticket" class="w-4 h-4 mt-0.5" />
              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="showArtist in artistProfile.shows"
                  :key="showArtist.show.id"
                  color="info"
                  variant="subtle"
                  size="sm"
                >
                  {{ showArtist.show.title }}
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
  artistProfile?: any
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const artistId = computed(() => props.artistProfile?.id)

const qrCodeValue = computed(() => {
  return artistId.value ? `artist-${artistId.value}` : ''
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
  link.download = `qr-code-artist-${artistId.value}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
</script>
