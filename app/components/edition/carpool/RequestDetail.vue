<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <UCard>
      <div class="space-y-4">
        <!-- Utilisateur + actions -->
        <div class="flex items-start justify-between">
          <UiUserDisplay :user="request.user" :datetime="request.createdAt" size="lg" />
          <div v-if="canEdit" class="flex gap-1">
            <UButton
              icon="i-heroicons-pencil"
              size="sm"
              color="warning"
              variant="ghost"
              :title="$t('components.carpool.edit_request')"
              @click="emit('edit')"
            />
            <UButton
              icon="i-heroicons-trash"
              size="sm"
              color="error"
              variant="ghost"
              :title="$t('components.carpool.delete_request')"
              @click="handleDelete"
            />
          </div>
        </div>

        <!-- Infos du trajet -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-calendar" class="text-gray-400 size-5" />
            <div>
              <p class="text-xs text-gray-500">{{ $t('components.carpool.trip_date') }}</p>
              <p class="font-medium">{{ formatTripDate(request.tripDate) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-map-pin" class="text-gray-400 size-5" />
            <div>
              <p class="text-xs text-gray-500">{{ $t('components.carpool.location') }}</p>
              <p class="font-medium">{{ request.locationCity }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UIcon
              :name="
                request.direction === 'TO_EVENT'
                  ? 'i-heroicons-arrow-right'
                  : 'i-heroicons-arrow-left'
              "
              class="text-gray-400 size-5"
            />
            <div>
              <p class="text-xs text-gray-500">{{ $t('components.carpool.direction') }}</p>
              <p class="font-medium">
                {{
                  request.direction === 'TO_EVENT'
                    ? $t('carpool.direction.to_event')
                    : $t('carpool.direction.from_event')
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Places et contact -->
        <div class="flex flex-wrap items-center gap-3">
          <UBadge color="warning" variant="soft" size="md">
            {{ $t('components.carpool.seats_needed', { count: request.seatsNeeded }) }}
          </UBadge>
        </div>

        <!-- Description -->
        <p v-if="request.description" class="text-gray-600 dark:text-gray-400">
          {{ request.description }}
        </p>

        <!-- Contact : bouton révéler ou numéro affiché -->
        <div v-if="request.hasPhoneNumber && authStore.isAuthenticated && !canEdit">
          <div v-if="phoneRevealed && request.phoneNumber" class="flex items-center gap-2">
            <UIcon name="i-heroicons-phone" class="text-gray-400" />
            <span>{{ request.phoneNumber }}</span>
            <UButton
              size="sm"
              variant="soft"
              icon="i-heroicons-chat-bubble-left-right"
              :href="`tel:${request.phoneNumber}`"
            >
              {{ $t('components.carpool.contact_user', { name: request.user.pseudo }) }}
            </UButton>
          </div>
          <UButton
            v-else
            size="sm"
            variant="soft"
            icon="i-heroicons-phone"
            @click="phoneRevealed = true"
          >
            {{ $t('components.carpool.reveal_contact') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Commentaires -->
    <UCard>
      <EditionCarpoolCommentsInline
        :id="request.id"
        type="request"
        @comment-added="emit('comment-added')"
      />
    </UCard>
  </div>
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

const canEdit = computed(() => authStore.user?.id === props.request.user?.id)
const phoneRevealed = ref(false)

const formatTripDate = (date: string) => {
  const { locale } = useI18n()
  return formatDate(date, { locale: locale.value, includeTime: true, format: 'long' })
}

const { execute: executeDeleteRequest } = useApiAction(
  () => `/api/carpool-requests/${props.request.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('messages.request_deleted') },
    errorMessages: { default: t('errors.deletion_error') },
    onSuccess: () => {
      emit('deleted')
      router.push(`/editions/${props.editionId}/carpool`)
    },
  }
)

const handleDelete = () => {
  if (!confirm(t('components.carpool.confirm_delete_request'))) return
  executeDeleteRequest()
}
</script>
