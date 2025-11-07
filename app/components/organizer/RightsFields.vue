<template>
  <div class="space-y-3">
    <!-- Global rights (sauf ceux qui seront dans le tableau) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div
        v-for="p in globalRightsOutsideTable"
        :key="p.key"
        class="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/40"
      >
        <span class="text-xs font-medium">{{ $t(p.label) }}</span>
        <USwitch
          :size="switchSize"
          color="primary"
          :model-value="localValue.rights[p.key]"
          @update:model-value="(val) => updateRight(p.key, val)"
        />
      </div>
    </div>

    <!-- Optional title -->
    <div v-if="!hideTitle" class="pt-1">
      <UInput
        v-model="localValue.title"
        :size="inputSize"
        :placeholder="$t('components.organizers_rights_panel.title_placeholder')"
        class="w-full"
        @update:model-value="emitModel"
      />
    </div>

    <!-- Per-edition rights as headerless table -->
    <div v-if="editions.length" class="mt-2">
      <div class="flex items-center justify-between mb-1">
        <h6
          class="text-[11px] uppercase font-semibold tracking-wide text-gray-500 dark:text-gray-400"
        >
          {{ $t('components.organizers_rights_panel.per_edition') }}
        </h6>
        <UButton
          v-if="localValue.perEdition.length"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-x-mark"
          @click="resetPerEdition"
          >{{ $t('common.reset') }}</UButton
        >
      </div>
      <div class="border border-gray-100 dark:border-gray-700 rounded overflow-hidden">
        <div class="max-h-48 overflow-y-auto">
          <table class="w-full text-[11px]">
            <thead>
              <tr
                class="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300"
              >
                <th class="text-left font-medium px-2 py-1"></th>
                <th class="text-center font-medium px-2 py-1 uppercase tracking-wide">
                  {{ $t('common.edit') }}
                </th>
                <th class="text-center font-medium px-2 py-1 uppercase tracking-wide">
                  {{ $t('common.delete') }}
                </th>
                <th class="text-center font-medium px-2 py-1 uppercase tracking-wide">
                  {{ $t('common.volunteers_short') }}
                </th>
                <th class="text-center font-medium px-2 py-1 uppercase tracking-wide">
                  {{ $t('common.artists') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- Ligne "Toutes les éditions" -->
              <tr
                class="border-b border-gray-100 dark:border-gray-700 bg-primary-50/40 dark:bg-primary-900/20 hover:bg-primary-50/60 dark:hover:bg-primary-900/30"
              >
                <td class="px-3 py-2.5 align-middle">
                  <div class="font-semibold text-xs">
                    {{ $t('components.organizers_rights_panel.all_editions') }}
                  </div>
                </td>
                <td class="px-3 py-2.5 align-middle">
                  <div class="flex justify-center">
                    <USwitch
                      :aria-label="$t('permissions.editAllEditions')"
                      :size="switchSize"
                      color="primary"
                      :model-value="localValue.rights.editAllEditions"
                      @update:model-value="(val) => updateRight('editAllEditions', val)"
                    />
                  </div>
                </td>
                <td class="px-3 py-2.5 align-middle">
                  <div class="flex justify-center">
                    <USwitch
                      :aria-label="$t('permissions.deleteAllEditions')"
                      :size="switchSize"
                      color="primary"
                      :model-value="localValue.rights.deleteAllEditions"
                      @update:model-value="(val) => updateRight('deleteAllEditions', val)"
                    />
                  </div>
                </td>
                <td class="px-3 py-2.5 align-middle">
                  <div class="flex justify-center">
                    <USwitch
                      :aria-label="$t('permissions.manageVolunteers')"
                      :size="switchSize"
                      color="primary"
                      :model-value="localValue.rights.manageVolunteers"
                      @update:model-value="(val) => updateRight('manageVolunteers', val)"
                    />
                  </div>
                </td>
                <td class="px-3 py-2.5 align-middle">
                  <div class="flex justify-center">
                    <USwitch
                      :aria-label="$t('permissions.manageArtists')"
                      :size="switchSize"
                      color="primary"
                      :model-value="localValue.rights.manageArtists"
                      @update:model-value="(val) => updateRight('manageArtists', val)"
                    />
                  </div>
                </td>
              </tr>

              <!-- Lignes pour chaque édition -->
              <tr
                v-for="ed in editions"
                :key="ed.id"
                class="border-b last:border-b-0 border-gray-100 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                <td class="px-3 py-2 align-middle max-w-[160px] break-words">
                  <div>{{ getEditionDisplayNameWithFallback(ed) }}</div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ formatDateRange(ed.startDate, ed.endDate) }}
                  </div>
                </td>
                <td class="px-3 py-2 align-middle">
                  <div class="flex justify-center">
                    <USwitch
                      :aria-label="$t('common.edit')"
                      :size="switchSize"
                      color="primary"
                      :disabled="localValue.rights.editAllEditions"
                      :model-value="hasEditionFlag(ed.id, 'canEdit')"
                      @update:model-value="(val) => toggleEdition(ed.id, 'canEdit', val)"
                    />
                  </div>
                </td>
                <td class="px-3 py-2 align-middle">
                  <div class="flex justify-center">
                    <USwitch
                      :aria-label="$t('common.delete')"
                      :size="switchSize"
                      color="primary"
                      :disabled="localValue.rights.deleteAllEditions"
                      :model-value="hasEditionFlag(ed.id, 'canDelete')"
                      @update:model-value="(val) => toggleEdition(ed.id, 'canDelete', val)"
                    />
                  </div>
                </td>
                <td class="px-3 py-2 align-middle">
                  <div class="flex justify-center">
                    <USwitch
                      :aria-label="$t('common.volunteers_short')"
                      :size="switchSize"
                      color="primary"
                      :disabled="localValue.rights.manageVolunteers"
                      :model-value="hasEditionFlag(ed.id, 'canManageVolunteers')"
                      @update:model-value="
                        (val) => toggleEdition(ed.id, 'canManageVolunteers', val)
                      "
                    />
                  </div>
                </td>
                <td class="px-3 py-2 align-middle">
                  <div class="flex justify-center">
                    <USwitch
                      :aria-label="$t('common.artists')"
                      :size="switchSize"
                      color="primary"
                      :disabled="localValue.rights.manageArtists"
                      :model-value="hasEditionFlag(ed.id, 'canManageArtists')"
                      @update:model-value="(val) => toggleEdition(ed.id, 'canManageArtists', val)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface EditionLite {
  id: number
  name: string | null
  startDate: string | Date
  endDate: string | Date
  convention?: { name: string }
}
interface PerEditionRight {
  editionId: number
  canEdit?: boolean
  canDelete?: boolean
  canManageVolunteers?: boolean
  canManageArtists?: boolean
}
interface ModelValue {
  title: string | null
  rights: Record<string, boolean>
  perEdition: PerEditionRight[]
}
interface PermissionMeta {
  key: string
  label: string
}

// Lazy load des traductions permissions via le composable (avant le rendu)
await useLazyI18n('permissions')

const props = withDefaults(
  defineProps<{
    modelValue: ModelValue
    editions: EditionLite[]
    conventionName?: string
    permissionList?: PermissionMeta[]
    hideTitle?: boolean
    size?: 'xs' | 'sm'
  }>(),
  {
    permissionList: () => [
      { key: 'editConvention', label: 'permissions.editConvention' },
      { key: 'deleteConvention', label: 'permissions.deleteConvention' },
      { key: 'manageOrganizers', label: 'permissions.manageOrganizers' },
      { key: 'addEdition', label: 'permissions.addEdition' },
      { key: 'editAllEditions', label: 'permissions.editAllEditions' },
      { key: 'deleteAllEditions', label: 'permissions.deleteAllEditions' },
      { key: 'manageVolunteers', label: 'permissions.manageVolunteers' },
      { key: 'manageArtists', label: 'permissions.manageArtists' },
    ],
    hideTitle: false,
    size: 'xs',
  }
)
const emit = defineEmits<{ (e: 'update:modelValue', v: ModelValue): void }>()

// local copy (we mutate then emit whole object)
const localValue = reactive<ModelValue>({
  title: props.modelValue.title,
  rights: { ...props.modelValue.rights },
  perEdition: JSON.parse(JSON.stringify(props.modelValue.perEdition || [])),
})

let syncingFromParent = false
watch(
  () => props.modelValue,
  (v) => {
    syncingFromParent = true
    localValue.title = v.title
    for (const k in localValue.rights) {
      if (k in v.rights) localValue.rights[k] = !!v.rights[k]
    }
    // Ajouter nouvelles clés éventuelles
    for (const k in v.rights) {
      if (!(k in localValue.rights)) localValue.rights[k] = !!v.rights[k]
    }
    localValue.perEdition = JSON.parse(JSON.stringify(v.perEdition || []))
    syncingFromParent = false
  },
  { deep: true }
)

// Propager les modifications du champ titre (v-model interne ne déclenche pas autrement d'émission)
watch(
  () => localValue.title,
  () => {
    if (!syncingFromParent) emitModel()
  }
)

const switchSize = computed(() => props.size)
const inputSize = computed(() => (props.size === 'xs' ? 'xs' : 'sm'))

// Droits globaux qui ne seront pas dans le tableau (convention et ajout d'éditions)
const globalRightsOutsideTable = computed(() =>
  props.permissionList.filter(
    (p) =>
      !['editAllEditions', 'deleteAllEditions', 'manageVolunteers', 'manageArtists'].includes(
        p.key
      )
  )
)

// Helper pour afficher le nom d'édition avec fallback sur le nom de convention
function getEditionDisplayNameWithFallback(edition: EditionLite): string {
  if (edition.name) return edition.name
  if (props.conventionName) return props.conventionName
  if (edition.convention?.name) return edition.convention.name
  return `#${edition.id}`
}

// Helper pour formater la plage de dates
function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return ''
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }

    const startFormatted = start.toLocaleDateString('fr-FR', formatOptions)
    const endFormatted = end.toLocaleDateString('fr-FR', formatOptions)

    // Si même jour, afficher seulement une date
    if (start.toDateString() === end.toDateString()) {
      return startFormatted
    }

    return `${startFormatted} - ${endFormatted}`
  } catch {
    return ''
  }
}

function updateRight(key: string, value: any) {
  localValue.rights[key] = !!value
  // If enabling editAllEditions we clean perEdition edit flags
  if (key === 'editAllEditions' && localValue.rights.editAllEditions) {
    localValue.perEdition.forEach((p) => {
      if (p.canEdit) p.canEdit = false
    })
  }
  // If enabling deleteAllEditions we clean perEdition delete flags
  if (key === 'deleteAllEditions' && localValue.rights.deleteAllEditions) {
    localValue.perEdition.forEach((p) => {
      if (p.canDelete) p.canDelete = false
    })
  }
  // If enabling manageVolunteers we clean perEdition volunteer flags
  if (key === 'manageVolunteers' && localValue.rights.manageVolunteers) {
    localValue.perEdition.forEach((p) => {
      if (p.canManageVolunteers) p.canManageVolunteers = false
    })
  }
  // If enabling manageArtists we clean perEdition artist flags
  if (key === 'manageArtists' && localValue.rights.manageArtists) {
    localValue.perEdition.forEach((p) => {
      if (p.canManageArtists) p.canManageArtists = false
    })
  }
  // Clean up empty entries
  localValue.perEdition = localValue.perEdition.filter(
    (p) => p.canEdit || p.canDelete || p.canManageVolunteers || p.canManageArtists
  )
  if (!syncingFromParent) emit('update:modelValue', JSON.parse(JSON.stringify(localValue)))
}
function hasEditionFlag(
  editionId: number,
  field: 'canEdit' | 'canDelete' | 'canManageVolunteers' | 'canManageArtists'
) {
  return !!localValue.perEdition.find((p) => p.editionId === editionId && (p as any)[field])
}
function toggleEdition(
  editionId: number,
  field: 'canEdit' | 'canDelete' | 'canManageVolunteers' | 'canManageArtists',
  value: any
) {
  const boolVal = !!value
  let entry = localValue.perEdition.find((p) => p.editionId === editionId)
  if (!entry && boolVal) {
    entry = {
      editionId,
      canEdit: false,
      canDelete: false,
      canManageVolunteers: false,
      canManageArtists: false,
    }
    localValue.perEdition.push(entry)
  }
  if (!entry) return
  ;(entry as any)[field] = boolVal
  // cleaning
  if (!entry.canEdit && !entry.canDelete && !entry.canManageVolunteers && !entry.canManageArtists) {
    localValue.perEdition = localValue.perEdition.filter((p) => p !== entry)
  }
  if (!syncingFromParent) emit('update:modelValue', JSON.parse(JSON.stringify(localValue)))
}
function resetPerEdition() {
  localValue.perEdition = []
  if (!syncingFromParent) emit('update:modelValue', JSON.parse(JSON.stringify(localValue)))
}

function emitModel() {
  emit('update:modelValue', JSON.parse(JSON.stringify(localValue)))
}
</script>
