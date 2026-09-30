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

    <!-- ⚠️ Trois états distincts là où il n'y en avait qu'un : voir la page d'une offre, même
         correction. « Introuvable » s'affichait aussi bien pendant le chargement que sur un 401 —
         et c'est ce dernier cas qui faisait lire « introuvable » à un visiteur non connecté sur
         une demande qui existait. -->
    <div v-else-if="chargementDemande" class="mt-6 flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="erreurDemande">
      <EditionHeader :edition="edition" current-page="carpool" />
      <UAlert
        class="mt-6"
        icon="i-lucide-alert-triangle"
        :color="demandeIntrouvable ? 'error' : 'warning'"
        variant="soft"
        :title="
          demandeIntrouvable
            ? $t('components.carpool.request_not_found')
            : $t('components.carpool.request_load_error')
        "
        :actions="
          demandeIntrouvable
            ? []
            : [{ label: $t('common.retry'), color: 'neutral', onClick: () => refreshRequest() }]
        "
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
import { useEditionStore } from '#imports'

const route = useRoute()
const editionStore = useEditionStore()

const editionId = parseInt(route.params.id as string)
const requestId = parseInt(route.params.requestId as string)

// Charger l'édition
const { data: edition, pending: loading } = await useApiFetch(`/api/editions/${editionId}`, {
  lazy: true,
  transform: (ed: any) => {
    if (ed) editionStore.setEdition(ed)
    return ed
  },
})

/*
 * L'erreur est relevée, et pas seulement la donnée — même raison que sur la page d'une offre :
 * `!carpoolRequest` ne distinguait pas « pas encore chargé » de « n'existe pas » de « la requête a
 * échoué ».
 */
const {
  data: carpoolRequest,
  refresh: refreshRequest,
  pending: chargementDemande,
  error: erreurDemande,
} = await useLazyFetch(`/api/carpool-requests/${requestId}`)

/** Un vrai 404 : la demande n'existe pas. Tout le reste est une panne, et se réessaie. */
const demandeIntrouvable = computed(() => erreurDemande.value?.statusCode === 404)

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
