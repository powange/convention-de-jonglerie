<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold flex items-center gap-2">
      <UIcon name="i-heroicons-chat-bubble-left" />
      {{ $t('components.carpool.comments') }}
      <UBadge v-if="comments.length > 0" color="neutral" variant="soft" size="sm">
        {{ comments.length }}
      </UBadge>
    </h3>

    <!-- Chargement -->
    <div v-if="loading" class="text-center py-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto mb-2 w-6 h-6" />
      <p>{{ $t('components.carpool.loading_comments') }}</p>
    </div>

    <!-- Liste des commentaires -->
    <div v-else-if="comments.length > 0" class="space-y-3">
      <UCard v-for="comment in comments" :key="comment.id" variant="subtle">
        <div class="mb-2 flex items-start justify-between gap-2">
          <UiUserDisplay :user="comment.user" :datetime="comment.createdAt" size="sm" />
          <!-- ⚠️ SES PROPRES COMMENTAIRES SEULEMENT. La garde n'est pas ici : c'est
               `deleteCommentForEntity` qui compare l'auteur à la session et refuse en 403. Ce
               `v-if` ne fait que ne pas proposer un geste qui serait refusé — un commentaire posté
               par erreur était jusqu'ici DÉFINITIF pour son auteur. -->
          <UTooltip
            v-if="comment.user?.id === authStore.user?.id"
            :text="$t('components.carpool.delete_comment')"
          >
            <UButton
              color="error"
              variant="ghost"
              size="xs"
              icon="i-heroicons-trash"
              :loading="suppressionEnCours(comment.id)"
              :aria-label="$t('components.carpool.delete_comment')"
              @click="demanderLaSuppression(comment)"
            />
          </UTooltip>
        </div>
        <p class="text-sm whitespace-pre-line break-words">{{ comment.content }}</p>
      </UCard>
    </div>

    <!-- Aucun commentaire -->
    <div v-else class="text-center py-6 text-gray-500">
      <UIcon name="i-heroicons-chat-bubble-left" class="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p class="font-medium">{{ $t('components.carpool.no_comments') }}</p>
      <p class="text-sm">
        {{
          $t('components.carpool.be_first_to_comment', { type: $t(`components.carpool.${type}`) })
        }}
      </p>
    </div>

    <!-- Formulaire pour ajouter un commentaire -->
    <div
      v-if="authStore.isAuthenticated"
      class="pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <UTextarea
        v-model="newComment"
        :placeholder="$t('components.carpool.add_comment_placeholder')"
        autoresize
        class="w-full"
        @blur="newComment = newComment.trim()"
      />
      <div class="flex justify-end mt-2">
        <UButton
          :disabled="!newComment.trim()"
          :loading="isAddingComment"
          color="primary"
          @click="addComment"
        >
          {{ $t('components.carpool.publish') }}
        </UButton>
      </div>
    </div>

    <!-- Message pour utilisateurs non connectés -->
    <div
      v-else
      class="pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-gray-500"
    >
      <p class="text-sm">
        <NuxtLink
          :to="useReturnTo().buildLoginUrl($route.fullPath)"
          class="text-primary-600 hover:underline"
        >
          <!-- `navigation.login` et non `auth.login` : même texte (« Connexion »), mais
               `common.json` est TOUJOURS embarqué, alors que `auth.json` n'est chargé que sous
               /auth, /login, /register et /profile. Sur une page de covoiturage atteinte par
               rechargement, un visiteur non connecté voyait donc la clé brute. Charger tout le
               domaine `auth` sur chaque page d'édition coûterait plus que de déplacer un mot. -->
          {{ $t('navigation.login') }}
        </NuxtLink>
        {{ $t('components.carpool.to_add_comment') }}
      </p>
    </div>
    <!-- La suppression est définitive : le commentaire n'est pas archivé. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '#imports'

interface Comment {
  id: number
  content: string
  createdAt: string
  user: {
    id: number
    pseudo: string
    email: string
  }
}

interface Props {
  id: number
  type: 'offer' | 'request'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'comment-added': []
}>()

const authStore = useAuthStore()
const { t } = useI18n()

const comments = ref<Comment[]>([])
const newComment = ref('')

const { execute: loadComments, loading } = useApiAction(
  () =>
    props.type === 'offer'
      ? `/api/carpool-offers/${props.id}/comments`
      : `/api/carpool-requests/${props.id}/comments`,
  {
    method: 'GET',
    errorMessages: { default: t('errors.cannot_load_comments') },
    onSuccess: (response: any) => {
      comments.value = response
    },
  }
)

const { execute: executeAddComment, loading: isAddingComment } = useApiAction(
  () =>
    props.type === 'offer'
      ? `/api/carpool-offers/${props.id}/comments`
      : `/api/carpool-requests/${props.id}/comments`,
  {
    method: 'POST',
    body: () => ({ content: newComment.value }),
    successMessage: { title: t('messages.comment_added') },
    errorMessages: { default: t('errors.cannot_add_comment') },
    onSuccess: async () => {
      newComment.value = ''
      await loadComments()
      emit('comment-added')
    },
  }
)

const confirmation = useConfirmation()

/**
 * Retirer son propre commentaire.
 *
 * ## ⚠️ POURQUOI CE GESTE N'EXISTAIT PAS
 *
 * `deleteCommentForEntity` était écrite — garde d'auteur comprise — et **n'avait aucun appelant** :
 * les quatre points d'API du module étaient deux `.get` et deux `.post`. Un commentaire posté par
 * erreur était donc **définitif pour son auteur**.
 *
 * 📍 Second cas du même motif dans ce seul constat, avec `commentSchema` : du code qui porte sa
 * logique ET ses tests sans être atteint donne la couverture d'une fonctionnalité sans la
 * fonctionnalité.
 */
const { execute: executerSuppression, isLoading: suppressionEnCours } = useApiActionById(
  (commentId) =>
    props.type === 'offer'
      ? `/api/carpool-offers/${props.id}/comments/${commentId}`
      : `/api/carpool-requests/${props.id}/comments/${commentId}`,
  {
    method: 'DELETE',
    successMessage: { title: t('messages.comment_deleted') },
    errorMessages: { default: t('errors.cannot_delete_comment') },
    onSuccess: async () => {
      await loadComments()
      // Le compte des commentaires est affiché par la carte de l'annonce : sans cet événement, il
      // resterait sur sa valeur d'avant jusqu'au prochain chargement de page.
      emit('comment-added')
    },
  }
)

function demanderLaSuppression(comment: { id: number }) {
  confirmation.demanderConfirmation({
    titre: t('components.carpool.delete_comment'),
    description: t('components.carpool.delete_comment_confirm'),
    libelleConfirmer: t('common.delete'),
    couleurConfirmer: 'error',
    agir: () => executerSuppression(comment.id),
  })
}

onMounted(async () => {
  await loadComments()
})

const addComment = () => {
  newComment.value = newComment.value.trim()
  if (!newComment.value) return
  executeAddComment()
}
</script>
