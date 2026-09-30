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

    <!-- ⚠️ Trois états distincts là où il n'y en avait qu'un. `!offer` couvrait indistinctement le
         chargement, un vrai 404 et une panne réseau — et affichait « introuvable » dans les trois
         cas. Un visiteur non connecté lisait donc « introuvable » sur une offre qui existait, parce
         que le point d'API répondait 401 : le message accusait la donnée d'une faute qui était
         celle de l'accès. -->
    <div v-else-if="chargementOffre" class="mt-6 flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="erreurOffre">
      <EditionHeader :edition="edition" current-page="carpool" />
      <UAlert
        class="mt-6"
        icon="i-lucide-alert-triangle"
        :color="offreIntrouvable ? 'error' : 'warning'"
        variant="soft"
        :title="
          offreIntrouvable
            ? $t('components.carpool.offer_not_found')
            : $t('components.carpool.offer_load_error')
        "
        :actions="
          offreIntrouvable
            ? []
            : [{ label: $t('common.retry'), color: 'neutral', onClick: () => refreshOffer() }]
        "
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
import { useEditionStore } from '#imports'

const route = useRoute()
const editionStore = useEditionStore()

const editionId = parseInt(route.params.id as string)
const offerId = parseInt(route.params.offerId as string)

// Charger l'édition
const { data: edition, pending: loading } = await useApiFetch(`/api/editions/${editionId}`, {
  lazy: true,
  transform: (ed: any) => {
    if (ed) editionStore.setEdition(ed)
    return ed
  },
})

/*
 * L'erreur est relevée, et pas seulement la donnée.
 *
 * `!offer` seul ne distingue pas « pas encore chargé » de « n'existe pas » de « la requête a
 * échoué ». L'écran affichait « introuvable » dans les trois cas — y compris sur un 401, ce qui
 * accusait la donnée d'une faute qui était celle de l'accès.
 */
const {
  data: offer,
  refresh: refreshOffer,
  pending: chargementOffre,
  error: erreurOffre,
} = await useLazyFetch(`/api/carpool-offers/${offerId}`)

/** Un vrai 404 : l'offre n'existe pas. Tout le reste est une panne, et se réessaie. */
const offreIntrouvable = computed(() => erreurOffre.value?.statusCode === 404)

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
