<template>
  <UButton
    v-if="action"
    :icon="action.icon"
    :color="action.color"
    :loading="loading"
    size="xs"
    variant="soft"
    @click.stop="trigger"
  >
    {{ action.label }}
  </UButton>
</template>

<script setup lang="ts">
type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'

const props = defineProps<{
  editionId: number
  reservationId: number
  status: StockReservationStatus
  /** Si false, le bouton n'est pas rendu. */
  canEdit: boolean
}>()

const emit = defineEmits<{
  updated: []
}>()

const { t } = useI18n()
const loading = ref(false)

type Action = {
  nextStatus: StockReservationStatus
  label: string
  icon: string
  color: 'primary' | 'success' | 'neutral'
}

const action = computed<Action | null>(() => {
  if (!props.canEdit) return null
  if (props.status === 'RESERVED') {
    return {
      nextStatus: 'PICKED_UP',
      label: t('gestion.stock.mark_picked_up'),
      icon: 'i-heroicons-arrow-up-on-square',
      color: 'primary',
    }
  }
  if (props.status === 'PICKED_UP') {
    return {
      nextStatus: 'RETURNED',
      label: t('gestion.stock.mark_returned'),
      icon: 'i-heroicons-arrow-down-on-square',
      color: 'success',
    }
  }
  return null
})

async function trigger() {
  if (!action.value || loading.value) return
  loading.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/stock-reservations/${props.reservationId}`, {
      method: 'PUT',
      body: { status: action.value.nextStatus },
    })
    useToast().add({
      title: t('common.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    emit('updated')
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>
