<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="$t('gestion.treasury.entry_kind')" required>
          <UFieldGroup>
            <UButton
              v-for="option in kindOptions"
              :key="option.value"
              :color="form.kind === option.value ? option.color : 'neutral'"
              :variant="form.kind === option.value ? 'solid' : 'outline'"
              :icon="option.icon"
              :label="option.label"
              @click="form.kind = option.value"
            />
          </UFieldGroup>
        </UFormField>

        <UFormField :label="$t('gestion.treasury.entry_title')" required>
          <UInput v-model="form.title" class="w-full" maxlength="150" />
        </UFormField>

        <UFormField :label="$t('common.description')">
          <UTextarea v-model="form.description" class="w-full" :rows="2" maxlength="2000" />
        </UFormField>

        <div class="flex flex-col gap-4 sm:flex-row">
          <UFormField :label="$t('common.amount')" required class="sm:w-48">
            <!-- Saisie en unité courante ; le serveur convertit en centimes. `step-snapping`
                 désactivé, sinon un montant hors du pas serait ramené au multiple le plus proche. -->
            <UInputNumber
              v-model="form.amount"
              :min="0"
              :step="10"
              :step-snapping="false"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.treasury.entry_code')" class="flex-1">
            <USelectMenu
              v-model="form.codeId"
              value-key="value"
              :items="codeItems"
              class="w-full"
              :search-input="{ placeholder: $t('common.search') }"
            />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('common.cancel')"
          @click="isOpen = false"
        />
        <UButton :loading="saving" :disabled="!isValid" :label="$t('common.save')" @click="save" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  /** Ligne existante à modifier, ou `null` pour une création. */
  entry: {
    entryId?: number
    kind: 'EXPENSE' | 'INCOME'
    title: string
    description?: string | null
    settled: number
    code?: { id: number } | null
  } | null
  codes: { id: number; code: string; label: string }[]
  currency: string
  editionId: number
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const form = reactive<{
  kind: 'EXPENSE' | 'INCOME'
  title: string
  description: string
  amount: number
  codeId: number | null
}>({ kind: 'EXPENSE', title: '', description: '', amount: 0, codeId: null })

const kindOptions = computed(() => [
  {
    value: 'EXPENSE' as const,
    label: t('gestion.treasury.expense'),
    icon: 'i-lucide-trending-down',
    color: 'error' as const,
  },
  {
    value: 'INCOME' as const,
    label: t('gestion.treasury.income'),
    icon: 'i-lucide-trending-up',
    color: 'success' as const,
  },
])

const codeItems = computed(() => [
  { value: null, label: t('gestion.treasury.no_code') },
  ...props.codes.map((c) => ({ value: c.id, label: `${c.code} — ${c.label}` })),
])

const isEditing = computed(() => !!props.entry?.entryId)
const title = computed(() =>
  isEditing.value ? t('gestion.treasury.edit_entry') : t('gestion.treasury.add_entry')
)
const isValid = computed(() => form.title.trim().length > 0 && form.amount > 0)

// Repartir des valeurs de la ligne à chaque ouverture : sans cela, une modification garderait la
// saisie précédente, et une création rouvrirait le dernier montant tapé.
watch(
  () => [props.open, props.entry] as const,
  ([open, entry]) => {
    if (!open) return
    form.kind = entry?.kind ?? 'EXPENSE'
    form.title = entry?.title ?? ''
    form.description = entry?.description ?? ''
    form.amount = entry ? entry.settled / 100 : 0
    form.codeId = entry?.code?.id ?? null
  },
  { immediate: true }
)

const body = () => ({
  kind: form.kind,
  title: form.title.trim(),
  description: form.description.trim() || null,
  amount: form.amount,
  codeId: form.codeId,
})

const { execute: createEntry, loading: creating } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/entries`,
  {
    method: 'POST',
    body,
    successMessage: { title: t('gestion.treasury.entry_saved') },
    errorMessages: { default: t('gestion.treasury.entry_error') },
    onSuccess: () => emit('saved'),
  }
)

const { execute: updateEntry, loading: updating } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/entries/${props.entry?.entryId}`,
  {
    method: 'PUT',
    body,
    successMessage: { title: t('gestion.treasury.entry_saved') },
    errorMessages: { default: t('gestion.treasury.entry_error') },
    onSuccess: () => emit('saved'),
  }
)

const saving = computed(() => creating.value || updating.value)

async function save() {
  if (!isValid.value) return
  if (isEditing.value) await updateEntry()
  else await createEntry()
}
</script>
