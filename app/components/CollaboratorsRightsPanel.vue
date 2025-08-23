<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h5 class="text-sm font-medium text-gray-900 dark:text-white">{{ $t('components.collaborators_rights_panel.title') }}</h5>
  <UButton size="xs" color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="loading" @click="refresh">{{ $t('common.refresh') }}</UButton>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">{{ $t('common.loading') }}</div>
    <div v-else-if="!collaborators.length" class="text-sm italic text-gray-500">{{ $t('components.collaborators_rights_panel.no_collaborators') }}</div>

    <div v-else class="space-y-3">
      <div v-for="c in collaborators" :key="c.id" class="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white/60 dark:bg-gray-900/40">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium flex items-center gap-2">
              <span class="truncate max-w-[160px]" :title="c.user.pseudo">{{ c.user.pseudo }}</span>
              <UBadge v-if="c.rights" :color="c.rights.manageCollaborators ? 'warning' : (c.rights.editConvention ? 'info' : 'neutral')" size="xs" variant="subtle">
                {{ c.rights.manageCollaborators ? $t('permissions.admin') : (c.rights.editConvention ? $t('permissions.moderator') : $t('permissions.viewer')) }}
              </UBadge>
            </p>
            <p v-if="c.title" class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{{ c.title }}</p>
          </div>
          <div>
            <UButton size="xs" variant="ghost" color="neutral" :icon="expandedId === c.id ? 'i-heroicons-chevron-up' : 'i-heroicons-adjustments-horizontal'" @click="toggle(c.id)" />
          </div>
        </div>

        <div v-if="expandedId === c.id" class="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
          <!-- Global rights form -->
          <form class="space-y-2" @submit.prevent="save(c)">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div v-for="p in permissionList" :key="p.key" class="flex items-start gap-2">
                <UCheckbox v-if="draft[c.id]" :model-value="draft[c.id]?.rights[p.key]" :label="$t(p.label)" :ui="{label:'text-xs'}" @change="val => updateRight(c.id, p.key, val)" />
              </div>
            </div>
            <div>
              <UInput v-if="draft[c.id]" v-model="draft[c.id]!.title" size="xs" :placeholder="$t('components.collaborators_rights_panel.title_placeholder')" />
            </div>
                    <!-- Per-edition rights -->
                    <div class="mt-4">
                      <h6 class="text-[11px] uppercase font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-2">{{ $t('components.collaborators_rights_panel.per_edition') }}</h6>
                      <div v-if="!editions.length" class="text-[11px] italic text-gray-500">{{ $t('components.collaborators_rights_panel.no_editions') }}</div>
                      <div v-else class="max-h-48 overflow-y-auto pr-1 space-y-2">
                        <div v-for="ed in editions" :key="ed.id" class="border border-gray-100 dark:border-gray-700 rounded p-2 flex items-center justify-between">
                          <span class="text-[11px] font-medium truncate max-w-[140px]" :title="ed.name || ('#'+ed.id)">{{ ed.name || ('#'+ed.id) }}</span>
                          <div class="flex gap-3 items-center">
                            <UCheckbox size="xs" :model-value="draft[c.id]?.perEdition.some(p=>p.editionId===ed.id && p.canEdit)" :label="$t('common.edit')" :ui="{label:'text-[10px]'}" @change="val => togglePerEdition(c.id, ed.id, 'canEdit', val)" />
                            <UCheckbox size="xs" :model-value="draft[c.id]?.perEdition.some(p=>p.editionId===ed.id && p.canDelete)" :label="$t('common.delete')" :ui="{label:'text-[10px]'}" @change="val => togglePerEdition(c.id, ed.id, 'canDelete', val)" />
                          </div>
                        </div>
                      </div>
                    </div>
            <div class="flex justify-end gap-2">
              <UButton size="xs" color="neutral" variant="ghost" @click="cancel(c.id)">{{ $t('common.cancel') }}</UButton>
              <UButton size="xs" color="primary" icon="i-heroicons-check" :loading="savingId === c.id" type="submit">{{ $t('common.save') }}</UButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
  <!-- History section -->
  <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
    <div class="flex items-center justify-between mb-2">
      <h5 class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2"><UIcon name="i-heroicons-clock" /> {{ $t('components.collaborators_rights_panel.history_title') }}</h5>
      <UButton size="xs" color="neutral" variant="ghost" :loading="historyLoading" icon="i-heroicons-arrow-path" @click="fetchHistory">{{ $t('components.collaborators_rights_panel.refresh_history') }}</UButton>
    </div>
    <div v-if="historyLoading" class="text-xs text-gray-500">{{ $t('common.loading') }}</div>
    <div v-else-if="!history.length && historyLoaded" class="text-xs italic text-gray-500">{{ $t('components.collaborators_rights_panel.no_history') }}</div>
  <div v-else class="space-y-2 max-h-56 overflow-y-auto pr-1">
      <div v-for="h in history" :key="h.id" class="p-2 bg-white/70 dark:bg-gray-900/40 rounded border border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center">
          <span class="text-[11px] uppercase tracking-wide font-semibold text-indigo-600 dark:text-indigo-400">{{ formatChangeType(h.changeType) }}</span>
          <span class="text-[10px] text-gray-400">{{ timeAgo(h.createdAt) }}</span>
        </div>
        <div v-if="h.actor?.pseudo" class="text-[11px] text-gray-600 dark:text-gray-300 mt-1">{{ $t('components.collaborators_rights_panel.by_user', { user: h.actor.pseudo }) }}</div>
      </div>
    </div>
    <div v-if="!historyLoaded && !historyLoading" class="text-xs text-gray-500">
      <UButton size="xs" color="primary" variant="soft" @click="fetchHistory">{{ $t('components.collaborators_rights_panel.load_history') }}</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props { conventionId: number | null }
const props = defineProps<Props>();

interface EditionLite { id:number; name:string|null }
interface PerEditionRight { editionId:number; canEdit?:boolean; canDelete?:boolean }
interface CollaboratorItem { id:number; user:{ id:number; pseudo:string }; title?:string|null; rights:Record<string, boolean|undefined>; perEdition:PerEditionRight[] }
interface DraftEntry { title:string|null; rights:Record<string, boolean>; perEdition:PerEditionRight[] }

const { t } = useI18n();
const toast = useToast();

const collaborators = ref<CollaboratorItem[]>([]);
const editions = ref<EditionLite[]>([]);
const loading = ref(false);
const savingId = ref<number|null>(null);
const expandedId = ref<number|null>(null);
const draft = reactive<Record<number, DraftEntry>>({});
// History state
interface HistoryItem { id:number; changeType:string; createdAt:string; actor?: { pseudo:string } }
const history = ref<HistoryItem[]>([]);
const historyLoading = ref(false);
const historyLoaded = ref(false);

function formatChangeType(type:string){
  const map:Record<string,string> = {
    RIGHTS_UPDATED: t('permissions.history.RIGHTS_UPDATED'),
    PER_EDITIONS_UPDATED: t('permissions.history.PER_EDITIONS_UPDATED'),
    ARCHIVED: t('permissions.history.ARCHIVED'),
    UNARCHIVED: t('permissions.history.UNARCHIVED')
  };
  return map[type] || type;
}
function timeAgo(dateStr:string){
  const d = new Date(dateStr).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff/60000);
  if(m < 1) return t('common.time_just_now');
  if(m < 60) return t('common.time_minutes_ago', { count: m });
  const h = Math.floor(m/60); if(h < 24) return t('common.time_hours_ago', { count: h });
  const days = Math.floor(h/24); return t('common.time_days_ago', { count: days });
}
async function fetchHistory(){
  if(!props.conventionId) return;
  historyLoading.value = true;
  try {
    history.value = await $fetch(`/api/conventions/${props.conventionId}/collaborators/history`);
    historyLoaded.value = true;
  } catch(e){ console.error(e); } finally { historyLoading.value = false; }
}

// Minimal list of global permissions (edition-level later)
const permissionList = [
  { key: 'editConvention', label: 'permissions.editConvention' },
  { key: 'deleteConvention', label: 'permissions.deleteConvention' },
  { key: 'manageCollaborators', label: 'permissions.manageCollaborators' },
  { key: 'addEdition', label: 'permissions.addEdition' },
  { key: 'editAllEditions', label: 'permissions.editAllEditions' },
  { key: 'deleteAllEditions', label: 'permissions.deleteAllEditions' }
];

function ensureDraft(c:CollaboratorItem){
  if(!draft[c.id]){
    draft[c.id] = {
      title: c.title || null,
  rights: Object.fromEntries(permissionList.map(p => [p.key, !!c.rights[p.key]])),
  perEdition: JSON.parse(JSON.stringify(c.perEdition || []))
    };
  }
}
function toggle(id:number){
  if(expandedId.value === id){ expandedId.value = null; return; }
  const c = collaborators.value.find(x=>x.id===id); if(!c) return; ensureDraft(c); expandedId.value = id;
}
function updateRight(id:number, key:string, value:any){ if(!draft[id]) return; draft[id].rights[key] = !!value; }
function togglePerEdition(collabId:number, editionId:number, field:'canEdit'|'canDelete', value:any){
  const d = draft[collabId]; if(!d) return;
  let entry = d.perEdition.find(p=>p.editionId===editionId);
  if(!entry){ entry = { editionId, canEdit:false, canDelete:false }; d.perEdition.push(entry); }
  (entry as any)[field] = !!value;
  // Nettoyage: retirer lignes vides
  d.perEdition = d.perEdition.filter(p=>p.canEdit || p.canDelete);
}
function cancel(id:number){ draft[id] = undefined as any; if(expandedId.value === id) expandedId.value = null; }

async function refresh(){
  if(!props.conventionId) return;
  loading.value = true;
  try {
    const [collabs, eds] = await Promise.all([
      $fetch<CollaboratorItem[]>(`/api/conventions/${props.conventionId}/collaborators`),
      $fetch<Array<{id:number; name:string|null}>>(`/api/conventions/${props.conventionId}/editions`)
    ]);
    collaborators.value = collabs;
    editions.value = eds.map(e => ({ id: e.id, name: e.name }));
  } catch(e){ console.error(e); } finally { loading.value=false; }
}

async function save(c:CollaboratorItem){ if(!props.conventionId) return; const d = draft[c.id]; if(!d) return; savingId.value = c.id; try { await $fetch(`/api/conventions/${props.conventionId}/collaborators/${c.id}/rights`, { method:'PATCH' as any, body: { title: d.title, rights: d.rights, perEdition: d.perEdition } }); toast.add({ title: t('components.collaborators_rights_panel.saved'), color:'success', icon:'i-heroicons-check-circle' }); await refresh(); expandedId.value = null; draft[c.id] = undefined as any; } catch(e:any){ toast.add({ title: t('errors.update_error'), description: e?.data?.message || e?.message, color:'error', icon:'i-heroicons-x-circle' }); } finally { savingId.value = null; } }

watch(() => props.conventionId, (v) => { if(v) refresh(); }, { immediate: true });

</script>

