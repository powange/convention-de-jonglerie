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
      <!-- Liste des quotas existants.
           En lecture seule : le titre et la quantité s'y consultent, et se modifient dans la
           fenêtre d'édition. Les champs de saisie en ligne écrasaient le nom du quota sur un
           écran étroit, et le sélecteur numérique, contrôlé par la liste, revenait à l'ancienne
           valeur dès qu'on cliquait sur ses flèches. -->
      <div
        v-for="(quota, index) in sortedQuotas"
        :key="quota.id"
        class="flex flex-col gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors sm:flex-row sm:items-center"
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
        <!-- Première ligne : ce qu'il faut lire -->
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <div
            class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
            :title="$t('ticketing.quotas.list.drag_tooltip')"
          >
            <UIcon name="i-heroicons-bars-3" class="h-5 w-5" />
          </div>

          <span
            class="text-sm font-medium text-gray-500 dark:text-gray-400 w-6 text-center shrink-0"
          >
            {{ index + 1 }}
          </span>

          <span class="font-medium truncate" :title="quota.title">{{ quota.title }}</span>

          <UBadge color="neutral" variant="subtle" class="shrink-0">
            {{ quota.quantity }}
          </UBadge>
        </div>

        <!-- Seconde ligne sous sm : les actions -->
        <div class="flex items-center gap-2 sm:shrink-0 pl-7 sm:pl-0">
          <UButton
            icon="i-heroicons-pencil"
            color="neutral"
            variant="outline"
            :title="$t('ticketing.quotas.list.edit_button')"
            @click="ouvrirEdition(quota)"
          />
          <UButton
            icon="i-heroicons-trash"
            color="error"
            :title="$t('ticketing.quotas.list.delete_button')"
            @click="confirmDeleteQuota(quota)"
          />
        </div>
      </div>

      <!-- Ligne d'ajout -->
      <div
        class="flex flex-col gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 sm:flex-row sm:items-center"
      >
        <UInput
          v-model="form.title"
          class="flex-1 min-w-0"
          :placeholder="$t('ticketing.quotas.list.name_placeholder')"
          @keydown.enter="handleSave"
        />
        <div class="flex items-center gap-2 sm:shrink-0">
          <UInputNumber v-model="form.quantity" :min="1" class="w-32" @keydown.enter="handleSave" />
          <UButton
            icon="i-heroicons-plus"
            color="primary"
            :loading="saving"
            :title="$t('common.add')"
            @click="handleSave"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Fenêtre d'édition : titre, quantité et description se règlent ici, et l'enregistrement est
       explicite — l'ancienne saisie en ligne enregistrait à la perte de focus, sans que rien ne
       dise ce qui était parti. -->
  <UModal v-model:open="editionOuverte" :title="$t('ticketing.quotas.list.edit_title')">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="$t('ticketing.quotas.list.name_label')" required>
          <UInput
            v-model="editionForm.title"
            class="w-full"
            :placeholder="$t('ticketing.quotas.list.name_placeholder')"
          />
        </UFormField>

        <UFormField :label="$t('ticketing.quotas.list.quantity_label')" required>
          <UInputNumber v-model="editionForm.quantity" :min="1" class="w-40" />
        </UFormField>

        <UFormField :label="$t('ticketing.quotas.list.description_label')">
          <UTextarea
            v-model="editionForm.description"
            class="w-full"
            :rows="3"
            :placeholder="$t('ticketing.quotas.list.description_placeholder')"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="outline" @click="editionOuverte = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="primary" @click="enregistrerEdition">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>

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

/**
 * Édition d'un quota dans une fenêtre dédiée.
 *
 * Le formulaire travaille sur une copie : tant que l'enregistrement n'est pas demandé, la liste
 * ne bouge pas. C'est ce qui manquait à la saisie en ligne — elle envoyait à chaque perte de
 * focus, et le sélecteur numérique, dont la valeur venait de la liste, revenait à l'ancien
 * nombre dès qu'on cliquait sur ses flèches.
 */
const editionOuverte = ref(false)
const quotaEnEdition = ref<Quota | null>(null)
const editionForm = ref({ title: '', quantity: 1, description: '' })

const ouvrirEdition = (quota: Quota) => {
  quotaEnEdition.value = quota
  editionForm.value = {
    title: quota.title,
    quantity: quota.quantity,
    description: quota.description || '',
  }
  editionOuverte.value = true
}

const enregistrerEdition = () => {
  const quota = quotaEnEdition.value
  if (!quota) return

  const saisie = editionForm.value
  // updateQuota porte déjà la validation et signale l'erreur par un message. On refait le même
  // constat ici pour une seule raison : laisser la fenêtre ouverte quand la saisie est refusée,
  // sans quoi la correction serait impossible.
  const valide = saisie.title.trim() !== '' && saisie.quantity >= 1

  updateQuota(quota.id, {
    title: saisie.title,
    quantity: saisie.quantity,
    description: saisie.description.trim() || null,
  })

  if (valide) editionOuverte.value = false
}

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
