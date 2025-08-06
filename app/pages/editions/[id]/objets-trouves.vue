<template>
  <div>
    <!-- En-tête avec navigation -->
    <EditionHeader 
      v-if="edition"
      :edition="edition" 
      current-page="objets-trouves" 
      :is-favorited="isFavorited(edition.id)"
      @toggle-favorite="toggleFavorite(edition.id)"
    />
    
    <div class="max-w-6xl mx-auto px-4 py-8">
      <!-- Actions et message d'information -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-3xl font-bold">{{ $t('editions.lost_found') }}</h1>
          <UButton 
            v-if="canAddLostFound"
            icon="i-heroicons-plus" 
            color="primary" 
            @click="showAddModal = true"
          >
            {{ $t('editions.add_lost_item') }}
          </UButton>
        </div>

        <!-- Message d'information -->
        <UAlert v-if="!isEditionFinished" icon="i-heroicons-information-circle" color="blue">
          {{ $t('editions.lost_found_after_edition') }}
        </UAlert>
      </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-500" />
    </div>

    <!-- Liste des objets trouvés -->
    <div v-else-if="lostFoundItems.length > 0" class="space-y-6">
      <UCard 
        v-for="item in lostFoundItems" 
        :key="item.id"
        :class="{ 'opacity-75': item.status === 'RETURNED' }"
      >
        <template #header>
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <UserAvatar 
                :user="item.user" 
                size="lg"
              />
              <div>
                <p class="font-medium">{{ item.user.prenom }} {{ item.user.nom }}</p>
                <p class="text-sm text-gray-500">{{ formatDate(item.createdAt) }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <UBadge 
                :color="item.status === 'RETURNED' ? 'success' : 'warning'" 
                :variant="item.status === 'RETURNED' ? 'soft' : 'solid'"
              >
                {{ item.status === 'RETURNED' ? t('editions.returned') : t('editions.lost') }}
              </UBadge>
              <UButton
                v-if="canEditLostFound"
                icon="i-heroicons-arrow-path"
                size="xs"
                variant="ghost"
                @click="toggleStatus(item.id)"
                :title="item.status === 'RETURNED' ? t('editions.mark_as_lost') : t('editions.mark_as_returned')"
              />
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
          >
        </div>

        <!-- Section commentaires -->
        <template #footer>
          <div class="space-y-4">
            <!-- Liste des commentaires -->
            <div v-if="item.comments.length > 0" class="space-y-3">
              <div 
                v-for="comment in item.comments" 
                :key="comment.id"
                class="flex gap-3"
              >
                <UserAvatar 
                  :user="comment.user" 
                  size="md" 
                  shrink
                />
                <div class="flex-1">
                  <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                    <p class="text-sm font-medium">{{ comment.user.prenom }} {{ comment.user.nom }}</p>
                    <p class="text-sm text-gray-700 dark:text-gray-300 mt-1">{{ comment.content }}</p>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">{{ formatDate(comment.createdAt) }}</p>
                </div>
              </div>
            </div>

            <!-- Formulaire d'ajout de commentaire -->
            <div v-if="authStore.isAuthenticated" class="flex gap-3">
              <UInput 
                v-model="commentContents[item.id]"
                :placeholder="t('editions.add_comment_placeholder')"
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
    <div v-else class="text-center py-12">
      <UIcon name="i-heroicons-magnifying-glass" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('editions.no_lost_items') }}
      </h3>
      <p class="text-gray-500">
        {{ isEditionFinished ? t('editions.no_items_reported') : t('editions.items_appear_after_edition') }}
      </p>
    </div>

    <!-- Modal d'ajout d'objet trouvé -->
    <UModal v-model:open="showAddModal">
      <template #header>
        <h3 class="text-lg font-semibold">{{ $t('editions.add_lost_item') }}</h3>
      </template>
      
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('common.description')" required>
            <UTextarea 
              v-model="newItem.description"
              :placeholder="t('editions.describe_lost_item')"
              rows="3"
            />
          </UFormField>

          <UFormField :label="t('editions.photo_optional')">
            <div class="space-y-3">
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleFileSelect"
              >
              
              <UButton 
                icon="i-heroicons-camera"
                variant="outline"
                block
                @click="$refs.fileInput.click()"
                :loading="uploadingImage"
              >
                {{ uploadingImage ? t('editions.uploading') : t('editions.choose_photo') }}
              </UButton>

              <img 
                v-if="newItem.imageUrl"
                :src="newItem.imageUrl"
                :alt="t('common.preview')"
                class="max-w-full rounded-lg"
              >
            </div>
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton 
            variant="ghost"
            @click="showAddModal = false"
          >
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
        <img 
          :src="currentImageUrl"
          :alt="t('editions.enlarged_image')"
          class="w-full"
        >
      </template>
    </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import EditionHeader from '~/components/edition/EditionHeader.vue'
import UserAvatar from '~/components/ui/UserAvatar.vue'

// Props et route
const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const { t } = useI18n()

const editionId = computed(() => parseInt(route.params.id as string))

// État local
const loading = ref(true)
const lostFoundItems = ref<any[]>([])
const commentContents = ref<Record<number, string>>({})
const showAddModal = ref(false)
const showImageModalState = ref(false)
const currentImageUrl = ref('')
const uploadingImage = ref(false)
const submittingItem = ref(false)

const newItem = ref({
  description: '',
  imageUrl: ''
})

// Récupérer l'édition
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Vérifier si l'édition est terminée
const isEditionFinished = computed(() => {
  if (!edition.value) return false
  return new Date() > new Date(edition.value.endDate)
})

// Vérifier les permissions
const canAddLostFound = computed(() => {
  if (!authStore.isAuthenticated || !isEditionFinished.value) return false
  if (!edition.value) return false
  return editionStore.canEditEdition(edition.value, authStore.user?.id || 0)
})

const canEditLostFound = computed(() => canAddLostFound.value)

// Fonction pour les favoris
const isFavorited = (editionId: number) => {
  return edition.value?.favoritedBy?.some(u => u.id === authStore.user?.id) || false
}

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
    toast.add({ 
      title: t('messages.favorite_status_updated'), 
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    })
  } catch (e: any) {
    toast.add({ 
      title: e.statusMessage || t('errors.favorite_update_failed'), 
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    })
  }
}

// Fonctions
const formatDate = (date: string) => {
  const { locale } = useI18n()
  return new Date(date).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const fetchLostFoundItems = async () => {
  loading.value = true
  try {
    const data = await $fetch(`/api/editions/${editionId.value}/lost-found`)
    lostFoundItems.value = data
  } catch (error) {
    console.error('Error loading lost items:', error)
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('editions.cannot_load_lost_items')
    })
  } finally {
    loading.value = false
  }
}

const postComment = async (itemId: number) => {
  const content = commentContents.value[itemId]?.trim()
  if (!content) return

  try {
    const comment = await $fetch(`/api/editions/${editionId.value}/lost-found/${itemId}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: { content }
    })

    // Ajouter le commentaire à l'item
    const item = lostFoundItems.value.find(i => i.id === itemId)
    if (item) {
      item.comments.push(comment)
    }

    // Réinitialiser le champ
    commentContents.value[itemId] = ''

    toast.add({
      color: 'success',
      title: t('editions.comment_added')
    })
  } catch (error) {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('editions.cannot_add_comment')
    })
  }
}

const toggleStatus = async (itemId: number) => {
  try {
    const updatedItem = await $fetch(`/api/editions/${editionId.value}/lost-found/${itemId}/return`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    // Mettre à jour l'item dans la liste
    const index = lostFoundItems.value.findIndex(i => i.id === itemId)
    if (index !== -1) {
      lostFoundItems.value[index] = updatedItem
    }

    toast.add({
      color: 'success',
      title: updatedItem.status === 'RETURNED' ? t('editions.item_marked_returned') : t('editions.item_marked_lost')
    })
  } catch (error) {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('editions.cannot_change_status')
    })
  }
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return

  uploadingImage.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)

    const { imageUrl } = await $fetch(`/api/editions/${editionId.value}/lost-found/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: formData
    })

    newItem.value.imageUrl = imageUrl
    toast.add({
      color: 'success',
      title: t('editions.photo_uploaded')
    })
  } catch (error) {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('editions.cannot_upload_photo')
    })
  } finally {
    uploadingImage.value = false
  }
}

const submitNewItem = async () => {
  if (!newItem.value.description?.trim()) return

  submittingItem.value = true
  try {
    const item = await $fetch(`/api/editions/${editionId.value}/lost-found`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: {
        description: newItem.value.description.trim(),
        imageUrl: newItem.value.imageUrl || undefined
      }
    })

    // Ajouter à la liste
    lostFoundItems.value.unshift(item)

    // Réinitialiser et fermer
    newItem.value = { description: '', imageUrl: '' }
    showAddModal.value = false

    toast.add({
      color: 'success',
      title: t('editions.lost_item_added')
    })
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: error.data?.statusMessage || t('editions.cannot_add_item')
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
  if (isEditionFinished.value) {
    await fetchLostFoundItems()
  } else {
    loading.value = false
  }
})
</script>