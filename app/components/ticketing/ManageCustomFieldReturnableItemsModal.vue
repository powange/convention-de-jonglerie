<script setup lang="ts">
interface CustomField {
  id: number
  label: string
  type: string
  values?: string[]
  returnableItems?: Array<{
    returnableItemId: number
    returnableItem?: { id: number; name: string }
    choiceValue?: string | null
  }>
}

interface Association {
  returnableItemId: number | null
  choiceValue: string | null
}

const props = defineProps<{
  open: boolean
  editionId: number
  customField: CustomField | null
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

const availableItems = ref<Array<{ id: number; name: string }>>([])
const associations = ref<Association[]>([])

const isChoiceList = computed(() => props.customField?.type === 'ChoiceList')

const modalTitle = computed(() =>
  props.customField
    ? t('gestion.ticketing.custom_fields_returnable_items_manage_for', {
        label: props.customField.label,
      })
    : ''
)

const itemOptions = computed(() =>
  availableItems.value.map((item) => ({ label: item.name, value: item.id }))
)

const choiceOptions = computed(() => {
  if (!isChoiceList.value || !props.customField?.values) {
    return [{ label: t('gestion.ticketing.custom_fields_all_choices'), value: null }]
  }
  return [
    { label: t('gestion.ticketing.custom_fields_all_choices'), value: null },
    ...props.customField.values.map((v) => ({ label: v, value: v })),
  ]
})

const { execute: loadAvailableItems, loading } = useApiAction<
  unknown,
  { data: { returnableItems: Array<{ id: number; name: string }> } }
>(() => `/api/editions/${props.editionId}/ticketing/returnable-items`, {
  method: 'GET',
  silentSuccess: true,
  errorMessages: { default: t('gestion.organizers.error_loading_items') },
  onSuccess: (result) => {
    availableItems.value = result?.data?.returnableItems || []
  },
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      associations.value =
        props.customField?.returnableItems?.map((ri) => ({
          returnableItemId: ri.returnableItemId,
          choiceValue: ri.choiceValue ?? null,
        })) ?? []
      loadAvailableItems()
    }
  },
  { immediate: true }
)

function addAssociation() {
  associations.value.push({ returnableItemId: null, choiceValue: null })
}

function removeAssociation(index: number) {
  associations.value.splice(index, 1)
}

const buildSaveBody = () => {
  const valid = associations.value
    .filter(
      (a): a is { returnableItemId: number; choiceValue: string | null } =>
        a.returnableItemId !== null
    )
    .map((a) => ({
      returnableItemId: a.returnableItemId,
      choiceValue: isChoiceList.value ? a.choiceValue : null,
    }))
  return { items: valid }
}

const { execute: save, loading: saving } = useApiAction(
  () =>
    `/api/editions/${props.editionId}/ticketing/custom-fields/${props.customField?.id}/returnable-items`,
  {
    method: 'PUT',
    body: buildSaveBody,
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      emit('saved')
      isOpen.value = false
    },
  }
)
</script>

<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto h-8 w-8" />
      </div>

      <div v-else class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{
              $t('gestion.ticketing.custom_fields_associations_count', {
                count: associations.length,
              })
            }}
          </h3>
          <UButton
            icon="i-heroicons-plus"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="availableItems.length === 0"
            @click="addAssociation"
          >
            {{ $t('common.add') }}
          </UButton>
        </div>

        <p v-if="availableItems.length === 0" class="text-sm text-amber-600 dark:text-amber-400">
          {{ $t('gestion.ticketing.no_returnable_items_created') }}
        </p>

        <div
          v-else-if="associations.length === 0"
          class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <p class="text-sm text-gray-500">
            {{ $t('gestion.ticketing.custom_fields_no_association') }}
          </p>
        </div>

        <div v-else class="space-y-3">
          <UCard v-for="(assoc, index) in associations" :key="index">
            <div
              :class="['grid gap-4', isChoiceList ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1']"
            >
              <UFormField :label="$t('gestion.ticketing.custom_fields_article_label')" required>
                <USelect
                  v-model="assoc.returnableItemId"
                  :items="itemOptions"
                  :placeholder="$t('gestion.ticketing.custom_fields_select_article')"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="isChoiceList"
                :label="$t('gestion.ticketing.custom_fields_choice_label')"
              >
                <USelect
                  v-model="assoc.choiceValue"
                  :items="choiceOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="flex justify-end mt-3">
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="sm"
                @click="removeAssociation(index)"
              >
                {{ $t('common.delete') }}
              </UButton>
            </div>
          </UCard>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" :disabled="loading" @click="save">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
