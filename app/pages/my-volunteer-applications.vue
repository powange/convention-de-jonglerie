<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ $t('pages.volunteers.my_applications') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ $t('pages.volunteers.applications_description') }}
        </p>
      </div>

      <!-- Contrôles d'affichage -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <!-- Toggle vue compacte/détaillée -->
        <UButtonGroup size="sm" class="w-full sm:w-auto">
          <UButton
            :variant="viewMode === 'detailed' ? 'solid' : 'ghost'"
            icon="i-heroicons-squares-2x2"
            class="flex-1 sm:flex-none"
            @click="viewMode = 'detailed'"
          >
            <span class="hidden sm:inline">{{ $t('pages.volunteers.view_detailed_short') }}</span>
            <span class="sm:hidden">{{ $t('pages.volunteers.view_detailed') }}</span>
          </UButton>
          <UButton
            :variant="viewMode === 'compact' ? 'solid' : 'ghost'"
            icon="i-heroicons-list-bullet"
            class="flex-1 sm:flex-none"
            @click="viewMode = 'compact'"
          >
            <span class="hidden sm:inline">{{ $t('pages.volunteers.view_compact_short') }}</span>
            <span class="sm:hidden">{{ $t('pages.volunteers.view_compact') }}</span>
          </UButton>
        </UButtonGroup>

        <!-- Export planning -->
        <UDropdown
          v-if="acceptedApplications.length > 0"
          :items="exportMenuItems"
          class="w-full sm:w-auto"
        >
          <UButton
            color="primary"
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            size="sm"
            class="w-full sm:w-auto justify-center"
          >
            {{ $t('pages.volunteers.export') }}
          </UButton>
        </UDropdown>
      </div>
    </div>

    <!-- Navigation par tabs -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex space-x-4 sm:space-x-8 overflow-x-auto pb-0 scrollbar-hide">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'py-3 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex items-center gap-1 sm:gap-2 transition-colors min-w-0 flex-shrink-0',
            activeTab === tab.id
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
          ]"
          @click="activeTab = tab.id"
        >
          <UIcon :name="tab.icon" class="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
          <span class="truncate">{{ tab.label }}</span>
          <UBadge
            v-if="tab.count > 0"
            :color="tab.badgeColor"
            variant="soft"
            size="sm"
            class="flex-shrink-0"
          >
            {{ tab.count }}
          </UBadge>
        </button>
      </nav>
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
        {{ $t('common.error') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ error.message || $t('errors.loading_error') }}
      </p>
    </div>

    <!-- Liste des candidatures filtrées -->
    <div v-else-if="filteredApplications && filteredApplications.length > 0" class="space-y-6">
      <!-- Vue détaillée -->
      <div v-if="viewMode === 'detailed'" class="space-y-6">
        <UCard
          v-for="application in filteredApplications"
          :key="application.id"
          class="hover:shadow-lg transition-shadow"
        >
          <template #header>
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4">
                <!-- Logo de la convention ou image de l'édition -->
                <div class="flex-shrink-0">
                  <img
                    v-if="application.edition.imageUrl"
                    :src="
                      getImageUrl(
                        application.edition.imageUrl,
                        'edition',
                        application.edition.id
                      ) || ''
                    "
                    :alt="getEditionDisplayName(application.edition)"
                    class="w-16 h-16 object-cover rounded-lg"
                  />
                  <img
                    v-else-if="application.edition.convention.logo"
                    :src="
                      getImageUrl(
                        application.edition.convention.logo,
                        'convention',
                        application.edition.convention.id
                      ) || ''
                    "
                    :alt="application.edition.convention.name"
                    class="w-16 h-16 object-cover rounded-lg"
                  />
                  <div
                    v-else
                    class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                  >
                    <UIcon name="i-heroicons-calendar-days" class="text-gray-400" size="24" />
                  </div>
                </div>

                <div class="flex-1">
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    {{ getEditionDisplayName(application.edition) }}
                  </h3>
                  <p class="text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                    {{ application.edition.city }}, {{ application.edition.country }}
                  </p>
                  <p class="text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                    {{
                      formatDateRange(application.edition.startDate, application.edition.endDate)
                    }}
                  </p>
                </div>
              </div>

              <div class="flex flex-col items-end gap-2">
                <UBadge
                  :color="getStatusColor(application.status)"
                  :variant="getStatusVariant(application.status)"
                  class="flex items-center gap-1.5"
                  size="lg"
                >
                  <UIcon :name="getStatusIcon(application.status)" class="w-3.5 h-3.5" />
                  {{ $t(`editions.volunteers.status.${application.status.toLowerCase()}`) }}
                </UBadge>

                <!-- Équipes assignées dans le header -->
                <div
                  v-if="
                    application.status === 'ACCEPTED' &&
                    application.assignedTeams &&
                    Array.isArray(application.assignedTeams) &&
                    application.assignedTeams.length > 0
                  "
                  class="flex flex-wrap gap-1 justify-end"
                >
                  <UBadge
                    v-for="team in application.assignedTeams as string[]"
                    :key="team"
                    color="info"
                    variant="solid"
                  >
                    {{ team }}
                  </UBadge>
                </div>

                <span class="text-sm text-gray-500">
                  {{ $t('pages.volunteers.applied_on') }} {{ formatDate(application.createdAt) }}
                </span>
              </div>
            </div>
          </template>

          <!-- Détails de la candidature -->
          <div class="space-y-4">
            <!-- Motivation -->
            <div v-if="application.motivation">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.motivation') }}
              </h4>
              <p class="text-gray-600 dark:text-gray-400 text-sm">
                {{ application.motivation }}
              </p>
            </div>

            <!-- Disponibilités -->
            <div>
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.availability') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <span v-if="application.setupAvailability">{{ $t('pages.volunteers.setup') }}</span>
                <span
                  v-if="
                    application.setupAvailability &&
                    (application.eventAvailability || application.teardownAvailability)
                  "
                  >,
                </span>
                <span v-if="application.eventAvailability">{{ $t('pages.volunteers.event') }}</span>
                <span v-if="application.eventAvailability && application.teardownAvailability"
                  >,
                </span>
                <span v-if="application.teardownAvailability">{{
                  $t('pages.volunteers.teardown')
                }}</span>
              </div>
            </div>

            <!-- Dates d'arrivée/départ -->
            <div v-if="application.arrivalDateTime || application.departureDateTime">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.dates') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span v-if="application.arrivalDateTime">
                  {{ formatDateTimeWithGranularity(application.arrivalDateTime) }}
                </span>
                <UIcon
                  v-if="application.arrivalDateTime && application.departureDateTime"
                  name="i-heroicons-arrow-right"
                  class="text-gray-400"
                  size="16"
                />
                <span v-if="application.departureDateTime">
                  {{ formatDateTimeWithGranularity(application.departureDateTime) }}
                </span>
              </div>
            </div>

            <!-- Préférences alimentaires et allergies -->
            <div
              v-if="
                (application.edition.volunteersAskDiet &&
                  application.dietaryPreference !== 'NONE') ||
                (application.edition.volunteersAskAllergies && application.allergies)
              "
            >
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.dietary_preferences') }}
              </h4>
              <div class="text-sm space-y-1">
                <div
                  v-if="
                    application.edition.volunteersAskDiet &&
                    application.dietaryPreference !== 'NONE'
                  "
                >
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.diet') }}:</span
                  >
                  <span class="ml-2">{{
                    $t(`pages.volunteers.dietary.${application.dietaryPreference.toLowerCase()}`)
                  }}</span>
                </div>
                <div v-if="application.edition.volunteersAskAllergies && application.allergies">
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.allergies') }}:</span
                  >
                  <span class="ml-2">{{ application.allergies }}</span>
                </div>
              </div>
            </div>

            <!-- Préférences horaires -->
            <div
              v-if="
                application.edition.volunteersAskTimePreferences &&
                application.timePreferences &&
                Array.isArray(application.timePreferences) &&
                application.timePreferences.length > 0
              "
            >
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.time_preferences') }}
              </h4>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="timeSlot in application.timePreferences as string[]"
                  :key="timeSlot"
                  color="neutral"
                  variant="soft"
                  size="sm"
                >
                  {{ $t(`editions.volunteers.time_slots_options.${timeSlot}`) }}
                </UBadge>
              </div>
            </div>

            <!-- Préférences d'équipes -->
            <div
              v-if="
                application.edition.volunteersAskTeamPreferences &&
                application.teamPreferences &&
                Array.isArray(application.teamPreferences) &&
                application.teamPreferences.length > 0
              "
            >
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.team_preferences') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <span v-for="(team, index) in application.teamPreferences as string[]" :key="team">
                  {{ team }}<span v-if="index < application.teamPreferences.length - 1">, </span>
                </span>
              </div>
            </div>

            <!-- Animaux de compagnie -->
            <div v-if="application.edition.volunteersAskPets && application.hasPets">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.pets') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.has_pets') }}:</span
                  >
                  <span class="ml-2">{{ $t('common.yes') }}</span>
                </div>
                <div v-if="application.petsDetails" class="mt-1">
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.pets_details') }}:</span
                  >
                  <span class="ml-2">{{ application.petsDetails }}</span>
                </div>
              </div>
            </div>

            <!-- Personnes mineures -->
            <div v-if="application.edition.volunteersAskMinors && application.hasMinors">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.minors') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.has_minors') }}:</span
                  >
                  <span class="ml-2">{{ $t('common.yes') }}</span>
                </div>
                <div v-if="application.minorsDetails" class="mt-1">
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.minors_details') }}:</span
                  >
                  <span class="ml-2">{{ application.minorsDetails }}</span>
                </div>
              </div>
            </div>

            <!-- Véhicule -->
            <div v-if="application.edition.volunteersAskVehicle && application.hasVehicle">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.vehicle') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.has_vehicle') }}:</span
                  >
                  <span class="ml-2">{{ $t('common.yes') }}</span>
                </div>
                <div v-if="application.vehicleDetails" class="mt-1">
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.vehicle_details') }}:</span
                  >
                  <span class="ml-2">{{ application.vehicleDetails }}</span>
                </div>
              </div>
            </div>

            <!-- Compagnon -->
            <div v-if="application.edition.volunteersAskCompanion && application.companionName">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.companion') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('pages.volunteers.companion_name') }}:</span
                >
                <span class="ml-2">{{ application.companionName }}</span>
              </div>
            </div>

            <!-- Liste à éviter -->
            <div v-if="application.edition.volunteersAskAvoidList && application.avoidList">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.avoid_list') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ application.avoidList }}
              </div>
            </div>

            <!-- Compétences -->
            <div v-if="application.edition.volunteersAskSkills && application.skills">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.skills') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ application.skills }}
              </div>
            </div>

            <!-- Expérience -->
            <div
              v-if="
                application.edition.volunteersAskExperience &&
                (application.hasExperience || application.experienceDetails)
              "
            >
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">
                {{ $t('pages.volunteers.experience') }}
              </h4>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <div v-if="application.hasExperience !== null">
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.has_experience') }}:</span
                  >
                  <span class="ml-2">{{
                    application.hasExperience ? $t('common.yes') : $t('common.no')
                  }}</span>
                </div>
                <div v-if="application.experienceDetails" class="mt-1">
                  <span class="text-gray-600 dark:text-gray-400"
                    >{{ $t('pages.volunteers.experience_details') }}:</span
                  >
                  <span class="ml-2">{{ application.experienceDetails }}</span>
                </div>
              </div>
            </div>

            <!-- Créneaux assignés -->
            <div
              v-if="
                application.status === 'ACCEPTED' &&
                application.assignedTimeSlots &&
                application.assignedTimeSlots.length > 0
              "
            >
              <h4 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <UIcon name="i-heroicons-clock" class="text-blue-600 dark:text-blue-400" />
                {{ $t('pages.volunteers.assigned_time_slots') }}
                <UBadge color="blue" variant="soft" size="sm">
                  {{ application.assignedTimeSlots.length }}
                </UBadge>
              </h4>
              <div class="space-y-3">
                <div
                  v-for="assignment in application.assignedTimeSlots"
                  :key="assignment.id"
                  class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-blue-900 dark:text-blue-100 text-sm mb-1">
                        {{ assignment.timeSlot.title || $t('pages.volunteers.unnamed_slot') }}
                      </p>
                      <div
                        class="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 mb-2"
                      >
                        <UIcon name="i-heroicons-calendar-days" class="w-3 h-3" />
                        <span>
                          {{
                            formatSlotDateTime(
                              assignment.timeSlot.startDateTime,
                              assignment.timeSlot.endDateTime
                            )
                          }}
                        </span>
                      </div>
                      <div v-if="assignment.timeSlot.team" class="flex items-center gap-2">
                        <div
                          class="w-2 h-2 rounded-full flex-shrink-0"
                          :style="{ backgroundColor: assignment.timeSlot.team.color || '#6b7280' }"
                        ></div>
                        <span class="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {{ assignment.timeSlot.team.name }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-2 text-xs text-blue-600 dark:text-blue-400">
                {{ $t('pages.volunteers.total_hours') }}:
                {{ calculateTotalHours(application.assignedTimeSlots) }}h
              </div>
            </div>

            <!-- Note d'acceptation -->
            <div
              v-if="application.status === 'ACCEPTED' && application.acceptanceNote"
              class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
            >
              <h4
                class="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-check-circle" class="text-green-600 dark:text-green-400" />
                {{ $t('editions.volunteers.acceptance_note_title') }}
              </h4>
              <p class="text-sm text-green-700 dark:text-green-300">
                {{ application.acceptanceNote }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <template #footer>
            <div class="flex justify-between items-center">
              <div class="flex flex-wrap gap-2">
                <UButton
                  :to="`/editions/${application.edition.id}`"
                  size="sm"
                  color="primary"
                  variant="outline"
                  icon="i-heroicons-eye"
                >
                  {{ $t('pages.volunteers.view_edition') }}
                </UButton>

                <UButton
                  v-if="
                    application.status === 'ACCEPTED' && application.assignedTimeSlots?.length > 0
                  "
                  size="sm"
                  color="blue"
                  variant="outline"
                  icon="i-heroicons-calendar-days"
                  @click="showPlanning(application)"
                >
                  {{ $t('pages.volunteers.view_planning') }}
                </UButton>

                <UButton
                  v-if="application.status === 'ACCEPTED'"
                  size="sm"
                  color="green"
                  variant="outline"
                  icon="i-heroicons-chat-bubble-bottom-center-text"
                  @click="contactOrganizer(application)"
                >
                  {{ $t('pages.volunteers.contact_organizer') }}
                </UButton>
              </div>

              <div class="flex gap-2">
                <UButton
                  v-if="application.status === 'PENDING'"
                  size="sm"
                  color="error"
                  variant="ghost"
                  icon="i-heroicons-trash"
                  @click="withdrawApplication(application.id)"
                >
                  {{ $t('pages.volunteers.withdraw') }}
                </UButton>
              </div>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Vue compacte -->
      <div v-else class="space-y-3">
        <div
          v-for="application in filteredApplications"
          :key="application.id"
          class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all touch-manipulation"
        >
          <div class="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <!-- Image -->
            <div class="flex-shrink-0">
              <img
                v-if="application.edition.imageUrl"
                :src="
                  getImageUrl(application.edition.imageUrl, 'edition', application.edition.id) || ''
                "
                :alt="getEditionDisplayName(application.edition)"
                class="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg"
              />
              <img
                v-else-if="application.edition.convention.logo"
                :src="
                  getImageUrl(
                    application.edition.convention.logo,
                    'convention',
                    application.edition.convention.id
                  ) || ''
                "
                :alt="application.edition.convention.name"
                class="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg"
              />
              <div
                v-else
                class="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
              >
                <UIcon name="i-heroicons-calendar-days" class="text-gray-400" size="18" />
              </div>
            </div>

            <!-- Informations principales -->
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 dark:text-white truncate text-sm sm:text-base">
                {{ getEditionDisplayName(application.edition) }}
              </h3>
              <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {{ application.edition.city }}, {{ application.edition.country }}
              </p>
              <p class="text-xs text-gray-500 truncate sm:hidden">
                {{ formatDateRange(application.edition.startDate, application.edition.endDate) }}
              </p>
              <p class="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">
                {{ formatDateRange(application.edition.startDate, application.edition.endDate) }}
              </p>
            </div>
          </div>

          <!-- Statut et actions -->
          <div
            class="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto"
          >
            <UBadge
              :color="getStatusColor(application.status)"
              :variant="getStatusVariant(application.status)"
              class="flex items-center gap-1"
            >
              <UIcon :name="getStatusIcon(application.status)" class="w-3 h-3" />
              {{ $t(`editions.volunteers.status.${application.status.toLowerCase()}`) }}
            </UBadge>

            <!-- Actions rapides -->
            <div class="flex flex-wrap gap-1 sm:gap-1 justify-start sm:justify-end">
              <UButton
                :to="`/editions/${application.edition.id}`"
                size="xs"
                color="primary"
                variant="ghost"
                icon="i-heroicons-eye"
                class="sm:w-auto w-8 h-8"
                square
              />
              <UButton
                v-if="
                  application.status === 'ACCEPTED' && application.assignedTimeSlots?.length > 0
                "
                size="xs"
                color="blue"
                variant="ghost"
                icon="i-heroicons-calendar-days"
                class="sm:w-auto w-8 h-8"
                square
                @click="showPlanning(application)"
              />
              <UButton
                v-if="application.status === 'ACCEPTED'"
                size="xs"
                color="green"
                variant="ghost"
                icon="i-heroicons-chat-bubble-bottom-center-text"
                class="sm:w-auto w-8 h-8"
                square
                @click="contactOrganizer(application)"
              />
              <UButton
                v-if="application.status === 'PENDING'"
                size="xs"
                color="error"
                variant="ghost"
                icon="i-heroicons-trash"
                class="sm:w-auto w-8 h-8"
                square
                @click="withdrawApplication(application.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- État vide -->
    <div v-else-if="activeTab === 'all'" class="text-center py-12">
      <UIcon name="i-heroicons-hand-raised" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('pages.volunteers.no_applications') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('pages.volunteers.no_applications_description') }}
      </p>
      <UButton to="/" color="primary" icon="i-heroicons-magnifying-glass">
        {{ $t('pages.volunteers.browse_conventions') }}
      </UButton>
    </div>

    <!-- État vide pour les onglets spécifiques -->
    <div v-else class="text-center py-12">
      <UIcon name="i-heroicons-folder-open" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ getEmptyStateTitle() }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ getEmptyStateDescription() }}
      </p>
    </div>

    <!-- Modal Planning -->
    <UModal v-model:open="planningModalOpen" :ui="{ width: 'max-w-4xl' }">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-calendar-days" class="text-blue-600" size="20" />
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('pages.volunteers.my_planning') }}
            </h3>
            <p v-if="selectedApplication" class="text-sm text-gray-600 dark:text-gray-400">
              {{ getEditionDisplayName(selectedApplication.edition) }}
            </p>
          </div>
        </div>
      </template>

      <div v-if="selectedApplication" class="space-y-4">
        <!-- Statistiques du planning -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-clock" class="text-blue-600" size="24" />
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Total heures</p>
                <p class="text-xl font-semibold text-blue-600">
                  {{ calculateTotalHours(selectedApplication.assignedTimeSlots || []) }}h
                </p>
              </div>
            </div>
          </div>
          <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-calendar-days" class="text-green-600" size="24" />
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Créneaux</p>
                <p class="text-xl font-semibold text-green-600">
                  {{ selectedApplication.assignedTimeSlots?.length || 0 }}
                </p>
              </div>
            </div>
          </div>
          <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-user-group" class="text-purple-600" size="24" />
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Équipes</p>
                <p class="text-xl font-semibold text-purple-600">
                  {{ getUniqueTeamsCount(selectedApplication.assignedTimeSlots || []) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Liste des créneaux -->
        <div class="space-y-3">
          <h4 class="font-medium text-gray-900 dark:text-white">
            {{ $t('pages.volunteers.assigned_time_slots') }}
          </h4>
          <div
            v-for="assignment in selectedApplication.assignedTimeSlots"
            :key="assignment.id"
            class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 dark:text-white mb-1">
                  {{ assignment.timeSlot.title || $t('pages.volunteers.unnamed_slot') }}
                </p>
                <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                  <span>
                    {{
                      formatSlotDateTime(
                        assignment.timeSlot.startDateTime,
                        assignment.timeSlot.endDateTime
                      )
                    }}
                  </span>
                </div>
                <div v-if="assignment.timeSlot.team" class="flex items-center gap-2">
                  <div
                    class="w-3 h-3 rounded-full flex-shrink-0"
                    :style="{ backgroundColor: assignment.timeSlot.team.color || '#6b7280' }"
                  ></div>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {{ assignment.timeSlot.team.name }}
                  </span>
                </div>
                <p v-if="assignment.timeSlot.description" class="text-sm text-gray-500 mt-2">
                  {{ assignment.timeSlot.description }}
                </p>
              </div>
              <div class="text-right text-sm text-gray-500">
                {{
                  formatSlotDuration(
                    assignment.timeSlot.startDateTime,
                    assignment.timeSlot.endDateTime
                  )
                }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between">
          <UButton color="gray" variant="ghost" @click="planningModalOpen = false">
            {{ $t('common.close') }}
          </UButton>
          <div class="flex gap-2">
            <UButton
              color="blue"
              variant="outline"
              icon="i-heroicons-arrow-down-tray"
              @click="exportPlanning('pdf')"
            >
              {{ $t('pages.volunteers.export_pdf') }}
            </UButton>
            <UButton
              color="green"
              variant="outline"
              icon="i-heroicons-calendar"
              @click="exportPlanning('ical')"
            >
              {{ $t('pages.volunteers.export_ical') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth-protected',
})

const { t } = useI18n()
const { getImageUrl } = useImageUrl()
const { formatDateTimeWithGranularity } = useDateFormat()
const toast = useToast()

// États de la vue
const viewMode = ref<'detailed' | 'compact'>('detailed')
const activeTab = ref('all')
const planningModalOpen = ref(false)
const selectedApplication = ref<any>(null)

// Récupération des candidatures
const {
  data: applications,
  pending,
  error,
  refresh,
} = await useFetch('/api/user/volunteer-applications')

// Applications filtrées selon l'onglet actif
const filteredApplications = computed(() => {
  if (!applications.value) return []

  switch (activeTab.value) {
    case 'pending':
      return applications.value.filter((app) => app.status === 'PENDING')
    case 'accepted':
      return applications.value.filter((app) => app.status === 'ACCEPTED')
    case 'rejected':
      return applications.value.filter((app) => app.status === 'REJECTED')
    case 'history':
      return applications.value.filter((app) => ['REJECTED', 'WITHDRAWN'].includes(app.status))
    default:
      return applications.value
  }
})

// Applications acceptées pour export
const acceptedApplications = computed(() => {
  return applications.value?.filter((app) => app.status === 'ACCEPTED') || []
})

// Configuration des onglets
const tabs = computed(() => [
  {
    id: 'all',
    label: t('common.all'),
    icon: 'i-heroicons-folder',
    count: applications.value?.length || 0,
    badgeColor: 'primary',
  },
  {
    id: 'pending',
    label: t('pages.volunteers.pending'),
    icon: 'i-heroicons-clock',
    count: applications.value?.filter((app) => app.status === 'PENDING').length || 0,
    badgeColor: 'warning',
  },
  {
    id: 'accepted',
    label: t('pages.volunteers.accepted'),
    icon: 'i-heroicons-check-circle',
    count: applications.value?.filter((app) => app.status === 'ACCEPTED').length || 0,
    badgeColor: 'success',
  },
  {
    id: 'history',
    label: t('pages.volunteers.history'),
    icon: 'i-heroicons-archive-box',
    count:
      applications.value?.filter((app) => ['REJECTED', 'WITHDRAWN'].includes(app.status)).length ||
      0,
    badgeColor: 'gray',
  },
])

// Menu d'export
const exportMenuItems = [
  [
    {
      label: t('pages.volunteers.export_pdf'),
      icon: 'i-heroicons-document-text',
      click: () => exportPlanning('pdf'),
    },
  ],
  [
    {
      label: t('pages.volunteers.export_ical'),
      icon: 'i-heroicons-calendar',
      click: () => exportPlanning('ical'),
    },
  ],
]

// Fonctions utilitaires
const getEditionDisplayName = (edition: any) => {
  return edition.name || edition.convention.name
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const startStr = start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  const endStr = end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return `${startStr} - ${endStr}`
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'warning'
    case 'ACCEPTED':
      return 'success'
    case 'REJECTED':
      return 'error'
    case 'WITHDRAWN':
      return 'neutral'
    default:
      return 'neutral'
  }
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'ACCEPTED':
      return 'solid'
    case 'REJECTED':
      return 'solid'
    default:
      return 'soft'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'i-heroicons-clock'
    case 'ACCEPTED':
      return 'i-heroicons-check-circle'
    case 'REJECTED':
      return 'i-heroicons-x-circle'
    case 'WITHDRAWN':
      return 'i-heroicons-arrow-uturn-left'
    default:
      return 'i-heroicons-question-mark-circle'
  }
}

// Fonction pour formater les dates et heures des créneaux
const formatSlotDateTime = (startDateTime: string, endDateTime: string) => {
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)

  const dateStr = start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  const startTimeStr = start.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const endTimeStr = end.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${dateStr} • ${startTimeStr} - ${endTimeStr}`
}

// Fonction pour calculer le total d'heures
const calculateTotalHours = (assignments: any[]) => {
  let totalMs = 0

  assignments.forEach((assignment) => {
    const start = new Date(assignment.timeSlot.startDateTime)
    const end = new Date(assignment.timeSlot.endDateTime)
    totalMs += end.getTime() - start.getTime()
  })

  const totalHours = totalMs / (1000 * 60 * 60)
  return totalHours.toFixed(1)
}

// Fonction pour retirer une candidature
const withdrawApplication = async (applicationId: number) => {
  if (!confirm(t('pages.volunteers.confirm_withdraw'))) {
    return
  }

  try {
    // Pour l'instant, on peut utiliser l'API de suppression existante
    // Il faudrait idéalement créer une API spécifique pour le retrait
    await $fetch(
      `/api/editions/${applications.value?.find((app) => app.id === applicationId)?.edition.id}/volunteers/apply`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: t('pages.volunteers.withdrawal_success'),
      color: 'success',
    })

    // Rafraîchir la liste
    await refresh()
  } catch (error: any) {
    console.error('Erreur lors du retrait:', error)
    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('pages.volunteers.withdrawal_error'),
      color: 'error',
    })
  }
}

// Fonction pour afficher le planning
const showPlanning = (application: any) => {
  selectedApplication.value = application
  planningModalOpen.value = true
}

// Fonction d'export du planning
const exportPlanning = async (format: 'pdf' | 'ical') => {
  try {
    const acceptedApps = acceptedApplications.value
    if (acceptedApps.length === 0) {
      toast.add({
        title: 'Aucun planning à exporter',
        description: "Vous n'avez pas de candidatures acceptées",
        color: 'warning',
      })
      return
    }

    // TODO: Implémenter l'export selon le format
    toast.add({
      title: `Export ${format.toUpperCase()} en cours...`,
      description: 'Cette fonctionnalité sera bientôt disponible',
      color: 'info',
    })
  } catch (error: any) {
    toast.add({
      title: "Erreur lors de l'export",
      description: error.message || 'Une erreur est survenue',
      color: 'error',
    })
  }
}

// Fonction pour contacter l'organisateur
const contactOrganizer = (_application: any) => {
  // TODO: Implémenter la logique de contact
  toast.add({
    title: 'Contact organisateur',
    description: 'Cette fonctionnalité sera bientôt disponible',
    color: 'info',
  })
}

// Fonction pour formater la durée d'un créneau
const formatSlotDuration = (startDateTime: string, endDateTime: string) => {
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)
  const durationMs = end.getTime() - start.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}

// Fonction pour compter les équipes uniques
const getUniqueTeamsCount = (assignments: any[]) => {
  if (!assignments || assignments.length === 0) return 0

  const teamIds = new Set()
  assignments.forEach((assignment) => {
    if (assignment.timeSlot.team?.id) {
      teamIds.add(assignment.timeSlot.team.id)
    }
  })

  return teamIds.size
}

// États vides personnalisés
const getEmptyStateTitle = () => {
  switch (activeTab.value) {
    case 'pending':
      return t('pages.volunteers.no_pending_applications')
    case 'accepted':
      return t('pages.volunteers.no_accepted_applications')
    case 'history':
      return t('pages.volunteers.no_history')
    default:
      return t('pages.volunteers.no_applications')
  }
}

const getEmptyStateDescription = () => {
  switch (activeTab.value) {
    case 'pending':
      return t('pages.volunteers.no_pending_description')
    case 'accepted':
      return t('pages.volunteers.no_accepted_description')
    case 'history':
      return t('pages.volunteers.no_history_description')
    default:
      return t('pages.volunteers.no_applications_description')
  }
}

// SEO
useSeoMeta({
  title: t('pages.volunteers.my_applications'),
  description: t('pages.volunteers.applications_description'),
})
</script>
