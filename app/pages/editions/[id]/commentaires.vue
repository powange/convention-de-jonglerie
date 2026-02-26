<template>
  <div>
    <div v-if="editionLoading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader :edition="edition" current-page="commentaires" />

      <!-- Contenu des commentaires -->
      <div class="space-y-6">
        <!-- Formulaire pour ajouter un nouveau post -->
        <UCard v-if="authStore.isAuthenticated" variant="subtle">
          <template #header>
            <h3 class="text-lg font-semibold">{{ $t('pages.comments.write_comment') }}</h3>
          </template>

          <UForm :state="newPostForm" :validate="validateNewPost" @submit="submitNewPost">
            <UFormField :label="$t('pages.comments.your_comment')" name="content" required>
              <UTextarea
                v-model="newPostForm.content"
                :placeholder="$t('pages.comments.comment_placeholder')"
                :rows="4"
                :maxlength="2000"
                class="w-full"
              />
              <template #help>
                <div class="flex justify-between text-xs">
                  <span>{{ $t('pages.comments.share_experience') }}</span>
                  <span
                    :class="
                      newPostForm.content.length > 1800 ? 'text-warning-500' : 'text-gray-500'
                    "
                  >
                    {{ newPostForm.content.length }}/2000
                  </span>
                </div>
              </template>
            </UFormField>

            <div class="flex justify-end gap-2 mt-4">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                @click="newPostForm.content = ''"
              >
                {{ $t('common.cancel') }}
              </UButton>
              <UButton
                type="submit"
                :loading="isSubmittingPost"
                :disabled="!newPostForm.content.trim()"
              >
                {{ $t('components.posts.publish') }}
              </UButton>
            </div>
          </UForm>
        </UCard>

        <!-- Message pour les utilisateurs non connectés -->
        <UCard v-else variant="subtle">
          <div class="text-center py-4">
            <UIcon name="i-heroicons-chat-bubble-left-right" class="text-gray-400 text-4xl mb-2" />
            <p class="text-gray-600 mb-4">{{ $t('pages.comments.login_to_participate') }}</p>
            <UButton to="/login" color="primary">
              {{ $t('navigation.login') }}
            </UButton>
          </div>
        </UCard>

        <!-- Liste des posts -->
        <div v-if="loading" class="space-y-4">
          <USkeleton v-for="i in 3" :key="i" class="h-32" />
        </div>

        <div v-else-if="posts.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="text-gray-400 text-4xl mb-4" />
          <p class="text-gray-600">{{ $t('pages.comments.no_comments') }}</p>
          <p class="text-gray-500 text-sm">{{ $t('pages.comments.be_first_to_comment') }}</p>
        </div>

        <div v-else class="space-y-6">
          <EditionPost
            v-for="post in posts"
            :key="post.id"
            :post="post"
            :current-user-id="authStore.user?.id"
            :can-pin="canManageEdition"
            @delete-post="deletePost"
            @add-comment="addComment"
            @delete-comment="deleteComment"
            @toggle-pin="togglePin"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)

// Charger l'édition côté serveur ET client pour SSR/SEO
const {
  data: edition,
  pending: editionLoading,
  error,
  refresh: _refreshEdition,
} = await useFetch<Edition>(`/api/editions/${editionId}`)

// Gestion des erreurs
if (error.value) {
  throw createError({
    status: error.value.status || error.value.statusCode || 404,
    statusText: error.value.statusText || error.value.statusMessage || 'Edition not found',
  })
}

// Synchroniser le store avec les données useFetch pour la compatibilité avec les autres pages
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      editionStore.setEdition(newEdition)
    }
  },
  { immediate: true }
)

const loading = ref(false)
const posts = ref<Record<string, unknown>[]>([])

const newPostForm = reactive({
  content: '',
})

// Vérifier si l'utilisateur peut gérer l'édition (organisateur)
const canManageEdition = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Validation du nouveau post
const validateNewPost = (state: { content: string }) => {
  const errors = []
  if (!state.content || !state.content.trim()) {
    errors.push({ path: 'content', message: t('errors.content_required') })
  }
  if (state.content && state.content.length > 2000) {
    errors.push({ path: 'content', message: t('errors.content_too_long', { max: 2000 }) })
  }
  return errors
}

// Charger les posts
const loadPosts = async () => {
  loading.value = true
  try {
    const response = await $fetch(`/api/editions/${editionId}/posts`)
    posts.value = response
  } catch {
    toast.add({
      title: t('errors.loading_error'),
      description: t('errors.cannot_load_comments'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

// Soumettre un nouveau post
const { execute: executeSubmitNewPost, loading: isSubmittingPost } = useApiAction(
  () => `/api/editions/${editionId}/posts`,
  {
    method: 'POST',
    body: () => ({ content: newPostForm.content.trim() }),
    successMessage: {
      title: t('messages.comment_published'),
      description: t('messages.comment_published_successfully'),
    },
    errorMessages: { default: t('errors.cannot_publish_comment') },
    onSuccess: (newPost: Record<string, unknown>) => {
      posts.value.unshift(newPost)
      newPostForm.content = ''
    },
  }
)

const submitNewPost = () => {
  if (!authStore.isAuthenticated) return
  executeSubmitNewPost()
}

// Supprimer un post
const { execute: deletePost } = useApiActionById((id) => `/api/editions/${editionId}/posts/${id}`, {
  method: 'DELETE',
  successMessage: {
    title: t('messages.comment_deleted'),
    description: t('messages.comment_deleted_successfully'),
  },
  errorMessages: { default: t('errors.cannot_delete_comment') },
  onSuccess: (_result: unknown, id: string | number) => {
    posts.value = posts.value.filter((p: Record<string, unknown>) => p.id !== id)
  },
  onError: async () => {
    await loadPosts()
  },
})

// Ajouter un commentaire à un post
// Note: addComment reçoit (postId, content) depuis le composant enfant,
// on doit wrapper car useApiActionById ne supporte qu'un seul paramètre (id)
const addComment = async (postId: number, content: string) => {
  try {
    const newComment = await $fetch(`/api/editions/${editionId}/posts/${postId}/comments`, {
      method: 'POST',
      body: { content },
    })

    // Trouver le post et ajouter le commentaire
    const postIndex = posts.value.findIndex((p: Record<string, unknown>) => p.id === postId)
    if (postIndex !== -1) {
      posts.value[postIndex] = {
        ...posts.value[postIndex],
        comments: [...(posts.value[postIndex] as any).comments, newComment],
      }
    }

    toast.add({
      title: t('messages.reply_published'),
      description: t('messages.reply_published_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch {
    toast.add({
      title: t('errors.cannot_publish_reply'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    await loadPosts()
  }
}

// Supprimer un commentaire
// Note: deleteComment reçoit (postId, commentId) depuis le composant enfant,
// on doit wrapper car useApiActionById ne supporte qu'un seul paramètre (id)
const deleteComment = async (postId: number, commentId: number) => {
  try {
    await $fetch(`/api/editions/${editionId}/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    })

    // Trouver le post et supprimer le commentaire
    const postIndex = posts.value.findIndex((p: Record<string, unknown>) => p.id === postId)
    if (postIndex !== -1) {
      posts.value[postIndex] = {
        ...posts.value[postIndex],
        comments: (posts.value[postIndex] as any).comments.filter(
          (c: Record<string, unknown>) => c.id !== commentId
        ),
      }
    }

    toast.add({
      title: t('messages.reply_deleted'),
      description: t('messages.reply_deleted_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch {
    toast.add({
      title: t('errors.cannot_delete_reply'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    await loadPosts()
  }
}

// Épingler/désépingler un post
// Note: togglePin reçoit (postId, currentPinned) depuis le composant enfant,
// on doit wrapper car le body dépend de currentPinned
const togglePin = async (postId: number, currentPinned: boolean) => {
  const newPinned = !currentPinned
  try {
    await $fetch(`/api/editions/${editionId}/posts/${postId}/pin`, {
      method: 'PATCH',
      body: { pinned: newPinned },
    })

    // Recharger les posts pour avoir le bon tri (épinglés en premier)
    await loadPosts()

    toast.add({
      title: newPinned ? t('messages.post_pinned') : t('messages.post_unpinned'),
      description: newPinned
        ? t('messages.post_pinned_successfully')
        : t('messages.post_unpinned_successfully'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch {
    toast.add({
      title: t('errors.cannot_pin_post'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    await loadPosts()
  }
}

// Métadonnées SEO avec le nom de l'édition
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))

const seoTitle = computed(() => {
  if (!edition.value) return 'Commentaires'
  return `Commentaires - ${editionName.value}`
})

const seoDescription = computed(() => {
  if (!edition.value) return ''
  const name = editionName.value
  return `Lisez les commentaires et avis des participants sur ${name}. Partagez votre expérience et vos impressions sur cette convention de jonglerie.`
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
})

onMounted(async () => {
  await loadPosts()
})
</script>
