<template>
  <UContainer class="py-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-archive-box" class="text-amber-600 size-6" />
        <h1 class="text-2xl font-semibold">{{ $t('gestion.stock.title') }}</h1>
      </div>
      <UButton
        v-if="canManage"
        icon="i-heroicons-plus"
        color="primary"
        size="sm"
        @click="openGroupModal(null)"
      >
        {{ $t('gestion.stock.new_group') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!groups.length"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon name="i-heroicons-archive-box-x-mark" class="size-12 text-gray-400 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('gestion.stock.empty_state') }}
      </p>
      <UButton
        v-if="canManage"
        icon="i-heroicons-plus"
        color="primary"
        size="sm"
        @click="openGroupModal(null)"
      >
        {{ $t('gestion.stock.new_group') }}
      </UButton>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard
        v-for="group in groups"
        :key="group.id"
        class="cursor-pointer hover:shadow-md transition-shadow"
        @click="goToGroup(group.id)"
      >
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h2 class="font-semibold truncate">{{ group.name }}</h2>
            </div>
            <UDropdownMenu v-if="canManage" :items="getGroupActions(group)" @click.stop>
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
                variant="ghost"
                color="neutral"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </template>

        <p
          v-if="group.description"
          class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 min-h-12"
        >
          {{ group.description }}
        </p>
        <p v-else class="text-sm text-gray-400 italic min-h-12">
          {{ $t('gestion.stock.group_description_empty') }}
        </p>

        <template #footer>
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2 text-gray-500">
              <UIcon name="i-heroicons-cube" class="size-4" />
              {{
                $t('gestion.stock.items_count', { count: group.items.length }, group.items.length)
              }}
            </div>
            <div class="flex items-center gap-1 text-primary-500">
              <span>{{ $t('common.view_more') }}</span>
              <UIcon name="i-heroicons-arrow-right" class="size-4" />
            </div>
          </div>
        </template>
      </UCard>
    </div>

    <StockGroupModal
      v-model:open="groupModalOpen"
      :edition-id="editionId"
      :group="editingGroup"
      @saved="handleGroupSaved"
      @deleted="handleGroupDeleted"
    />

    <!-- Une seule modale pour les confirmations de l'écran. `confirm()` bloquait la page, ne
         suivait pas la langue choisie et ne disait jamais sur quoi portait l'action. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
  </UContainer>
</template>

<script setup lang="ts">
import { useAuthStore, useEditionStore } from '#imports'

import { peutGererLeStock } from '../../../../../utils/droits-stock'
import { resumeSuppressionGroupe } from '../../../../../utils/suppression-groupe'

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

// Titre de l'onglet : « Stock matériel » (référence de la section, repris par les sous-pages).
useSeoMeta({
  title: () => t('gestion.stock.title'),
})

interface StockItemLite {
  id: number
  /** Le nombre de réservations, que la cascade emportera avec l'objet. */
  _count?: { reservations?: number } | null
}
interface StockGroupItem {
  id: number
  name: string
  description: string | null
  displayOrder: number
  items: StockItemLite[]
}

const groups = ref<StockGroupItem[]>([])
const loading = ref(true)

const edition = computed(() => editionStore.getEditionById(editionId))

const canManage = computed(() =>
  peutGererLeStock(edition.value as any, authStore.user?.id, authStore.isAdminModeActive)
)

const fetchGroups = async () => {
  try {
    loading.value = true
    const res = await $fetch<{ success: boolean; data: { groups: StockGroupItem[] } }>(
      `/api/editions/${editionId}/stock-groups`
    )
    groups.value = res?.data?.groups || []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId, { force: true })
  }
})

await fetchGroups()

const groupModalOpen = ref(false)
const editingGroup = ref<StockGroupItem | null>(null)

function openGroupModal(group: StockGroupItem | null) {
  editingGroup.value = group
  groupModalOpen.value = true
}

function goToGroup(groupId: number) {
  router.push(`/editions/${editionId}/gestion/stock/${groupId}`)
}

const getGroupActions = (group: StockGroupItem) => [
  [
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => openGroupModal(group),
    },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteGroup(group),
    },
  ],
]

const confirmation = useConfirmation()

function deleteGroup(group: StockGroupItem) {
  // La base est en cascade : le groupe emporte ses objets, et chaque objet ses réservations. La
  // confirmation ne disait que les objets — or ce sont les réservations qui font mal, puisqu'elles
  // ont été posées par d'autres. Le décompte se fait dans `suppression-groupe`, éprouvé à part.
  const resume = resumeSuppressionGroupe(group.items)
  const message = t(
    'gestion.stock.confirm_delete_group',
    { name: group.name, objets: resume.objets, count: resume.reservations },
    resume.reservations
  )
  confirmation.demanderConfirmation({
    titre: t('common.delete'),
    description: message,
    libelleConfirmer: t('common.delete'),
    agir: async () => {
      await $fetch(`/api/editions/${editionId}/stock-groups/${group.id}`, { method: 'DELETE' })
      await fetchGroups()
    },
  })
}

async function handleGroupSaved() {
  await fetchGroups()
}
async function handleGroupDeleted() {
  await fetchGroups()
}
</script>
