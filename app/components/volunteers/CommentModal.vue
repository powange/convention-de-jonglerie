<template>
  <UModal v-model:open="isOpen" :title="modalTitle" @close="handleClose">
    <template #body>
      <div class="space-y-4">
        <!-- Informations sur le bénévole -->
        <div class="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <UiUserAvatar v-if="volunteer?.user" :user="volunteer.user" size="md" />
          <div>
            <p class="font-medium text-gray-900 dark:text-white">
              {{ volunteer?.user?.prenom }} {{ volunteer?.user?.nom }}
            </p>
            <p class="text-sm text-gray-500">{{ volunteer?.user?.email }}</p>
          </div>
        </div>

        <!-- Champ de commentaire -->
        <UFormField
          :label="$t('gestion.volunteers.comment_label')"
          :help="$t('gestion.volunteers.comment_hint')"
        >
          <UTextarea
            v-model="commentContent"
            :placeholder="$t('gestion.volunteers.comment_placeholder')"
            :rows="6"
            :maxlength="5000"
            class="w-full"
            autoresize
          />
        </UFormField>

        <p class="text-xs text-gray-500">
          {{ commentContent.length }} / 5000 {{ $t('common.characters') }}
        </p>

        <!-- Avertissement -->
        <div class="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <UIcon
            name="i-heroicons-information-circle"
            class="text-yellow-600 flex-shrink-0 mt-0.5"
          />
          <p class="text-sm text-yellow-800 dark:text-yellow-200">
            {{ $t('gestion.volunteers.comment_warning') }}
          </p>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-between gap-3">
        <UButton
          v-if="hasExistingComment"
          color="error"
          variant="soft"
          :loading="isDeleting"
          @click="handleDelete"
        >
          {{ $t('common.delete') }}
        </UButton>
        <div class="flex gap-3 ml-auto">
          <UButton color="neutral" variant="soft" @click="close">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :loading="isSaving"
            :disabled="!commentContent.trim()"
            @click="handleSave"
          >
            {{ $t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Volunteer {
  id: number
  userId: number
  user: {
    id: number
    pseudo: string
    email: string
    prenom: string
    nom: string
    profilePicture?: string
    volunteerComments?: Array<{
      content: string
      createdAt: string
      updatedAt: string
    }>
  }
}

interface Props {
  open: boolean
  volunteer: Volunteer | null
  editionId: number
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'commentSaved'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const commentContent = ref('')

// Action pour sauvegarder le commentaire
const { execute: executeSave, loading: isSaving } = useApiAction(
  () => `/api/conventions/${props.editionId}/volunteers/${props.volunteer?.userId}/comment`,
  {
    method: 'PUT',
    body: () => ({ content: commentContent.value.trim() }),
    successMessage: { title: t('gestion.volunteers.comment_saved_success') },
    errorMessages: { default: t('gestion.volunteers.comment_save_error') },
    onSuccess: () => {
      emit('commentSaved')
      isOpen.value = false
    },
  }
)

// Action pour supprimer le commentaire
const { execute: executeDelete, loading: isDeleting } = useApiAction(
  () => `/api/conventions/${props.editionId}/volunteers/${props.volunteer?.userId}/comment`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.volunteers.comment_deleted_success') },
    errorMessages: { default: t('gestion.volunteers.comment_delete_error') },
    onSuccess: () => {
      emit('commentSaved')
      isOpen.value = false
    },
  }
)

const modalTitle = computed(() => {
  if (!props.volunteer) return t('gestion.volunteers.comment_modal_title')
  return t('gestion.volunteers.comment_modal_title_for', {
    name: `${props.volunteer.user.prenom} ${props.volunteer.user.nom}`,
  })
})

const hasExistingComment = computed(() => {
  return (
    props.volunteer?.user?.volunteerComments && props.volunteer.user.volunteerComments.length > 0
  )
})

// Charger le commentaire existant quand le modal s'ouvre
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.volunteer) {
      if (hasExistingComment.value) {
        commentContent.value = props.volunteer.user.volunteerComments![0].content
      } else {
        commentContent.value = ''
      }
    }
  }
)

const handleSave = () => {
  if (!props.volunteer || !commentContent.value.trim()) return
  executeSave()
}

const handleDelete = () => {
  if (!props.volunteer) return
  executeDelete()
}

const handleClose = () => {
  commentContent.value = ''
}
</script>
