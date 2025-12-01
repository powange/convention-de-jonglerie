<template>
  <div class="space-y-4">
    <UAlert
      icon="i-mdi-facebook"
      color="info"
      variant="soft"
      :title="$t('admin.import.facebook_event_data')"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Informations principales -->
      <div class="space-y-2">
        <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.main_info') }}
        </h4>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
          <p>
            <strong>{{ $t('common.name') }}:</strong>
            {{ facebookData.name || '-' }}
          </p>
          <p v-if="facebookData.startTimestamp">
            <strong>{{ $t('admin.import.start_date') }}:</strong>
            {{ formatTimestamp(facebookData.startTimestamp) }}
          </p>
          <p v-if="facebookData.endTimestamp">
            <strong>{{ $t('admin.import.end_date') }}:</strong>
            {{ formatTimestamp(facebookData.endTimestamp) }}
          </p>
          <p v-if="facebookData.timezone">
            <strong>{{ $t('admin.import.timezone') }}:</strong>
            {{ facebookData.timezone }}
          </p>
        </div>
      </div>

      <!-- Lieu -->
      <div v-if="facebookData.location" class="space-y-2">
        <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.location') }}
        </h4>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
          <p v-if="facebookData.location.name">
            <strong>{{ $t('common.name') }}:</strong>
            {{ facebookData.location.name }}
          </p>
          <p v-if="facebookData.location.address">
            <strong>{{ $t('admin.import.address') }}:</strong>
            {{ facebookData.location.address }}
          </p>
          <p v-if="facebookData.location.countryCode">
            <strong>{{ $t('admin.import.country_code') }}:</strong>
            {{ facebookData.location.countryCode }}
          </p>
          <p v-if="facebookData.location.coordinates">
            <strong>{{ $t('admin.import.coordinates') }}:</strong>
            {{ facebookData.location.coordinates.latitude }},
            {{ facebookData.location.coordinates.longitude }}
          </p>
        </div>
      </div>

      <!-- URLs -->
      <div class="space-y-2">
        <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.urls') }}
        </h4>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
          <p v-if="facebookData.ticketUrl">
            <strong>{{ $t('admin.import.ticketing') }}:</strong>
            <a
              :href="facebookData.ticketUrl"
              target="_blank"
              class="text-primary-500 hover:underline break-all"
            >
              {{ facebookData.ticketUrl }}
            </a>
          </p>
          <p v-if="photoUrl">
            <strong>{{ $t('admin.import.image') }}:</strong>
            <a :href="photoUrl" target="_blank" class="text-primary-500 hover:underline break-all">
              {{ $t('admin.import.view_image') }}
            </a>
          </p>
        </div>
      </div>

      <!-- Image preview -->
      <div v-if="photoUrl" class="space-y-2">
        <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.image_preview') }}
        </h4>
        <img :src="photoUrl" :alt="facebookData.name" class="max-h-48 rounded-lg object-cover" />
      </div>
    </div>

    <!-- Description -->
    <div v-if="facebookData.description" class="space-y-2">
      <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
        {{ $t('common.description') }}
      </h4>
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm max-h-48 overflow-y-auto whitespace-pre-wrap"
      >
        {{ facebookData.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface FacebookData {
  name?: string
  description?: string
  startTimestamp?: number
  endTimestamp?: number
  timezone?: string
  ticketUrl?: string
  location?: {
    name?: string
    address?: string
    countryCode?: string
    coordinates?: {
      latitude: number
      longitude: number
    }
  }
  photo?: {
    imageUri?: string
    url?: string
  }
}

const props = defineProps<{
  facebookData: FacebookData
}>()

const photoUrl = computed(() => props.facebookData.photo?.imageUri || props.facebookData.photo?.url)

/**
 * Formate un timestamp Unix en date lisible
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
}
</script>
