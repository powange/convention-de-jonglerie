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
      <UCard variant="subtle">
        
        <template #header>
          <!-- Affiche de l'édition et description -->
          <div class="flex flex-col sm:flex-row gap-6">
            <div v-if="edition.imageUrl" class="flex-shrink-0 self-center sm:self-start">
              <img 
                :src="normalizeImageUrl(edition.imageUrl)" 
                :alt="`Affiche de ${getEditionDisplayName(edition)}`" 
                class="w-full sm:w-48 h-auto sm:h-48 max-w-xs object-cover rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity" 
                @click="showImageOverlay = true"
              >
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold mb-2">À propos de cette édition</h3>
              <p class="text-gray-700 dark:text-gray-300">{{ edition.description || 'Aucune description disponible' }}</p>
            </div>
          </div>
        </template>
        

        <div class="space-y-6">
          <!-- Informations pratiques -->
          <div class="space-y-3">
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
              {{ formatDateTimeRange(edition.startDate, edition.endDate) }}
            </p>
            
            <!-- Collaborateurs -->
            <div v-if="getAllCollaborators(edition).length > 0" class="pt-2">
              <div class="flex items-center gap-2 mb-2">
                <UIcon name="i-heroicons-users" class="text-gray-400" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Équipe organisatrice</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="collaborator in getAllCollaborators(edition)"
                  :key="collaborator.id"
                  class="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-full text-sm"
                  :title="getCollaboratorTitle(collaborator)"
                >
                  <img 
                    :src="getUserAvatar(collaborator, 16)" 
                    :alt="`Avatar de ${collaborator.pseudo}`"
                    class="w-4 h-4 rounded-full"
                  >
                  <span class="text-gray-700 dark:text-gray-300">{{ collaborator.pseudo }}</span>
                  <UBadge
                    v-if="collaborator.isCreator"
                    size="xs"
                    color="primary"
                    variant="soft"
                  >
                    Créateur
                  </UBadge>
                  <UBadge
                    v-else-if="collaborator.role === 'ADMINISTRATOR'"
                    size="xs"
                    color="orange"
                    variant="soft"
                  >
                    Admin
                  </UBadge>
                  <UBadge
                    v-else-if="collaborator.role === 'MODERATOR'"
                    size="xs"
                    color="blue"
                    variant="soft"
                  >
                    Modérateur
                  </UBadge>
                </div>
              </div>
            </div>
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
              :alt="`Affiche de ${getEditionDisplayName(edition)}`" 
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
import { useAvatar } from '~/utils/avatar';

const { formatDateTimeRange } = useDateFormat();
import EditionHeader from '~/components/edition/EditionHeader.vue';
import { getEditionDisplayName } from '~/utils/editionName';

const route = useRoute();
const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();
const { servicesByCategory } = useConventionServices();
const { getUserAvatar } = useAvatar();

const editionId = parseInt(route.params.id as string);
const edition = ref<Edition | null>(null);
const showImageOverlay = ref(false);
const { normalizeImageUrl } = useImageUrl();

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
    const errorMessage = (e && typeof e === 'object' && 'statusMessage' in e && typeof e.statusMessage === 'string') 
                        ? e.statusMessage 
                        : 'Échec de la mise à jour du statut de favori';
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
      pseudo: edition.creator.pseudo,
      email: edition.creator.email || '',
      profilePicture: edition.creator.profilePicture || null,
      updatedAt: edition.creator.updatedAt || new Date().toISOString(),
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
          pseudo: collab.user.pseudo,
          email: collab.user.email || '',
          profilePicture: collab.user.profilePicture || null,
          updatedAt: collab.user.updatedAt || new Date().toISOString(),
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
    return `${collaborator.pseudo} - Créateur de l'édition`;
  }
  
  const roleNames = {
    'ADMINISTRATOR': 'Administrateur',
    'MODERATOR': 'Modérateur'
  };
  
  const roleName = roleNames[collaborator.role] || 'Collaborateur';
  return `${collaborator.pseudo} - ${roleName} de la convention`;
};
</script>