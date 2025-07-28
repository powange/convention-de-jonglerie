<template>
  <div class="mb-6">
    <!-- En-tête avec le nom de l'édition -->
    <div class="mb-4">
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-4">
          <div v-if="edition.convention?.logo" class="flex-shrink-0">
            <img :src="edition.convention.logo" :alt="edition.convention.name" class="w-16 h-16 object-cover rounded-lg shadow-md" >
          </div>
          <div v-else class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shadow-md">
            <UIcon name="i-heroicons-building-library" class="text-gray-400" size="24" />
          </div>
          <div>
            <h1 class="text-3xl font-bold">{{ getEditionDisplayName(edition) }}</h1>
            <div class="flex items-center gap-4 mt-2 text-gray-500">
              <span>{{ edition.city }}, {{ edition.country }}</span>
              <span>•</span>
              <span>{{ formatDateRange(edition.startDate, edition.endDate) }}</span>
            </div>
          </div>
        </div>
        
        <!-- Bouton favori -->
        <UButton
          v-if="authStore.isAuthenticated"
          :icon="isFavorited ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
          :color="isFavorited ? 'warning' : 'neutral'"
          variant="ghost"
          size="lg"
          @click="$emit('toggle-favorite')"
        >
          {{ isFavorited ? 'Favoris' : 'Ajouter' }}
        </UButton>
      </div>
    </div>

    <!-- Navigation par onglets -->
    <div class="border-b border-gray-200">
      <nav class="flex space-x-8" aria-label="Tabs">
        <NuxtLink 
          :to="`/editions/${edition.id}`"
          :class="[
            'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
            currentPage === 'details' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <UIcon name="i-heroicons-information-circle" class="mr-1" />
          Détails
        </NuxtLink>
        
        <NuxtLink 
          v-if="authStore.isAuthenticated"
          :to="`/editions/${edition.id}/covoiturage`"
          :class="[
            'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
            currentPage === 'covoiturage' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <UIcon name="i-heroicons-truck" class="mr-1" />
          Covoiturage
        </NuxtLink>
        
        <NuxtLink 
          v-if="canAccess"
          :to="`/editions/${edition.id}/gestion`"
          :class="[
            'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
            currentPage === 'gestion' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <UIcon name="i-heroicons-cog" class="mr-1" />
          Gestion
        </NuxtLink>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useEditionStore } from '~/stores/editions';
import { getEditionDisplayName } from '~/utils/editionName';

interface Props {
  edition: any;
  currentPage: 'details' | 'covoiturage' | 'gestion';
  isFavorited?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'toggle-favorite': [];
}>();
const authStore = useAuthStore();
const editionStore = useEditionStore();

// Vérifier l'accès à la page gestion
const canAccess = computed(() => {
  if (!props.edition || !authStore.user?.id) return false;
  const canEdit = editionStore.canEditEdition(props.edition, authStore.user.id);
  return canEdit || authStore.user?.id === props.edition?.creatorId;
});

// Formatter la plage de dates
const formatDateRange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  
  if (startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString('fr-FR', options);
  }
  
  return `${startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString('fr-FR', options)}`;
};
</script>