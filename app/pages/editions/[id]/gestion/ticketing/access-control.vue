<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-shield-check" class="text-blue-600 dark:text-blue-400" />
            Contrôle d'accès
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Scanner et valider les billets à l'entrée
          </p>
        </div>
        <UButton
          v-if="allowOnsiteRegistration"
          icon="i-heroicons-user-plus"
          color="primary"
          class="sm:flex-shrink-0"
          @click="showAddParticipantModal = true"
        >
          {{ $t('edition.ticketing.add_participant') }}
        </UButton>
      </div>

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <!-- Grille avec Scanner et Recherche -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Scanner de billets -->
          <UCard>
            <div class="space-y-6">
              <!-- En-tête -->
              <div class="flex items-center gap-3">
                <div
                  class="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30"
                >
                  <UIcon
                    name="i-heroicons-qr-code"
                    class="h-6 w-6 text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ $t('edition.ticketing.scan_ticket') }}
                  </h2>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Scanner un QR code ou saisir manuellement
                  </p>
                </div>
              </div>

              <!-- Bouton Scanner -->
              <UButton
                icon="i-heroicons-qr-code"
                color="primary"
                size="xl"
                variant="soft"
                class="w-full justify-center h-[52px]"
                @click="startScanner"
              >
                <span class="font-semibold">Scanner un QR code</span>
              </UButton>

              <!-- Bouton de synchronisation HelloAsso -->
              <div
                v-if="hasHelloAssoConfig"
                class="pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <UButton
                  icon="i-heroicons-arrow-path"
                  color="primary"
                  variant="soft"
                  class="w-full justify-center"
                  :loading="syncingHelloAsso"
                  @click="syncHelloAsso"
                >
                  <span class="font-medium">Synchroniser HelloAsso</span>
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- Rechercher un billet -->
          <UCard>
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-magnifying-glass" class="text-purple-500" />
                <h2 class="text-lg font-semibold">Chercher un billet</h2>
              </div>

              <UAlert
                icon="i-heroicons-information-circle"
                color="info"
                variant="soft"
                description="Recherchez un billet par nom, prénom ou email"
              />

              <!-- Zone de recherche -->
              <div class="space-y-4">
                <UFieldGroup class="w-full">
                  <UInput
                    v-model="searchTerm"
                    :placeholder="$t('ticketing.access_control.search_placeholder')"
                    icon="i-heroicons-magnifying-glass"
                    class="w-full"
                    @keydown.enter="searchTickets"
                  />
                  <UButton
                    icon="i-heroicons-magnifying-glass"
                    color="primary"
                    :disabled="!searchTerm || searchTerm.length < 2"
                    :loading="searching"
                    @click="searchTickets"
                  />
                </UFieldGroup>

                <!-- Résultats de recherche -->
                <div v-if="searchResults" class="space-y-2">
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ searchResults.total }} résultat{{
                      searchResults.total > 1 ? 's' : ''
                    }}
                    trouvé{{ searchResults.total > 1 ? 's' : '' }}
                  </div>

                  <!-- Liste des billets -->
                  <div v-if="searchResults.tickets.length > 0" class="space-y-2">
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon :name="ticketConfig.icon" :class="ticketConfig.iconColorClass" />
                      Billets ({{ searchResults.tickets.length }})
                    </div>
                    <div class="space-y-1 max-h-60 overflow-y-auto">
                      <button
                        v-for="result in searchResults.tickets"
                        :key="result.participant.ticket.id"
                        class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-2 border-transparent hover:border-primary-500 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                        @click="selectSearchResult(result)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-white">
                              {{ result.participant.ticket.user.firstName }}
                              {{ result.participant.ticket.user.lastName }}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              {{ result.participant.ticket.user.email }}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-500">
                              {{ result.participant.ticket.name }}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <UBadge :color="ticketConfig.color">{{
                              $t('ticketing.stats.participants')
                            }}</UBadge>
                            <UIcon
                              v-if="result.participant.ticket.entryValidated"
                              name="i-heroicons-check-circle"
                              class="text-green-500"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Liste des artistes -->
                  <div
                    v-if="searchResults.artists && searchResults.artists.length > 0"
                    class="space-y-2"
                  >
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon :name="artistConfig.icon" :class="artistConfig.iconColorClass" />
                      Artistes ({{ searchResults.artists.length }})
                    </div>
                    <div class="space-y-1 max-h-60 overflow-y-auto">
                      <button
                        v-for="result in searchResults.artists"
                        :key="result.participant.artist.id"
                        class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-2 border-transparent hover:border-primary-500 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                        @click="selectSearchResult(result)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-white">
                              {{ result.participant.artist.user.firstName }}
                              {{ result.participant.artist.user.lastName }}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              {{ result.participant.artist.user.email }}
                            </div>
                            <div
                              v-if="result.participant.artist.shows.length > 0"
                              class="text-xs text-gray-500 dark:text-gray-500"
                            >
                              Spectacle{{ result.participant.artist.shows.length > 1 ? 's' : '' }}:
                              {{ result.participant.artist.shows.map((s) => s.title).join(', ') }}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <UBadge :color="artistConfig.color">{{
                              $t('ticketing.stats.artists')
                            }}</UBadge>
                            <UIcon
                              v-if="result.participant.artist.entryValidated"
                              name="i-heroicons-check-circle"
                              class="text-green-500"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Liste des bénévoles -->
                  <div v-if="searchResults.volunteers.length > 0" class="space-y-2">
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon :name="volunteerConfig.icon" :class="volunteerConfig.iconColorClass" />
                      {{ $t('ticketing.stats.volunteers') }} ({{ searchResults.volunteers.length }})
                    </div>
                    <div class="space-y-1 max-h-60 overflow-y-auto">
                      <button
                        v-for="result in searchResults.volunteers"
                        :key="result.participant.volunteer.id"
                        class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-2 border-transparent hover:border-primary-500 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                        @click="selectSearchResult(result)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-white">
                              {{ result.participant.volunteer.user.firstName }}
                              {{ result.participant.volunteer.user.lastName }}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              {{ result.participant.volunteer.user.email }}
                            </div>
                            <div
                              v-if="result.participant.volunteer.teams.length > 0"
                              class="text-xs text-gray-500 dark:text-gray-500"
                            >
                              Équipe{{ result.participant.volunteer.teams.length > 1 ? 's' : '' }}:
                              {{ result.participant.volunteer.teams.map((t) => t.name).join(', ') }}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <UBadge color="primary">{{ $t('ticketing.stats.volunteers') }}</UBadge>
                            <UIcon
                              v-if="result.participant.volunteer.entryValidated"
                              name="i-heroicons-check-circle"
                              class="text-green-500"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Liste des organisateurs -->
                  <div
                    v-if="searchResults.organizers && searchResults.organizers.length > 0"
                    class="space-y-2"
                  >
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon :name="organizerConfig.icon" :class="organizerConfig.iconColorClass" />
                      {{ $t('ticketing.stats.organizers') }} ({{ searchResults.organizers.length }})
                    </div>
                    <div class="space-y-1 max-h-60 overflow-y-auto">
                      <button
                        v-for="result in searchResults.organizers"
                        :key="result.participant.organizer.id"
                        class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-2 border-transparent hover:border-primary-500 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                        @click="selectSearchResult(result)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-white">
                              {{ result.participant.organizer.user.firstName }}
                              {{ result.participant.organizer.user.lastName }}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              {{ result.participant.organizer.user.email }}
                            </div>
                            <div
                              v-if="result.participant.organizer.title"
                              class="text-xs text-gray-500 dark:text-gray-500"
                            >
                              {{ result.participant.organizer.title }}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <UBadge :color="organizerConfig.color">{{
                              $t('common.organizer')
                            }}</UBadge>
                            <UIcon
                              v-if="result.participant.organizer.entryValidated"
                              name="i-heroicons-check-circle"
                              class="text-green-500"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Aucun résultat -->
                  <div
                    v-if="searchResults.total === 0"
                    class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <UIcon
                      name="i-heroicons-magnifying-glass"
                      class="mx-auto h-12 w-12 text-gray-400 mb-2"
                    />
                    <p class="text-sm text-gray-500">
                      {{ $t('ticketing.access_control.no_ticket_found') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Statistiques -->
        <TicketingStatsEntryStatsCard
          :stats="stats"
          @show-volunteers-not-validated="showVolunteersNotValidatedModal"
          @show-artists-not-validated="showArtistsNotValidatedModal"
          @show-organizers-not-validated="showOrganizersNotValidatedModal"
        />

        <!-- Statistiques des quotas -->
        <TicketingStatsQuotaStatsCard :edition-id="editionId" />

        <!-- Dernières validations -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="text-orange-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('edition.ticketing.recent_validations') }}
              </h2>
            </div>

            <div v-if="loadingValidations" class="text-center py-8">
              <p class="text-sm text-gray-500">{{ $t('ticketing.access_control.loading') }}</p>
            </div>

            <div
              v-else-if="recentValidations.length === 0"
              class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <UIcon name="i-heroicons-ticket" class="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">{{ $t('edition.ticketing.no_validation_yet') }}</p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="validation in recentValidations"
                :key="validation.id"
                :class="[
                  'p-3 rounded-lg',
                  validation.type === 'ticket'
                    ? `${ticketConfig.bgClass} ${ticketConfig.darkBgClass}`
                    : validation.type === 'volunteer'
                      ? `${volunteerConfig.bgClass} ${volunteerConfig.darkBgClass}`
                      : validation.type === 'artist'
                        ? `${artistConfig.bgClass} ${artistConfig.darkBgClass}`
                        : `${organizerConfig.bgClass} ${organizerConfig.darkBgClass}`,
                ]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3 flex-1 min-w-0">
                    <!-- Icône du type -->
                    <UIcon
                      :name="
                        validation.type === 'ticket'
                          ? ticketConfig.icon
                          : validation.type === 'volunteer'
                            ? volunteerConfig.icon
                            : validation.type === 'artist'
                              ? artistConfig.icon
                              : organizerConfig.icon
                      "
                      :class="[
                        'flex-shrink-0 mt-0.5',
                        validation.type === 'ticket'
                          ? ticketConfig.iconColorClass
                          : validation.type === 'volunteer'
                            ? volunteerConfig.iconColorClass
                            : validation.type === 'artist'
                              ? artistConfig.iconColorClass
                              : organizerConfig.iconColorClass,
                      ]"
                      size="20"
                    />

                    <!-- Participant validé -->
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-900 dark:text-white">
                        {{ validation.firstName }} {{ validation.lastName }}
                      </div>
                      <div class="text-sm text-gray-600 dark:text-gray-400">
                        {{ validation.name }}
                      </div>
                    </div>
                  </div>

                  <div class="text-right flex-shrink-0 space-y-2">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatValidationTime(validation.entryValidatedAt) }}
                    </div>
                    <!-- Validé par -->
                    <div v-if="validation.validator" class="flex justify-end">
                      <UiUserDisplayForAdmin
                        :user="validation.validator"
                        size="sm"
                        :show-email="false"
                        :border="false"
                        avatar-class=""
                      />
                    </div>
                    <div v-else class="flex items-center justify-end gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 italic">{{
                        $t('ticketing.access_control.unknown')
                      }}</span>
                      <div
                        class="h-5 w-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0"
                      >
                        <UIcon name="i-heroicons-user" class="h-3 w-3 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Scanner QR Code -->
      <TicketingQrCodeScanner v-model:open="scannerOpen" @scan="handleScan" />

      <!-- Modal détails du participant -->
      <TicketingParticipantDetailsModal
        v-model:open="participantModalOpen"
        :participant="selectedParticipant"
        :type="participantType"
        :is-refunded="isRefundedOrder"
        @validate="handleValidateParticipants"
        @invalidate="handleInvalidateEntry"
      />

      <!-- Modal ajout de participant -->
      <TicketingAddParticipantModal
        v-model:open="showAddParticipantModal"
        :edition-id="editionId"
        :allow-anonymous-orders="allowAnonymousOrders"
        @order-created="handleOrderCreated"
      />

      <!-- Modal liste des bénévoles non validés -->
      <UModal
        v-model:open="volunteersNotValidatedModalOpen"
        title="Bénévoles n'ayant pas validé leur billet"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert icon="i-heroicons-information-circle" color="info" variant="soft">
              <template #description>
                Liste des bénévoles acceptés qui n'ont pas encore scanné leur billet au contrôle
                d'accès.
              </template>
            </UAlert>

            <div v-if="loadingVolunteersNotValidated" class="text-center py-8">
              <p class="text-sm text-gray-500">Chargement...</p>
            </div>

            <div
              v-else-if="volunteersNotValidated.length === 0"
              class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <UIcon
                name="i-heroicons-check-circle"
                class="mx-auto h-12 w-12 text-green-400 mb-2"
              />
              <p class="text-sm text-gray-500">Tous les bénévoles ont validé leur billet !</p>
            </div>

            <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto">
              <div
                v-for="volunteer in volunteersNotValidated"
                :key="volunteer.id"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <UiUserDisplayForAdmin :user="volunteer.user" size="md" :show-email="true" />
                <div
                  v-if="volunteer.teams.length > 0"
                  class="text-xs text-gray-500 dark:text-gray-500 mt-2 ml-14"
                >
                  Équipe{{ volunteer.teams.length > 1 ? 's' : '' }} :
                  {{ volunteer.teams.map((t) => t.name).join(', ') }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <template #footer>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ volunteersNotValidated.length }} bénévole{{
              volunteersNotValidated.length > 1 ? 's' : ''
            }}
            non validé{{ volunteersNotValidated.length > 1 ? 's' : '' }}
          </p>
        </template>
      </UModal>

      <!-- Modal liste des artistes non validés -->
      <UModal
        v-model:open="artistsNotValidatedModalOpen"
        title="Artistes n'ayant pas validé leur billet"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert icon="i-heroicons-information-circle" color="info" variant="soft">
              <template #description>
                Liste des artistes qui n'ont pas encore scanné leur billet au contrôle d'accès.
              </template>
            </UAlert>

            <div v-if="loadingArtistsNotValidated" class="text-center py-8">
              <p class="text-sm text-gray-500">Chargement...</p>
            </div>

            <div
              v-else-if="artistsNotValidated.length === 0"
              class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <UIcon
                name="i-heroicons-check-circle"
                class="mx-auto h-12 w-12 text-green-400 mb-2"
              />
              <p class="text-sm text-gray-500">Tous les artistes ont validé leur billet !</p>
            </div>

            <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto">
              <div
                v-for="artist in artistsNotValidated"
                :key="artist.id"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <UiUserDisplayForAdmin :user="artist.user" size="md" :show-email="true" />
                <div
                  v-if="artist.shows.length > 0"
                  class="text-xs text-gray-500 dark:text-gray-500 mt-2 ml-14"
                >
                  Spectacle{{ artist.shows.length > 1 ? 's' : '' }} :
                  {{ artist.shows.map((s) => s.title).join(', ') }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <template #footer>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ artistsNotValidated.length }} artiste{{
              artistsNotValidated.length > 1 ? 's' : ''
            }}
            non validé{{ artistsNotValidated.length > 1 ? 's' : '' }}
          </p>
        </template>
      </UModal>

      <!-- Modal liste des organisateurs non validés -->
      <UModal
        v-model:open="organizersNotValidatedModalOpen"
        title="Organisateurs n'ayant pas validé leur billet"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert icon="i-heroicons-information-circle" color="info" variant="soft">
              <template #description>
                Liste des organisateurs qui n'ont pas encore scanné leur billet au contrôle d'accès.
              </template>
            </UAlert>

            <div v-if="loadingOrganizersNotValidated" class="text-center py-8">
              <p class="text-sm text-gray-500">Chargement...</p>
            </div>

            <div
              v-else-if="organizersNotValidated.length === 0"
              class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <UIcon
                name="i-heroicons-check-circle"
                class="mx-auto h-12 w-12 text-green-400 mb-2"
              />
              <p class="text-sm text-gray-500">Tous les organisateurs ont validé leur billet !</p>
            </div>

            <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto">
              <div
                v-for="organizer in organizersNotValidated"
                :key="organizer.id"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <UiUserDisplayForAdmin :user="organizer.user" size="md" :show-email="true">
                  <template v-if="organizer.title" #badge>
                    <UBadge color="neutral" variant="subtle" size="xs">
                      {{ organizer.title }}
                    </UBadge>
                  </template>
                </UiUserDisplayForAdmin>
              </div>
            </div>
          </div>
        </template>

        <template #footer>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ organizersNotValidated.length }} organisateur{{
              organizersNotValidated.length > 1 ? 's' : ''
            }}
            non validé{{ organizersNotValidated.length > 1 ? 's' : '' }}
          </p>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const { getParticipantTypeConfig } = useParticipantTypes()

// Récupérer les configurations de couleurs
const ticketConfig = getParticipantTypeConfig('ticket')
const volunteerConfig = getParticipantTypeConfig('volunteer')
const artistConfig = getParticipantTypeConfig('artist')
const organizerConfig = getParticipantTypeConfig('organizer')

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Vérifier les permissions de contrôle d'accès pour les bénévoles en créneau
const { canAccessAccessControl } = useAccessControlPermissions(editionId)

// SSE pour rafraîchissement automatique
const { lastUpdate } = useRealtimeStats(editionId)

// Paramètres de billetterie
const { settings: ticketingSettings, fetchSettings: fetchTicketingSettings } =
  useTicketingSettings(editionId)

const allowOnsiteRegistration = computed(
  () => ticketingSettings.value?.allowOnsiteRegistration ?? true
)
const allowAnonymousOrders = computed(() => ticketingSettings.value?.allowAnonymousOrders ?? false)

const scannerOpen = ref(false)
const participantModalOpen = ref(false)
const showAddParticipantModal = ref(false)
const selectedParticipant = ref<any>(null)
const participantType = ref<'ticket' | 'volunteer'>('ticket')
const isRefundedOrder = ref(false)
const searchTerm = ref('')
const searching = ref(false)
const searchResults = ref<any>(null)
const recentValidations = ref<any[]>([])
const loadingValidations = ref(false)
const stats = ref({
  validatedToday: 0,
  totalValidated: 0,
  ticketsValidated: 0,
  volunteersValidated: 0,
  artistsValidated: 0,
  ticketsValidatedToday: 0,
  volunteersValidatedToday: 0,
  artistsValidatedToday: 0,
  totalTickets: 0,
  totalVolunteers: 0,
  totalArtists: 0,
})
const hasHelloAssoConfig = ref(false)
const syncingHelloAsso = ref(false)
const volunteersNotValidatedModalOpen = ref(false)
const volunteersNotValidated = ref<any[]>([])
const loadingVolunteersNotValidated = ref(false)
const artistsNotValidatedModalOpen = ref(false)
const artistsNotValidated = ref<any[]>([])
const loadingArtistsNotValidated = ref(false)
const organizersNotValidatedModalOpen = ref(false)
const organizersNotValidated = ref<any[]>([])
const loadingOrganizersNotValidated = ref(false)

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les paramètres de billetterie
  await fetchTicketingSettings()

  // Charger les statistiques et les dernières validations
  await Promise.all([loadStats(), loadRecentValidations(), checkHelloAssoConfig()])
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) return true

  // Bénévoles avec créneau actif de contrôle d'accès (±15 minutes)
  if (canAccessAccessControl.value) return true

  // Tous les organisateurs de la convention (même sans droits)
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

const startScanner = () => {
  scannerOpen.value = true
}

const handleScan = async (code: string) => {
  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/verify`, {
      method: 'POST',
      body: {
        qrCode: code,
      },
    })

    if (result.found && result.participant) {
      // Afficher la modal avec les détails du participant
      selectedParticipant.value = result.participant
      participantType.value = result.type || 'ticket'
      isRefundedOrder.value = result.isRefunded || false
      participantModalOpen.value = true

      toast.add({
        title:
          result.type === 'volunteer'
            ? t('ticketing.access_control.volunteer_found')
            : t('ticketing.access_control.ticket_found'),
        description: result.message,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      toast.add({
        title: 'Billet introuvable',
        description: result.message,
        icon: 'i-heroicons-exclamation-triangle',
        color: 'warning',
      })
    }
  } catch (error: any) {
    console.error('Failed to validate ticket:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de vérifier le billet',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const handleValidateParticipants = async (
  participantIds: number[],
  paymentInfo?: {
    paymentMethod?: 'cash' | 'card' | 'check' | null
    checkNumber?: string
  },
  userInfo?: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
  }
) => {
  try {
    // Appeler l'API pour valider les participants
    await $fetch(`/api/editions/${editionId}/ticketing/validate-entry`, {
      method: 'POST',
      body: {
        participantIds,
        type: participantType.value,
        paymentMethod: paymentInfo?.paymentMethod,
        checkNumber: paymentInfo?.checkNumber,
        userInfo,
      },
    })

    toast.add({
      title: 'Entrée validée',
      description: `${participantIds.length} participant${participantIds.length > 1 ? 's' : ''} validé${participantIds.length > 1 ? 's' : ''}`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Recharger les statistiques et les dernières validations
    await Promise.all([loadStats(), loadRecentValidations()])

    // Recharger le participant pour afficher le nouveau statut
    if (participantType.value === 'volunteer' && selectedParticipant.value?.volunteer?.id) {
      await reloadParticipant(selectedParticipant.value.volunteer.id, 'volunteer')
    } else if (participantType.value === 'artist' && selectedParticipant.value?.artist?.id) {
      await reloadParticipant(selectedParticipant.value.artist.id, 'artist')
    } else if (participantType.value === 'organizer' && selectedParticipant.value?.organizer?.id) {
      await reloadParticipant(selectedParticipant.value.organizer.id, 'organizer')
    } else if (participantType.value === 'ticket' && selectedParticipant.value?.ticket?.qrCode) {
      await reloadParticipant(selectedParticipant.value.ticket.qrCode, 'ticket')
    }
  } catch (error: any) {
    console.error('Failed to validate participants:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de valider les participants',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const reloadParticipant = async (
  identifier: number | string,
  type: 'ticket' | 'volunteer' | 'artist' | 'organizer'
) => {
  try {
    let qrCode: string
    if (type === 'volunteer') {
      qrCode = `volunteer-${identifier}`
    } else if (type === 'artist') {
      qrCode = `artist-${identifier}`
    } else if (type === 'organizer') {
      qrCode = `organizer-${identifier}`
    } else {
      qrCode = identifier as string
    }

    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/verify`, {
      method: 'POST',
      body: {
        qrCode,
      },
    })

    if (result.success && result.found) {
      selectedParticipant.value = result.participant
    }
  } catch (error) {
    console.error('Failed to reload participant:', error)
  }
}

const handleInvalidateEntry = async (participantId: number) => {
  try {
    await $fetch(`/api/editions/${editionId}/ticketing/invalidate-entry`, {
      method: 'POST',
      body: {
        participantId,
        type: participantType.value,
      },
    })

    toast.add({
      title: 'Entrée dévalidée',
      description: "L'entrée a été dévalidée avec succès",
      icon: 'i-heroicons-x-circle',
      color: 'success',
    })

    // Recharger les statistiques et les dernières validations
    await Promise.all([loadStats(), loadRecentValidations()])

    // Recharger le participant pour afficher le nouveau statut
    if (participantType.value === 'volunteer' && selectedParticipant.value?.volunteer?.id) {
      await reloadParticipant(selectedParticipant.value.volunteer.id, 'volunteer')
    } else if (participantType.value === 'artist' && selectedParticipant.value?.artist?.id) {
      await reloadParticipant(selectedParticipant.value.artist.id, 'artist')
    } else if (participantType.value === 'organizer' && selectedParticipant.value?.organizer?.id) {
      await reloadParticipant(selectedParticipant.value.organizer.id, 'organizer')
    } else if (participantType.value === 'ticket' && selectedParticipant.value?.ticket?.qrCode) {
      await reloadParticipant(selectedParticipant.value.ticket.qrCode, 'ticket')
    }
  } catch (error: any) {
    console.error('Failed to invalidate entry:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible de dévalider l'entrée",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const handleOrderCreated = async (qrCode: string) => {
  try {
    // Appeler l'API verify pour récupérer les détails de la commande
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/verify`, {
      method: 'POST',
      body: {
        qrCode,
      },
    })

    if (result.found && result.participant) {
      // Afficher la modal avec les détails du participant
      selectedParticipant.value = result.participant
      participantType.value = 'ticket'
      participantModalOpen.value = true

      toast.add({
        title: 'Commande créée',
        description: 'La commande a été créée avec succès',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })

      // Recharger les statistiques et les dernières validations
      await Promise.all([loadStats(), loadRecentValidations()])
    }
  } catch (error: any) {
    console.error('Failed to load created order:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de charger la commande créée',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const searchTickets = async () => {
  if (!searchTerm.value || searchTerm.value.length < 2 || searching.value) return

  searching.value = true
  searchResults.value = null

  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/search`, {
      method: 'POST',
      body: {
        searchTerm: searchTerm.value,
      },
    })

    if (result.success) {
      searchResults.value = result.results
    }
  } catch (error: any) {
    console.error('Failed to search tickets:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de rechercher les billets',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    searching.value = false
  }
}

const selectSearchResult = (result: any) => {
  // Afficher la modal avec les détails du participant
  selectedParticipant.value = result.participant
  participantType.value = result.type || 'ticket'
  isRefundedOrder.value = result.isRefunded || false
  participantModalOpen.value = true

  // Ne plus réinitialiser la recherche pour conserver le terme et les résultats
  // L'utilisateur peut ainsi revenir aux résultats après avoir fermé la modal
}

const loadStats = async () => {
  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/stats`)

    if (result.success) {
      stats.value = result.stats
    }
  } catch (error: any) {
    console.error('Failed to load stats:', error)
  }
}

const loadRecentValidations = async () => {
  loadingValidations.value = true

  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/recent-validations`)

    if (result.success) {
      recentValidations.value = result.validations
    }
  } catch (error: any) {
    console.error('Failed to load recent validations:', error)
  } finally {
    loadingValidations.value = false
  }
}

const formatValidationTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Il y a ${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `Il y a ${diffDays}j`
}

// Vérifier si HelloAsso est configuré
const checkHelloAssoConfig = async () => {
  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/external`)
    hasHelloAssoConfig.value =
      result?.hasConfig && result?.config?.provider?.toUpperCase() === 'HELLOASSO'
  } catch {
    // Pas de configuration HelloAsso
    hasHelloAssoConfig.value = false
  }
}

// Synchroniser les participants depuis HelloAsso
const syncHelloAsso = async () => {
  if (syncingHelloAsso.value) return

  syncingHelloAsso.value = true

  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/orders`)

    if (result.success) {
      const totalParticipants = result.stats?.totalItems || 0

      toast.add({
        title: 'Synchronisation réussie',
        description: `${totalParticipants} participant${totalParticipants > 1 ? 's' : ''} synchronisé${totalParticipants > 1 ? 's' : ''} depuis HelloAsso`,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })

      // Recharger les statistiques et les dernières validations
      await Promise.all([loadStats(), loadRecentValidations()])
    }
  } catch (error: any) {
    console.error('Failed to sync HelloAsso:', error)
    toast.add({
      title: 'Erreur de synchronisation',
      description: error.data?.message || 'Impossible de synchroniser les participants HelloAsso',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    syncingHelloAsso.value = false
  }
}

// Charger les bénévoles non validés
const loadVolunteersNotValidated = async () => {
  loadingVolunteersNotValidated.value = true

  try {
    const result: any = await $fetch(
      `/api/editions/${editionId}/ticketing/volunteers-not-validated`
    )

    if (result.success) {
      volunteersNotValidated.value = result.volunteers
    }
  } catch (error: any) {
    console.error('Failed to load volunteers not validated:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de charger les bénévoles non validés',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loadingVolunteersNotValidated.value = false
  }
}

// Afficher la modal des bénévoles non validés
const showVolunteersNotValidatedModal = async () => {
  volunteersNotValidatedModalOpen.value = true
  // Charger les données à chaque fois que la modal s'ouvre
  await loadVolunteersNotValidated()
}

// Charger les artistes non validés
const loadArtistsNotValidated = async () => {
  loadingArtistsNotValidated.value = true

  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/artists-not-validated`)

    if (result.success) {
      artistsNotValidated.value = result.artists
    }
  } catch (error: any) {
    console.error('Failed to load artists not validated:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de charger les artistes non validés',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loadingArtistsNotValidated.value = false
  }
}

// Afficher la modal des artistes non validés
const showArtistsNotValidatedModal = async () => {
  artistsNotValidatedModalOpen.value = true
  // Charger les données à chaque fois que la modal s'ouvre
  await loadArtistsNotValidated()
}

// Charger les organisateurs non validés
const loadOrganizersNotValidated = async () => {
  loadingOrganizersNotValidated.value = true

  try {
    const result: any = await $fetch(
      `/api/editions/${editionId}/ticketing/organizers-not-validated`
    )

    if (result.success) {
      organizersNotValidated.value = result.organizers
    }
  } catch (error: any) {
    console.error('Failed to load organizers not validated:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de charger les organisateurs non validés',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loadingOrganizersNotValidated.value = false
  }
}

// Afficher la modal des organisateurs non validés
const showOrganizersNotValidatedModal = async () => {
  organizersNotValidatedModalOpen.value = true
  // Charger les données à chaque fois que la modal s'ouvre
  await loadOrganizersNotValidated()
}

// Rafraîchir automatiquement quand une mise à jour SSE arrive
watch(lastUpdate, () => {
  if (lastUpdate.value) {
    // Rafraîchir les stats et les validations récentes
    Promise.all([loadStats(), loadRecentValidations()])

    // Recharger la liste des bénévoles non validés si la modal est ouverte
    if (volunteersNotValidatedModalOpen.value) {
      loadVolunteersNotValidated()
    }

    // Recharger la liste des artistes non validés si la modal est ouverte
    if (artistsNotValidatedModalOpen.value) {
      loadArtistsNotValidated()
    }

    // Recharger la liste des organisateurs non validés si la modal est ouverte
    if (organizersNotValidatedModalOpen.value) {
      loadOrganizersNotValidated()
    }
  }
})
</script>
