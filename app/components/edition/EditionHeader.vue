<template>
  <div class="mb-6">
    <!-- En-tête avec le nom de l'édition -->
    <div class="mb-4">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="flex items-start gap-4">
          <div v-if="edition.convention?.logo" class="flex-shrink-0">
            <img :src="normalizeImageUrl(edition.convention.logo)" :alt="edition.convention.name" class="w-16 h-16 object-cover rounded-lg shadow-md" >
          </div>
          <div v-else class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shadow-md">
            <UIcon name="i-heroicons-building-library" class="text-gray-400" size="24" />
          </div>
          <div class="flex-1">
            <div class="flex items-start justify-between sm:block">
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold">{{ getEditionDisplayName(edition) }}</h1>
                <div class="flex flex-col sm:flex-row sm:items-center sm:gap-4 mt-2 text-gray-500 text-sm sm:text-base">
                  <span>{{ edition.city }}, {{ edition.country }}</span>
                  <span class="hidden sm:inline">•</span>
                  <span>{{ formatDateRange(edition.startDate, edition.endDate) }}</span>
                </div>
              </div>
              
              <!-- Bouton favori mobile -->
              <UButton
                v-if="authStore.isAuthenticated"
                :icon="isFavorited ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                :color="isFavorited ? 'warning' : 'neutral'"
                variant="ghost"
                size="sm"
                class="sm:hidden flex-shrink-0"
                @click="$emit('toggle-favorite')"
              />
            </div>
          </div>
        </div>
        
        <!-- Bouton favori desktop -->
        <UButton
          v-if="authStore.isAuthenticated"
          :icon="isFavorited ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
          :color="isFavorited ? 'warning' : 'neutral'"
          variant="ghost"
          size="lg"
          class="hidden sm:flex"
          @click="$emit('toggle-favorite')"
        >
          {{ isFavorited ? 'Favoris' : 'Ajouter' }}
        </UButton>
      </div>
    </div>

    <!-- Navigation par onglets -->
    <div class="border-b border-gray-200">
      <nav class="flex justify-center sm:justify-start space-x-2 sm:space-x-8" aria-label="Tabs">
        <NuxtLink 
          :to="`/editions/${edition.id}`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'details' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
          :title="'Détails'"
        >
          <UIcon name="i-heroicons-information-circle" :class="['sm:mr-1']" size="24" class="sm:!w-4 sm:!h-4" />
          <span class="hidden sm:inline">Détails</span>
        </NuxtLink>
        
        <NuxtLink 
          :to="`/editions/${edition.id}/commentaires`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'commentaires' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
          :title="'Commentaires'"
        >
          <UIcon name="i-heroicons-chat-bubble-left-right" :class="['sm:mr-1']" size="24" class="sm:!w-4 sm:!h-4" />
          <span class="hidden sm:inline">Commentaires</span>
        </NuxtLink>
        
        <NuxtLink 
          :to="`/editions/${edition.id}/covoiturage`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'covoiturage' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
          :title="'Covoiturage'"
        >
          <UIcon name="i-heroicons-truck" :class="['sm:mr-1']" size="24" class="sm:!w-4 sm:!h-4" />
          <span class="hidden sm:inline">Covoiturage</span>
        </NuxtLink>
        
        <NuxtLink 
          v-if="canAccess"
          :to="`/editions/${edition.id}/gestion`"
          :class="[
            'py-3 px-3 sm:py-2 sm:px-1 border-b-2 font-medium text-sm flex items-center',
            currentPage === 'gestion' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
          :title="'Gestion'"
        >
          <UIcon name="i-heroicons-cog" :class="['sm:mr-1']" size="24" class="sm:!w-4 sm:!h-4" />
          <span class="hidden sm:inline">Gestion</span>
        </NuxtLink>
      </nav>
      
      <!-- Titre de la page courante sur mobile -->
      <div class="sm:hidden text-center py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ getPageTitle(currentPage) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Edition } from '~/types';
import { useAuthStore } from '~/stores/auth';
import { useEditionStore } from '~/stores/editions';
import { getEditionDisplayName } from '~/utils/editionName';

const { normalizeImageUrl } = useImageUrl();

interface Props {
  edition: Edition;
  currentPage: 'details' | 'commentaires' | 'covoiturage' | 'gestion';
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

// Obtenir le titre de la page selon la page courante
const getPageTitle = (page: string) => {
  const titles = {
    'details': 'Détails',
    'commentaires': 'Commentaires',
    'covoiturage': 'Covoiturage',
    'gestion': 'Gestion'
  };
  return titles[page] || 'Détails';
};
</script>