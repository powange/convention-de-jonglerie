<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <div v-else-if="!carpoolRequest">
      <EditionHeader :edition="edition" current-page="carpool" />
      <UAlert
        class="mt-6"
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('components.carpool.request_not_found')"
      />
    </div>

    <div v-else class="space-y-6">
      <EditionHeader :edition="edition" current-page="carpool" />

      <!-- Bouton retour -->
      <UButton
        :to="`/editions/${editionId}/carpool`"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left"
        size="sm"
      >
        {{ $t('components.carpool.back_to_list') }}
      </UButton>

      <!-- Détail de la demande -->
      <EditionCarpoolRequestDetail
        :request="carpoolRequest"
        :edition-id="editionId"
        @edit="openEditModal"
        @deleted="navigateTo(`/editions/${editionId}/carpool`)"
        @comment-added="refreshRequest"
      />

      <!-- Modal d'édition -->
      <UModal v-model:open="showEditModal" :title="$t('components.carpool.edit_request')">
        <template #body>
          <EditionCarpoolRequestForm
            :edition-id="editionId"
            :initial-data="carpoolRequest"
            :is-editing="true"
            @success="onRequestEdited"
            @cancel="showEditModal = false"
          />
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()

const editionId = parseInt(route.params.id as string)
const requestId = parseInt(route.params.requestId as string)

// Charger l'édition
const { data: edition, pending: loading } = await useLazyFetch(`/api/editions/${editionId}`, {
  transform: (response: any) => {
    const ed = response?.data?.edition || response
    if (ed) editionStore.setEdition(ed)
    return ed
  },
})

// Charger la demande
const { data: carpoolRequest, refresh: refreshRequest } = await useLazyFetch(
  `/api/carpool-requests/${requestId}`
)

// Modal d'édition
const showEditModal = ref(false)

const openEditModal = () => {
  showEditModal.value = true
}

const onRequestEdited = () => {
  showEditModal.value = false
  refreshRequest()
}

useSeoMeta({
  title: computed(() =>
    carpoolRequest.value
      ? `${carpoolRequest.value.user?.pseudo} — ${carpoolRequest.value.locationCity}`
      : ''
  ),
})
</script>
