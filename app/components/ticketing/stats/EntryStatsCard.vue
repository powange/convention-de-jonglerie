<template>
  <UCard>
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-chart-bar" class="text-purple-500" />
        <h2 class="text-lg font-semibold">{{ $t('edition.ticketing.entry_stats') }}</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('edition.ticketing.total_entries') }}
              </p>
              <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {{ stats.totalValidated }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.validatedToday }}
                {{ $t('edition.ticketing.validated_today').toLowerCase() }}
              </p>
            </div>
            <UIcon name="i-heroicons-users" class="text-blue-500" size="32" />
          </div>
        </div>

        <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('ticketing.stats.participants') }}
              </p>
              <p class="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {{ stats.ticketsValidated }} / {{ stats.totalTickets }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.ticketsValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon name="i-heroicons-ticket" class="text-orange-500" size="32" />
          </div>
        </div>

        <button
          v-if="stats.totalVolunteers > 0"
          class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer text-left w-full"
          @click="$emit('show-volunteers-not-validated')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('ticketing.stats.volunteers') }}
              </p>
              <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {{ stats.volunteersValidated }} / {{ stats.totalVolunteers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.volunteersValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon name="i-heroicons-user-group" class="text-purple-500" size="32" />
          </div>
        </button>

        <button
          v-if="stats.totalArtists > 0"
          class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer text-left w-full"
          @click="$emit('show-artists-not-validated')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('ticketing.stats.artists') }}
              </p>
              <p class="text-2xl font-bold text-green-600 dark:text-green-400">
                {{ stats.artistsValidated }} / {{ stats.totalArtists }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.artistsValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon name="i-heroicons-star" class="text-green-500" size="32" />
          </div>
        </button>

        <button
          v-if="stats.totalOrganizers > 0"
          class="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer text-left w-full"
          @click="$emit('show-organizers-not-validated')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('ticketing.stats.organizers') }}
              </p>
              <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {{ stats.organizersValidated }} / {{ stats.totalOrganizers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.organizersValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon name="i-heroicons-shield-check" class="text-indigo-500" size="32" />
          </div>
        </button>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface EntryStats {
  validatedToday: number
  totalValidated: number
  ticketsValidated: number
  volunteersValidated: number
  artistsValidated: number
  organizersValidated: number
  ticketsValidatedToday: number
  volunteersValidatedToday: number
  artistsValidatedToday: number
  organizersValidatedToday: number
  totalTickets: number
  totalVolunteers: number
  totalArtists: number
  totalOrganizers: number
}

defineProps<{
  stats: EntryStats
}>()

defineEmits<{
  'show-volunteers-not-validated': []
  'show-artists-not-validated': []
  'show-organizers-not-validated': []
}>()
</script>
