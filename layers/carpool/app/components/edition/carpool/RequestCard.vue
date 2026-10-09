<template>
  <NuxtLink :to="`/editions/${editionId}/carpool/requests/${request.id}`" class="block">
    <UCard class="hover:shadow-md transition-shadow cursor-pointer">
      <div class="space-y-4">
        <!-- En-tête avec les infos utilisateur -->
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <UiUserDisplay :user="request.user" :datetime="request.createdAt" size="lg" />
          </div>

          <!-- Boutons d'action pour le créateur -->
          <ClientOnly>
            <div v-if="canEdit" class="flex gap-1">
              <UButton
                icon="i-heroicons-pencil"
                size="xs"
                color="warning"
                variant="ghost"
                :title="$t('components.carpool.edit_request')"
                @click.stop="emit('edit')"
              />
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                color="error"
                variant="ghost"
                :title="$t('components.carpool.delete_request')"
                @click.stop="handleDelete"
              />
            </div>
          </ClientOnly>
          <div class="text-right">
            <UBadge color="warning" variant="soft" class="mb-2">
              {{ $t('components.carpool.seats_needed', { count: request.seatsNeeded }) }}
            </UBadge>
            <div class="text-sm">
              <div class="flex items-center gap-1 justify-end mb-1">
                <UIcon name="i-heroicons-calendar" class="text-gray-400 w-4 h-4" />
                <span class="font-medium">{{ formatTripDate(request.tripDate) }}</span>
              </div>
              <div class="flex items-center gap-1 justify-end mb-1">
                <UIcon name="i-heroicons-map-pin" class="text-gray-400 w-4 h-4" />
                <span class="font-medium">{{ request.locationCity }}</span>
              </div>
              <div class="flex items-center gap-1 justify-end">
                <UIcon
                  :name="
                    request.direction === 'TO_EVENT'
                      ? 'i-heroicons-arrow-right'
                      : 'i-heroicons-arrow-left'
                  "
                  class="text-gray-400 w-4 h-4"
                />
                <span class="text-sm font-medium">{{
                  request.direction === 'TO_EVENT'
                    ? $t('carpool.direction.to_event')
                    : $t('carpool.direction.from_event')
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Description -->
        <p v-if="request.description" class="text-sm text-gray-600">{{ request.description }}</p>

        <!-- Nombre de commentaires, comme sur la carte d'une offre.
             ⚠️ C'était une MODALE, et elle ne s'ouvrait jamais : la carte entière est un
             `NuxtLink`, et le bouton déclencheur n'arrêtait pas la propagation du clic. On
             naviguait donc vers la page de détail à chaque tentative. La lecture et l'écriture des
             commentaires vivent là-bas, par `CommentsInline` — l'endroit où l'on arrivait déjà. -->
        <div v-if="nombreDeCommentaires > 0" class="pt-2">
          <div class="flex items-center gap-1 text-sm text-gray-500">
            <UIcon name="i-heroicons-chat-bubble-left" class="w-4 h-4" />
            {{ $t('components.carpool.view_comments', { count: nombreDeCommentaires }) }}
          </div>
        </div>
      </div>
    </UCard>
  </NuxtLink>

  <!--
    ⚠️ HORS DU `NuxtLink`, volontairement. Toute la carte est un lien : un élément interactif placé
    à l'intérieur verrait ses clics remonter en navigation. La modale est donc une sœur du lien, pas
    sa fille.
  -->
  <UiConfirmationDemandee :confirmation="confirmation" />
</template>

<script setup lang="ts">
import type { CarpoolRequest } from '~/types/carpool'

import { useAuthStore } from '#imports'

interface Props {
  request: CarpoolRequest
  editionId: number
}

const props = defineProps<Props>()
/*
 * Plus de `comment-added` : la carte n'écrit plus de commentaire, elle en affiche le nombre. Laisser
 * l'émission déclarée entretiendrait un contrat que rien n'honore — et son écouteur dans
 * `Section.vue`, un rafraîchissement qui ne se déclenche jamais.
 */
const emit = defineEmits<{
  edit: []
  deleted: []
}>()

const authStore = useAuthStore()
const { t, locale } = useI18n()

/**
 * La liste d'une édition ne rend que `commentsCount` ; le détail rend les commentaires.
 *
 * Le repli sur la longueur garde la carte juste dans les deux cas — et ne se contredit pas, parce
 * que le serveur OMET `comments` plutôt que de le rendre vide quand il ne les a pas chargés. Même
 * calcul que sur la carte d'une offre, que ce lot rejoint.
 */
const nombreDeCommentaires = computed(
  () => props.request.commentsCount ?? props.request.comments?.length ?? 0
)

// Vérifier si l'utilisateur peut éditer cette demande
const canEdit = computed(() => {
  return authStore.user && authStore.user.id === props.request.user.id
})

/*
 * Un seul formateur pour tout le module, au fuseau du NAVIGATEUR. Cet écran passait par le
 * `formatDate` partagé, qui force `Europe/Paris` — donc une heure fausse hors de France pour un
 * départ qui n'a rien à voir avec le lieu de l'événement. L'année disparaît au passage : un trajet
 * se publie pour les jours qui viennent, et les cartes d'offre n'en affichaient déjà pas.
 */
const formatTripDate = (date: string) => formatCarpoolDate(date, locale.value)

const { execute: executeDeleteRequest } = useApiAction(
  () => `/api/carpool-requests/${props.request.id}`,
  {
    method: 'DELETE',
    successMessage: {
      title: t('messages.request_deleted'),
      description: t('messages.request_deleted_successfully'),
    },
    errorMessages: { default: t('errors.deletion_error') },
    onSuccess: () => emit('deleted'),
  }
)

const confirmation = useConfirmation()

const handleDelete = () => {
  confirmation.demanderConfirmation({
    titre: t('common.delete'),
    /*
     * La ville est ce qui distingue une demande d'une autre à l'écran — le libellé disait seulement
     * « cette demande de covoiturage », devant une liste qui en contient plusieurs.
     */
    description: t('components.carpool.confirm_delete_request', {
      city: props.request.locationCity,
    }),
    libelleConfirmer: t('common.delete'),
    agir: () => executeDeleteRequest(),
  })
}
</script>
