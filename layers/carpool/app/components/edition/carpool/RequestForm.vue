<template>
  <EditionCarpoolFormBase
    :form-type="'request'"
    :edition-id="editionId"
    :initial-data="initialData"
    :is-editing="isEditing"
    @success="handleSuccess"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
// Auto-imported: EditionCarpoolFormBase

interface Props {
  editionId: string
  initialData?: any
  isEditing?: boolean
}

defineProps<Props>()
const emit = defineEmits(['success', 'cancel'])

const handleSuccess = (data: any) => {
  emit('success', data)
}

const handleCancel = () => {
  emit('cancel')
}
</script>
