<template>
  <UCard>
    <div class="space-y-4">
      <!-- En-tête avec les infos utilisateur -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3 flex-1">
          <UserAvatar
            :user="request.user"
            size="lg"
          />
          <div>
            <p class="font-semibold">{{ request.user.pseudo }}</p>
            <p class="text-sm text-gray-500">
              {{ $t('components.carpool.requested_on', { date: new Date(request.createdAt).toLocaleDateString() }) }}
            </p>
          </div>
        </div>
        
        <!-- Boutons d'action pour le créateur -->
        <div v-if="canEdit" class="flex gap-1">
          <UButton
            icon="i-heroicons-pencil"
            size="xs"
            color="warning"
            variant="ghost"
            :title="$t('components.carpool.edit_request')"
            @click="emit('edit')"
          />
          <UButton
            icon="i-heroicons-trash"
            size="xs"
            color="error"
            variant="ghost"
            :title="$t('components.carpool.delete_request')"
            @click="handleDelete"
          />
        </div>
        <div class="text-right">
          <UBadge color="warning" variant="soft" class="mb-2">
            {{ $t('components.carpool.seats_needed', { count: request.seatsNeeded }) }}
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
          <span class="font-medium">{{ $t('components.carpool.contact') }} :</span>
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
          {{ $t('components.carpool.contact_user', { name: request.user.pseudo }) }}
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
import CarpoolCommentsModal from './CarpoolCommentsModal.vue';
import UserAvatar from '~/components/ui/UserAvatar.vue';

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
  'edit': [];
  'deleted': [];
}>();

const authStore = useAuthStore();
const toast = useToast();
const { t } = useI18n();

// Vérifier si l'utilisateur peut éditer cette demande
const canEdit = computed(() => {
  return authStore.user && authStore.user.id === props.request.user.id;
});

const formatDate = (date: string) => {
  const { locale } = useI18n();
  return new Date(date).toLocaleString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const handleDelete = async () => {
  if (!confirm(t('components.carpool.confirm_delete_request'))) {
    return;
  }

  try {
    await $fetch(`/api/carpool-requests/${props.request.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });

    toast.add({
      title: t('messages.request_deleted'),
      description: t('messages.request_deleted_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'green'
    });

    emit('deleted');
  } catch (error: unknown) {
    const httpError = error as { data?: { message?: string }; message?: string };
    toast.add({
      title: t('errors.deletion_error'),
      description: httpError.data?.message || httpError.message || t('errors.generic_error'),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    });
  }
};
</script>