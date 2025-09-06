<template>
  <div class="space-y-6">
    <!-- Boutons d'actions (uniquement pour les utilisateurs connectés) -->
    <div
      v-if="authStore.isAuthenticated"
      class="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
    >
      <!-- Bouton pour proposer un covoiturage -->
      <UButton
        :label="$t('components.carpool.propose_carpool')"
        icon="i-heroicons-plus"
        color="primary"
        size="lg"
        class="w-full sm:w-auto"
        @click="showOfferModal = true"
      />

      <!-- Bouton pour demander un covoiturage -->
      <UButton
        :label="$t('components.carpool.request_carpool')"
        icon="i-heroicons-magnifying-glass"
        color="primary"
        variant="soft"
        size="lg"
        class="w-full sm:w-auto"
        @click="showRequestModal = true"
      />
    </div>

    <!-- Modal pour proposer un covoiturage -->
    <UModal
      v-model:open="showOfferModal"
      :title="$t('carpool.offer.create')"
      :description="$t('carpool.offer.create_description')"
    >
      <template #body>
        <CarpoolOfferForm
          :edition-id="String(editionId)"
          @success="onOfferCreated"
          @cancel="showOfferModal = false"
        />
      </template>
    </UModal>

    <!-- Modal pour demander un covoiturage -->
    <UModal
      v-model:open="showRequestModal"
      :title="$t('carpool.request.create')"
      :description="$t('carpool.request.create_description')"
    >
      <template #body>
        <CarpoolRequestForm
          :edition-id="String(editionId)"
          @success="onRequestCreated"
          @cancel="showRequestModal = false"
        />
      </template>
    </UModal>

    <!-- Modal pour éditer une offre de covoiturage -->
    <UModal
      v-model:open="showEditOfferModal"
      :title="$t('components.carpool.edit_offer')"
      :description="$t('carpool.offer.edit_description')"
    >
      <template #body>
        <CarpoolOfferForm
          v-if="editingOffer"
          :edition-id="String(editionId)"
          :initial-data="editingOffer"
          :is-editing="true"
          @success="onOfferUpdated"
          @cancel="showEditOfferModal = false"
        />
      </template>
    </UModal>

    <!-- Modal pour éditer une demande de covoiturage -->
    <UModal
      v-model:open="showEditRequestModal"
      :title="$t('components.carpool.edit_request')"
      :description="$t('carpool.request.edit_description')"
    >
      <template #body>
        <CarpoolRequestForm
          v-if="editingRequest"
          :edition-id="String(editionId)"
          :initial-data="editingRequest"
          :is-editing="true"
          @success="onRequestUpdated"
          @cancel="showEditRequestModal = false"
        />
      </template>
    </UModal>

    <!-- Onglets pour afficher les listes -->
    <UTabs :items="tabs" default-value="offers" variant="link">
      <template #offers>
        <div class="space-y-4">
          <!-- Liste des offres -->
          <div v-if="offers.length > 0" class="space-y-4">
            <CarpoolOfferCard
              v-for="offer in offers"
              :key="offer.id"
              :offer="offer"
              :highlighted="props.highlightOfferId === offer.id"
              @comment-added="refreshOffers"
              @passenger-added="refreshOffers"
              @edit="editOffer(offer)"
              @deleted="refreshOffers"
            />
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            <UIcon name="i-heroicons-truck" class="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p class="text-lg font-medium">{{ $t('components.carpool.no_offers') }}</p>
            <p class="text-sm">{{ $t('components.carpool.be_first_to_offer') }}</p>
          </div>
        </div>
      </template>

      <template #requests>
        <div class="space-y-4">
          <!-- Liste des demandes -->
          <div v-if="requests.length > 0" class="space-y-4">
            <CarpoolRequestCard
              v-for="request in requests"
              :key="request.id"
              :request="request"
              @comment-added="refreshRequests"
              @edit="editRequest(request)"
              @deleted="refreshRequests"
            />
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            <UIcon
              name="i-heroicons-magnifying-glass"
              class="mx-auto h-12 w-12 text-gray-300 mb-4"
            />
            <p class="text-lg font-medium">{{ $t('components.carpool.no_requests') }}</p>
            <p class="text-sm">{{ $t('components.carpool.no_requests_published') }}</p>
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

import CarpoolOfferCard from './CarpoolOfferCard.vue'
import CarpoolOfferForm from './CarpoolOfferForm.vue'
import CarpoolRequestCard from './CarpoolRequestCard.vue'
import CarpoolRequestForm from './CarpoolRequestForm.vue'

interface Props {
  editionId: number
  highlightOfferId?: number | null
}

const props = defineProps<Props>()
const authStore = useAuthStore()

// Détection de la taille d'écran
const isSmallScreen = ref(false)

// États des modals
const showOfferModal = ref(false)
const showRequestModal = ref(false)
const showEditOfferModal = ref(false)
const showEditRequestModal = ref(false)

// États pour l'édition
const editingOffer = ref(null)
const editingRequest = ref(null)

const { t } = useI18n()

const tabs = computed(() => [
  {
    value: 'offers',
    label: `${isSmallScreen.value ? t('components.carpool.offers_short') : t('components.carpool.offers_long')} (${offers.value.length})`,
    icon: 'i-heroicons-truck',
    slot: 'offers',
  },
  {
    value: 'requests',
    label: `${isSmallScreen.value ? t('components.carpool.requests_short') : t('components.carpool.requests_long')} (${requests.value.length})`,
    icon: 'i-heroicons-magnifying-glass',
    slot: 'requests',
  },
])

// Charger les offres de covoiturage
const { data: carpoolOffers, refresh: refreshOffers } = await useFetch(
  `/api/editions/${props.editionId}/carpool-offers`
)

// Charger les demandes de covoiturage
const { data: carpoolRequests, refresh: refreshRequests } = await useFetch(
  `/api/editions/${props.editionId}/carpool-requests`
)

// Computed pour s'assurer que les données sont des tableaux
const offers = computed(() => (Array.isArray(carpoolOffers.value) ? carpoolOffers.value : []))
const requests = computed(() => (Array.isArray(carpoolRequests.value) ? carpoolRequests.value : []))

// Fonction pour vérifier la taille d'écran
const checkScreenSize = () => {
  if (import.meta.client) {
    isSmallScreen.value = window.innerWidth < 640
  }
}

// Initialiser et écouter les changements de taille
onMounted(() => {
  checkScreenSize()
  if (import.meta.client) {
    window.addEventListener('resize', checkScreenSize)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', checkScreenSize)
  }
})

const onOfferCreated = () => {
  console.log('onOfferCreated appelé')
  refreshOffers()
  // Fermer la modal après succès
  showOfferModal.value = false
  console.log('Modal fermée:', showOfferModal.value)
}

const onRequestCreated = () => {
  console.log('onRequestCreated appelé')
  refreshRequests()
  // Fermer la modal après succès
  showRequestModal.value = false
  console.log('Modal fermée:', showRequestModal.value)
}

// Fonctions pour l'édition
const editOffer = (offer) => {
  editingOffer.value = offer
  showEditOfferModal.value = true
}

const editRequest = (request) => {
  editingRequest.value = request
  showEditRequestModal.value = true
}

const onOfferUpdated = () => {
  refreshOffers()
  showEditOfferModal.value = false
  editingOffer.value = null
}

const onRequestUpdated = () => {
  refreshRequests()
  showEditRequestModal.value = false
  editingRequest.value = null
}
</script>
