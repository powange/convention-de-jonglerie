<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Mes Favoris</h1>
      <UButton 
        icon="i-heroicons-magnifying-glass" 
        size="md" 
        color="primary" 
        variant="outline" 
        label="Découvrir des conventions" 
        to="/"
      />
    </div>

    <div v-if="loading" class="text-center py-8">
      <p>Chargement de vos favoris...</p>
    </div>

    <div v-else-if="favoriteConventions.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-star" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">Aucun favori</h3>
      <p class="text-gray-500 mb-4">Vous n'avez pas encore ajouté de convention à vos favoris.</p>
      <UButton 
        icon="i-heroicons-magnifying-glass" 
        color="primary" 
        variant="solid" 
        label="Découvrir des conventions"
        to="/"
      />
    </div>

    <div v-else>
      <p class="text-gray-600 mb-4">{{ favoriteConventions.length }} convention{{ favoriteConventions.length > 1 ? 's' : '' }} en favoris</p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard v-for="convention in favoriteConventions" :key="convention.id">
          <template #header>
            <div class="flex items-center gap-3">
              <div v-if="convention.imageUrl" class="flex-shrink-0">
                <img :src="convention.imageUrl" :alt="convention.name" class="w-16 h-16 object-cover rounded-lg" >
              </div>
              <div v-else class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                <UIcon name="i-heroicons-photo" class="text-gray-400" size="24" />
              </div>
              <div class="flex-1">
                <h2 class="text-xl font-semibold">{{ convention.name }}</h2>
                <UBadge :color="getStatusColor(convention)" variant="subtle" class="mt-1">
                  {{ getStatusText(convention) }}
                </UBadge>
              </div>
            </div>
          </template>
          
          <p class="text-sm text-gray-500 mb-2">Du: {{ new Date(convention.startDate).toLocaleDateString() }} au {{ new Date(convention.endDate).toLocaleDateString() }}</p>
          <p class="text-sm text-gray-500 flex items-center gap-1 mb-2">
            <UIcon name="i-heroicons-map-pin" class="text-gray-400" size="16" />
            {{ convention.city }}, {{ convention.country }}
          </p>
          <p class="text-sm text-gray-500 flex items-center gap-1 mb-2">
            <UIcon name="i-heroicons-user" class="text-gray-400" size="16" />
            Créé par {{ convention.creator?.pseudo || 'Utilisateur inconnu' }}
          </p>
          
          <!-- Services avec pictos -->
          <div class="flex flex-wrap gap-1 mt-2">
            <UIcon v-if="convention.hasFoodTrucks" name="i-mdi:food-outline" class="text-orange-500" size="20" title="Food trucks" />
            <UIcon v-if="convention.hasKidsZone" name="i-heroicons-face-smile" class="text-pink-500" size="20" title="Zone enfants" />
            <UIcon v-if="convention.acceptsPets" name="i-material-symbols:pets" class="text-amber-600" size="20" title="Animaux acceptés" />
            <UIcon v-if="convention.hasTentCamping" name="i-material-symbols:camping-outline" class="text-green-600" size="20" title="Camping tente" />
            <UIcon v-if="convention.hasTruckCamping" name="i-heroicons-truck" class="text-blue-500" size="20" title="Camping camion" />
            <UIcon v-if="convention.hasFamilyCamping" name="i-heroicons-users" class="text-indigo-500" size="20" title="Camping famille" />
            <UIcon v-if="convention.hasGym" name="i-heroicons-trophy" class="text-purple-500" size="20" title="Gymnase" />
            <UIcon v-if="convention.hasFireSpace" name="i-heroicons-fire" class="text-red-600" size="20" title="Fire space" />
            <UIcon v-if="convention.hasGala" name="i-heroicons-sparkles" class="text-yellow-500" size="20" title="Gala" />
            <UIcon v-if="convention.hasOpenStage" name="i-heroicons-microphone" class="text-cyan-500" size="20" title="Scène ouverte" />
            <UIcon v-if="convention.hasConcert" name="i-heroicons-musical-note" class="text-violet-500" size="20" title="Concert" />
            <UIcon v-if="convention.hasCantine" name="i-heroicons-cake" class="text-amber-500" size="20" title="Cantine" />
            <UIcon v-if="convention.hasAerialSpace" name="i-heroicons-cloud" class="text-sky-500" size="20" title="Espace aérien" />
            <UIcon v-if="convention.hasSlacklineSpace" name="i-heroicons-minus" class="text-teal-500" size="20" title="Espace slackline" />
            <UIcon v-if="convention.hasToilets" name="i-guidance:wc" class="text-gray-600" size="20" title="WC" />
            <UIcon v-if="convention.hasShowers" name="i-material-symbols-light:shower-outline" class="text-blue-400" size="20" title="Douches" />
            <UIcon v-if="convention.hasAccessibility" name="i-bx:handicap" class="text-blue-600" size="20" title="Accessibilité handicapé" />
            <UIcon v-if="convention.hasWorkshops" name="i-heroicons-academic-cap" class="text-slate-600" size="20" title="Workshops" />
          </div>

          <template #footer>
            <div class="flex justify-between items-center">
              <UButton
                icon="i-heroicons-star-solid"
                color="warning"
                variant="ghost"
                title="Retirer des favoris"
                @click="removeFavorite(convention.id)"
              />
              <div class="flex space-x-2">
                <UButton
                  icon="i-heroicons-eye"
                  size="sm"
                  color="info"
                  variant="solid"
                  label="Voir"
                  :to="`/conventions/${convention.id}`"
                />
                <UButton
                  v-if="conventionStore.canEditConvention(convention, authStore.user?.id || 0)"
                  icon="i-heroicons-pencil"
                  size="sm"
                  color="warning"
                  variant="solid"
                  label="Modifier"
                  :to="`/conventions/${convention.id}/edit`"
                />
              </div>
            </div>
          </template>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useConventionStore } from '~/stores/conventions';
import type { Convention } from '~/types';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const authStore = useAuthStore();
const conventionStore = useConventionStore();
const toast = useToast();

const loading = ref(true);

// Calculer les conventions favorites de l'utilisateur
const favoriteConventions = computed(() => {
  return conventionStore.conventions.filter(
    convention => convention.favoritedBy.some(user => user.id === authStore.user?.id)
  );
});

// Déterminer le statut d'une convention
const getStatusColor = (convention: Convention) => {
  const now = new Date();
  const startDate = new Date(convention.startDate);
  const endDate = new Date(convention.endDate);
  
  if (now < startDate) return 'info';  // À venir
  if (now > endDate) return 'neutral';  // Passée
  return 'success';  // En cours
};

const getStatusText = (convention: Convention) => {
  const now = new Date();
  const startDate = new Date(convention.startDate);
  const endDate = new Date(convention.endDate);
  
  if (now < startDate) return 'À venir';
  if (now > endDate) return 'Terminée';
  return 'En cours';
};

const removeFavorite = async (id: number) => {
  try {
    await conventionStore.toggleFavorite(id);
    toast.add({ 
      title: 'Retiré des favoris', 
      icon: 'i-heroicons-star', 
      color: 'warning' 
    });
  } catch (_e: unknown) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de retirer des favoris',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  }
};

onMounted(async () => {
  try {
    await conventionStore.fetchConventions();
  } catch (_error) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de charger les conventions',
      icon: 'i-heroicons-exclamation-triangle', 
      color: 'error' 
    });
  } finally {
    loading.value = false;
  }
});
</script>