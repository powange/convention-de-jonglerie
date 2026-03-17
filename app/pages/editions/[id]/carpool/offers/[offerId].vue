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

    <div v-else-if="!offer">
      <EditionHeader :edition="edition" current-page="carpool" />
      <UAlert
        class="mt-6"
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('components.carpool.offer_not_found')"
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

      <!-- Détail de l'offre -->
      <EditionCarpoolOfferDetail
        :offer="offer"
        :edition-id="editionId"
        @edit="openEditModal"
        @deleted="navigateTo(`/editions/${editionId}/carpool`)"
        @comment-added="refreshOffer"
        @booking-updated="refreshOffer"
      />

      <!-- Modal d'édition -->
      <UModal v-model:open="showEditModal" :title="$t('components.carpool.edit_offer')">
        <template #body>
          <EditionCarpoolOfferForm
            :edition-id="editionId"
            :initial-data="offer"
            :is-editing="true"
            @success="onOfferEdited"
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
const offerId = parseInt(route.params.offerId as string)

// Charger l'édition
const { data: edition, pending: loading } = await useLazyFetch(`/api/editions/${editionId}`, {
  transform: (response: any) => {
    const ed = response?.data?.edition || response
    if (ed) editionStore.setEdition(ed)
    return ed
  },
})

// Charger l'offre
const { data: offer, refresh: refreshOffer } = await useLazyFetch(`/api/carpool-offers/${offerId}`)

// Modal d'édition
const showEditModal = ref(false)

const openEditModal = () => {
  showEditModal.value = true
}

const onOfferEdited = () => {
  showEditModal.value = false
  refreshOffer()
}

useSeoMeta({
  title: computed(() =>
    offer.value ? `${offer.value.user?.pseudo} — ${offer.value.locationCity}` : ''
  ),
})
</script>
