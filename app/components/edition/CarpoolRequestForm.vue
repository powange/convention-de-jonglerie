<template>
  <CarpoolFormBase
    :form-type="'request'"
    :edition-id="editionId"
    :initial-data="initialData"
    @submit="handleSubmit"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
import CarpoolFormBase from './CarpoolFormBase.vue'

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