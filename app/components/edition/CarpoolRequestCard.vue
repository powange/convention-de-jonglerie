<template>
  <UCard>
    <div class="space-y-4">
      <!-- En-tête avec les infos utilisateur -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <img 
            :src="getUserAvatar(request.user, 20)" 
            :alt="`Avatar de ${request.user.pseudo}`"
            class="w-10 h-10 rounded-full"
          >
          <div>
            <p class="font-semibold">{{ request.user.pseudo }}</p>
            <p class="text-sm text-gray-500">
              Demandé le {{ new Date(request.createdAt).toLocaleDateString() }}
            </p>
          </div>
        </div>
        <div class="text-right">
          <UBadge color="orange" variant="soft" class="mb-2">
            {{ request.seatsNeeded }} place{{ request.seatsNeeded > 1 ? 's' : '' }} recherchée{{ request.seatsNeeded > 1 ? 's' : '' }}
          </UBadge>
          <div class="text-sm">
            <div class="flex items-center gap-1 justify-end mb-1">
              <UIcon name="i-heroicons-calendar" class="text-gray-400 w-4 h-4" />
              <span class="font-medium">{{ formatDate(request.departureDate) }}</span>
            </div>
            <div class="flex items-center gap-1 justify-end">
              <UIcon name="i-heroicons-map-pin" class="text-gray-400 w-4 h-4" />
              <span class="font-medium">{{ request.departureCity }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Détails de la demande -->
      <div class="space-y-2">
        <div v-if="authStore.isAuthenticated && request.phoneNumber" class="flex items-center gap-2">
          <UIcon name="i-heroicons-phone" class="text-gray-400" />
          <span class="font-medium">Contact :</span>
          <span>{{ request.phoneNumber }}</span>
        </div>
      </div>

      <!-- Description -->
      <p v-if="request.description" class="text-sm text-gray-600">{{ request.description }}</p>

      <!-- Bouton de contact -->
      <div v-if="authStore.isAuthenticated && request.phoneNumber" class="pt-2">
        <UButton
          size="sm"
          variant="soft"
          icon="i-heroicons-chat-bubble-left-right"
          :href="`tel:${request.phoneNumber}`"
        >
          Contacter {{ request.user.pseudo }}
        </UButton>
      </div>

      <!-- Section commentaires -->
      <div class="pt-4">
        <div class="flex items-center justify-between">
          <!-- Modal des commentaires -->
          <CarpoolCommentsModal
            :id="request.id"
            type="request"
            @comment-added="emit('comment-added')"
          />
        </div>
      </div>

    </div>
  </UCard>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useAvatar } from '~/utils/avatar';
import CarpoolCommentsModal from './CarpoolCommentsModal.vue';

interface CarpoolRequest {
  id: number;
  departureDate: string;
  departureCity: string;
  seatsNeeded: number;
  description?: string;
  phoneNumber?: string;
  createdAt: string;
  user: {
    id: number;
    pseudo: string;
    email: string;
  };
  comments?: Array<{
    id: number;
    content: string;
    createdAt: string;
    user: {
      id: number;
      pseudo: string;
      emailHash: string;
      profilePicture?: string | null;
      updatedAt?: string;
    };
  }>;
}

interface Props {
  request: CarpoolRequest;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'comment-added': [];
}>();

const authStore = useAuthStore();
const { getUserAvatar } = useAvatar();

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>