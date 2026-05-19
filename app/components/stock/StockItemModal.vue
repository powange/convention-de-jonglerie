<template>
  <UModal
    v-model:open="isOpen"
    :title="item ? $t('gestion.stock.edit_item') : $t('gestion.stock.new_item')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField :label="$t('gestion.stock.item_name')" required :error="fieldErrors.name">
          <UInput
            v-model="formData.name"
            :placeholder="$t('gestion.stock.item_name_placeholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('gestion.stock.item_description')" :error="fieldErrors.description">
          <UTextarea
            v-model="formData.description"
            :placeholder="$t('gestion.stock.item_description_placeholder')"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('gestion.stock.item_quantity')" :error="fieldErrors.quantity">
          <div class="flex flex-wrap items-center gap-1">
            <UButton
              v-for="n in 10"
              :key="n"
              :variant="formData.quantity === n ? 'solid' : 'soft'"
              :color="formData.quantity === n ? 'primary' : 'neutral'"
              size="sm"
              :ui="{ base: 'min-w-9 justify-center' }"
              @click="formData.quantity = n"
            >
              {{ n }}
            </UButton>
            <UInputNumber
              v-model="formData.quantity"
              :min="1"
              :step="1"
              class="w-28 ml-1"
              :ui="{ base: 'text-center' }"
            />
          </div>
        </UFormField>

        <UFormField :label="$t('gestion.stock.item_notes')" :error="fieldErrors.notes">
          <UTextarea
            v-model="formData.notes"
            :placeholder="$t('gestion.stock.item_notes_placeholder')"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <!-- Bloc Emprunt externe -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
          <USwitch
            v-model="formData.isExternalLoan"
            :label="$t('gestion.stock.external_loan')"
            :description="$t('gestion.stock.external_loan_help')"
          />

          <div v-if="formData.isExternalLoan" class="space-y-3 pt-1">
            <UFormField :label="$t('gestion.stock.owner_contact')">
              <UTextarea
                v-model="formData.ownerContact"
                :placeholder="$t('gestion.stock.owner_contact_placeholder')"
                :rows="2"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="$t('gestion.stock.return_due_at')">
              <UInput v-model="formData.returnDueAt" type="date" class="w-full" />
            </UFormField>
          </div>
        </div>

        <p v-if="!item" class="text-xs text-gray-500 italic">
          {{ $t('gestion.stock.locations_managed_separately_hint') }}
        </p>
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
interface StockItemLite {
  id: number
  name: string
  description: string | null
  quantity: number
  notes: string | null
  isExternalLoan?: boolean
  ownerContact?: string | null
  returnDueAt?: string | null
}

const props = defineProps<{
  open: boolean
  editionId: number
  groupId: number
  item: StockItemLite | null
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
  name: '',
  description: '',
  quantity: 1,
  notes: '',
  isExternalLoan: false,
  ownerContact: '',
  returnDueAt: '',
})

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toISOString().split('T')[0]
  } catch {
    return ''
  }
}
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)

function resetFieldErrors() {
  fieldErrors.value = {}
}

watch(
  () => [props.open, props.item],
  ([open]) => {
    if (open) {
      formData.name = props.item?.name || ''
      formData.description = props.item?.description || ''
      formData.quantity = props.item?.quantity ?? 1
      formData.notes = props.item?.notes || ''
      formData.isExternalLoan = props.item?.isExternalLoan ?? false
      formData.ownerContact = props.item?.ownerContact || ''
      formData.returnDueAt = toDateInput(props.item?.returnDueAt)
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
  if (!formData.quantity || formData.quantity < 1) {
    fieldErrors.value = { quantity: t('errors.required_field') }
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      quantity: formData.quantity,
      notes: formData.notes.trim() || null,
      isExternalLoan: formData.isExternalLoan,
      ownerContact: formData.isExternalLoan
        ? formData.ownerContact.trim() || null
        : null,
      returnDueAt:
        formData.isExternalLoan && formData.returnDueAt
          ? new Date(formData.returnDueAt).toISOString()
          : null,
    }
    if (props.item) {
      await $fetch(`/api/editions/${props.editionId}/stock-items/${props.item.id}`, {
        method: 'PUT',
        body,
      })
    } else {
      await $fetch(`/api/editions/${props.editionId}/stock-groups/${props.groupId}/items`, {
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
