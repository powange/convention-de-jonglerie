<template>
  <div class="mb-6">
    <!-- En-tête avec le nom de la convention -->
    <div class="mb-4">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-bold">{{ convention.name }}</h1>
          <div class="flex items-center gap-4 mt-2 text-gray-500">
            <span>{{ convention.city }}, {{ convention.country }}</span>
            <span>•</span>
            <span>{{ formatDateRange(convention.startDate, convention.endDate) }}</span>
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
          :to="`/editions/${convention.id}`"
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
          :to="`/editions/${convention.id}/covoiturage`"
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
          :to="`/editions/${convention.id}/gestion`"
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

interface Props {
  convention: any;
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
  if (!props.convention || !authStore.user?.id) return false;
  const canEdit = editionStore.canEditEdition(props.convention, authStore.user.id);
  return canEdit || authStore.user?.id === props.convention?.creatorId;
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