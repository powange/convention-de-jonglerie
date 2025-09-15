<template>
  <EditionCarpoolFormBase
    :form-type="'request'"
    :edition-id="editionId"
    :initial-data="initialData"
    @submit="handleSubmit"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
// Auto-imported: EditionCarpoolFormBase

interface Props {
  editionId: string
  initialData?: any
}

defineProps<Props>()
const emit = defineEmits(['created', 'cancel'])

const handleSubmit = (data: any) => {
  emit('created', data)
}

const handleCancel = () => {
  emit('cancel')
}
</script>
