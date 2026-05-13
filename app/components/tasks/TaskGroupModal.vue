<template>
  <UModal
    v-model:open="isOpen"
    :title="group ? $t('gestion.tasks.edit_group') : $t('gestion.tasks.new_group')"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField :label="$t('gestion.tasks.group_name')" required :error="fieldErrors.name">
          <UInput
            v-model="formData.name"
            :placeholder="$t('gestion.tasks.group_name_placeholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="$t('gestion.tasks.group_description')" :error="fieldErrors.description">
          <UTextarea
            v-model="formData.description"
            :placeholder="$t('gestion.tasks.group_description_placeholder')"
            :rows="3"
            class="w-full"
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <UButton
          v-if="group"
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          :loading="deleting"
          @click="handleDelete"
        >
          {{ $t('common.delete') }}
        </UButton>
        <div v-else />
        <div class="flex gap-2">
          <UButton variant="ghost" color="neutral" @click="isOpen = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="saving" @click="handleSubmit">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface TaskGroupItem {
  id: number
  name: string
  description: string | null
}

const props = defineProps<{
  open: boolean
  editionId: number
  group: TaskGroupItem | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
  deleted: []
}>()

const { t } = useI18n()
const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const formData = reactive<{ name: string; description: string }>({ name: '', description: '' })
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)
const deleting = ref(false)

function resetFieldErrors() {
  fieldErrors.value = {}
}

watch(
  () => [props.open, props.group],
  ([open]) => {
    if (open) {
      formData.name = props.group?.name || ''
      formData.description = props.group?.description || ''
      resetFieldErrors()
    }
  },
  { immediate: true }
)

function applyApiErrors(e: any): boolean {
  const errors = e?.data?.data?.errors || e?.data?.errors
  if (!errors || typeof errors !== 'object') return false
  const next: Record<string, string> = {}
  for (const [path, message] of Object.entries(errors as Record<string, string>)) {
    const fieldName = path.split('.')[0]
    if (!next[fieldName]) next[fieldName] = message
  }
  fieldErrors.value = next
  return true
}

async function handleSubmit() {
  resetFieldErrors()
  if (!formData.name.trim()) {
    fieldErrors.value = { name: t('errors.required_field') }
    return
  }
  saving.value = true
  try {
    const body = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
    }
    if (props.group) {
      await $fetch(`/api/editions/${props.editionId}/task-groups/${props.group.id}`, {
        method: 'PUT',
        body,
      })
    } else {
      await $fetch(`/api/editions/${props.editionId}/task-groups`, {
        method: 'POST',
        body,
      })
    }
    useToast().add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    emit('saved')
    isOpen.value = false
  } catch (e: any) {
    const hasFieldErrors = applyApiErrors(e)
    useToast().add({
      title: hasFieldErrors
        ? e?.data?.data?.message || e?.data?.message || t('errors.validation_error')
        : e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.group) return
  if (!confirm(t('gestion.tasks.confirm_delete_group_simple', { name: props.group.name }))) return
  deleting.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/task-groups/${props.group.id}`, {
      method: 'DELETE',
    })
    useToast().add({
      title: t('common.deleted'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    emit('deleted')
    isOpen.value = false
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}
</script>
