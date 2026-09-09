<!--
  Déplacer plusieurs objets vers un autre groupe.

  Un geste à part, et non une ligne de la modale de modification : c'est le plus courant après une
  réorganisation du stock, et il n'a qu'une question à poser. L'enfouir au milieu de dix champs
  facultatifs l'aurait rendu plus long qu'il ne doit l'être.
-->
<template>
  <UModal v-model:open="isOpen" :title="t('gestion.stock.bulk_move')">
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('gestion.stock.bulk_move_intro', { count: itemIds.length }) }}
        </p>

        <!-- Le groupe courant ne figure pas dans la liste : s'y déplacer ne ferait rien, et le
             proposer obligeait à comprendre pourquoi le bouton restait inerte. -->
        <UFormField v-if="groupItems.length" :label="t('gestion.stock.item_group')">
          <USelect
            v-model="groupeCible"
            :items="groupItems"
            :placeholder="t('gestion.stock.bulk_move_choose_group')"
            class="w-full"
          />
        </UFormField>
        <p v-else class="text-sm text-gray-500 italic">
          {{ t('gestion.stock.bulk_move_no_other_group') }}
        </p>

        <!-- Dit d'avance ce qui va sembler être une disparition. -->
        <UAlert
          v-if="groupeCible !== undefined"
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          :description="t('gestion.stock.bulk_move_leaves_page')"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="enregistrement"
          :disabled="groupeCible === undefined"
          @click="deplacer"
        >
          {{ t('gestion.stock.bulk_move_apply', { count: itemIds.length }) }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  editionId: number
  itemIds: number[]
  groupeCourantId: number
  groups: Array<{ id: number; name: string }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()
const enregistrement = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

/**
 * Vide tant qu'on n'a rien choisi : il n'y a pas de destination par défaut sensée. `USelect`
 * n'exprime ce vide que par `undefined` — un `null` ne lui conviendrait pas.
 */
const groupeCible = ref<number | undefined>(undefined)

const groupItems = computed(() =>
  props.groups
    .filter((g) => g.id !== props.groupeCourantId)
    .map((g) => ({ label: g.name, value: g.id }))
)

// Chaque ouverture repart de zéro : garder un choix précédent ferait déplacer une autre sélection
// vers une destination qu'on ne regarde plus.
watch(
  () => props.modelValue,
  (ouvert) => {
    if (ouvert) groupeCible.value = undefined
  }
)

async function deplacer() {
  if (groupeCible.value === undefined) return

  enregistrement.value = true
  try {
    await $fetch(`/api/editions/${props.editionId}/stock-items/bulk`, {
      method: 'PATCH',
      body: { itemIds: props.itemIds, stockGroupId: groupeCible.value },
    })
    toast.add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    emit('saved')
    isOpen.value = false
  } catch (e: any) {
    toast.add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    enregistrement.value = false
  }
}
</script>
