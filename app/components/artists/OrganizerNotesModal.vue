<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('artists.organizer_notes')"
    :description="$t('artists.notes_for_artist', { name: artistName })"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UFormField :label="$t('artists.notes_label')">
        <UTextarea
          v-model="localNotes"
          :placeholder="$t('artists.notes_placeholder')"
          :rows="8"
          class="w-full"
          autofocus
        />
      </UFormField>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="outline" @click="close">
        {{ $t('common.cancel') }}
      </UButton>
      <UButton color="primary" :loading="saving" @click="saveNotes">
        {{ $t('common.save') }}
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  artist: any
  editionId: number
}>()

const emit = defineEmits<{
  notesSaved: []
}>()

const isOpen = defineModel<boolean>({ required: true })
const { t } = useI18n()

const localNotes = ref('')

const artistName = computed(() => {
  if (!props.artist?.user) return ''
  return `${props.artist.user.prenom} ${props.artist.user.nom}`
})

// Initialiser les notes quand la modal s'ouvre
watch(
  () => props.artist,
  (newArtist) => {
    if (newArtist) {
      localNotes.value = newArtist.organizerNotes || ''
    }
  },
  { immediate: true }
)

const { execute: saveNotes, loading: saving } = useApiAction(
  () => `/api/editions/${props.editionId}/artists/${props.artist?.id}/notes`,
  {
    method: 'PATCH',
    body: () => ({ organizerNotes: localNotes.value.trim() || null }),
    successMessage: { title: t('artists.notes_saved') },
    errorMessages: { default: t('artists.error_save_notes') },
    onSuccess: () => {
      emit('notesSaved')
      isOpen.value = false
    },
  }
)
</script>
