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
              description="Utilisez un lecteur de QR code ou entrez manuellement le code du billet"
            />

            <!-- Zone de scan -->
            <div class="space-y-4">
              <UFormField :label="$t('editions.ticketing.ticket_code_label')">
                <UFieldGroup>
                  <UInput
                    v-model="ticketCode"
                    :placeholder="$t('editions.ticketing.ticket_code_placeholder')"
                    size="xl"
                    icon="i-heroicons-ticket"
                    @keydown.enter="validateTicket"
                  />
                  <UButton
                    :label="$t('editions.ticketing.validate_ticket')"
                    icon="i-heroicons-check-circle"
                    color="success"
                    size="lg"
                    class="flex-1"
                    :disabled="!ticketCode"
                    :loading="validatingTicket"
                    @click="validateTicket"
                  />
                </UFieldGroup>
              </UFormField>

              <div class="flex gap-2">
                <UButton icon="i-heroicons-qr-code" color="primary" size="lg" @click="startScanner">
                  Scanner un QR code
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Statistiques -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-chart-bar" class="text-purple-500" />
              <h2 class="text-lg font-semibold">{{ $t('editions.ticketing.entry_stats') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('editions.ticketing.validated_today') }}
                    </p>
                    <p class="text-2xl font-bold text-green-600 dark:text-green-400">0</p>
                  </div>
                  <UIcon name="i-heroicons-check-circle" class="text-green-500" size="32" />
                </div>
              </div>

              <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('editions.ticketing.total_entries') }}
                    </p>
                    <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">0</p>
                  </div>
                  <UIcon name="i-heroicons-users" class="text-blue-500" size="32" />
                </div>
              </div>

              <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('editions.ticketing.refused') }}
                    </p>
                    <p class="text-2xl font-bold text-red-600 dark:text-red-400">0</p>
                  </div>
                  <UIcon name="i-heroicons-x-circle" class="text-red-500" size="32" />
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

            <div class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <UIcon name="i-heroicons-ticket" class="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">{{ $t('editions.ticketing.no_validation_yet') }}</p>
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

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
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
</script>
