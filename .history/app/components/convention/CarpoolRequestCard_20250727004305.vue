<template>
  <UCard>
    <div class="space-y-4">
      <!-- En-tête avec les infos utilisateur -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <UAvatar 
            :src="getUserAvatar(request.user.email, 40)" 
            :alt="request.user.pseudo" 
            size="md"
          />
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
        <div v-if="request.phoneNumber" class="flex items-center gap-2">
          <UIcon name="i-heroicons-phone" class="text-gray-400" />
          <span class="font-medium">Contact :</span>
          <span>{{ request.phoneNumber }}</span>
        </div>
      </div>

      <!-- Description -->
      <p v-if="request.description" class="text-sm text-gray-600">{{ request.description }}</p>

      <!-- Bouton de contact -->
      <div v-if="authStore.isLoggedIn && request.phoneNumber" class="pt-2">
        <UButton
          size="sm"
          variant="soft"
          icon="i-heroicons-chat-bubble-left-right"
          :href="`tel:${request.phoneNumber}`"
        >
          Contacter {{ request.user.pseudo }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useGravatar } from '~/utils/gravatar';

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
}

interface Props {
  request: CarpoolRequest;
}

const props = defineProps<Props>();
const authStore = useAuthStore();
const { getUserAvatar } = useGravatar();

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