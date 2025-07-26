<template>
  <div class="space-y-6">
    <!-- Boutons d'actions -->
    <div class="flex gap-4 justify-center">
      <!-- Modal pour proposer un covoiturage -->
      <UModal close-icon="i-heroicons-x-mark">
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          size="lg"
        >
          Proposer un covoiturage
        </UButton>
        
        <template #content>
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold">Proposer un covoiturage</h3>
            </template>
            
            <CarpoolOfferForm
              :convention-id="conventionId"
              @success="onOfferCreated"
            />
          </UCard>
        </template>
      </UModal>
      
      <!-- Modal pour demander un covoiturage -->
      <UModal close-icon="i-heroicons-x-mark">
        <UButton
          icon="i-heroicons-magnifying-glass"
          color="blue"
          variant="soft"
          size="lg"
        >
          Demander un covoiturage
        </UButton>
        
        <template #content>
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold">Rechercher un covoiturage</h3>
            </template>
            
            <CarpoolRequestForm
              :convention-id="conventionId"
              @success="onRequestCreated"
            />
          </UCard>
        </template>
      </UModal>
    </div>

    <!-- Onglets pour afficher les listes -->
    <UTabs :items="tabs" v-model="selectedTab">
      <template #offers>
        <div class="space-y-4">
          <!-- Liste des offres -->
          <div v-if="carpoolOffers.length > 0" class="space-y-4">
            <CarpoolOfferCard
              v-for="offer in carpoolOffers"
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
          <div v-if="carpoolRequests.length > 0" class="space-y-4">
            <CarpoolRequestCard
              v-for="request in carpoolRequests"
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

const onOfferCreated = () => {
  refreshOffers();
};

const onRequestCreated = () => {
  refreshRequests();
};
</script>