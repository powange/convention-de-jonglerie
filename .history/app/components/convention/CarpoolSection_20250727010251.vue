<template>
  <div class="space-y-6">
    <!-- Boutons d'actions -->
    <div class="flex gap-4 justify-center">
      
    <!-- Modal pour proposer un covoiturage -->
    <UModal v-model:open="showOfferModal" title="Proposer un covoiturage">
      <!-- Bouton pour proposer un covoiturage -->
      <UButton
        label="Proposer un covoiturage"
        icon="i-heroicons-plus"
        color="primary"
        size="lg"
      />
      <template #description></template>
      <template #body>
        <CarpoolOfferForm
          :convention-id="conventionId"
          @success="onOfferCreated"
        />
      </template>
    </UModal>
      
    <!-- Modal pour demander un covoiturage -->
    <UModal v-model:open="showRequestModal" title="Demander un covoiturage">
      <!-- Bouton pour demander un covoiturage -->
      <UButton
        label="Demander un covoiturage"
        icon="i-heroicons-magnifying-glass"
        color="primary"
        variant="soft"
        size="lg"
      />
      <template #description></template>
      <template #body>
        <CarpoolRequestForm
          :convention-id="conventionId"
          @success="onRequestCreated"
        />z
      </template>
    </UModal>
    </div>

    <!-- Onglets pour afficher les listes -->
    <UTabs :items="tabs" default-value="offers">
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

// États des modals
const showOfferModal = ref(false);
const showRequestModal = ref(false);

const tabs = computed(() => [
  {
    key: 'offers',
    label: `Offres de covoiturage (${offers.value.length})`,
    icon: 'i-heroicons-truck',
    slot: 'offers',
  },
  {
    key: 'requests',
    label: `Demandes de covoiturage (${requests.value.length})`,
    icon: 'i-heroicons-magnifying-glass',
    slot: 'requests',
  },
]);

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
  console.log('onOfferCreated appelé');
  refreshOffers();
  // Fermer la modal après succès
  showOfferModal.value = false;
  console.log('Modal fermée:', showOfferModal.value);
};

const onRequestCreated = () => {
  console.log('onRequestCreated appelé');
  refreshRequests();
  // Fermer la modal après succès
  showRequestModal.value = false;
  console.log('Modal fermée:', showRequestModal.value);
};
</script>