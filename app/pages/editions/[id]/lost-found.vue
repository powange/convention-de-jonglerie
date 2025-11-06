<template>
  <div>
    <!-- En-tête avec navigation -->
    <EditionHeader v-if="edition" :edition="edition" current-page="lost-found" />

    <div class="max-w-6xl mx-auto px-4 py-8">
      <!-- Actions et message d'information -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-3xl font-bold">{{ $t('edition.lost_found') }}</h1>
          <UButton
            v-if="canAddLostFound"
            icon="i-heroicons-plus"
            color="primary"
            @click="showAddModal = true"
          >
            {{ $t('edition.add_lost_item') }}
          </UButton>
        </div>

        <!-- Bouton filtre objets restitués sous le titre -->
        <div v-if="hasReturnedItems" class="mb-4">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            :icon="showReturned ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
            @click="toggleShowReturned"
          >
            {{ showReturned ? t('edition.hide_returned_items') : t('edition.show_returned_items') }}
          </UButton>
        </div>

        <!-- Message d'information -->
        <UAlert v-if="!hasEditionStarted" icon="i-heroicons-information-circle" color="info">
          {{ $t('edition.lost_found_before_start') }}
        </UAlert>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-500" />
      </div>

      <!-- Liste des objets trouvés (filtrés) -->
      <div v-else-if="filteredItems.length > 0" class="space-y-6">
        <UCard
          v-for="item in filteredItems"
          :key="item.id"
          :class="{ 'opacity-75': item.status === 'RETURNED' }"
        >
          <template #header>
            <div class="flex items-start justify-between">
              <UiUserDisplayForAdmin
                :user="item.user"
                :datetime="item.createdAt"
                size="lg"
                :show-email="false"
              />
              <div class="flex items-center gap-2">
                <UBadge
                  :color="item.status === 'RETURNED' ? 'success' : 'warning'"
                  :variant="item.status === 'RETURNED' ? 'soft' : 'solid'"
                >
                  {{ item.status === 'RETURNED' ? t('edition.returned') : t('edition.lost') }}
                </UBadge>
                <UButton
                  v-if="canEditLostFound"
                  size="xs"
                  :color="item.status === 'RETURNED' ? 'warning' : 'success'"
                  variant="soft"
                  :icon="
                    item.status === 'RETURNED'
                      ? 'i-heroicons-arrow-uturn-left'
                      : 'i-heroicons-check-badge'
                  "
                  :aria-label="
                    item.status === 'RETURNED'
                      ? t('edition.mark_as_lost')
                      : t('edition.mark_as_returned')
                  "
                  class="flex items-center gap-1"
                  @click="toggleStatus(item.id)"
                >
                  {{
                    item.status === 'RETURNED'
                      ? t('edition.mark_as_lost')
                      : t('edition.mark_as_returned')
                  }}
                </UButton>
              </div>
            </div>
          </template>

          <!-- Description et image -->
          <div class="space-y-4">
            <p class="text-gray-700 dark:text-gray-300">{{ item.description }}</p>

            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="item.description"
              class="max-w-full md:max-w-md rounded-lg cursor-pointer"
              @click="showImageModal(item.imageUrl)"
            />
          </div>

          <!-- Section commentaires -->
          <template #footer>
            <div class="space-y-4">
              <!-- Liste des commentaires -->
              <div v-if="item.comments.length > 0" class="space-y-3">
                <div v-for="comment in item.comments" :key="comment.id" class="flex gap-3">
                  <div class="flex-1">
                    <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                      <UiUserDisplayForAdmin
                        :user="comment.user"
                        :datetime="comment.createdAt"
                        size="sm"
                        :show-email="false"
                      />
                      <p class="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        {{ comment.content }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Formulaire d'ajout de commentaire -->
              <div v-if="authStore.isAuthenticated" class="flex gap-3">
                <UInput
                  v-model="commentContents[item.id]"
                  :placeholder="t('edition.add_comment_placeholder')"
                  class="flex-1"
                  @keyup.enter="postComment(item.id)"
                />
                <UButton
                  icon="i-heroicons-paper-airplane"
                  color="primary"
                  :disabled="!commentContents[item.id]?.trim()"
                  @click="postComment(item.id)"
                />
              </div>
            </div>
          </template>
        </UCard>
      </div>

      <!-- État vide -->
      <div
        v-else
        class="py-24 min-h-[320px] flex flex-col items-center justify-center text-center gap-4"
      >
        <UIcon name="i-heroicons-magnifying-glass" class="w-14 h-14 text-gray-400" />
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ $t('edition.no_lost_items') }}
          </h3>
          <p class="text-gray-500 max-w-prose">
            {{
              !hasEditionStarted
                ? t('edition.items_appear_when_started')
                : lostFoundItems.length > 0
                  ? t('edition.no_items_reported')
                  : t('edition.no_items_reported')
            }}
          </p>
        </div>
        <!-- Bouton 'Afficher les objets restitués' supprimé selon demande -->
      </div>

      <!-- Modal d'ajout d'objet trouvé -->
      <UModal v-model:open="showAddModal">
        <template #header>
          <h3 class="text-lg font-semibold">{{ $t('edition.add_lost_item') }}</h3>
        </template>

        <template #body>
          <div class="space-y-4">
            <UFormField :label="t('common.description')" required class="w-full">
              <UTextarea
                v-model="newItem.description"
                :placeholder="t('edition.describe_lost_item')"
                :rows="4"
                class="w-full"
                autoresize
              />
            </UFormField>

            <UFormField :label="t('edition.photo_optional')">
              <UiImageUpload
                v-model="newItem.imageUrl"
                :endpoint="{ type: 'lost-found', id: editionId }"
                :options="{
                  validation: {
                    maxSize: 5 * 1024 * 1024,
                    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
                  },
                  resetAfterUpload: false,
                }"
                :alt="$t('pages.objets_trouves.photo_alt')"
                :placeholder="t('edition.choose_photo')"
                :allow-delete="false"
                @uploaded="onImageUploaded"
                @error="onImageError"
              />
            </UFormField>
          </div>
        </template>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton variant="ghost" @click="showAddModal = false">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :disabled="!newItem.description?.trim() || submittingItem"
              :loading="submittingItem"
              @click="submitNewItem"
            >
              {{ $t('common.add') }}
            </UButton>
          </div>
        </template>
      </UModal>

      <!-- Modal d'affichage d'image -->
      <UModal v-model:open="showImageModalState" size="xl">
        <template #body>
          <img :src="currentImageUrl" :alt="t('edition.enlarged_image')" class="w-full" />
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

// Props et route
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const { t } = useI18n()

const editionId = computed(() => parseInt(route.params.id as string))

// État local
const loading = ref(true)
type LostFoundUser = {
  id: number
  pseudo: string
  prenom: string
  nom: string
  profilePicture?: string | null
}
type LostFoundComment = { id: number; content: string; createdAt: string; user: LostFoundUser }
type LostFoundItem = {
  id: number
  description: string
  imageUrl?: string | null
  status: 'LOST' | 'RETURNED'
  createdAt: string
  user: LostFoundUser
  comments: LostFoundComment[]
}
const lostFoundItems = ref<LostFoundItem[]>([])
const showReturned = ref(false)
const commentContents = ref<Record<number, string>>({})
const showAddModal = ref(false)
const showImageModalState = ref(false)
const currentImageUrl = ref('')
const submittingItem = ref(false)

const newItem = ref({
  description: '',
  imageUrl: '',
})

// Récupérer l'édition
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Vérifier début / fin de l'édition
const hasEditionStarted = computed(() => {
  if (!edition.value) return false
  return new Date() >= new Date(edition.value.startDate)
})

// Vérifier les permissions
const canAddLostFound = computed(() => {
  if (!authStore.isAuthenticated || !hasEditionStarted.value) return false
  if (!edition.value) return false
  return editionStore.canEditEdition(edition.value, authStore.user?.id || 0)
})

const canEditLostFound = computed(() => canAddLostFound.value)

// Fonctions

const fetchLostFoundItems = async () => {
  loading.value = true
  try {
    const data = await $fetch(`/api/editions/${editionId.value}/lost-found`)
    // Sécurise: toujours un tableau
    lostFoundItems.value = Array.isArray(data) ? data : []
  } catch (error: unknown) {
    console.error('Error loading lost items:', error)
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('edition.cannot_load_lost_items'),
    })
  } finally {
    loading.value = false
  }
}

// Filtrage des items (masquer les RETURNED par défaut)
const hasReturnedItems = computed(() => lostFoundItems.value.some((i) => i.status === 'RETURNED'))
const filteredItems = computed(() => {
  if (showReturned.value) return lostFoundItems.value
  return lostFoundItems.value.filter((i) => i.status !== 'RETURNED')
})
const toggleShowReturned = () => {
  showReturned.value = !showReturned.value
}

const postComment = async (itemId: number) => {
  const content = commentContents.value[itemId]?.trim()
  if (!content) return

  try {
    const comment = await $fetch(`/api/editions/${editionId.value}/lost-found/${itemId}/comments`, {
      method: 'POST',
      body: { content },
    })

    // Ajouter le commentaire à l'item
    const item = lostFoundItems.value.find((i) => i.id === itemId)
    if (item) {
      item.comments.push(comment)
    }

    // Réinitialiser le champ
    commentContents.value[itemId] = ''

    toast.add({
      color: 'success',
      title: t('edition.comment_added'),
    })
  } catch {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('edition.cannot_add_comment'),
    })
  }
}

const toggleStatus = async (itemId: number) => {
  try {
    const updatedItem = await $fetch(
      `/api/editions/${editionId.value}/lost-found/${itemId}/return`,
      {
        method: 'PATCH',
      }
    )

    // Mettre à jour l'item dans la liste
    const index = lostFoundItems.value.findIndex((i) => i.id === itemId)
    if (index !== -1) {
      lostFoundItems.value[index] = updatedItem
    }

    toast.add({
      color: 'success',
      title:
        updatedItem.status === 'RETURNED'
          ? t('edition.item_marked_returned')
          : t('edition.item_marked_lost'),
    })
  } catch {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('edition.cannot_change_status'),
    })
  }
}

// Gestionnaires d'événements pour ImageUpload
const onImageUploaded = (result: { success: boolean; imageUrl?: string }) => {
  if (result.success && result.imageUrl) {
    newItem.value.imageUrl = result.imageUrl
    toast.add({
      color: 'success',
      title: t('edition.photo_uploaded'),
    })
  }
}

const onImageError = (error: string) => {
  toast.add({
    color: 'error',
    title: t('common.error'),
    description: error || t('edition.cannot_upload_photo'),
  })
}

const submitNewItem = async () => {
  if (!newItem.value.description?.trim()) return

  submittingItem.value = true
  try {
    const item = await $fetch(`/api/editions/${editionId.value}/lost-found`, {
      method: 'POST',
      body: {
        description: newItem.value.description.trim(),
        imageUrl: newItem.value.imageUrl || undefined,
      },
    })

    // Ajouter à la liste
    lostFoundItems.value.unshift(item)

    // Réinitialiser et fermer
    newItem.value = { description: '', imageUrl: '' }
    showAddModal.value = false

    toast.add({
      color: 'success',
      title: t('edition.lost_item_added'),
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } } | undefined
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: err?.data?.message || t('edition.cannot_add_item'),
    })
  } finally {
    submittingItem.value = false
  }
}

const showImageModal = (imageUrl: string) => {
  currentImageUrl.value = imageUrl
  showImageModalState.value = true
}

// Charger les données au montage
onMounted(async () => {
  await editionStore.fetchEditionById(editionId.value)
  if (hasEditionStarted.value) {
    await fetchLostFoundItems()
  } else {
    // Edition pas encore démarrée: on arrête le loading mais on ne fetch pas encore
    loading.value = false
    // Planification d'un fetch au démarrage si la date de début est connue
    if (edition.value?.startDate) {
      const startTime = new Date(edition.value.startDate).getTime()
      const delay = startTime - Date.now()
      if (delay > 0 && delay < 1000 * 60 * 60 * 24) {
        setTimeout(async () => {
          if (!lostFoundItems.value.length) {
            loading.value = true
            await fetchLostFoundItems()
          }
        }, delay + 500) // léger buffer
      }
    }
  }
})
</script>
