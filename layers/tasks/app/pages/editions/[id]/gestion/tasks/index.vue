<template>
  <UContainer class="py-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-clipboard-document-check" class="text-rose-500 size-6" />
        <h1 class="text-2xl font-semibold">{{ $t('edition.tasks') }}</h1>
      </div>
      <UButton icon="i-heroicons-plus" color="primary" size="sm" @click="openGroupModal(null)">
        {{ $t('gestion.task.new_group') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!groups.length"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon
        name="i-heroicons-clipboard-document-list"
        class="size-12 text-gray-400 mx-auto mb-3"
      />
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('gestion.task.empty_state') }}
      </p>
      <UButton icon="i-heroicons-plus" color="primary" size="sm" @click="openGroupModal(null)">
        {{ $t('gestion.task.new_group') }}
      </UButton>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- `data-reordonnable` porte l'identité : le composable retrouve la carte survolée par
           `elementFromPoint`, et non par son rang, qui change en cours de glissement.
           `touch-action: none` est indispensable — sans lui le navigateur traite le geste comme un
           défilement et n'émet plus de `pointermove`. Il n'est posé que si l'on peut réordonner,
           pour ne pas confisquer le défilement à qui ne fait que lire. -->
      <UCard
        v-for="group in groups"
        :key="group.id"
        :data-reordonnable="group.id"
        class="cursor-pointer hover:shadow-md transition-shadow"
        :class="[
          reordre.cleSaisie.value === group.id ? 'opacity-50' : '',
          reordre.cleSurvolee.value === group.id && reordre.cote.value === 'avant'
            ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
            : '',
          reordre.cleSurvolee.value === group.id && reordre.cote.value === 'apres'
            ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
            : '',
        ]"
        :style="groups.length > 1 ? { touchAction: 'none' } : undefined"
        @pointerdown="reordre.auPointerDown(group, $event)"
        @click="ouvrirGroupe(group.id)"
      >
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h2 class="font-semibold truncate">{{ group.name }}</h2>
            </div>
            <UDropdownMenu :items="getGroupActions(group)" @click.stop>
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
          {{ $t('gestion.task.group_description_empty') }}
        </p>

        <template #footer>
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2 text-gray-500">
              <UIcon name="i-heroicons-clipboard-document-list" class="size-4" />
              {{
                $t('gestion.task.tasks_count', { count: group._count.tasks }, group._count.tasks)
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

    <TasksTaskGroupModal
      v-model:open="groupModalOpen"
      :edition-id="editionId"
      :group="editingGroup"
      @saved="handleGroupSaved"
      @deleted="handleGroupDeleted"
    />

    <!-- La boîte native du navigateur ignorait le thème sombre et gardait ses boutons en anglais
         quelle que soit la langue choisie. Elle se plaçait aussi tout en haut de l'écran sur
         téléphone, loin du doigt qui venait d'appuyer. -->
    <UiConfirmModal
      v-model="confirmationOuverte"
      :title="t('gestion.task.delete_group')"
      :description="
        groupeASupprimer
          ? t('gestion.task.confirm_delete_group', {
              name: groupeASupprimer.name,
              count: groupeASupprimer._count.tasks,
            })
          : ''
      "
      :confirm-label="t('common.delete')"
      confirm-color="error"
      :loading="suppressionEnCours"
      @confirm="supprimerGroupe"
      @cancel="confirmationOuverte = false"
    />
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const editionId = parseInt(route.params.id as string)

// Titre de l'onglet : « Tâches » (référence de la section, repris par la page d'un groupe).
useSeoMeta({
  title: () => t('edition.tasks'),
})

interface TaskGroupItem {
  id: number
  name: string
  description: string | null
  displayOrder: number
  /** Le point d'API ne rend qu'un compte : cette page n'affiche rien d'autre des tâches. */
  _count: { tasks: number }
}

const groups = ref<TaskGroupItem[]>([])
const loading = ref(true)

const fetchGroups = async () => {
  try {
    loading.value = true
    const res = await $fetch<{ success: boolean; data: { groups: TaskGroupItem[] } }>(
      `/api/editions/${editionId}/task-groups`
    )
    groups.value = res?.data?.groups || []
  } finally {
    loading.value = false
  }
}

await fetchGroups()

const groupModalOpen = ref(false)
const editingGroup = ref<TaskGroupItem | null>(null)

function openGroupModal(group: TaskGroupItem | null) {
  editingGroup.value = group
  groupModalOpen.value = true
}

function goToGroup(groupId: number) {
  router.push(`/editions/${editionId}/gestion/tasks/${groupId}`)
}

/**
 * Ouvrir un groupe, sauf si l'on vient de le déplacer.
 *
 * Un `click` part dans la foulée du relâchement : sans ce garde-fou, terminer un glissement
 * ouvrirait la fiche qu'on venait seulement de ranger.
 */
function ouvrirGroupe(groupId: number) {
  if (reordre.vientDeGlisser.value) return
  goToGroup(groupId)
}

/**
 * Le réordonnancement des groupes.
 *
 * `displayOrder` existait en base depuis l'origine et le point d'API l'acceptait déjà : seule
 * l'interface manquait, si bien que l'ordre restait celui de la création.
 *
 * L'ordre est appliqué tout de suite et remis en place si l'enregistrement échoue — attendre le
 * serveur ferait revenir la carte à sa place sous le doigt avant de repartir.
 */
const reordre = useReordonnancementTactile<TaskGroupItem>({
  elements: () => groups.value,
  cle: (g) => g.id,
  desactive: () => groups.value.length < 2,
  auDepot: async (ordreFinal) => {
    const ordrePrecedent = groups.value
    groups.value = ordreFinal
    try {
      await $fetch(`/api/editions/${editionId}/task-groups/reorder`, {
        method: 'PUT',
        body: { orderedIds: ordreFinal.map((g) => g.id) },
      })
    } catch (e: unknown) {
      groups.value = ordrePrecedent
      const err = e as { data?: { message?: string } }
      useToast().add({
        title: err?.data?.message || t('errors.generic'),
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
    }
  },
})

const getGroupActions = (group: TaskGroupItem) => [
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

const confirmationOuverte = ref(false)
const groupeASupprimer = ref<TaskGroupItem | null>(null)
const suppressionEnCours = ref(false)

function deleteGroup(group: TaskGroupItem) {
  groupeASupprimer.value = group
  confirmationOuverte.value = true
}

async function supprimerGroupe() {
  // `UiConfirmModal` n'émet que `confirm` et `cancel` : la refermer revient à l'appelant.
  const groupe = groupeASupprimer.value
  if (!groupe) return

  suppressionEnCours.value = true
  try {
    await $fetch(`/api/editions/${editionId}/task-groups/${groupe.id}`, { method: 'DELETE' })
    await fetchGroups()
    confirmationOuverte.value = false
    groupeASupprimer.value = null
  } catch (e: unknown) {
    // La modale reste ouverte : l'échec se lit là où le geste a été fait, et l'on peut réessayer
    // sans reprendre la navigation depuis le menu.
    const err = e as { data?: { message?: string } }
    useToast().add({
      title: err?.data?.message || t('errors.generic'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    suppressionEnCours.value = false
  }
}

async function handleGroupSaved() {
  await fetchGroups()
}
async function handleGroupDeleted() {
  await fetchGroups()
}
</script>
