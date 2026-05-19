<template>
  <UContainer class="py-6">
    <!-- Breadcrumb -->
    <div class="mb-4">
      <UButton
        :to="`/editions/${editionId}/gestion/stock`"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-heroicons-arrow-left"
      >
        {{ $t('gestion.stock.title') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!group"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon name="i-heroicons-question-mark-circle" class="size-12 text-gray-400 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('gestion.stock.group_not_found') }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <UCard>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <UIcon name="i-heroicons-archive-box" class="text-amber-600 size-6 mt-1 shrink-0" />
            <div class="flex-1 min-w-0">
              <h1 class="text-xl font-semibold">{{ group.name }}</h1>
              <p v-if="group.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ group.description }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              v-if="canManage"
              icon="i-heroicons-plus"
              size="sm"
              color="primary"
              @click="openItemModal(null)"
            >
              {{ $t('gestion.stock.new_item') }}
            </UButton>
            <UDropdownMenu v-if="canManage" :items="groupActions">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="sm"
                variant="ghost"
                color="neutral"
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>

      <div
        v-if="!group.items.length"
        class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
      >
        <UIcon name="i-heroicons-cube" class="size-10 text-gray-400 mx-auto mb-2" />
        <p class="text-gray-600 dark:text-gray-400 mb-3 text-sm">
          {{ $t('gestion.stock.empty_group') }}
        </p>
        <UButton
          v-if="canManage"
          icon="i-heroicons-plus"
          color="primary"
          size="sm"
          @click="openItemModal(null)"
        >
          {{ $t('gestion.stock.new_item') }}
        </UButton>
      </div>

      <UCard v-else :ui="{ body: 'p-0 sm:p-0' }">
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead
              class="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-600 dark:text-gray-400"
            >
              <tr>
                <th class="px-4 py-2 text-left font-medium">{{ $t('gestion.stock.item_name') }}</th>
                <th class="px-4 py-2 text-right font-medium whitespace-nowrap">
                  {{ $t('common.quantity') }}
                </th>
                <th class="px-4 py-2 text-left font-medium whitespace-nowrap">
                  {{ $t('gestion.stock.locations') }}
                </th>
                <th class="px-4 py-2 text-right font-medium whitespace-nowrap">
                  {{ $t('gestion.stock.reservations_title') }}
                </th>
                <th class="px-2 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr
                v-for="item in group.items"
                :key="item.id"
                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                @click="goToItem(item.id)"
              >
                <td class="px-4 py-3 align-top">
                  <div class="font-medium">{{ item.name }}</div>
                  <div v-if="item.description" class="flex items-start gap-1 mt-0.5">
                    <p
                      :class="expandedDesc[item.id] ? 'whitespace-pre-wrap' : 'line-clamp-1'"
                      class="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-0"
                    >
                      {{ item.description }}
                    </p>
                    <button
                      v-if="isDescriptionTruncatable(item.description)"
                      type="button"
                      class="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-0.5"
                      :aria-label="
                        expandedDesc[item.id] ? $t('common.show_less') : $t('common.show_more')
                      "
                      @click.stop="toggleDescription(item.id)"
                    >
                      <UIcon
                        :name="
                          expandedDesc[item.id]
                            ? 'i-heroicons-chevron-up'
                            : 'i-heroicons-chevron-down'
                        "
                        class="size-3.5"
                      />
                    </button>
                  </div>
                </td>
                <td class="px-4 py-3 align-top text-right whitespace-nowrap">
                  <span class="font-medium tabular-nums">×{{ item.quantity }}</span>
                </td>
                <td class="px-4 py-3 align-top">
                  <div v-if="item.locations.length" class="flex flex-wrap gap-1.5">
                    <UBadge
                      v-for="loc in item.locations"
                      :key="loc.id"
                      color="neutral"
                      variant="soft"
                      size="xs"
                      class="font-normal"
                    >
                      <span class="flex items-center gap-1">
                        <span
                          v-if="loc.zone"
                          class="size-2 rounded-full"
                          :style="{ backgroundColor: loc.zone.color }"
                        />
                        <UIcon v-else-if="loc.marker" name="i-heroicons-flag" class="size-3" />
                        <UIcon v-else name="i-heroicons-map-pin" class="size-3" />
                        {{ loc.zone?.name || loc.marker?.name || loc.location }}
                        <span class="text-gray-500">×{{ loc.quantity }}</span>
                      </span>
                    </UBadge>
                  </div>
                  <span v-else class="text-xs text-gray-400 italic">
                    {{ $t('gestion.stock.no_locations_yet') }}
                  </span>
                </td>
                <td class="px-4 py-3 align-top text-right whitespace-nowrap tabular-nums">
                  <span :class="item._count.reservations ? '' : 'text-gray-400'">
                    {{ item._count.reservations }}
                  </span>
                </td>
                <td class="px-2 py-3 align-top text-right">
                  <UIcon name="i-heroicons-chevron-right" class="size-4 text-gray-400" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <StockGroupModal
      v-model:open="groupModalOpen"
      :edition-id="editionId"
      :group="group"
      @saved="handleGroupSaved"
      @deleted="handleGroupDeleted"
    />
    <StockItemModal
      v-if="group"
      v-model:open="itemModalOpen"
      :edition-id="editionId"
      :group-id="group.id"
      :item="editingItem"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      @saved="handleItemSaved"
    />
  </UContainer>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const editionId = parseInt(route.params.id as string)
const groupId = computed(() => parseInt(route.params.groupId as string))

interface StockItemLocationLite {
  id: number
  location: string | null
  quantity: number
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
}
interface StockItem {
  id: number
  name: string
  description: string | null
  quantity: number
  locations: StockItemLocationLite[]
  _count: { reservations: number }
}
interface StockGroupItem {
  id: number
  name: string
  description: string | null
  displayOrder: number
  items: StockItem[]
}

const allGroups = ref<StockGroupItem[]>([])
const zones = ref<{ id: number; name: string; color: string; types: string[] }[]>([])
const markers = ref<{ id: number; name: string; color: string | null; types: string[] }[]>([])
const loading = ref(true)

const edition = computed(() => editionStore.getEditionById(editionId))
const group = computed<StockGroupItem | null>(
  () => allGroups.value.find((g) => g.id === groupId.value) || null
)

const canManage = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  const userId = authStore.user.id
  if (authStore.isAdminModeActive) return true
  if (edition.value.creatorId === userId) return true
  if (edition.value.convention?.authorId === userId) return true
  const organizers = edition.value.convention?.organizers || []
  return organizers.some((collab: any) => {
    if (collab.user?.id !== userId) return false
    if (collab.rights?.manageStock || collab.rights?.editConvention) return true
    if (collab.perEditionRights) {
      const per = collab.perEditionRights.find((r: any) => r.editionId === edition.value!.id)
      if (per?.canManageStock || per?.canEdit) return true
    }
    return false
  })
})

async function fetchAll() {
  try {
    loading.value = true
    const [groupsRes, zonesRes, markersRes] = await Promise.all([
      $fetch<{ success: boolean; data: { groups: StockGroupItem[] } }>(
        `/api/editions/${editionId}/stock-groups`
      ),
      $fetch<{ success: boolean; data: { zones: any[] } } | any[]>(
        `/api/editions/${editionId}/zones`
      ).catch(() => null),
      $fetch<{ success: boolean; data: { markers: any[] } } | any[]>(
        `/api/editions/${editionId}/markers`
      ).catch(() => null),
    ])
    allGroups.value = groupsRes?.data?.groups || []
    const zonesData = Array.isArray(zonesRes)
      ? zonesRes
      : (zonesRes?.data?.zones ?? (zonesRes as any)?.data ?? [])
    zones.value = (zonesData || []).map((z: any) => ({
      id: z.id,
      name: z.name,
      color: z.color,
      types: Array.isArray(z.zoneTypes) ? z.zoneTypes : [],
    }))
    const markersData = Array.isArray(markersRes)
      ? markersRes
      : (markersRes?.data?.markers ?? (markersRes as any)?.data ?? [])
    markers.value = (markersData || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      color: m.color ?? null,
      types: Array.isArray(m.markerTypes) ? m.markerTypes : [],
    }))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId, { force: true })
  }
})

await fetchAll()

const groupModalOpen = ref(false)
const itemModalOpen = ref(false)
const editingItem = ref<StockItem | null>(null)
const expandedDesc = reactive<Record<number, boolean>>({})

function toggleDescription(id: number) {
  expandedDesc[id] = !expandedDesc[id]
}

function isDescriptionTruncatable(text: string): boolean {
  return text.length > 60 || text.includes('\n')
}

function openItemModal(item: StockItem | null) {
  editingItem.value = item
  itemModalOpen.value = true
}

function goToItem(itemId: number) {
  router.push(`/editions/${editionId}/gestion/stock/items/${itemId}`)
}

const groupActions = computed(() => [
  [
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => {
        groupModalOpen.value = true
      },
    },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteGroup(),
    },
  ],
])

async function deleteGroup() {
  if (!group.value) return
  if (
    !confirm(
      t('gestion.stock.confirm_delete_group', {
        name: group.value.name,
        count: group.value.items.length,
      })
    )
  )
    return
  await $fetch(`/api/editions/${editionId}/stock-groups/${group.value.id}`, { method: 'DELETE' })
  router.push(`/editions/${editionId}/gestion/stock`)
}

async function handleGroupSaved() {
  await fetchAll()
}
async function handleGroupDeleted() {
  router.push(`/editions/${editionId}/gestion/stock`)
}
async function handleItemSaved() {
  await fetchAll()
}
</script>
