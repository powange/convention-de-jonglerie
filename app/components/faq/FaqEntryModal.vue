<template>
  <UModal
    v-model:open="isOpen"
    :title="entry ? $t('gestion.faq.edit_entry') : $t('gestion.faq.new_entry')"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField :label="$t('gestion.faq.question')" required :error="fieldErrors.question">
          <UInput
            v-model="formData.question"
            :placeholder="$t('gestion.faq.question_placeholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('gestion.faq.answer')" required :error="fieldErrors.answer">
          <MinimalMarkdownEditor v-model="formData.answer" :disabled="saving" />
        </UFormField>

        <USwitch
          v-model="formData.isPublic"
          :label="$t('gestion.faq.is_public')"
          :description="$t('gestion.faq.is_public_help')"
        />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" @click="handleSubmit">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface FaqEntryLite {
  id: number
  question: string
  answer: string
  isPublic: boolean
}

const props = defineProps<{
  open: boolean
  editionId: number
  entry: FaqEntryLite | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const { t } = useI18n()
const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const formData = reactive({
  question: '',
  answer: '',
  isPublic: false,
})
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)

watch(
  () => [props.open, props.entry],
  ([open]) => {
    if (open) {
      formData.question = props.entry?.question || ''
      formData.answer = props.entry?.answer || ''
      formData.isPublic = props.entry?.isPublic ?? false
      fieldErrors.value = {}
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
  fieldErrors.value = {}
  if (!formData.question.trim()) {
    fieldErrors.value = { question: t('errors.required_field') }
    return
  }
  if (!formData.answer.trim()) {
    fieldErrors.value = { answer: t('errors.required_field') }
    return
  }
  saving.value = true
  try {
    const body = {
      question: formData.question.trim(),
      answer: formData.answer.trim(),
      isPublic: formData.isPublic,
    }
    if (props.entry) {
      await $fetch(`/api/editions/${props.editionId}/faq/${props.entry.id}`, {
        method: 'PUT',
        body,
      })
    } else {
      await $fetch(`/api/editions/${props.editionId}/faq`, {
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
</script>
