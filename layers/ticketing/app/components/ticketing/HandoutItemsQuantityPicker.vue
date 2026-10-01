<script setup lang="ts">
import { normaliserPhases, PHASES_EDITION, type PhaseEdition } from '~~/shared/utils/phases-edition'

/**
 * Sélection d'articles à remettre avec, pour chacun, le nombre d'exemplaires.
 *
 * Mutualise le motif repris par les écrans qui associent des articles en bloc
 * (spectacles, repas, tarifs, options, champs personnalisés) : un multi-select
 * suivi d'une ligne de quantité par article retenu.
 *
 * `v-model` porte directement la forme attendue par les API :
 * `[{ handoutItemId, quantity }]`.
 *
 * ⚠️ LES PHASES SONT OPTIONNELLES, et c'est indispensable : ce composant sert aussi aux
 * spectacles, repas, tarifs, options et champs personnalisés, dont les tables n'ont pas de colonne
 * `phases`. Seul l'écran des bénévoles passe `avec-phases`, et lui seul voit le sélecteur
 * apparaître. Les autres écrans ne changent ni d'apparence ni de charge utile.
 */
interface HandoutItemOption {
  id: number
  name: string
}

interface HandoutItemSelection {
  handoutItemId: number
  quantity: number
  /** Vide ou absent = toutes les phases. Voir `shared/utils/phases-edition.ts`. */
  phases?: PhaseEdition[]
}

const props = withDefaults(
  defineProps<{
    modelValue: HandoutItemSelection[]
    items: HandoutItemOption[]
    /** Masque le libellé « Quantité » quand l'écran en fournit déjà un */
    hideQuantityLabel?: boolean
    /** Propose, par article, les phases où il est remis. Bénévoles uniquement. */
    avecPhases?: boolean
    disabled?: boolean
  }>(),
  { hideQuantityLabel: false, avecPhases: false, disabled: false }
)

const emit = defineEmits<{ 'update:modelValue': [HandoutItemSelection[]] }>()

const { t } = useI18n()

const itemOptions = computed(() =>
  props.items.map((item) => ({ label: item.name, value: item.id }))
)

const CLES_DE_PHASE: Record<PhaseEdition, string> = {
  SETUP: 'common.setup',
  EVENT: 'common.event',
  TEARDOWN: 'common.teardown',
}

/** Les mêmes libellés que les repas : `common.setup` / `common.event` / `common.teardown`. */
const optionsDePhase = computed(() =>
  PHASES_EDITION.map((phase) => ({ label: t(CLES_DE_PHASE[phase]), value: phase }))
)

const selectedIds = computed({
  get: () => props.modelValue.map((entry) => entry.handoutItemId),
  set: (ids: number[]) => {
    // Conserve les quantités déjà saisies ; toute nouvelle sélection démarre à 1.
    // Conserve aussi les phases : retirer puis remettre un article ne doit pas effacer un choix
    // que l'utilisateur vient de faire sur la ligne voisine.
    const previous = new Map(props.modelValue.map((e) => [e.handoutItemId, e]))
    emit(
      'update:modelValue',
      ids.map((handoutItemId) => ({
        handoutItemId,
        quantity: previous.get(handoutItemId)?.quantity ?? 1,
        phases: previous.get(handoutItemId)?.phases ?? [],
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

const setPhases = (handoutItemId: number, phases: PhaseEdition[]) => {
  emit(
    'update:modelValue',
    props.modelValue.map((entry) =>
      entry.handoutItemId === handoutItemId ? { ...entry, phases: normaliserPhases(phases) } : entry
    )
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
      <template #default>
        <span v-if="selectedIds.length === 0">
          {{ $t('gestion.ticketing.no_items_selected') }}
        </span>
        <span v-else>
          {{ $t('gestion.ticketing.items_selected_count', { count: selectedIds.length }) }}
        </span>
      </template>
    </USelectMenu>

    <div v-if="selectedRows.length > 0" class="space-y-2">
      <!-- ⚠️ Le titre couvre les DEUX réglages quand les périodes sont proposées. Laisser
           « Quantité » au-dessus d'une liste déroulante de périodes la rendait indevinable : on
           lisait « Toutes les périodes » comme une valeur, sans voir que c'était un choix. -->
      <p v-if="!hideQuantityLabel" class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{
          avecPhases ? $t('ticketing.handout_items.periodes_et_quantite') : $t('common.quantity')
        }}
      </p>
      <div
        v-for="row in selectedRows"
        :key="row.handoutItemId"
        class="flex flex-col gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg sm:flex-row sm:items-center sm:gap-3"
      >
        <span class="text-sm flex-1 min-w-0 truncate">{{ row.name }}</span>
        <!-- ⚠️ Vide = TOUTES les phases, et le texte du champ le dit : laisser « aucune phase
             choisie » sans l'expliquer ferait croire que l'article n'est remis à personne. -->
        <div v-if="avecPhases" class="flex flex-col gap-1 w-full sm:w-56 shrink-0">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('ticketing.handout_items.periodes') }}
          </span>
          <USelectMenu
            :model-value="row.phases ?? []"
            :items="optionsDePhase"
            value-key="value"
            multiple
            size="sm"
            class="w-full"
            :disabled="disabled"
            :placeholder="$t('ticketing.handout_items.phases_toutes')"
            @update:model-value="setPhases(row.handoutItemId, $event as PhaseEdition[])"
          >
            <template #default>
              <span v-if="(row.phases ?? []).length === 0">
                {{ $t('ticketing.handout_items.phases_toutes') }}
              </span>
              <span v-else>
                {{ (row.phases ?? []).map((phase) => $t(CLES_DE_PHASE[phase])).join(', ') }}
              </span>
            </template>
          </USelectMenu>
        </div>
        <div class="flex flex-col gap-1 shrink-0">
          <span v-if="avecPhases" class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('common.quantity') }}
          </span>
          <UInputNumber
            :model-value="row.quantity"
            :min="1"
            :max="999"
            size="sm"
            class="w-28"
            :disabled="disabled"
            :aria-label="$t('common.quantity')"
            @update:model-value="setQuantity(row.handoutItemId, $event as number)"
          />
        </div>
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
