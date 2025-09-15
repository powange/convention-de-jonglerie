<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader
        :edition="edition"
        current-page="commentaires"
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />

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
          <EditionEditionPost
            v-for="post in posts"
            :key="post.id"
            :post="post"
            :current-user-id="authStore.user?.id"
            @delete-post="deletePost"
            @add-comment="addComment"
            @delete-comment="deleteComment"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
// import type { Edition } from '~/types';

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const loading = ref(false)
const posts = ref([])
const isSubmittingPost = ref(false)

const newPostForm = reactive({
  content: '',
})

const edition = computed(() => editionStore.getEditionById(editionId))

const isFavorited = computed(() => (editionId: number) => {
  return editionStore.editions
    .find((c) => c.id === editionId)
    ?.favoritedBy.some((u) => u.id === authStore.user?.id)
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
  } catch (error: unknown) {
    console.error('Erreur lors du chargement des posts:', error)
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
const submitNewPost = async () => {
  if (!authStore.isAuthenticated) return

  isSubmittingPost.value = true
  try {
    const newPost = await $fetch(`/api/editions/${editionId}/posts`, {
      method: 'POST',
      body: { content: newPostForm.content.trim() },
    })

    posts.value.unshift(newPost)
    newPostForm.content = ''

    toast.add({
      title: t('messages.comment_published'),
      description: t('messages.comment_published_successfully'),
      color: 'success',
    })
  } catch (error: unknown) {
    console.error('Error creating post:', error)
    const httpError = error as { data?: { message?: string } } | undefined
    toast.add({
      title: t('common.error'),
      description: httpError?.data?.message || t('errors.cannot_publish_comment'),
      color: 'error',
    })
  } finally {
    isSubmittingPost.value = false
  }
}

// Supprimer un post
const deletePost = async (postId: number) => {
  try {
    await $fetch(`/api/editions/${editionId}/posts/${postId}`, { method: 'DELETE' })

    posts.value = posts.value.filter((p) => p.id !== postId)

    toast.add({
      title: t('messages.comment_deleted'),
      description: t('messages.comment_deleted_successfully'),
      color: 'success',
    })
  } catch (error: unknown) {
    console.error('Erreur lors de la suppression du post:', error)
    toast.add({
      title: t('common.error'),
      description: t('errors.cannot_delete_comment'),
      color: 'error',
    })
  }
}

// Ajouter un commentaire à un post
const addComment = async (postId: number, content: string) => {
  try {
    const newComment = await $fetch(`/api/editions/${editionId}/posts/${postId}/comments`, {
      method: 'POST',
      body: { content },
    })

    // Trouver le post et ajouter le commentaire
    const post = posts.value.find((p) => p.id === postId)
    if (post) {
      post.comments.push(newComment)
    }

    toast.add({
      title: t('messages.reply_published'),
      description: t('messages.reply_published_successfully'),
      color: 'success',
    })
  } catch (error: unknown) {
    console.error('Error creating comment:', error)
    const httpError = error as { data?: { message?: string } } | undefined
    toast.add({
      title: t('common.error'),
      description: httpError?.data?.message || t('errors.cannot_publish_reply'),
      color: 'error',
    })
  }
}

// Supprimer un commentaire
const deleteComment = async (postId: number, commentId: number) => {
  try {
    await $fetch(`/api/editions/${editionId}/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    })

    // Trouver le post et supprimer le commentaire
    const post = posts.value.find((p) => p.id === postId)
    if (post) {
      post.comments = post.comments.filter((c) => c.id !== commentId)
    }

    toast.add({
      title: t('messages.reply_deleted'),
      description: t('messages.reply_deleted_successfully'),
      color: 'success',
    })
  } catch (error: unknown) {
    console.error('Erreur lors de la suppression du commentaire:', error)
    toast.add({
      title: t('common.error'),
      description: t('errors.cannot_delete_reply'),
      color: 'error',
    })
  }
}

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
    toast.add({
      title: t('messages.favorite_status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: unknown) {
    const err = e as { statusMessage?: string } | undefined
    toast.add({
      title: err?.statusMessage || t('errors.favorite_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

onMounted(async () => {
  if (!edition.value) {
    try {
      const fetchedEdition = await editionStore.fetchEditionById(editionId)
      // Ajouter l'édition au cache local
      const existingIndex = editionStore.editions.findIndex((e) => e.id === editionId)
      if (existingIndex === -1) {
        editionStore.editions.push(fetchedEdition)
      } else {
        editionStore.editions[existingIndex] = fetchedEdition
      }
    } catch (error) {
      console.error('Error loading edition:', error)
    }
  }
  await loadPosts()
})
</script>
