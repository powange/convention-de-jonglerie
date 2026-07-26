<script setup lang="ts">
/**
 * Sélection d'articles à remettre avec, pour chacun, le nombre d'exemplaires.
 *
 * Mutualise le motif repris par les écrans qui associent des articles en bloc
 * (spectacles, repas, tarifs, options, champs personnalisés) : un multi-select
 * suivi d'une ligne de quantité par article retenu.
 *
 * `v-model` porte directement la forme attendue par les API :
 * `[{ handoutItemId, quantity }]`.
 */
interface HandoutItemOption {
  id: number
  name: string
}

interface HandoutItemSelection {
  handoutItemId: number
  quantity: number
}

const props = withDefaults(
  defineProps<{
    modelValue: HandoutItemSelection[]
    items: HandoutItemOption[]
    /** Masque le libellé « Quantité » quand l'écran en fournit déjà un */
    hideQuantityLabel?: boolean
    disabled?: boolean
  }>(),
  { hideQuantityLabel: false, disabled: false }
)

const emit = defineEmits<{ 'update:modelValue': [HandoutItemSelection[]] }>()

const itemOptions = computed(() =>
  props.items.map((item) => ({ label: item.name, value: item.id }))
)

const selectedIds = computed({
  get: () => props.modelValue.map((entry) => entry.handoutItemId),
  set: (ids: number[]) => {
    // Conserve les quantités déjà saisies ; toute nouvelle sélection démarre à 1.
    const previous = new Map(props.modelValue.map((e) => [e.handoutItemId, e.quantity]))
    emit(
      'update:modelValue',
      ids.map((handoutItemId) => ({
        handoutItemId,
        quantity: previous.get(handoutItemId) ?? 1,
      }))
    )
  },
})

const selectedRows = computed(() =>
  props.modelValue.map((entry) => ({
    ...entry,
    name:
      props.items.find((item) => item.id === entry.handoutItemId)?.name ??
      `#${entry.handoutItemId}`,
  }))
)

const removeItem = (handoutItemId: number) => {
  emit(
    'update:modelValue',
    props.modelValue.filter((entry) => entry.handoutItemId !== handoutItemId)
  )
}

const setQuantity = (handoutItemId: number, quantity: number) => {
  emit(
    'update:modelValue',
    props.modelValue.map((entry) =>
      entry.handoutItemId === handoutItemId
        ? { ...entry, quantity: Math.max(1, Math.trunc(quantity) || 1) }
        : entry
    )
  )
}
</script>

<template>
  <div class="space-y-4">
    <USelectMenu
      v-model="selectedIds"
      :items="itemOptions"
      value-key="value"
      multiple
      :disabled="disabled || items.length === 0"
      :placeholder="$t('gestion.ticketing.select_handout_items_placeholder')"
      class="w-full"
    >
      <template #label>
        <span v-if="selectedIds.length === 0">
          {{ $t('gestion.ticketing.no_items_selected') }}
        </span>
        <span v-else>
          {{ $t('gestion.ticketing.items_selected_count', { count: selectedIds.length }) }}
        </span>
      </template>
    </USelectMenu>

    <div v-if="selectedRows.length > 0" class="space-y-2">
      <p v-if="!hideQuantityLabel" class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ $t('common.quantity') }}
      </p>
      <div
        v-for="row in selectedRows"
        :key="row.handoutItemId"
        class="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
      >
        <span class="text-sm flex-1 min-w-0 truncate">{{ row.name }}</span>
        <UInputNumber
          :model-value="row.quantity"
          :min="1"
          :max="999"
          size="sm"
          class="w-28 shrink-0"
          :disabled="disabled"
          :aria-label="$t('common.quantity')"
          @update:model-value="setQuantity(row.handoutItemId, $event as number)"
        />
        <UButton
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          size="sm"
          :disabled="disabled"
          :aria-label="$t('common.remove')"
          @click="removeItem(row.handoutItemId)"
        />
      </div>
    </div>
  </div>
</template>
