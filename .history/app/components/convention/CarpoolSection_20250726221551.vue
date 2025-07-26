<template>
  <div class="space-y-6">
    <!-- Boutons d'actions -->
    <div class="flex gap-4 justify-center">
      
    <!-- Modal pour proposer un covoiturage -->
    <UModal v-model="showOfferModal" title="Proposer un covoiturage">
      <!-- Bouton pour proposer un covoiturage -->
      <UButton
        label="Proposer un covoiturage"
        icon="i-heroicons-plus"
        color="primary"
        size="lg"
        @click="showOfferModal = true"
      />
      <template #body>
        <CarpoolOfferForm
          :convention-id="conventionId"
          @success="onOfferCreated"
        />
      </template>
    </UModal>
      
    <!-- Modal pour demander un covoiturage -->
    <UModal v-model="showRequestModal" title="Demander un covoiturage">
      <!-- Bouton pour demander un covoiturage -->
      <UButton
        label="Demander un covoiturage"
        icon="i-heroicons-magnifying-glass"
        color="primary"
        variant="soft"
        size="lg"
        @click="showRequestModal = true"
      />
      <template #body>
        <CarpoolRequestForm
          :convention-id="conventionId"
          @success="onRequestCreated"
        />
      </template>
    </UModal>
    </div>

    <!-- Onglets pour afficher les listes -->
    <UTabs :items="tabs" v-model="selectedTab">
      <template #offers>
        <div class="space-y-4">
          <!-- Liste des offres -->
          <div v-if="offers.length > 0" class="space-y-4">
            <CarpoolOfferCard
              v-for="offer in offers"
              :key="offer.id"
              :offer="offer"
              @comment-added="refreshOffers"
            />
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            <UIcon name="i-heroicons-truck" class="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p class="text-lg font-medium">Aucune offre de covoiturage</p>
            <p class="text-sm">Soyez le premier à proposer un covoiturage pour cette convention !</p>
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
            />
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            <UIcon name="i-heroicons-magnifying-glass" class="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p class="text-lg font-medium">Aucune demande de covoiturage</p>
            <p class="text-sm">Aucune demande n'a été publiée pour le moment.</p>
          </div>
        </div>
      </template>
    </UTabs>
    
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import CarpoolOfferCard from './CarpoolOfferCard.vue';
import CarpoolRequestCard from './CarpoolRequestCard.vue';
import CarpoolOfferForm from './CarpoolOfferForm.vue';
import CarpoolRequestForm from './CarpoolRequestForm.vue';

interface Props {
  conventionId: number;
}

const props = defineProps<Props>();
const authStore = useAuthStore();

const selectedTab = ref(0);

// États des modals
const showOfferModal = ref(false);
const showRequestModal = ref(false);

const tabs = [
  {
    key: 'offers',
    label: 'Offres de covoiturage',
    icon: 'i-heroicons-truck',
  },
  {
    key: 'requests',
    label: 'Demandes de covoiturage',
    icon: 'i-heroicons-magnifying-glass',
  },
];

// Charger les offres de covoiturage
const { data: carpoolOffers, refresh: refreshOffers } = await useFetch(
  `/api/conventions/${props.conventionId}/carpool-offers`
);

// Charger les demandes de covoiturage
const { data: carpoolRequests, refresh: refreshRequests } = await useFetch(
  `/api/conventions/${props.conventionId}/carpool-requests`
);

// Computed pour s'assurer que les données sont des tableaux
const offers = computed(() => Array.isArray(carpoolOffers.value) ? carpoolOffers.value : []);
const requests = computed(() => Array.isArray(carpoolRequests.value) ? carpoolRequests.value : []);

const onOfferCreated = () => {
  refreshOffers();
  // Fermer la modal après succès
  showOfferModal.value = false;
};

const onRequestCreated = () => {
  refreshRequests();
  // Fermer la modal après succès
  showRequestModal.value = false;
};
</script>