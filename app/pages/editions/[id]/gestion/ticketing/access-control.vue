<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
      <EditionHeader :edition="edition" current-page="gestion" />

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-shield-check" class="text-blue-600 dark:text-blue-400" />
          Contrôle d'accès
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Scanner et valider les billets à l'entrée
        </p>
      </div>

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <!-- Grille avec Scanner et Recherche -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Scanner de billets -->
          <UCard>
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-qr-code" class="text-blue-500" />
                <h2 class="text-lg font-semibold">{{ $t('editions.ticketing.scan_ticket') }}</h2>
              </div>

              <UAlert
                icon="i-heroicons-information-circle"
                color="info"
                variant="soft"
                description="Scannez un QR code ou entrez manuellement le code du billet"
              />

              <!-- Zone de scan -->
              <div class="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
                <UButton
                  icon="i-heroicons-qr-code"
                  color="primary"
                  size="lg"
                  class="w-full lg:w-auto"
                  @click="startScanner"
                >
                  Scanner un QR code
                </UButton>

                <div class="flex items-center justify-center">
                  <span class="text-gray-500 dark:text-gray-400 font-medium">ou</span>
                </div>

                <UFieldGroup class="flex-1">
                  <UInput
                    v-model="ticketCode"
                    :placeholder="$t('editions.ticketing.ticket_code_placeholder')"
                    icon="i-heroicons-ticket"
                    @keydown.enter="validateTicket"
                  />
                  <UButton
                    :label="$t('editions.ticketing.validate_ticket')"
                    icon="i-heroicons-check-circle"
                    color="success"
                    :disabled="!ticketCode"
                    :loading="validatingTicket"
                    @click="validateTicket"
                  />
                </UFieldGroup>
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
                    placeholder="Nom, prénom ou email..."
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
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
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
                          <div>
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
                          <UIcon
                            v-if="result.participant.ticket.entryValidated"
                            name="i-heroicons-check-circle"
                            class="text-green-500"
                          />
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Liste des bénévoles -->
                  <div v-if="searchResults.volunteers.length > 0" class="space-y-2">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      Bénévoles ({{ searchResults.volunteers.length }})
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
                            <UBadge color="purple">Bénévole</UBadge>
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

                  <!-- Aucun résultat -->
                  <div
                    v-if="searchResults.total === 0"
                    class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <UIcon
                      name="i-heroicons-magnifying-glass"
                      class="mx-auto h-12 w-12 text-gray-400 mb-2"
                    />
                    <p class="text-sm text-gray-500">Aucun billet trouvé</p>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Statistiques -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-chart-bar" class="text-purple-500" />
              <h2 class="text-lg font-semibold">{{ $t('editions.ticketing.entry_stats') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('editions.ticketing.total_entries') }}
                    </p>
                    <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {{ stats.totalValidated }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {{ stats.validatedToday }}
                      {{ $t('editions.ticketing.validated_today').toLowerCase() }}
                    </p>
                  </div>
                  <UIcon name="i-heroicons-users" class="text-blue-500" size="32" />
                </div>
              </div>

              <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Participants</p>
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

              <div class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Bénévoles</p>
                    <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {{ stats.volunteersValidated }} / {{ stats.totalVolunteers }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {{ stats.volunteersValidatedToday }} aujourd'hui
                    </p>
                  </div>
                  <UIcon name="i-heroicons-user-group" class="text-purple-500" size="32" />
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Dernières validations -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="text-orange-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('editions.ticketing.recent_validations') }}
              </h2>
            </div>

            <div v-if="loadingValidations" class="text-center py-8">
              <p class="text-sm text-gray-500">Chargement...</p>
            </div>

            <div
              v-else-if="recentValidations.length === 0"
              class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <UIcon name="i-heroicons-ticket" class="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">{{ $t('editions.ticketing.no_validation_yet') }}</p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="validation in recentValidations"
                :key="validation.id"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-medium text-gray-900 dark:text-white">
                      {{ validation.firstName }} {{ validation.lastName }}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                      {{ validation.name }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatValidationTime(validation.entryValidatedAt) }}
                    </div>
                    <UIcon name="i-heroicons-check-circle" class="text-green-500" />
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
        @validate="handleValidateParticipants"
        @invalidate="handleInvalidateEntry"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

const ticketCode = ref('')
const scannerOpen = ref(false)
const participantModalOpen = ref(false)
const selectedParticipant = ref<any>(null)
const participantType = ref<'ticket' | 'volunteer'>('ticket')
const validatingTicket = ref(false)
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
  ticketsValidatedToday: 0,
  volunteersValidatedToday: 0,
  totalTickets: 0,
  totalVolunteers: 0,
})

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les statistiques et les dernières validations
  await Promise.all([loadStats(), loadRecentValidations()])
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

  // Tous les collaborateurs de la convention (même sans droits)
  if (edition.value.convention?.collaborators) {
    return edition.value.convention.collaborators.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

const startScanner = () => {
  scannerOpen.value = true
}

const handleScan = (code: string) => {
  ticketCode.value = code
  // Valider automatiquement après le scan
  validateTicket()
}

const validateTicket = async () => {
  if (!ticketCode.value || validatingTicket.value) return

  validatingTicket.value = true

  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/verify`, {
      method: 'POST',
      body: {
        qrCode: ticketCode.value,
      },
    })

    if (result.found && result.participant) {
      // Afficher la modal avec les détails du participant
      selectedParticipant.value = result.participant
      participantType.value = result.type || 'ticket'
      participantModalOpen.value = true

      toast.add({
        title: result.type === 'volunteer' ? 'Bénévole trouvé' : 'Billet trouvé',
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
  } finally {
    validatingTicket.value = false
    ticketCode.value = ''
  }
}

const handleValidateParticipants = async (participantIds: number[]) => {
  try {
    // Appeler l'API pour valider les participants
    await $fetch(`/api/editions/${editionId}/ticketing/validate-entry`, {
      method: 'POST',
      body: {
        participantIds,
        type: participantType.value,
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

const reloadParticipant = async (identifier: number | string, type: 'ticket' | 'volunteer') => {
  try {
    let qrCode: string
    if (type === 'volunteer') {
      qrCode = `volunteer-${identifier}`
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
  participantModalOpen.value = true

  // Réinitialiser la recherche
  searchTerm.value = ''
  searchResults.value = null
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
</script>
