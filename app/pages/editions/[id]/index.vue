<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
      <UCard variant="subtle">
        
        <template #header>
          <!-- Affiche de l'édition et description -->
          <div class="flex flex-col sm:flex-row gap-6">
            <div v-if="edition.imageUrl" class="flex-shrink-0 self-center sm:self-start">
              <img 
                :src="normalizeImageUrl(edition.imageUrl)" 
                :alt="t('editions.poster_of', { name: getEditionDisplayName(edition) })" 
                class="w-full sm:w-48 h-auto sm:h-48 max-w-xs object-cover rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity" 
                @click="showImageOverlay = true"
              >
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold mb-2">{{ $t('editions.about_this_edition') }}</h3>
              <p class="text-gray-700 dark:text-gray-300">{{ edition.description || t('editions.no_description_available') }}</p>
            </div>
          </div>
        </template>
        

        <div class="space-y-6">
          <!-- Informations pratiques -->
          <div class="space-y-3">
            <h3 class="text-lg font-semibold">{{ $t('editions.practical_info') }}</h3>
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
              {{ formatDateTimeRange(edition.startDate, edition.endDate) }}
            </p>
            
            <!-- Collaborateurs -->
            <div v-if="getAllCollaborators(edition).length > 0" class="pt-2">
              <div class="flex items-center gap-2 mb-2">
                <UIcon name="i-heroicons-users" class="text-gray-400" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('editions.organizing_team') }}</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="collaborator in getAllCollaborators(edition)"
                  :key="collaborator.id"
                  class="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-full text-sm"
                  :title="getCollaboratorTitle(collaborator)"
                >
                  <UserAvatar
                    :user="collaborator.user"
                    size="xs"
                  />
                  <span class="text-gray-700 dark:text-gray-300">{{ collaborator.pseudo }}</span>
                  <UBadge
                    v-if="collaborator.isCreator"
                    size="xs"
                    color="primary"
                    variant="soft"
                  >
                    {{ $t('editions.creator') }}
                  </UBadge>
                  <UBadge
                    v-else-if="collaborator.role === 'ADMINISTRATOR'"
                    size="xs"
                    color="warning"
                    variant="soft"
                  >
                    {{ $t('editions.admin') }}
                  </UBadge>
                  <UBadge
                    v-else-if="collaborator.role === 'MODERATOR'"
                    size="xs"
                    color="info"
                    variant="soft"
                  >
                    {{ $t('editions.moderator') }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>

          <!-- Liens externes -->
          <div v-if="edition.ticketingUrl || edition.facebookUrl || edition.instagramUrl" class="space-y-2">
            <h3 class="text-lg font-semibold">{{ $t('editions.useful_links') }}</h3>
            <div class="flex gap-2">
              <UButton v-if="edition.ticketingUrl" icon="i-heroicons-ticket" :to="edition.ticketingUrl" target="_blank" size="sm">{{ $t('editions.ticketing') }}</UButton>
              <UButton v-if="edition.facebookUrl" icon="i-simple-icons-facebook" :to="edition.facebookUrl" target="_blank" size="sm" color="info">Facebook</UButton>
              <UButton v-if="edition.instagramUrl" icon="i-simple-icons-instagram" :to="edition.instagramUrl" target="_blank" size="sm" color="error">Instagram</UButton>
            </div>
          </div>

          <!-- Services -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">{{ $t('editions.services_offered') }}</h3>
            <div v-if="getActiveServicesByCategory(edition).length === 0" class="text-gray-500 text-sm">
              {{ $t('editions.no_services') }}
            </div>
            <div v-else class="space-y-4">
              <div v-for="category in getActiveServicesByCategory(edition)" :key="category.category" class="space-y-3">
                <h4 class="text-lg font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
                  {{ category.label }}
                </h4>
                <div class="flex flex-wrap gap-3">
                  <UBadge 
                    v-for="service in category.services" 
                    :key="service.key"
                    color="neutral" 
                    variant="soft"
                    size="xl"
                    class="px-4 py-3"
                  >
                    <UIcon :name="service.icon" :class="service.color" size="24" class="mr-2" />
                    <span class="text-base font-medium">{{ service.label }}</span>
                  </UBadge>
                </div>
              </div>
            </div>
          </div>

        </div>
      </UCard>
    </div>
    
    <!-- Overlay pour l'affiche en grand -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-300"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div 
          v-if="showImageOverlay && edition?.imageUrl" 
          class="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          @click="showImageOverlay = false"
        >
          <div class="relative max-w-6xl max-h-[90vh]">
            <img 
              :src="normalizeImageUrl(edition.imageUrl)" 
              :alt="t('editions.poster_of', { name: getEditionDisplayName(edition) })" 
              class="max-w-full max-h-[90vh] object-contain rounded-lg"
              @click.stop
            >
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              size="lg"
              class="absolute top-4 right-4"
              @click="showImageOverlay = false"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import type { Edition } from '~/types';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import { useTranslatedConventionServices } from '~/composables/useConventionServices';
import UserAvatar from '~/components/ui/UserAvatar.vue';

const { formatDateTimeRange } = useDateFormat();
import EditionHeader from '~/components/edition/EditionHeader.vue';
import { getEditionDisplayName } from '~/utils/editionName';

const route = useRoute();
const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();
const { t } = useI18n();
const { getTranslatedServicesByCategory } = useTranslatedConventionServices();

const editionId = parseInt(route.params.id as string);
const edition = computed(() => editionStore.getEditionById(editionId));
const showImageOverlay = ref(false);
const { normalizeImageUrl } = useImageUrl();

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId);
    } catch (error) {
      console.error('Failed to fetch edition:', error);
    }
  }
});

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    toast.add({ title: t('messages.favorite_status_updated'), icon: 'i-heroicons-check-circle', color: 'green' });
  } catch (e: unknown) {
    const errorMessage = (e && typeof e === 'object' && 'statusMessage' in e && typeof e.statusMessage === 'string') 
                        ? e.statusMessage 
                        : t('errors.favorite_update_failed');
    toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'red' });
  }
};

const getGoogleMapsUrl = (edition: Edition) => {
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

const getActiveServicesByCategory = (edition: Edition) => {
  if (!edition) return [];
  
  const servicesByCategory = getTranslatedServicesByCategory();
  return servicesByCategory.map(category => ({
    ...category,
    services: category.services.filter(service => edition[service.key])
  })).filter(category => category.services.length > 0);
};

// Obtenir tous les collaborateurs (créateur + collaborateurs de la convention)
const getAllCollaborators = (edition: Edition) => {
  if (!edition) return [];
  
  const collaborators = [];
  
  // Ajouter le créateur
  if (edition.creator) {
    const creator = {
      id: edition.creator.id,
      user: edition.creator, // Garder la référence complète
      pseudo: edition.creator.pseudo,
      isCreator: true,
      role: null
    };
    collaborators.push(creator);
  }
  
  // Ajouter les collaborateurs de la convention
  if (edition.convention?.collaborators) {
    edition.convention.collaborators.forEach(collab => {
      // Éviter les doublons si le créateur est aussi collaborateur
      if (!collaborators.some(c => c.id === collab.user.id)) {
        const collaborator = {
          id: collab.user.id,
          user: collab.user, // Garder la référence complète
          pseudo: collab.user.pseudo,
          isCreator: false,
          role: collab.role
        };
        collaborators.push(collaborator);
      }
    });
  }
  
  return collaborators;
};

// Obtenir le titre du collaborateur pour le tooltip
const getCollaboratorTitle = (collaborator: any) => {
  if (collaborator.isCreator) {
    return `${collaborator.pseudo} - ${t('editions.edition_creator')}`;
  }
  
  const roleNames = {
    'ADMINISTRATOR': t('editions.administrator'),
    'MODERATOR': t('editions.moderator')
  };
  
  const roleName = roleNames[collaborator.role] || t('editions.collaborator');
  return `${collaborator.pseudo} - ${roleName} ${t('editions.of_convention')}`;
};
</script>