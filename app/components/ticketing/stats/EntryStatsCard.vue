<template>
  <UCard>
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-chart-bar" class="text-purple-500" />
        <h2 class="text-lg font-semibold">{{ $t('edition.ticketing.entry_stats') }}</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Total des entrées validées -->
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

        <!-- Participants (billets) -->
        <div :class="`p-4 ${ticketConfig.bgClass} ${ticketConfig.darkBgClass} rounded-lg`">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('ticketing.stats.participants') }}
              </p>
              <p
                :class="`text-2xl font-bold ${ticketConfig.textClass} ${ticketConfig.darkTextClass}`"
              >
                {{ stats.ticketsValidated }} / {{ stats.totalTickets }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.ticketsValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon :name="ticketConfig.icon" :class="ticketConfig.iconColorClass" size="32" />
          </div>
        </div>

        <!-- Bénévoles -->
        <button
          v-if="stats.totalVolunteers > 0"
          :class="`p-4 ${volunteerConfig.bgClass} ${volunteerConfig.darkBgClass} ${volunteerConfig.hoverBgClass} ${volunteerConfig.darkHoverBgClass} rounded-lg transition-colors cursor-pointer text-left w-full`"
          @click="$emit('show-volunteers-not-validated')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('ticketing.stats.volunteers') }}
              </p>
              <p
                :class="`text-2xl font-bold ${volunteerConfig.textClass} ${volunteerConfig.darkTextClass}`"
              >
                {{ stats.volunteersValidated }} / {{ stats.totalVolunteers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.volunteersValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon :name="volunteerConfig.icon" :class="volunteerConfig.iconColorClass" size="32" />
          </div>
        </button>

        <!-- Artistes -->
        <button
          v-if="stats.totalArtists > 0"
          :class="`p-4 ${artistConfig.bgClass} ${artistConfig.darkBgClass} ${artistConfig.hoverBgClass} ${artistConfig.darkHoverBgClass} rounded-lg transition-colors cursor-pointer text-left w-full`"
          @click="$emit('show-artists-not-validated')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('ticketing.stats.artists') }}
              </p>
              <p
                :class="`text-2xl font-bold ${artistConfig.textClass} ${artistConfig.darkTextClass}`"
              >
                {{ stats.artistsValidated }} / {{ stats.totalArtists }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.artistsValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon :name="artistConfig.icon" :class="artistConfig.iconColorClass" size="32" />
          </div>
        </button>

        <!-- Organisateurs -->
        <button
          v-if="stats.totalOrganizers > 0"
          :class="`p-4 ${organizerConfig.bgClass} ${organizerConfig.darkBgClass} ${organizerConfig.hoverBgClass} ${organizerConfig.darkHoverBgClass} rounded-lg transition-colors cursor-pointer text-left w-full`"
          @click="$emit('show-organizers-not-validated')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('ticketing.stats.organizers') }}
              </p>
              <p
                :class="`text-2xl font-bold ${organizerConfig.textClass} ${organizerConfig.darkTextClass}`"
              >
                {{ stats.organizersValidated }} / {{ stats.totalOrganizers }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {{ stats.organizersValidatedToday }} aujourd'hui
              </p>
            </div>
            <UIcon :name="organizerConfig.icon" :class="organizerConfig.iconColorClass" size="32" />
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

// Utiliser le composable pour obtenir les configurations des types de participants
const { getParticipantTypeConfig } = useParticipantTypes()

const ticketConfig = getParticipantTypeConfig('ticket')
const volunteerConfig = getParticipantTypeConfig('volunteer')
const artistConfig = getParticipantTypeConfig('artist')
const organizerConfig = getParticipantTypeConfig('organizer')
</script>
