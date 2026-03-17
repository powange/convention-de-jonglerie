<template>
  <NuxtLink :to="`/editions/${editionId}/carpool/requests/${request.id}`" class="block">
    <UCard class="hover:shadow-md transition-shadow cursor-pointer">
      <div class="space-y-4">
        <!-- En-tête avec les infos utilisateur -->
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <UiUserDisplay :user="request.user" :datetime="request.createdAt" size="lg" />
          </div>

          <!-- Boutons d'action pour le créateur -->
          <div v-if="canEdit" class="flex gap-1">
            <UButton
              icon="i-heroicons-pencil"
              size="xs"
              color="warning"
              variant="ghost"
              :title="$t('components.carpool.edit_request')"
              @click.stop="emit('edit')"
            />
            <UButton
              icon="i-heroicons-trash"
              size="xs"
              color="error"
              variant="ghost"
              :title="$t('components.carpool.delete_request')"
              @click.stop="handleDelete"
            />
          </div>
          <div class="text-right">
            <UBadge color="warning" variant="soft" class="mb-2">
              {{ $t('components.carpool.seats_needed', { count: request.seatsNeeded }) }}
            </UBadge>
            <div class="text-sm">
              <div class="flex items-center gap-1 justify-end mb-1">
                <UIcon name="i-heroicons-calendar" class="text-gray-400 w-4 h-4" />
                <span class="font-medium">{{ formatTripDate(request.tripDate) }}</span>
              </div>
              <div class="flex items-center gap-1 justify-end mb-1">
                <UIcon name="i-heroicons-map-pin" class="text-gray-400 w-4 h-4" />
                <span class="font-medium">{{ request.locationCity }}</span>
              </div>
              <div class="flex items-center gap-1 justify-end">
                <UIcon
                  :name="
                    request.direction === 'TO_EVENT'
                      ? 'i-heroicons-arrow-right'
                      : 'i-heroicons-arrow-left'
                  "
                  class="text-gray-400 w-4 h-4"
                />
                <span class="text-sm font-medium">{{
                  request.direction === 'TO_EVENT'
                    ? $t('carpool.direction.to_event')
                    : $t('carpool.direction.from_event')
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Description -->
        <p v-if="request.description" class="text-sm text-gray-600">{{ request.description }}</p>

        <!-- Section commentaires -->
        <div class="pt-4">
          <div class="flex items-center justify-between">
            <!-- Modal des commentaires -->
            <EditionCarpoolCommentsModal
              :id="request.id"
              type="request"
              @comment-added="emit('comment-added')"
            />
          </div>
        </div>
      </div>
    </UCard>
  </NuxtLink>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { CarpoolRequest } from '~/types/carpool'
import { formatDate } from '~/utils/date'

interface Props {
  request: CarpoolRequest
  editionId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'comment-added': []
  edit: []
  deleted: []
}>()

const authStore = useAuthStore()
const { t } = useI18n()

// Vérifier si l'utilisateur peut éditer cette demande
const canEdit = computed(() => {
  return authStore.user && authStore.user.id === props.request.user.id
})

// Utilise la fonction importée formatDate
const formatTripDate = (date: string) => {
  const { locale } = useI18n()
  return formatDate(date, { locale: locale.value, includeTime: true, format: 'long' })
}

const { execute: executeDeleteRequest } = useApiAction(
  () => `/api/carpool-requests/${props.request.id}`,
  {
    method: 'DELETE',
    successMessage: {
      title: t('messages.request_deleted'),
      description: t('messages.request_deleted_successfully'),
    },
    errorMessages: { default: t('errors.deletion_error') },
    onSuccess: () => emit('deleted'),
  }
)

const handleDelete = () => {
  if (!confirm(t('components.carpool.confirm_delete_request'))) return
  executeDeleteRequest()
}
</script>
