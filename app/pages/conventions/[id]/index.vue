<template>
  <div>
    <div v-if="conventionStore.loading">
      <p>Chargement des détails de la convention...</p>
    </div>
    <div v-else-if="!convention">
      <p>Convention introuvable.</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <ConventionHeader 
        :convention="convention" 
        current-page="details" 
        :is-favorited="isFavorited(convention.id)"
        @toggle-favorite="toggleFavorite(convention.id)"
      />
      
      <!-- Contenu des détails -->
      <UCard>
        
        <template #header>
          <!-- Image et description -->
          <div class="flex gap-6">
            <div v-if="convention.imageUrl" class="flex-shrink-0">
              <img :src="convention.imageUrl" :alt="convention.name" class="w-48 h-48 object-cover rounded-lg shadow-lg" >
            </div>
            <div class="flex-1">
              <p class="">{{ convention.description || 'Aucune description disponible' }}</p>
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
                :href="getGoogleMapsUrl(convention)" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                {{ convention.addressLine1 }}<span v-if="convention.addressLine2">, {{ convention.addressLine2 }}</span>, {{ convention.postalCode }} {{ convention.city }}<span v-if="convention.region">, {{ convention.region }}</span>, {{ convention.country }}
              </a>
            </p>
            <p class="text-sm text-gray-600">
              <UIcon name="i-heroicons-calendar" class="inline mr-1" />
              Du {{ new Date(convention.startDate).toLocaleDateString() }} au {{ new Date(convention.endDate).toLocaleDateString() }}
            </p>
          </div>

          <!-- Liens externes -->
          <div v-if="convention.ticketingUrl || convention.facebookUrl || convention.instagramUrl" class="space-y-2">
            <h3 class="text-lg font-semibold">Liens utiles</h3>
            <div class="flex gap-2">
              <UButton v-if="convention.ticketingUrl" icon="i-heroicons-ticket" :to="convention.ticketingUrl" target="_blank" size="sm">Billetterie</UButton>
              <UButton v-if="convention.facebookUrl" icon="i-simple-icons-facebook" :to="convention.facebookUrl" target="_blank" size="sm" color="blue">Facebook</UButton>
              <UButton v-if="convention.instagramUrl" icon="i-simple-icons-instagram" :to="convention.instagramUrl" target="_blank" size="sm" color="pink">Instagram</UButton>
            </div>
          </div>

          <!-- Services -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Services proposés</h3>
            <div v-if="getActiveServicesByCategory(convention).length === 0" class="text-gray-500 text-sm">
              Aucun service spécifique renseigné
            </div>
            <div v-else class="space-y-4">
              <div v-for="category in getActiveServicesByCategory(convention)" :key="category.category" class="space-y-2">
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
import { useConventionStore } from '~/stores/conventions';
import { useAuthStore } from '~/stores/auth';
import ConventionHeader from '~/components/convention/ConventionHeader.vue';

const route = useRoute();
const conventionStore = useConventionStore();
const authStore = useAuthStore();
const toast = useToast();
const { servicesByCategory } = useConventionServices();

const conventionId = parseInt(route.params.id as string);
const convention = ref(null);

onMounted(async () => {
  try {
    convention.value = await conventionStore.fetchConventionById(conventionId);
  } catch (error) {
    console.error('Failed to fetch convention:', error);
  }
});

const isFavorited = computed(() => (_conventionId: number) => {
  return convention.value?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await conventionStore.toggleFavorite(id);
    // Recharger la convention pour mettre à jour l'état des favoris
    convention.value = await conventionStore.fetchConventionById(conventionId);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'green' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'red' });
  }
};

const getGoogleMapsUrl = (convention: any) => {
  const addressParts = [
    convention.addressLine1,
    convention.addressLine2,
    convention.postalCode,
    convention.city,
    convention.region,
    convention.country
  ].filter(Boolean);
  
  const fullAddress = addressParts.join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
};

const getActiveServicesByCategory = (convention: any) => {
  if (!convention) return [];
  
  return servicesByCategory.map(category => ({
    ...category,
    services: category.services.filter(service => convention[service.key])
  })).filter(category => category.services.length > 0);
};
</script>