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
              <img :src="convention.imageUrl" :alt="convention.name" class="w-48 h-48 object-cover rounded-lg shadow-lg" />
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
              {{ convention.addressLine1 }}<span v-if="convention.addressLine2">, {{ convention.addressLine2 }}</span>, {{ convention.postalCode }} {{ convention.city }}<span v-if="convention.region">, {{ convention.region }}</span>, {{ convention.country }}
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
          <div class="space-y-2">
            <h3 class="text-lg font-semibold">Services proposés</h3>
            <div class="flex flex-wrap gap-2">
              <UBadge v-if="convention.hasFastfood" color="orange" variant="soft">
                <UIcon name="i-heroicons-building-storefront" class="mr-1" />
                Restauration
              </UBadge>
              <UBadge v-if="convention.hasKidsZone" color="pink" variant="soft">
                <UIcon name="i-heroicons-face-smile" class="mr-1" />
                Zone enfants
              </UBadge>
              <UBadge v-if="convention.acceptsPets" color="red" variant="soft">
                <UIcon name="i-heroicons-heart" class="mr-1" />
                Animaux acceptés
              </UBadge>
              <UBadge v-if="convention.hasTentCamping" color="green" variant="soft">
                <UIcon name="i-heroicons-home" class="mr-1" />
                Camping tente
              </UBadge>
              <UBadge v-if="convention.hasTruckCamping" color="blue" variant="soft">
                <UIcon name="i-heroicons-truck" class="mr-1" />
                Camping camion
              </UBadge>
              <UBadge v-if="convention.hasGym" color="purple" variant="soft">
                <UIcon name="i-heroicons-trophy" class="mr-1" />
                Salle de sport
              </UBadge>
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

const conventionId = parseInt(route.params.id as string);
const convention = ref(null);

onMounted(async () => {
  try {
    convention.value = await conventionStore.fetchConventionById(conventionId);
  } catch (error) {
    console.error('Failed to fetch convention:', error);
  }
});

const isFavorited = computed(() => (conventionId: number) => {
  return convention.value?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await conventionStore.toggleFavorite(id);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'green' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'red' });
  }
};
</script>