<template>
  <UCard v-if="tickets.length > 0">
    <div class="space-y-4">
      <!-- En-tête -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30"
          >
            <UIcon name="i-heroicons-ticket" class="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ tickets.length > 1 ? 'Mes billets' : 'Mon billet' }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ tickets.length }} billet{{ tickets.length > 1 ? 's' : '' }} pour cette édition
            </p>
          </div>
        </div>
      </div>

      <!-- Liste des billets -->
      <div class="space-y-3">
        <div
          v-for="ticket in tickets"
          :key="ticket.id"
          class="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200 dark:border-purple-800/30"
        >
          <div class="flex items-start justify-between gap-4">
            <!-- Informations du billet -->
            <div class="flex-1 min-w-0 space-y-2">
              <div>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ ticket.tierName }}
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ ticket.firstName }} {{ ticket.lastName }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-500">{{ ticket.email }}</p>
              </div>

              <!-- Statut de validation -->
              <div v-if="ticket.entryValidated" class="flex items-center gap-2">
                <UIcon
                  name="i-heroicons-check-circle-solid"
                  class="h-4 w-4 text-green-600 dark:text-green-400"
                />
                <span class="text-xs font-medium text-green-600 dark:text-green-400">
                  Entrée validée
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-col items-end gap-2">
              <!-- Logo HelloAsso -->
              <img
                v-if="ticket.isHelloAsso"
                src="~/assets/img/helloasso/logo.svg"
                alt="HelloAsso"
                class="h-4"
              />
              <!-- Bouton QR Code -->
              <UButton
                icon="i-heroicons-qr-code"
                color="primary"
                variant="soft"
                size="sm"
                @click="showQrCode(ticket)"
              >
                QR Code
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>

  <!-- Modal QR Code -->
  <UModal v-model:open="qrModalOpen" :title="'QR Code - ' + selectedTicket?.tierName">
    <template #body>
      <div v-if="selectedTicket" class="space-y-4">
        <!-- Instructions -->
        <div
          class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
        >
          <div class="flex items-start gap-3">
            <UIcon
              name="i-heroicons-information-circle"
              class="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5"
            />
            <div class="text-sm text-purple-700 dark:text-purple-300">
              <p class="font-medium mb-1">Comment utiliser ce QR code</p>
              <p>Présentez ce QR code à l'entrée pour valider votre billet.</p>
            </div>
          </div>
        </div>

        <!-- QR Code -->
        <div class="flex flex-col items-center justify-center p-6">
          <Qrcode :value="selectedTicket.qrCode" variant="default" />
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
            {{ selectedTicket.qrCode }}
          </p>
        </div>

        <!-- Informations du billet -->
        <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Détails du billet
          </h4>
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <UIcon name="i-heroicons-ticket" class="w-4 h-4" />
              <span>{{ selectedTicket.tierName }}</span>
            </div>
            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <UIcon name="i-heroicons-user" class="w-4 h-4" />
              <span>{{ selectedTicket.firstName }} {{ selectedTicket.lastName }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Ticket {
  id: number
  firstName: string
  lastName: string
  email: string
  qrCode: string
  tierName: string
  amount: number
  isHelloAsso: boolean
  entryValidated: boolean
  entryValidatedAt: Date | null
}

const props = defineProps<{
  editionId: number
}>()

const tickets = ref<Ticket[]>([])
const qrModalOpen = ref(false)
const selectedTicket = ref<Ticket | null>(null)

// Charger les billets de l'utilisateur
const loadTickets = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/my-tickets`)
    tickets.value = response.tickets
  } catch (error) {
    console.error('Erreur lors du chargement des billets:', error)
  }
}

const showQrCode = (ticket: Ticket) => {
  selectedTicket.value = ticket
  qrModalOpen.value = true
}

// Charger les billets au montage du composant
onMounted(() => {
  loadTickets()
})
</script>
