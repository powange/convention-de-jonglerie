<template>
  <div>
    <div v-if="editionStore.loading">
      <p>Chargement des détails de l'édition...</p>
    </div>
    <div v-else-if="!edition">
      <p>Édition introuvable.</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader 
        :edition="edition" 
        current-page="details" 
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />
      
      <!-- Contenu des détails -->
      <UCard>
        
        <template #header>
          <!-- Affiche de l'édition et description -->
          <div class="flex gap-6">
            <div v-if="edition.imageUrl" class="flex-shrink-0">
              <img :src="edition.imageUrl" :alt="`Affiche de ${getEditionDisplayName(edition)}`" class="w-48 h-48 object-cover rounded-lg shadow-lg" >
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold mb-2">À propos de cette édition</h3>
              <p class="text-gray-700 dark:text-gray-300">{{ edition.description || 'Aucune description disponible' }}</p>
            </div>
          </div>
        </template>
        

        <div class="space-y-6">
          <!-- Informations pratiques -->
          <div class="space-y-2">
            <h3 class="text-lg font-semibold">Informations pratiques</h3>
            <p class="text-sm text-gray-600">
              <UIcon name="i-heroicons-map-pin" class="inline mr-1" />
              <a 
                :href="getGoogleMapsUrl(edition)" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                {{ edition.addressLine1 }}<span v-if="edition.addressLine2">, {{ edition.addressLine2 }}</span>, {{ edition.postalCode }} {{ edition.city }}<span v-if="edition.region">, {{ edition.region }}</span>, {{ edition.country }}
              </a>
            </p>
            <p class="text-sm text-gray-600">
              <UIcon name="i-heroicons-calendar" class="inline mr-1" />
              Du {{ new Date(edition.startDate).toLocaleDateString() }} au {{ new Date(edition.endDate).toLocaleDateString() }}
            </p>
          </div>

          <!-- Liens externes -->
          <div v-if="edition.ticketingUrl || edition.facebookUrl || edition.instagramUrl" class="space-y-2">
            <h3 class="text-lg font-semibold">Liens utiles</h3>
            <div class="flex gap-2">
              <UButton v-if="edition.ticketingUrl" icon="i-heroicons-ticket" :to="edition.ticketingUrl" target="_blank" size="sm">Billetterie</UButton>
              <UButton v-if="edition.facebookUrl" icon="i-simple-icons-facebook" :to="edition.facebookUrl" target="_blank" size="sm" color="blue">Facebook</UButton>
              <UButton v-if="edition.instagramUrl" icon="i-simple-icons-instagram" :to="edition.instagramUrl" target="_blank" size="sm" color="pink">Instagram</UButton>
            </div>
          </div>

          <!-- Services -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Services proposés</h3>
            <div v-if="getActiveServicesByCategory(edition).length === 0" class="text-gray-500 text-sm">
              Aucun service spécifique renseigné
            </div>
            <div v-else class="space-y-4">
              <div v-for="category in getActiveServicesByCategory(edition)" :key="category.category" class="space-y-2">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-1">
                  {{ category.label }}
                </h4>
                <div class="flex flex-wrap gap-2">
                  <UBadge 
                    v-for="service in category.services" 
                    :key="service.key"
                    color="neutral" 
                    variant="soft"
                  >
                    <UIcon :name="service.icon" :class="service.color" class="mr-1" />
                    {{ service.label }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>

        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import EditionHeader from '~/components/edition/EditionHeader.vue';
import { getEditionDisplayName } from '~/utils/editionName';

const route = useRoute();
const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();
const { servicesByCategory } = useConventionServices();

const editionId = parseInt(route.params.id as string);
const edition = ref(null);

onMounted(async () => {
  try {
    edition.value = await editionStore.fetchEditionById(editionId);
  } catch (error) {
    console.error('Failed to fetch edition:', error);
  }
});

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    // Recharger l'édition pour mettre à jour l'état des favoris
    edition.value = await editionStore.fetchEditionById(editionId);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'green' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'red' });
  }
};

const getGoogleMapsUrl = (edition: any) => {
  const addressParts = [
    edition.addressLine1,
    edition.addressLine2,
    edition.postalCode,
    edition.city,
    edition.region,
    edition.country
  ].filter(Boolean);
  
  const fullAddress = addressParts.join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
};

const getActiveServicesByCategory = (edition: any) => {
  if (!edition) return [];
  
  return servicesByCategory.map(category => ({
    ...category,
    services: category.services.filter(service => edition[service.key])
  })).filter(category => category.services.length > 0);
};
</script>