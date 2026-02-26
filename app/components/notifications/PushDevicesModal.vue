<template>
  <div>
    <!-- Bouton pour ouvrir la modal -->
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-heroicons-device-phone-mobile"
      @click="openModal"
    >
      {{ $t('notifications.devices.manage_button') }}
    </UButton>

    <!-- Modal de gestion des appareils -->
    <UModal v-model:open="isOpen" :title="$t('notifications.devices.title')">
      <template #body>
        <div v-if="loading" class="flex justify-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin" />
        </div>

        <div v-else-if="devices.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-device-phone-mobile" class="w-12 h-12 mx-auto text-gray-400" />
          <p class="mt-2 text-sm text-gray-500">{{ $t('notifications.devices.no_devices') }}</p>
        </div>

        <div v-else class="space-y-3">
          <p class="text-sm text-gray-500 mb-4">
            {{ $t('notifications.devices.description') }}
          </p>

          <div
            v-for="device in devices"
            :key="device.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <UIcon :name="getDeviceIcon(device)" class="w-6 h-6 text-gray-500 flex-shrink-0" />
              <div class="min-w-0">
                <p class="font-medium text-sm truncate">
                  {{ getDeviceName(device) }}
                </p>
                <p class="text-xs text-gray-500">
                  {{
                    $t('notifications.devices.registered_at', {
                      date: formatDate(device.createdAt),
                    })
                  }}
                </p>
              </div>
              <!-- Badge "Cet appareil" -->
              <UBadge v-if="isCurrentDevice(device)" color="primary" size="xs">
                {{ $t('notifications.devices.current_device') }}
              </UBadge>
            </div>

            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-heroicons-trash"
              :loading="isDeleting(device.id)"
              :disabled="!!deletingId"
              @click="deleteDevice(device.id)"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end">
          <UButton color="neutral" variant="ghost" @click="isOpen = false">
            {{ $t('common.close') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { UAParser } from 'ua-parser-js'

interface Device {
  id: string
  deviceId: string | null
  userAgent: string | null
  createdAt: string
  updatedAt: string
}

const { t } = useI18n()
const { getDeviceId } = useDeviceId()

const isOpen = ref(false)
const devices = ref<Device[]>([])

// Utilisation de useApiActionById pour la suppression
const {
  execute: executeDeleteDevice,
  loadingId: deletingId,
  isLoading: isDeleting,
} = useApiActionById((id) => `/api/notifications/fcm/devices/${id}`, {
  method: 'DELETE',
  successMessage: { title: t('notifications.devices.deleted') },
  errorMessages: { default: t('notifications.devices.error_deleting') },
  onSuccess: (_result, id) => {
    // Retirer de la liste locale
    devices.value = devices.value.filter((d) => d.id !== id)
  },
})

// DeviceId actuel pour identifier l'appareil courant (plus fiable que le User-Agent)
const currentDeviceId = ref<string | null>(null)

onMounted(() => {
  if (import.meta.client) {
    currentDeviceId.value = getDeviceId()
  }
})

// Charger les appareils
const { execute: fetchDevices, loading } = useApiAction('/api/notifications/fcm/devices', {
  method: 'GET',
  errorMessages: { default: t('notifications.devices.error_loading') },
  onSuccess: (response: any) => {
    devices.value = response
  },
})

/**
 * Ouvre la modal et charge les appareils
 */
function openModal() {
  isOpen.value = true
  fetchDevices()
}

/**
 * Supprime un appareil (utilise useApiActionById)
 */
function deleteDevice(deviceId: string) {
  executeDeleteDevice(deviceId)
}

/**
 * Vérifie si c'est l'appareil actuel (basé sur le deviceId)
 */
function isCurrentDevice(device: Device): boolean {
  if (!device.deviceId || !currentDeviceId.value) return false
  return device.deviceId === currentDeviceId.value
}

/**
 * Parse le User-Agent pour obtenir un nom lisible
 */
function getDeviceName(device: Device): string {
  if (!device.userAgent) {
    return 'Appareil inconnu'
  }

  const parser = new UAParser(device.userAgent)
  const result = parser.getResult()

  const browser = result.browser.name || 'Navigateur inconnu'
  const os = result.os.name || ''
  const deviceModel = result.device.model || ''
  const deviceVendor = result.device.vendor || ''

  // Construire le nom de l'appareil
  let deviceName = ''

  // Pour les mobiles/tablettes, afficher le modèle si disponible
  if (deviceModel && deviceModel.length > 1) {
    // Combiner vendor + model si disponible (ex: "Samsung Galaxy S21")
    if (deviceVendor && !deviceModel.toLowerCase().includes(deviceVendor.toLowerCase())) {
      deviceName = `${deviceVendor} ${deviceModel}`
    } else {
      deviceName = deviceModel
    }
  } else if (os) {
    // Sinon utiliser l'OS
    deviceName = result.os.version ? `${os} ${result.os.version}` : os
  }

  return deviceName ? `${browser} sur ${deviceName}` : browser
}

/**
 * Retourne l'icône appropriée selon l'appareil
 */
function getDeviceIcon(device: Device): string {
  if (!device.userAgent) {
    return 'i-heroicons-device-phone-mobile'
  }

  const parser = new UAParser(device.userAgent)
  const deviceType = parser.getDevice().type

  // mobile, tablet, smarttv, console, wearable, embedded
  if (deviceType === 'mobile' || deviceType === 'tablet' || deviceType === 'wearable') {
    return 'i-heroicons-device-phone-mobile'
  } else if (deviceType === 'smarttv') {
    return 'i-heroicons-tv'
  }

  return 'i-heroicons-computer-desktop'
}

/**
 * Formate une date
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>
