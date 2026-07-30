<template>
  <UModal v-model:open="isOpen" :title="$t('gestion.treasury.manage_codes')">
    <template #body>
      <div class="space-y-4">
        <UAlert
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          :description="$t('gestion.treasury.codes_help')"
        />

        <div class="flex flex-col gap-2 sm:flex-row">
          <UInput
            v-model="newCode"
            :placeholder="$t('gestion.treasury.code_placeholder')"
            class="sm:w-32"
            maxlength="32"
          />
          <UInput
            v-model="newLabel"
            :placeholder="$t('gestion.treasury.code_label_placeholder')"
            class="flex-1"
            maxlength="120"
          />
          <UButton
            icon="i-lucide-plus"
            :loading="creating"
            :disabled="!canCreate"
            :label="$t('common.add')"
            @click="addCode"
          />
        </div>

        <div v-if="codes.length" class="divide-y divide-gray-200 dark:divide-gray-800">
          <div
            v-for="code in codes"
            :key="code.id"
            class="flex items-center gap-3 py-2"
            data-testid="treasury-code"
          >
            <UBadge color="neutral" variant="subtle" class="font-mono">{{ code.code }}</UBadge>
            <span class="min-w-0 flex-1 truncate">{{ code.label }}</span>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :loading="removing.isLoading(code.id)"
              @click="removeCode(code.id)"
            />
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.treasury.no_codes_yet') }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('common.close')"
          @click="isOpen = false"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  codes: { id: number; code: string; label: string }[]
  editionId: number
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'changed'): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const newCode = ref('')
const newLabel = ref('')
const canCreate = computed(
  () => newCode.value.trim().length > 0 && newLabel.value.trim().length > 0
)

const { execute: executeCreate, loading: creating } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/codes`,
  {
    method: 'POST',
    body: () => ({ code: newCode.value.trim(), label: newLabel.value.trim() }),
    successMessage: { title: t('gestion.treasury.code_created') },
    errorMessages: { default: t('gestion.treasury.code_create_error') },
    onSuccess: () => {
      newCode.value = ''
      newLabel.value = ''
      emit('changed')
    },
  }
)

async function addCode() {
  if (canCreate.value) await executeCreate()
}

const removing = useApiActionById((id) => `/api/editions/${props.editionId}/treasury/codes/${id}`, {
  method: 'DELETE',
  successMessage: { title: t('gestion.treasury.code_deleted') },
  errorMessages: { default: t('gestion.treasury.code_delete_error') },
  // Les lignes qui l'utilisaient gardent leur montant et perdent seulement leur imputation :
  // supprimer un code ne doit pas faire disparaître des charges.
  onSuccess: () => emit('changed'),
})

async function removeCode(id: number) {
  await removing.execute(id)
}
</script>
