<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <UIcon name="i-heroicons-clipboard-document-list" />
      <span class="font-medium">{{ $t('components.carpool.pending_bookings') }}</span>
    </div>
    <div v-if="bookings.length === 0" class="text-sm text-gray-500">
      {{ $t('components.carpool.no_pending_bookings') }}
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="b in bookings"
        :key="b.id"
        class="flex items-center justify-between border rounded p-2"
      >
        <div class="flex items-center gap-2">
          <UiUserAvatar :user="b.requester" size="xs" />
          <div>
            <div class="font-medium">{{ b.requester.pseudo }}</div>
            <div class="text-xs text-gray-500">
              {{ $t('components.carpool.requested_seats', { count: b.seats }) }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            v-if="b.status !== 'PENDING'"
            :color="
              b.status === 'ACCEPTED' ? 'success' : b.status === 'REJECTED' ? 'error' : 'neutral'
            "
            >{{ b.status }}</UBadge
          >
          <template v-else>
            <UButton
              size="xs"
              color="success"
              variant="soft"
              :loading="isUpdating(b.id)"
              @click="update(b.id, 'ACCEPT')"
              >{{ $t('components.carpool.accept') }}</UButton
            >
            <UButton
              size="xs"
              color="error"
              variant="soft"
              :loading="isUpdating(b.id)"
              @click="update(b.id, 'REJECT')"
              >{{ $t('components.carpool.reject') }}</UButton
            >
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  offerId: number
}
const props = defineProps<Props>()
const emit = defineEmits<{ updated: [] }>()

const bookings = ref<any[]>([])

const load = async () => {
  const data = await $fetch(`/api/carpool-offers/${props.offerId}/bookings`)
  bookings.value = data || []
}

onMounted(load)
watch(() => props.offerId, load)

const pendingAction = ref<'ACCEPT' | 'REJECT' | 'CANCEL'>('ACCEPT')

const { execute: executeUpdate, isLoading: isUpdating } = useApiActionById(
  (bookingId) => `/api/carpool-offers/${props.offerId}/bookings/${bookingId}`,
  {
    method: 'PUT',
    body: () => ({ action: pendingAction.value }),
    silentSuccess: true,
    onSuccess: async () => {
      await load()
      emit('updated')
    },
  }
)

const update = (bookingId: number, action: 'ACCEPT' | 'REJECT' | 'CANCEL') => {
  pendingAction.value = action
  executeUpdate(bookingId)
}
</script>
