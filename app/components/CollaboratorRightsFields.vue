<template>
  <div class="space-y-3">
    <!-- Global rights -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div
        v-for="p in effectivePermissionList"
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
        :placeholder="$t('components.collaborators_rights_panel.title_placeholder')"
      />
    </div>

    <!-- Per-edition rights -->
    <div v-if="editions.length" class="mt-2">
      <div class="flex items-center justify-between mb-2">
        <h6
          class="text-[11px] uppercase font-semibold tracking-wide text-gray-500 dark:text-gray-400"
        >
          {{ $t('components.collaborators_rights_panel.per_edition') }}
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
      <div
        class="max-h-48 overflow-y-auto pr-1 space-y-2 border border-gray-100 dark:border-gray-700 rounded p-2"
      >
        <div
          v-for="ed in editions"
          :key="ed.id"
          class="border border-gray-100 dark:border-gray-700 rounded px-2 py-1 flex items-center justify-between bg-white/60 dark:bg-gray-900/40"
        >
          <span
            class="text-[11px] font-medium truncate max-w-[140px]"
            :title="ed.name || '#' + ed.id"
            >{{ ed.name || '#' + ed.id }}</span
          >
          <div class="flex gap-4 items-center">
            <div class="flex items-center gap-1">
              <span class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{{
                $t('common.edit')
              }}</span>
              <USwitch
                :size="switchSize"
                color="primary"
                :disabled="localValue.rights.editAllEditions"
                :model-value="hasEditionFlag(ed.id, 'canEdit')"
                @update:model-value="(val) => toggleEdition(ed.id, 'canEdit', val)"
              />
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{{
                $t('common.delete')
              }}</span>
              <USwitch
                :size="switchSize"
                color="primary"
                :model-value="hasEditionFlag(ed.id, 'canDelete')"
                @update:model-value="(val) => toggleEdition(ed.id, 'canDelete', val)"
              />
            </div>
          </div>
        </div>
        <div v-if="!localValue.perEdition.length" class="text-[11px] italic text-gray-500">
          {{ $t('components.collaborators_rights_panel.per_edition_hint') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface EditionLite {
  id: number
  name: string | null
}
interface PerEditionRight {
  editionId: number
  canEdit?: boolean
  canDelete?: boolean
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

const props = withDefaults(
  defineProps<{
    modelValue: ModelValue
    editions: EditionLite[]
    permissionList?: PermissionMeta[]
    hideTitle?: boolean
    size?: 'xs' | 'sm'
  }>(),
  {
    permissionList: () => [
      { key: 'editConvention', label: 'permissions.editConvention' },
      { key: 'deleteConvention', label: 'permissions.deleteConvention' },
      { key: 'manageCollaborators', label: 'permissions.manageCollaborators' },
      { key: 'addEdition', label: 'permissions.addEdition' },
      { key: 'editAllEditions', label: 'permissions.editAllEditions' },
      { key: 'deleteAllEditions', label: 'permissions.deleteAllEditions' },
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

const switchSize = computed(() => props.size)
const inputSize = computed(() => (props.size === 'xs' ? 'xs' : 'sm'))
const effectivePermissionList = computed(() => props.permissionList)

function updateRight(key: string, value: any) {
  localValue.rights[key] = !!value
  // If enabling editAllEditions we clean perEdition edit flags
  if (key === 'editAllEditions' && localValue.rights.editAllEditions) {
    localValue.perEdition = localValue.perEdition.filter((p) => p.canDelete) // drop entries that only had canEdit
    localValue.perEdition.forEach((p) => {
      if (p.canEdit) p.canEdit = false
    })
    localValue.perEdition = localValue.perEdition.filter((p) => p.canDelete) // remove empty after clearing
  }
  if (!syncingFromParent) emit('update:modelValue', JSON.parse(JSON.stringify(localValue)))
}
function hasEditionFlag(editionId: number, field: 'canEdit' | 'canDelete') {
  return !!localValue.perEdition.find((p) => p.editionId === editionId && (p as any)[field])
}
function toggleEdition(editionId: number, field: 'canEdit' | 'canDelete', value: any) {
  const boolVal = !!value
  let entry = localValue.perEdition.find((p) => p.editionId === editionId)
  if (!entry && boolVal) {
    entry = { editionId, canEdit: false, canDelete: false }
    localValue.perEdition.push(entry)
  }
  if (!entry) return
  ;(entry as any)[field] = boolVal
  // cleaning
  if (!entry.canEdit && !entry.canDelete) {
    localValue.perEdition = localValue.perEdition.filter((p) => p !== entry)
  }
  if (!syncingFromParent) emit('update:modelValue', JSON.parse(JSON.stringify(localValue)))
}
function resetPerEdition() {
  localValue.perEdition = []
  if (!syncingFromParent) emit('update:modelValue', JSON.parse(JSON.stringify(localValue)))
}
</script>
