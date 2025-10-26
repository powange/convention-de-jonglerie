<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ $t('artists.my_profiles') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ $t('artists.profiles_description') }}
        </p>
      </div>
    </div>

    <!-- Chargement -->
    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" size="24" />
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="mx-auto mb-4 text-error-500"
        size="48"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('artists.error_loading') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ error.message }}
      </p>
      <UButton @click="refresh"> {{ $t('common.retry') }} </UButton>
    </div>

    <!-- Liste des profils -->
    <div v-else-if="artistProfiles && artistProfiles.length > 0" class="space-y-4">
      <UCard
        v-for="profile in artistProfiles"
        :key="profile.id"
        class="hover:shadow-lg transition-shadow"
      >
        <template #header>
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-musical-note" class="w-5 h-5 text-primary-500" />
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ getEditionDisplayName(profile.edition) }}
                </h3>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                <UIcon name="i-heroicons-map-pin" class="w-4 h-4 inline" />
                {{ profile.edition.city }}, {{ profile.edition.country }}
              </p>
            </div>
            <UButton
              color="primary"
              variant="soft"
              icon="i-heroicons-qr-code"
              @click="openQrCodeModal(profile)"
            >
              {{ $t('artists.my_qr_code') }}
            </UButton>
          </div>
        </template>

        <!-- Informations du profil -->
        <div class="space-y-4">
          <!-- Dates -->
          <div v-if="profile.arrivalDateTime || profile.departureDateTime" class="space-y-2">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('artists.dates') }}
            </h4>
            <div class="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div v-if="profile.arrivalDateTime" class="flex items-center gap-2">
                <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
                <span
                  >{{ $t('artists.arrival') }}: {{ formatDateTime(profile.arrivalDateTime) }}</span
                >
              </div>
              <div v-if="profile.departureDateTime" class="flex items-center gap-2">
                <UIcon name="i-heroicons-arrow-left-on-rectangle" class="w-4 h-4" />
                <span
                  >{{ $t('artists.departure') }}:
                  {{ formatDateTime(profile.departureDateTime) }}</span
                >
              </div>
            </div>
          </div>

          <!-- Spectacles -->
          <div v-if="profile.shows && profile.shows.length > 0" class="space-y-2">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('artists.my_shows') }}
            </h4>
            <div class="space-y-2">
              <div
                v-for="showArtist in profile.shows"
                :key="showArtist.show.id"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h5 class="font-medium text-gray-900 dark:text-white">
                      {{ showArtist.show.title }}
                    </h5>
                    <p
                      v-if="showArtist.show.description"
                      class="text-sm text-gray-600 dark:text-gray-400 mt-1"
                    >
                      {{ showArtist.show.description }}
                    </p>
                    <div class="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <div class="flex items-center gap-1">
                        <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                        <span>{{ formatDateTime(showArtist.show.startDateTime) }}</span>
                      </div>
                      <div v-if="showArtist.show.duration" class="flex items-center gap-1">
                        <UIcon name="i-heroicons-clock" class="w-3 h-3" />
                        <span>{{ showArtist.show.duration }} min</span>
                      </div>
                      <div v-if="showArtist.show.location" class="flex items-center gap-1">
                        <UIcon name="i-heroicons-map-pin" class="w-3 h-3" />
                        <span>{{ showArtist.show.location }}</span>
                      </div>
                    </div>
                    <!-- Articles à récupérer -->
                    <div
                      v-if="
                        showArtist.show.returnableItems &&
                        showArtist.show.returnableItems.length > 0
                      "
                      class="mt-2"
                    >
                      <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ $t('artists.items_to_receive') }}:
                      </p>
                      <div class="flex flex-wrap gap-1">
                        <UBadge
                          v-for="item in showArtist.show.returnableItems"
                          :key="item.returnableItem.id"
                          color="blue"
                          variant="subtle"
                          size="sm"
                        >
                          {{ item.returnableItem.name }}
                        </UBadge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Informations diététiques -->
          <div
            v-if="profile.dietaryPreference && profile.dietaryPreference !== 'NONE'"
            class="space-y-2"
          >
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('artists.dietary_info') }}
            </h4>
            <div class="flex flex-wrap gap-2">
              <UBadge color="info" variant="subtle">
                {{ $t(`common.dietary_preferences.${profile.dietaryPreference}`) }}
              </UBadge>
              <UBadge v-if="profile.allergies" color="warning" variant="subtle">
                {{ $t('artists.allergies') }}: {{ profile.allergies }}
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Aucun profil -->
    <div v-else class="text-center py-12">
      <UIcon name="i-heroicons-musical-note" class="mx-auto mb-4 text-gray-400" size="48" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('artists.no_profiles') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ $t('artists.no_profiles_description') }}
      </p>
    </div>

    <!-- Modal QR Code -->
    <ArtistsQrCodeModal v-model:open="qrCodeModalOpen" :artist-profile="selectedProfile" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  middleware: 'auth',
})

// Récupération des profils d'artiste
const {
  data: artistProfiles,
  pending,
  error,
  refresh,
} = await useFetch('/api/user/artist-profiles')

// Modal QR Code
const qrCodeModalOpen = ref(false)
const selectedProfile = ref<any>(null)

const openQrCodeModal = (profile: any) => {
  selectedProfile.value = profile
  qrCodeModalOpen.value = true
}

const getEditionDisplayName = (edition: any) => {
  return edition?.name || edition?.convention?.name || 'Édition'
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>
