<template>
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">{{ $t('ticketing.quotas.list.loading') }}</p>
  </div>

  <div v-else class="space-y-4">
    <!-- Message d'information -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="soft"
      :title="$t('ticketing.quotas.list.title')"
      :description="$t('ticketing.quotas.list.description')"
    />

    <div class="space-y-2">
      <!-- Liste des quotas existants -->
      <div
        v-for="(quota, index) in sortedQuotas"
        :key="quota.id"
        class="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        :class="[
          draggedQuotaId === quota.id && 'opacity-50',
          dragOverQuotaId === quota.id && 'border-primary-500 border-2',
        ]"
        draggable="true"
        @dragstart="handleDragStart(quota, $event)"
        @dragend="handleDragEnd"
        @dragover.prevent="handleDragOver(quota, $event)"
        @drop="handleDrop(quota, $event)"
      >
        <!-- Poignée de drag -->
        <div
          class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          :title="$t('ticketing.quotas.list.drag_tooltip')"
        >
          <UIcon name="i-heroicons-bars-3" class="h-5 w-5" />
        </div>

        <!-- Numéro de position -->
        <div class="flex-shrink-0 w-8 text-center">
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
            {{ index + 1 }}
          </span>
        </div>

        <UFieldGroup>
          <UInput
            :model-value="quota.title"
            :placeholder="$t('ticketing.quotas.list.name_placeholder')"
            @blur="updateQuota(quota.id, { title: $event.target.value })"
          />
          <UInputNumber
            :model-value="quota.quantity"
            :min="1"
            :ui="{ base: 'w-32' }"
            @update:model-value="updateQuota(quota.id, { quantity: $event })"
          />
          <UModal>
            <UButton icon="i-heroicons-pencil" color="neutral" variant="outline" />
            <template #body>
              <UFormField :label="$t('ticketing.quotas.list.description_label')">
                <textarea
                  v-model="quota.description"
                  :placeholder="$t('ticketing.quotas.list.description_placeholder')"
                  color="neutral"
                  variant="outline"
                  class="w-full"
                  @blur="updateQuota(quota.id, { description: $event.target.value || null })"
                />
              </UFormField>
            </template>
          </UModal>
          <UButton icon="i-heroicons-trash" color="error" @click="confirmDeleteQuota(quota)" />
        </UFieldGroup>
      </div>

      <!-- Ligne d'ajout -->
      <div class="flex items-center py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <UFieldGroup>
          <UInput
            v-model="form.title"
            :placeholder="$t('ticketing.quotas.list.name_placeholder')"
            @keydown.enter="handleSave"
          />
          <UInputNumber
            v-model="form.quantity"
            :min="1"
            :ui="{ base: 'w-32' }"
            @keydown.enter="handleSave"
          />
          <UModal>
            <UButton icon="i-heroicons-pencil" color="neutral" variant="outline" />
            <template #body>
              <UFormField :label="$t('ticketing.quotas.list.description_label')">
                <textarea
                  v-model="form.description"
                  :placeholder="$t('ticketing.quotas.list.description_placeholder')"
                  color="neutral"
                  variant="outline"
                  class="w-full"
                  @keydown.enter="handleSave"
                />
              </UFormField>
            </template>
          </UModal>
          <UButton icon="i-heroicons-plus" color="primary" :loading="saving" @click="handleSave" />
        </UFieldGroup>
      </div>
    </div>
  </div>

  <!-- Modal de confirmation de suppression de quota -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    :title="$t('ticketing.quotas.list.delete_title')"
    :description="$t('ticketing.quotas.list.delete_confirm', { name: quotaToDelete?.title })"
    :confirm-label="$t('ticketing.quotas.list.delete_button')"
    confirm-color="error"
    confirm-icon="i-heroicons-trash"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="deleting"
    @confirm="deleteQuota"
    @cancel="deleteConfirmOpen = false"
  />
</template>

<script setup lang="ts">
interface Quota {
  id: number
  title: string
  description: string | null
  quantity: number
}

interface QuotaForm {
  title: string
  description: string
  quantity: number
}

const props = defineProps<{
  quotas: Quota[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const toast = useToast()

const deleteConfirmOpen = ref(false)
const quotaToDelete = ref<Quota | null>(null)

// Drag and drop
const draggedQuotaId = ref<number | null>(null)
const dragOverQuotaId = ref<number | null>(null)
const sortedQuotas = ref<Quota[]>([])

const form = ref<QuotaForm>({
  title: '',
  description: '',
  quantity: 1,
})

// Initialiser sortedQuotas avec les props.quotas
watch(
  () => props.quotas,
  (newQuotas) => {
    sortedQuotas.value = [...newQuotas]
  },
  { immediate: true }
)

const confirmDeleteQuota = (quota: Quota) => {
  quotaToDelete.value = quota
  deleteConfirmOpen.value = true
}

// Action pour supprimer un quota
const { execute: executeDeleteQuota, loading: deleting } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/quotas/${quotaToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('ticketing.quotas.deleted') },
    errorMessages: { default: t('ticketing.quotas.error_deleting') },
    onSuccess: () => {
      deleteConfirmOpen.value = false
      quotaToDelete.value = null
      emit('refresh')
    },
  }
)

const deleteQuota = () => {
  if (!quotaToDelete.value) return
  executeDeleteQuota()
}

// Données temporaires pour la mise à jour d'un quota
const updatePayload = ref<{
  quotaId: number
  data: { title: string; description: string | null; quantity: number }
} | null>(null)

// Action pour mettre à jour un quota (silencieuse car modifications inline)
const { execute: executeUpdateQuota } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/quotas/${updatePayload.value?.quotaId}`,
  {
    method: 'PUT',
    body: () => updatePayload.value?.data,
    silentSuccess: true,
    errorMessages: { default: t('ticketing.quotas.error_updating') },
    refreshOnSuccess: () => emit('refresh'),
  }
)

const updateQuota = (
  quotaId: number,
  updates: Partial<{ title: string; description: string | null; quantity: number }>
) => {
  // Trouver le quota à mettre à jour
  const quota = props.quotas.find((q) => q.id === quotaId)
  if (!quota) return

  // Construire les données à envoyer
  const data = {
    title: updates.title !== undefined ? updates.title.trim() : quota.title,
    description: updates.description !== undefined ? updates.description : quota.description,
    quantity: updates.quantity !== undefined ? updates.quantity : quota.quantity,
  }

  // Validation
  if (!data.title) {
    toast.add({
      title: t('common.error'),
      description: t('ticketing.quotas.title_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  if (data.quantity < 1) {
    toast.add({
      title: t('common.error'),
      description: t('ticketing.quotas.quantity_min'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  // Stocker les données et exécuter
  updatePayload.value = { quotaId, data }
  executeUpdateQuota()
}

// Action pour créer un quota
const { execute: executeCreateQuota, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/quotas`,
  {
    method: 'POST',
    body: () => ({
      title: form.value.title.trim(),
      description: form.value.description.trim() || null,
      quantity: form.value.quantity,
    }),
    successMessage: { title: t('ticketing.quotas.created') },
    errorMessages: { default: t('ticketing.quotas.error_saving') },
    onSuccess: () => {
      form.value = { title: '', description: '', quantity: 1 }
      emit('refresh')
    },
  }
)

const handleSave = () => {
  if (!form.value.title.trim()) {
    toast.add({
      title: t('common.error'),
      description: t('ticketing.quotas.title_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  if (form.value.quantity < 1) {
    toast.add({
      title: t('common.error'),
      description: t('ticketing.quotas.quantity_min'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  executeCreateQuota()
}

const handleDragStart = (quota: Quota, event: DragEvent) => {
  draggedQuotaId.value = quota.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', '')
  }
}

const handleDragEnd = () => {
  draggedQuotaId.value = null
  dragOverQuotaId.value = null
}

const handleDragOver = (quota: Quota, _event: DragEvent) => {
  dragOverQuotaId.value = quota.id
}

const handleDrop = async (targetQuota: Quota, event: DragEvent) => {
  event.preventDefault()

  if (!draggedQuotaId.value || draggedQuotaId.value === targetQuota.id) {
    draggedQuotaId.value = null
    dragOverQuotaId.value = null
    return
  }

  const draggedIndex = sortedQuotas.value.findIndex((q) => q.id === draggedQuotaId.value)
  const targetIndex = sortedQuotas.value.findIndex((q) => q.id === targetQuota.id)

  if (draggedIndex === -1 || targetIndex === -1) {
    draggedQuotaId.value = null
    dragOverQuotaId.value = null
    return
  }

  // Réorganiser localement
  const newQuotas = [...sortedQuotas.value]
  const [draggedQuota] = newQuotas.splice(draggedIndex, 1)
  newQuotas.splice(targetIndex, 0, draggedQuota)
  sortedQuotas.value = newQuotas

  // Mettre à jour les positions en base de données
  await updateQuotasPositions(newQuotas)

  draggedQuotaId.value = null
  dragOverQuotaId.value = null
}

// Positions à envoyer pour le reorder
const reorderPositions = ref<{ id: number; position: number }[]>([])

// Action pour mettre à jour l'ordre des quotas
const { execute: executeReorder } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/quotas/reorder`,
  {
    method: 'PUT',
    body: () => ({ positions: reorderPositions.value }),
    successMessage: { title: t('ticketing.quotas.order_updated') },
    errorMessages: { default: t('ticketing.quotas.error_reordering') },
    refreshOnSuccess: () => emit('refresh'),
  }
)

const updateQuotasPositions = (quotas: Quota[]) => {
  reorderPositions.value = quotas.map((quota, index) => ({
    id: quota.id,
    position: index,
  }))
  executeReorder()
}
</script>
