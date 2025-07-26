<template>
  <UCard>
    <div class="space-y-4">
      <!-- En-tête avec les infos utilisateur -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <UAvatar 
            :src="getUserAvatar(offer.user.email, 40)" 
            :alt="offer.user.pseudo" 
            size="md"
          />
          <div>
            <p class="font-semibold">{{ offer.user.pseudo }}</p>
            <p class="text-sm text-gray-500">
              Proposé le {{ new Date(offer.createdAt).toLocaleDateString() }}
            </p>
          </div>
        </div>
        <div class="text-right">
          <UBadge color="primary" variant="soft" class="mb-2">
            {{ offer.availableSeats }} place{{ offer.availableSeats > 1 ? 's' : '' }}
          </UBadge>
          <div class="text-sm">
            <div class="flex items-center gap-1 justify-end mb-1">
              <UIcon name="i-heroicons-calendar" class="text-gray-400 w-4 h-4" />
              <span class="font-medium">{{ formatDate(offer.departureDate) }}</span>
            </div>
            <div class="flex items-center gap-1 justify-end">
              <UIcon name="i-heroicons-map-pin" class="text-gray-400 w-4 h-4" />
              <span class="font-medium">{{ offer.departureCity }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Détails du trajet -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-map" class="text-gray-400" />
          <span class="font-medium">Adresse :</span>
          <span>{{ offer.departureAddress }}</span>
        </div>

        <div v-if="offer.phoneNumber" class="flex items-center gap-2">
          <UIcon name="i-heroicons-phone" class="text-gray-400" />
          <span class="font-medium">Contact :</span>
          <span>{{ offer.phoneNumber }}</span>
        </div>
      </div>

      <!-- Description -->
      <div v-if="offer.description" class="pt-2 border-t">
        <p class="text-sm text-gray-600">{{ offer.description }}</p>
      </div>

      <!-- Section commentaires -->
      <div class="border-t pt-4">
        <div class="flex items-center justify-between">
          <UButton
            size="sm"
            variant="ghost"
            icon="i-heroicons-chat-bubble-left"
            @click="showCommentsModal = true"
          >
            Voir les commentaires ({{ offer.comments?.length || 0 }})
          </UButton>
        </div>
      </div>

      <!-- Modal des commentaires -->
      <CarpoolCommentsModal
        v-model:open="showCommentsModal"
        :offer-id="offer.id"
        @comment-added="emit('comment-added')"
      />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useGravatar } from '~/utils/gravatar';
import CarpoolCommentsModal from './CarpoolCommentsModal.vue';

interface CarpoolOffer {
  id: number;
  departureDate: string;
  departureCity: string;
  departureAddress: string;
  availableSeats: number;
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
      email: string;
    };
  }>;
}

interface Props {
  offer: CarpoolOffer;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'comment-added': [];
}>();

const authStore = useAuthStore();
const { getUserAvatar } = useGravatar();

const showCommentsModal = ref(false);

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