<template>
  <div>
    <div v-if="pending" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <div v-else-if="!canEdit">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>

    <div v-else class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('gestion.map.import_title') }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('gestion.map.import_subtitle', { name: data?.mapName ?? '' }) }}
          </p>
        </div>
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="outline"
          :to="`/editions/${editionId}/gestion/map`"
          :label="$t('gestion.map.import_back')"
        />
      </div>

      <UAlert
        v-if="error"
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('gestion.map.import_fetch_failed')"
        :description="error.data?.message || error.message"
      />

      <template v-else>
        <!-- Sans identifiants, un réimport ne saura plus distinguer un objet déplacé d'un objet
             supprimé : l'import reste possible, mais l'organisateur doit le savoir. -->
        <UAlert
          v-if="data && !data.identified"
          icon="i-lucide-info"
          color="warning"
          variant="subtle"
          :title="$t('gestion.map.import_no_ids_title')"
          :description="$t('gestion.map.import_no_ids_help')"
        />

        <UAlert
          v-if="importedCount > 0 && edition.externalMapRef"
          icon="i-lucide-map"
          color="info"
          variant="subtle"
          :title="$t('gestion.map.import_switch_title')"
          :description="$t('gestion.map.import_switch_help')"
        >
          <template #actions>
            <UButton
              size="xs"
              color="info"
              :loading="switching"
              :label="$t('gestion.map.import_switch_action')"
              @click="switchToInternalMap"
            />
          </template>
        </UAlert>

        <!-- Un objet par calque, le calque portant la catégorisation déjà faite en dessinant. -->
        <UCard v-for="layer in layers" :key="layer.key">
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-layers" class="h-5 w-5" />
                <h2 class="font-semibold">{{ layer.name || $t('gestion.map.import_no_layer') }}</h2>
                <UBadge color="neutral" variant="subtle" size="sm">
                  {{ layer.rows.length }}
                </UBadge>
              </div>

              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <USelectMenu
                  v-model="layerTypes[layer.key]"
                  multiple
                  value-key="value"
                  :items="typeItems"
                  size="sm"
                  class="w-56"
                  :placeholder="$t('gestion.map.import_layer_types')"
                  :search-input="{ placeholder: $t('common.search') }"
                />
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-wand-sparkles"
                  :label="$t('gestion.map.import_layer_apply')"
                  @click="applyLayerTypes(layer)"
                />
                <UButton
                  size="sm"
                  icon="i-lucide-download"
                  :loading="layerImporting === layer.key"
                  :disabled="layer.pending.length === 0"
                  :label="$t('gestion.map.import_layer_all', { count: layer.pending.length })"
                  @click="importLayer(layer)"
                />
              </div>
            </div>
          </template>

          <div class="divide-y divide-gray-200 dark:divide-gray-800">
            <div
              v-for="row in layer.rows"
              :key="row.key"
              class="flex flex-col gap-3 py-3 lg:flex-row lg:items-center"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <UIcon :name="kindIcon(row)" class="h-5 w-5 shrink-0 text-gray-400" />
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ row.name }}</p>
                  <p v-if="row.hint" class="truncate text-xs text-gray-500 dark:text-gray-400">
                    {{ row.hint }}
                  </p>
                </div>
              </div>

              <div v-if="row.state === 'unsupported'" class="flex items-center gap-2">
                <UBadge color="neutral" variant="subtle">
                  {{ $t('gestion.map.import_state_unsupported') }}
                </UBadge>
              </div>

              <template v-else-if="row.state === 'importable' || row.state === 'imported'">
                <div class="flex flex-wrap items-center gap-2">
                  <USelectMenu
                    v-model="draft[row.key]!.types"
                    multiple
                    value-key="value"
                    :items="typeItems"
                    size="sm"
                    class="w-48"
                    :search-input="{ placeholder: $t('common.search') }"
                  />
                  <UPopover>
                    <UButton size="sm" color="neutral" variant="outline">
                      <span
                        class="h-4 w-4 rounded-full border border-gray-300 dark:border-gray-600"
                        :style="{ backgroundColor: draft[row.key]!.color }"
                      />
                    </UButton>
                    <template #content>
                      <div class="p-3">
                        <UiColorPicker
                          v-model="draft[row.key]!.color"
                          :palette="[...ZONE_PALETTE]"
                          format="hex"
                          :columns="8"
                          allow-custom
                          :custom-label="$t('gestion.map.custom_color')"
                        />
                      </div>
                    </template>
                  </UPopover>

                  <!-- Une fois importée, la ligne affiche son état plutôt qu'un bouton toujours
                       actif. Le bouton revient dès qu'un réglage diffère de ce qui est enregistré :
                       c'est alors un réimport, qui écrase les valeurs précédentes. -->
                  <UBadge
                    v-if="row.state === 'imported' && !canReimport(row)"
                    color="success"
                    variant="subtle"
                    icon="i-lucide-check"
                  >
                    {{ $t('gestion.map.import_state_imported') }}
                  </UBadge>
                  <UButton
                    v-else
                    size="sm"
                    icon="i-lucide-download"
                    :color="row.state === 'imported' ? 'warning' : 'primary'"
                    :loading="importAction.isLoading(row.key)"
                    :label="
                      row.state === 'imported'
                        ? $t('gestion.map.import_reimport')
                        : $t('gestion.map.import_action')
                    "
                    @click="importRow(row)"
                  />

                  <UBadge v-if="row.editedLocally" color="warning" variant="subtle">
                    {{ $t('gestion.map.import_state_edited') }}
                  </UBadge>
                  <UButton
                    v-if="row.state === 'imported'"
                    size="sm"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-undo-2"
                    :loading="deleteAction.isLoading(row.key)"
                    :label="$t('common.remove')"
                    @click="confirmDelete(row)"
                  />
                </div>
              </template>
            </div>
          </div>
        </UCard>

        <!-- Objets disparus de la carte Google. Section à part : « n'existe plus » n'a rien à voir
             avec « jamais classé dans un calque ». -->
        <UCard v-if="missingRows.length > 0">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-help-circle" class="h-5 w-5 text-amber-500" />
              <h2 class="font-semibold">{{ $t('gestion.map.import_state_missing') }}</h2>
              <UBadge color="warning" variant="subtle" size="sm">{{ missingRows.length }}</UBadge>
            </div>
          </template>

          <div class="divide-y divide-gray-200 dark:divide-gray-800">
            <div
              v-for="row in missingRows"
              :key="row.key"
              class="flex flex-col gap-3 py-3 lg:flex-row lg:items-center"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <UIcon :name="kindIcon(row)" class="h-5 w-5 shrink-0 text-gray-400" />
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ row.name }}</p>
                  <p
                    v-if="row.dependencyLabel"
                    class="truncate text-xs text-amber-600 dark:text-amber-400"
                  >
                    {{ row.dependencyLabel }}
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UBadge v-if="row.editedLocally" color="warning" variant="subtle">
                  {{ $t('gestion.map.import_state_edited') }}
                </UBadge>
                <UButton
                  size="sm"
                  color="error"
                  variant="outline"
                  icon="i-lucide-trash-2"
                  :loading="deleteAction.isLoading(row.key)"
                  :label="$t('common.delete')"
                  @click="confirmDelete(row)"
                />
              </div>
            </div>
          </div>
        </UCard>

        <UAlert
          v-if="data && data.rows.length === 0"
          icon="i-lucide-inbox"
          color="neutral"
          variant="subtle"
          :title="$t('gestion.map.import_empty')"
        />
      </template>
    </div>

    <!-- La suppression détache silencieusement spectacles, ateliers et stock : la confirmation
         doit dire ce qui perdra son lieu, la base ne s'y opposant pas. -->
    <UModal
      :open="!!pendingDelete"
      :title="$t('gestion.map.import_delete_title')"
      @update:open="(v: boolean) => !v && (pendingDelete = null)"
    >
      <template #body>
        <p>{{ $t('gestion.map.import_delete_confirm', { name: pendingDelete?.name ?? '' }) }}</p>
        <UAlert
          v-if="pendingDelete?.dependencyLabel"
          class="mt-3"
          icon="i-lucide-unlink"
          color="warning"
          variant="subtle"
          :title="$t('gestion.map.import_delete_dependencies')"
          :description="pendingDelete.dependencyLabel"
        />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('common.cancel')"
            @click="pendingDelete = null"
          />
          <!-- `deleteAction.loading` est une ref à l'intérieur d'un objet : le template ne la
               déballe pas et elle serait toujours vraie, laissant le bouton désactivé.
               `isLoading()` renvoie un booléen. -->
          <UButton
            color="error"
            :label="$t('common.delete')"
            :loading="!!pendingDelete && deleteAction.isLoading(pendingDelete.key)"
            @click="runDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

import {
  EDITION_ZONE_TYPES,
  ZONE_TYPE_COLORS,
  getZoneTypeIcon,
  type EditionZoneType,
} from '~~/shared/utils/zone-types'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const ZONE_PALETTE = Object.values(ZONE_TYPE_COLORS)

const typeItems = computed(() =>
  EDITION_ZONE_TYPES.map((type) => ({
    label: t(`map.types.${type.toLowerCase()}`),
    value: type,
    icon: getZoneTypeIcon(type),
  }))
)

interface ApiRow {
  state: 'importable' | 'imported' | 'missing' | 'unsupported'
  object?: {
    externalId: string | null
    name: string
    description: string | null
    layer: string | null
    kind: 'polygon' | 'point' | 'line'
    coordinates: [number, number][]
    color: string | null
  }
  record?: {
    id: number
    name: string
    kind: 'zone' | 'marker'
    color: string | null
    types: string[]
    dependencies: {
      shows: number
      workshops: number
      stockItems: number
      stockReservations: number
    }
  }
  editedLocally?: boolean
}

const { data, pending, error } = await useFetch<{
  mapName: string | null
  identified: boolean
  rows: ApiRow[]
  layers: string[]
}>(() => `/api/editions/${editionId.value}/external-map/objects`, {
  transform: (payload: any) => payload?.data ?? payload,
})

/** Brouillon de saisie par ligne : catégories et couleur, pré-remplis depuis la carte. */
const draft = reactive<Record<string, { types: EditionZoneType[]; color: string }>>({})
const layerTypes = reactive<Record<string, EditionZoneType[]>>({})

/**
 * L'identifiant du fournisseur est préféré : il ne change pas quand la ligne passe de « à
 * importer » à « importé ». Une clé qui changerait ferait perdre le brouillon de saisie et
 * remonterait la ligne comme neuve.
 */
function rowKey(row: ApiRow, index: number): string {
  if (row.object?.externalId) return `obj-${row.object.externalId}`
  if (row.record) return `${row.record.kind}-${row.record.id}`
  return `obj-${index}`
}

interface ViewRow {
  key: string
  state: ApiRow['state']
  name: string
  hint: string | null
  editedLocally: boolean
  object?: ApiRow['object']
  record?: ApiRow['record']
  dependencyLabel: string | null
}

function dependencyLabel(record: ApiRow['record']): string | null {
  if (!record) return null
  const parts: string[] = []
  const d = record.dependencies
  if (d.shows) parts.push(t('gestion.map.import_dep_shows', d.shows))
  if (d.workshops) parts.push(t('gestion.map.import_dep_workshops', d.workshops))
  if (d.stockItems) parts.push(t('gestion.map.import_dep_stock', d.stockItems))
  if (d.stockReservations) parts.push(t('gestion.map.import_dep_reservations', d.stockReservations))
  return parts.length ? parts.join(', ') : null
}

const rows = computed<ViewRow[]>(() =>
  (data.value?.rows ?? []).map((row, index) => {
    const key = rowKey(row, index)
    return {
      key,
      state: row.state,
      name: row.object?.name || row.record?.name || '',
      hint: row.state === 'unsupported' ? t('gestion.map.import_unsupported_help') : null,
      editedLocally: !!row.editedLocally,
      object: row.object,
      record: row.record,
      dependencyLabel: dependencyLabel(row.record),
    }
  })
)

interface LayerGroup {
  key: string
  name: string | null
  rows: ViewRow[]
  pending: ViewRow[]
}

/**
 * Les objets disparus n'ont plus de calque : les ranger avec les objets réellement sans calque
 * mêlerait « jamais classé » et « n'existe plus », deux situations sans rapport. Ils ont donc
 * leur propre section.
 */
const missingRows = computed(() => rows.value.filter((r) => r.state === 'missing'))

const layers = computed<LayerGroup[]>(() => {
  const groups = new Map<string, LayerGroup>()
  for (const row of rows.value) {
    if (row.state === 'missing') continue
    const name = row.object?.layer ?? null
    const key = name ?? '__sans_calque__'
    let group = groups.get(key)
    if (!group) {
      group = { key, name, rows: [], pending: [] }
      groups.set(key, group)
    }
    group.rows.push(row)
    if (row.state === 'importable') group.pending.push(row)
  }
  return [...groups.values()]
})

const importedCount = computed(() => rows.value.filter((r) => r.state === 'imported').length)

/** Initialise les brouillons dès que les données arrivent, sans écraser une saisie en cours. */
watch(
  rows,
  (list) => {
    for (const row of list) {
      if (draft[row.key]) continue
      if (row.state === 'importable') {
        draft[row.key] = {
          types: ['OTHER'],
          color: row.object?.color ?? ZONE_TYPE_COLORS.OTHER,
        }
      } else if (row.state === 'imported' && row.record) {
        // Une ligne déjà importée part de ce qui est enregistré : c'est l'écart avec ces
        // valeurs, et lui seul, qui fera réapparaître le bouton de réimport.
        draft[row.key] = {
          types: (row.record.types.length ? row.record.types : ['OTHER']) as EditionZoneType[],
          color: row.record.color ?? row.object?.color ?? ZONE_TYPE_COLORS.OTHER,
        }
      }
    }
    for (const layer of layers.value) {
      if (!layerTypes[layer.key]) layerTypes[layer.key] = ['OTHER']
    }
  },
  { immediate: true }
)

/**
 * Vrai quand les réglages de la ligne diffèrent de ce qui est enregistré. Comparer aux valeurs
 * de la base plutôt qu'à un instantané local évite de proposer un réimport après un simple
 * rechargement de page.
 */
function hasPendingChanges(row: ViewRow): boolean {
  const entry = draft[row.key]
  if (!entry || !row.record) return false
  if ((entry.color ?? '').toUpperCase() !== (row.record.color ?? '').toUpperCase()) return true
  const current = [...entry.types].sort()
  const stored = [...row.record.types].sort()
  return current.length !== stored.length || current.some((t, i) => t !== stored[i])
}

/**
 * Deux raisons de rouvrir l'import d'une ligne déjà importée :
 *
 * - ses réglages ont été modifiés ici et n'ont pas encore été appliqués ;
 * - l'objet a été retouché dans l'application depuis l'import, et l'organisateur peut vouloir
 *   revenir à la version de la carte d'origine. Sans cela, une retouche locale figerait la ligne.
 */
function canReimport(row: ViewRow): boolean {
  return row.state === 'imported' && (hasPendingChanges(row) || row.editedLocally)
}

function kindIcon(row: ViewRow): string {
  if (row.object?.kind === 'point' || row.record?.kind === 'marker') return 'i-lucide-map-pin'
  if (row.object?.kind === 'line') return 'i-lucide-spline'
  return 'i-lucide-pentagon'
}

function applyLayerTypes(layer: LayerGroup) {
  const types = layerTypes[layer.key]
  if (!types?.length) return
  for (const row of layer.pending) {
    const entry = draft[row.key]
    if (entry) entry.types = [...types]
  }
}

/** Le corps est reconstruit à partir de la clé de ligne, `useApiActionById` ne recevant qu'un id. */
function importBodyFor(key: string | number) {
  const row = rows.value.find((r) => r.key === key)
  const entry = draft[String(key)]
  const object = row?.object
  if (!entry || !object) return {}
  return {
    externalId: object.externalId,
    kind: object.kind,
    name: object.name || t('gestion.map.import_unnamed'),
    description: object.description,
    color: entry.color,
    types: entry.types.length ? entry.types : ['OTHER'],
    coordinates: object.coordinates,
  }
}

const importAction = useApiActionById<{ item: unknown; alreadyImported: boolean }>(
  () => `/api/editions/${editionId.value}/external-map/import`,
  {
    method: 'POST',
    body: (key) => importBodyFor(key),
    silentSuccess: true,
    errorMessages: { default: t('gestion.map.import_error') },
  }
)

/**
 * `refresh` est désactivé pendant un import groupé, qui rafraîchit une seule fois à la fin :
 * recharger après chaque objet rendrait la liste instable sous les yeux de l'organisateur.
 */
/**
 * Remplace la liste des lignes.
 *
 * `useFetch` expose ses données dans une référence **superficielle** (`options.deep ? ref :
 * shallowRef`). Modifier une ligne sur place ne déclencherait donc aucun rendu : il faut
 * réaffecter `data.value`. Le rechargement d'avant masquait le problème en remplaçant tout.
 */
function replaceRows(update: (rows: ApiRow[]) => ApiRow[]) {
  const current = data.value
  if (!current) return
  data.value = { ...current, rows: update([...current.rows]) }
}

/**
 * Met à jour la ligne à partir de la réponse, sans recharger la liste.
 *
 * Un rechargement referait télécharger et analyser la carte du fournisseur à chaque objet — une
 * centaine de kilo-octets et deux requêtes externes pour un seul clic — et ferait sauter la page
 * sous les yeux de l'organisateur.
 */
function applyImportedItem(row: ViewRow, item: Record<string, any>) {
  if (!row.object) return
  const kind = row.object.kind === 'polygon' ? 'zone' : 'marker'
  const rawTypes = item.zoneTypes ?? item.markerTypes

  replaceRows((rows) =>
    rows.map((r, i) =>
      rowKey(r, i) === row.key
        ? {
            ...r,
            state: 'imported' as const,
            editedLocally: false,
            record: {
              id: item.id,
              name: item.name,
              kind,
              color: item.color ?? null,
              types: Array.isArray(rawTypes) ? rawTypes : [],
              // Un objet fraîchement importé n'a encore rien qui en dépende ; un réimport ne
              // change pas ce qui y est rattaché, d'où la reprise de la valeur connue.
              dependencies: r.record?.dependencies ?? {
                shows: 0,
                workshops: 0,
                stockItems: 0,
                stockReservations: 0,
              },
            },
          }
        : r
    )
  )
}

async function importRow(row: ViewRow): Promise<boolean> {
  const object = row.object
  if (!draft[row.key] || !object || object.kind === 'line') return false

  const result = await importAction.execute(row.key)
  if (!result) return false

  applyImportedItem(row, (result as { item: Record<string, any> }).item)
  return true
}

const layerImporting = ref<string | null>(null)

/**
 * L'import groupé n'est qu'une boucle sur l'opération unitaire : chaque objet est écrit
 * immédiatement, donc une interruption ne perd rien de ce qui a déjà été importé.
 */
async function importLayer(layer: LayerGroup) {
  layerImporting.value = layer.key
  let imported = 0
  try {
    for (const row of [...layer.pending]) {
      const ok = await importRow(row)
      if (!ok) break
      imported++
    }
  } finally {
    layerImporting.value = null
    if (imported > 0) {
      useToast().add({
        title: t('gestion.map.import_layer_done', imported),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
  }
}

const pendingDelete = ref<ViewRow | null>(null)

function confirmDelete(row: ViewRow) {
  pendingDelete.value = row
}

const deleteAction = useApiActionById(
  (key) => {
    const row = rows.value.find((r) => r.key === key)
    const record = row?.record
    const segment = record?.kind === 'marker' ? 'markers' : 'zones'
    return `/api/editions/${editionId.value}/${segment}/${record?.id}`
  },
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.map.import_deleted') },
    errorMessages: { default: t('gestion.map.import_delete_error') },
  }
)

async function runDelete() {
  const row = pendingDelete.value
  if (!row) return

  const result = await deleteAction.execute(row.key)
  pendingDelete.value = null
  if (result === null) return

  // Là encore, pas de rechargement : la carte du fournisseur n'a pas changé, seule la ligne
  // concernée bouge.
  replaceRows((rows) =>
    rows.flatMap((r, i) => {
      if (rowKey(r, i) !== row.key) return [r]
      // L'objet existe toujours sur la carte : il redevient importable. Sinon la ligne « plus
      // retrouvée » disparaît, plus rien ne la rattachant à quoi que ce soit.
      return r.object
        ? [{ ...r, state: 'importable' as const, record: undefined, editedLocally: false }]
        : []
    })
  )
}

const switching = ref(false)

/**
 * Tant que la carte externe est renseignée, elle masque la carte interne : sans cette bascule,
 * l'organisateur importerait ses objets sans rien voir changer sur la page publique.
 */
const { execute: clearExternalMap } = useApiAction(
  () => `/api/editions/${editionId.value}/external-map`,
  {
    method: 'PATCH',
    body: () => ({ url: '' }),
    successMessage: { title: t('gestion.map.import_switch_done') },
    errorMessages: { default: t('gestion.map.external_map_error') },
    onSuccess: () => {
      if (edition.value) {
        editionStore.setEdition({
          ...edition.value,
          externalMapProvider: null,
          externalMapRef: null,
        })
      }
      navigateTo(`/editions/${editionId.value}/gestion/map`)
    },
  }
)

async function switchToInternalMap() {
  switching.value = true
  try {
    await clearExternalMap()
  } finally {
    switching.value = false
  }
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId.value, { force: true })
  }
})
</script>
