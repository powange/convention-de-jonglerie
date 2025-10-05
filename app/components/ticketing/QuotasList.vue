<template>
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">Chargement...</p>
  </div>

  <div v-else class="space-y-4">
    <!-- Message d'information -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="soft"
      title="Gestion des quotas"
      description="Définissez ici les quotas pour limiter l'accès à certaines prestations (spectacles, activités, entrées, etc.)"
    />

    <div class="space-y-2">
      <!-- Liste des quotas existants -->
      <div
        v-for="quota in quotas"
        :key="quota.id"
        class="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <UFieldGroup>
          <UInput
            :model-value="quota.title"
            placeholder="Titre du quota"
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
              <UFormField label="description">
                <textarea
                  v-model="quota.description"
                  placeholder="Description (optionnel)"
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
          <UInput v-model="form.title" placeholder="Nouveau quota..." @keydown.enter="handleSave" />
          <UInputNumber
            v-model="form.quantity"
            :min="1"
            :ui="{ base: 'w-32' }"
            @keydown.enter="handleSave"
          />
          <UModal>
            <UButton icon="i-heroicons-pencil" color="neutral" variant="outline" />
            <template #body>
              <UFormField label="description">
                <textarea
                  v-model="form.description"
                  placeholder="Description (optionnel)"
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
    title="Supprimer le quota"
    :description="`Êtes-vous sûr de vouloir supprimer le quota '${quotaToDelete?.title}' ?`"
    confirm-label="Supprimer"
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

const saving = ref(false)
const deleteConfirmOpen = ref(false)
const quotaToDelete = ref<Quota | null>(null)
const deleting = ref(false)

const form = ref<QuotaForm>({
  title: '',
  description: '',
  quantity: 1,
})

const confirmDeleteQuota = (quota: Quota) => {
  quotaToDelete.value = quota
  deleteConfirmOpen.value = true
}

const deleteQuota = async () => {
  if (!quotaToDelete.value) return

  const toast = useToast()
  deleting.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/ticketing/quotas/${quotaToDelete.value.id}`, {
      method: 'DELETE',
    })

    toast.add({
      title: 'Quota supprimé',
      description: 'Le quota a été supprimé avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    deleteConfirmOpen.value = false
    quotaToDelete.value = null
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to delete quota:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de supprimer le quota',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

const updateQuota = async (
  quotaId: number,
  updates: Partial<{ title: string; description: string | null; quantity: number }>
) => {
  const toast = useToast()

  console.log(updates)

  try {
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
        title: 'Erreur',
        description: 'Le titre est obligatoire',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
      return
    }

    if (data.quantity < 1) {
      toast.add({
        title: 'Erreur',
        description: 'La quantité doit être au moins 1',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
      return
    }

    await $fetch(`/api/editions/${props.editionId}/ticketing/quotas/${quotaId}`, {
      method: 'PUT',
      body: data,
    })

    emit('refresh')
  } catch (error: any) {
    console.error('Failed to update quota:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de mettre à jour le quota',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const handleSave = async () => {
  const toast = useToast()

  if (!form.value.title.trim()) {
    toast.add({
      title: 'Erreur',
      description: 'Le titre est obligatoire',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  if (form.value.quantity < 1) {
    toast.add({
      title: 'Erreur',
      description: 'La quantité doit être au moins 1',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  saving.value = true
  try {
    const data = {
      title: form.value.title.trim(),
      description: form.value.description.trim() || null,
      quantity: form.value.quantity,
    }

    await $fetch(`/api/editions/${props.editionId}/ticketing/quotas`, {
      method: 'POST',
      body: data,
    })

    toast.add({
      title: 'Quota créé',
      description: 'Le quota a été créé avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Réinitialiser le formulaire
    form.value = {
      title: '',
      description: '',
      quantity: 1,
    }

    emit('refresh')
  } catch (error: any) {
    console.error('Failed to save quota:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible d'enregistrer le quota",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
