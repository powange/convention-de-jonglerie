<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('edition.artists.organizer_notes')"
    :description="$t('edition.artists.notes_for_artist', { name: artistName })"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UFormField :label="$t('edition.artists.notes_label')">
        <UTextarea
          v-model="localNotes"
          :placeholder="$t('edition.artists.notes_placeholder')"
          :rows="8"
          class="w-full"
          autofocus
        />
      </UFormField>
    </template>

    <template #footer="{ close }">
      <UButton
        color="neutral"
        variant="outline"
        @click="close"
      >
        {{ $t('common.cancel') }}
      </UButton>
      <UButton
        color="primary"
        :loading="saving"
        @click="saveNotes"
      >
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
const toast = useToast()
const { t } = useI18n()

const localNotes = ref('')
const saving = ref(false)

const artistName = computed(() => {
  if (!props.artist?.user) return ''
  return `${props.artist.user.prenom} ${props.artist.user.nom}`
})

// Initialiser les notes quand la modal s'ouvre
watch(() => props.artist, (newArtist) => {
  if (newArtist) {
    localNotes.value = newArtist.organizerNotes || ''
  }
}, { immediate: true })

const saveNotes = async () => {
  if (!props.artist?.id) return

  saving.value = true
  try {
    const trimmedNotes = localNotes.value.trim()
    await $fetch(`/api/editions/${props.editionId}/artists/${props.artist.id}/notes`, {
      method: 'PATCH',
      body: {
        organizerNotes: trimmedNotes || null,
      },
    })

    toast.add({
      title: t('edition.artists.notes_saved'),
      color: 'success',
    })

    emit('notesSaved')
    isOpen.value = false
  } catch (error) {
    console.error('Error saving notes:', error)
    toast.add({
      title: t('edition.artists.error_save_notes'),
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
