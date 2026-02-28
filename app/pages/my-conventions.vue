<template>
  <div>
    <!-- Section Conventions -->
    <div class="mb-12">
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3">
          <h2 class="text-2xl font-bold">{{ $t('navigation.my_conventions') }}</h2>
          <UButton
            icon="i-heroicons-question-mark-circle"
            size="xs"
            color="neutral"
            variant="ghost"
            :ui="{ rounded: 'rounded-full' }"
            @click="openFeaturesModal"
          />
          <span class="text-xs text-gray-500">({{ myConventions.length }} conventions)</span>
        </div>
        <UButton
          icon="i-heroicons-plus"
          size="sm"
          color="primary"
          variant="outline"
          :label="t('conventions.create')"
          to="/conventions/add"
        />
      </div>

      <div v-if="conventionsLoading" class="text-center py-8">
        <p>{{ $t('common.loading') }}</p>
      </div>

      <div v-else-if="myConventions.length === 0" class="py-12">
        <!-- Hero Empty State -->
        <div class="max-w-2xl mx-auto text-center mb-12">
          <div class="flex justify-center mb-8">
            <div
              class="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center"
            >
              <UIcon
                name="i-heroicons-building-library"
                class="text-primary-600 dark:text-primary-400"
                size="40"
              />
            </div>
          </div>

          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {{ $t('conventions.empty_state_title') }}
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
            {{ $t('conventions.empty_state_description') }}
          </p>

          <UButton
            color="primary"
            size="lg"
            icon="i-heroicons-plus"
            :label="$t('conventions.create_first_convention')"
            to="/conventions/add"
          />
        </div>

        <!-- Features Card -->
        <div class="max-w-4xl mx-auto">
          <ConventionsFeaturesCard :show-footer="false" />
        </div>
      </div>

      <!-- Contenu principal -->
      <div v-else>
        <!-- Sélecteur de convention -->
        <ConventionSelector v-model="selectedConventionId" :conventions="myConventions" />

        <!-- Convention sélectionnée -->
        <template v-if="selectedListItem">
          <!-- Détails -->
          <ConventionDetails
            :convention="selectedListItem"
            :can-edit="canEditConvention(selectedListItem)"
            :can-delete="canDeleteConvention(selectedListItem)"
            @edit="navigateTo(`/conventions/${selectedListItem!.id}/edit`)"
            @delete="deleteConvention(selectedListItem!.id)"
          />

          <!-- Chargement du détail -->
          <div v-if="detailLoading" class="text-center py-8">
            <p>{{ $t('common.loading') }}</p>
          </div>

          <!-- Éditions + Organisateurs (une fois le détail chargé) -->
          <template v-else-if="conventionDetail?.conventionId === selectedListItem.id">
            <ConventionEditionsGrid
              :editions="conventionDetail.editions ?? []"
              :convention="mergedConvention!"
              :can-add-edition="canAddEdition(selectedListItem)"
              @status-change="updateEditionStatus"
              @delete="deleteEdition"
              @duplicate="duplicateEdition"
            />

            <ConventionOrganizersSection
              :organizers="conventionDetail.organizers ?? []"
              :convention="mergedConvention!"
              :can-manage="canManageOrganizers(selectedListItem)"
              @edit-organizer="openEditOrganizerModal($event)"
              @add-organizer="openAddOrganizerModal()"
              @show-history="openHistoryModal()"
            />
          </template>
        </template>
      </div>
    </div>

    <!-- Modal d'édition de organisateur -->
    <ConventionOrganizerEditModal
      v-model:open="editOrganizerModalOpen"
      :organizer="selectedOrganizerForEdit"
      :convention="mergedConvention"
      :editions="conventionDetail?.editions ?? []"
      :loading="savingOrganizer"
      @save="saveOrganizerChanges"
      @delete="removeOrganizer"
    />

    <!-- Modal d'ajout de organisateur -->
    <UModal v-model:open="addOrganizerModalOpen" :title="$t('conventions.add_organizer')" size="lg">
      <template #body>
        <div v-if="selectedListItem" class="space-y-4">
          <div class="space-y-3">
            <!-- Recherche utilisateur -->
            <div>
              <label class="block text-sm font-medium mb-2"> Sélectionner un utilisateur </label>
              <UserSelector
                v-model="newOrganizerUser"
                v-model:search-term="newOrganizersearchTerm"
                :searched-users="searchedUsers"
                :searching-users="searchingUsers"
                :placeholder="$t('gestion.organizers.search_user_placeholder')"
              />
            </div>

            <!-- Configuration des droits -->
            <div v-if="newOrganizerUser">
              <label class="block text-sm font-medium mb-2"> Droits du organisateur </label>
              <OrganizerRightsFields
                v-model="newOrganizerRights"
                :editions="conventionDetail?.editions ?? []"
                :convention-name="selectedListItem.name"
                size="sm"
              />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="closeAddOrganizerModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :disabled="!newOrganizerUser" @click="addOrganizer">
            {{ $t('common.add') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal des fonctionnalités -->
    <ConventionsFeaturesModal v-model:model-value="showFeaturesModal" />

    <!-- Modal de l'historique des organisateurs -->
    <UModal
      v-model:open="historyModalOpen"
      :title="
        selectedListItem
          ? $t('conventions.history.title_full', { name: selectedListItem.name })
          : ''
      "
      size="lg"
    >
      <template #body>
        <div v-if="selectedListItem">
          <ConventionOrganizerHistory :convention-id="selectedListItem.id" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <UButton variant="ghost" @click="historyModalOpen = false">
            {{ $t('common.close') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal de confirmation de suppression d'édition -->
    <UModal v-model:open="deleteEditionModalOpen" title="Confirmer la suppression">
      <template #body>
        <div class="space-y-4">
          <div class="flex items-center gap-3 text-orange-600">
            <UIcon name="i-heroicons-exclamation-triangle" size="20" />
            <span class="font-medium">Attention : cette action est irréversible</span>
          </div>

          <p class="text-gray-600 dark:text-gray-300">
            Êtes-vous sûr de vouloir supprimer cette édition ? Toutes les données associées
            (bénévoles, commentaires, objets trouvés, etc.) seront définitivement perdues.
          </p>

          <div v-if="editionToDelete" class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="font-medium">{{ getEditionDisplayName(editionToDelete) }}</div>
            <div class="text-sm text-gray-500">
              {{ editionToDelete.city }}, {{ editionToDelete.country }}
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="cancelDeleteEdition">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deletingEdition" @click="confirmDeleteEdition">
            {{ $t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'

import { useAuthStore } from '~/stores/auth'
import type {
  ConventionListItem,
  DashboardEdition,
  DashboardOrganizer,
  ConventionDashboardResponse,
} from '~/types'
import type { OrganizerRightsFormData } from '~/types/organizer'
import { getEditionDisplayNameWithConvention } from '~/utils/editionName'

// Charger les traductions du fichier edition.json pour les clés edition.*
await useLazyI18n('edition')

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected',
})

const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// Détail chargé pour une convention
interface ConventionDetailData {
  conventionId: number
  editions: DashboardEdition[]
  organizers: DashboardOrganizer[]
}

// État de la liste (chargement léger)
const conventionsLoading = ref(true)
const myConventions = ref<ConventionListItem[]>([])

// État du détail (chargement à la sélection)
const detailLoading = ref(false)
const conventionDetail = ref<ConventionDetailData | null>(null)

// Sélection de convention
const selectedConventionId = ref<number | null>(null)

const selectedListItem = computed(
  () => myConventions.value.find((c) => c.id === selectedConventionId.value) || null
)

// Convention fusionnée (liste + détail) pour les composants enfants
const mergedConvention = computed<
  (ConventionListItem & { editions?: DashboardEdition[]; organizers?: DashboardOrganizer[] }) | null
>(() => {
  const listItem = selectedListItem.value
  if (!listItem) return null
  const detail = conventionDetail.value
  if (!detail || detail.conventionId !== listItem.id) {
    return listItem
  }
  return {
    ...listItem,
    editions: detail.editions,
    organizers: detail.organizers,
  }
})

// Auto-sélection au chargement
watch(
  myConventions,
  (conventions) => {
    if (conventions.length > 0 && !selectedConventionId.value) {
      const urlId = Number(route.query.convention)
      if (urlId && conventions.find((c) => c.id === urlId)) {
        selectedConventionId.value = urlId
      } else {
        selectedConventionId.value = conventions[0].id
      }
    }
    // Vérifier que la convention sélectionnée existe encore
    if (
      selectedConventionId.value &&
      !conventions.find((c) => c.id === selectedConventionId.value)
    ) {
      selectedConventionId.value = conventions.length > 0 ? conventions[0].id : null
    }
  },
  { immediate: true }
)

// Charger le détail et persister la sélection dans l'URL
watch(selectedConventionId, async (id) => {
  if (id) {
    router.replace({ query: { ...route.query, convention: id.toString() } })
    await fetchConventionDetail(id)
  } else {
    conventionDetail.value = null
  }
})

// Modal d'édition de organisateur
const editOrganizerModalOpen = ref(false)
const selectedOrganizerForEdit = ref<DashboardOrganizer | null>(null)
// Modal d'ajout de organisateur
const addOrganizerModalOpen = ref(false)

interface SearchedUser {
  id: number
  label: string
  pseudo: string
  email: string
  emailHash: string | null
  profilePicture: string | null
  isRealUser: boolean
}

const newOrganizerUser = ref<SearchedUser | null>(null)
const newOrganizersearchTerm = ref('')
const newOrganizerRights = ref<OrganizerRightsFormData>({
  title: '',
  rights: {
    editConvention: false,
    deleteConvention: false,
    manageOrganizers: false,
    manageVolunteers: false,
    addEdition: false,
    editAllEditions: false,
    deleteAllEditions: false,
  },
  perEdition: [],
})

// Variables pour la recherche d'utilisateurs (réutilisées du UserSelector)
const searchedUsers = ref<SearchedUser[]>([])
const searchingUsers = ref(false)

// Watcher pour la recherche d'utilisateurs
let searchTimeout: NodeJS.Timeout | null = null

watch(newOrganizersearchTerm, (newValue) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  if (!newValue || newValue.length < 2) {
    searchedUsers.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    await searchUsers(newValue)
  }, 300)
})

interface UserSearchResult {
  id: number
  pseudo: string | null
  prenom: string | null
  nom: string | null
  email: string
  emailHash: string | null
  profilePicture: string | null
}

const searchUsers = async (email: string) => {
  // Validation basique d'email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    searchedUsers.value = []
    return
  }

  try {
    searchingUsers.value = true
    const response = await $fetch<{ users: UserSearchResult[] }>('/api/users/search', {
      query: { emailExact: email },
    })

    searchedUsers.value = response.users.map((user) => ({
      id: user.id,
      label: user.pseudo || `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() || user.email,
      pseudo: user.pseudo || `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() || user.email,
      email: user.email,
      emailHash: user.emailHash,
      profilePicture: user.profilePicture,
      isRealUser: true,
    }))
  } catch (error) {
    console.error('Error searching users:', error)
    searchedUsers.value = []
  } finally {
    searchingUsers.value = false
  }
}

// Modal fonctionnalités
const showFeaturesModal = ref(false)

// Modal de suppression d'édition
const deleteEditionModalOpen = ref(false)
const editionToDelete = ref<DashboardEdition | null>(null)
// Historique des organisateurs
const historyModalOpen = ref(false)

function openFeaturesModal() {
  showFeaturesModal.value = true
}

function openHistoryModal() {
  historyModalOpen.value = true
}

// Fonctions pour gérer les organisateurs
const openEditOrganizerModal = (organizer: DashboardOrganizer) => {
  if (!selectedListItem.value || !canManageOrganizers(selectedListItem.value)) {
    toast.add({
      title: 'Action non autorisée',
      description: "Vous n'avez pas les droits pour modifier ce organisateur",
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    return
  }

  selectedOrganizerForEdit.value = organizer
  editOrganizerModalOpen.value = true
}

const closeEditOrganizerModal = () => {
  editOrganizerModalOpen.value = false
  selectedOrganizerForEdit.value = null
}

const saveOrgRights = ref<OrganizerRightsFormData | null>(null)

const { execute: executeSaveOrganizer, loading: savingOrganizer } = useApiAction(
  () =>
    `/api/conventions/${selectedListItem.value?.id}/organizers/${selectedOrganizerForEdit.value?.id}`,
  {
    method: 'PUT',
    body: () => ({
      rights: saveOrgRights.value?.rights,
      title: saveOrgRights.value?.title,
      perEdition: saveOrgRights.value?.perEdition || [],
    }),
    successMessage: { title: t('gestion.organizers.organizer_updated') },
    errorMessages: { default: t('errors.update_organizer_error') },
    onSuccess: async () => {
      closeEditOrganizerModal()
      if (selectedListItem.value) await fetchConventionDetail(selectedListItem.value.id)
    },
  }
)

const saveOrganizerChanges = (rights: OrganizerRightsFormData) => {
  if (!selectedOrganizerForEdit.value || !selectedListItem.value) return
  saveOrgRights.value = rights
  executeSaveOrganizer()
}

const { execute: executeRemoveOrganizer } = useApiAction(
  () =>
    `/api/conventions/${selectedListItem.value?.id}/organizers/${selectedOrganizerForEdit.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.organizers.organizer_removed') },
    errorMessages: { default: t('errors.remove_organizer_error') },
    onSuccess: async () => {
      closeEditOrganizerModal()
      if (selectedListItem.value) await fetchConventionDetail(selectedListItem.value.id)
    },
  }
)

const removeOrganizer = () => {
  if (!selectedOrganizerForEdit.value || !selectedListItem.value) return
  if (confirm(t('gestion.organizers.confirm_remove'))) {
    executeRemoveOrganizer()
  }
}

const openAddOrganizerModal = () => {
  // Réinitialiser les valeurs
  newOrganizerUser.value = null
  newOrganizersearchTerm.value = ''
  newOrganizerRights.value = {
    title: '',
    rights: {
      editConvention: false,
      deleteConvention: false,
      manageOrganizers: false,
      manageVolunteers: false,
      addEdition: false,
      editAllEditions: false,
      deleteAllEditions: false,
    },
    perEdition: [],
  }
  searchedUsers.value = []
  addOrganizerModalOpen.value = true
}

const closeAddOrganizerModal = () => {
  addOrganizerModalOpen.value = false
  newOrganizerUser.value = null
  newOrganizersearchTerm.value = ''
  searchedUsers.value = []
}

const { execute: executeAddOrganizer } = useApiAction(
  () => `/api/conventions/${selectedListItem.value?.id}/organizers`,
  {
    method: 'POST',
    body: () => ({
      userId: newOrganizerUser.value?.id,
      rights: newOrganizerRights.value.rights,
      title: newOrganizerRights.value.title,
      perEdition: newOrganizerRights.value.perEdition || [],
    }),
    successMessage: { title: 'Organisateur ajouté' },
    errorMessages: { default: "Erreur lors de l'ajout" },
    onSuccess: async () => {
      closeAddOrganizerModal()
      if (selectedListItem.value) await fetchConventionDetail(selectedListItem.value.id)
    },
  }
)

const addOrganizer = () => {
  if (!newOrganizerUser.value || !selectedListItem.value) return
  executeAddOrganizer()
}

const deleteEdition = (id: number) => {
  // Trouver l'édition dans le détail
  const edition = conventionDetail.value?.editions?.find((ed) => ed.id === id)

  if (edition) {
    editionToDelete.value = edition
    deleteEditionModalOpen.value = true
  }
}

const cancelDeleteEdition = () => {
  deleteEditionModalOpen.value = false
  editionToDelete.value = null
}

const { execute: executeDeleteEdition, loading: deletingEdition } = useApiAction(
  () => `/api/editions/${editionToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('messages.edition_deleted') },
    errorMessages: { default: t('errors.deletion_error') },
    onSuccess: async () => {
      cancelDeleteEdition()
      if (selectedListItem.value) {
        await Promise.all([
          fetchConventionDetail(selectedListItem.value.id),
          fetchConventionsList(),
        ])
      }
    },
  }
)

const confirmDeleteEdition = () => {
  if (!editionToDelete.value || !selectedListItem.value) return
  executeDeleteEdition()
}

// Fonctions de fetch
const fetchConventionsList = async () => {
  try {
    conventionsLoading.value = true
    const data = await $fetch<ConventionListItem[]>('/api/conventions/my-conventions')
    myConventions.value = data || []
  } catch (error) {
    console.error('Error fetching conventions:', error)
    toast.add({
      title: t('common.error'),
      description: t('conventions.cannot_load_conventions'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
  } finally {
    conventionsLoading.value = false
  }
}

// Guard contre les réponses périmées lors de changements rapides de sélection
let currentDetailRequestId = 0

const fetchConventionDetail = async (id: number) => {
  const requestId = ++currentDetailRequestId
  try {
    detailLoading.value = true
    const data = await $fetch<ConventionDashboardResponse>(`/api/conventions/${id}/dashboard`)
    // Ignorer la réponse si une autre requête a été lancée entre-temps
    if (requestId !== currentDetailRequestId) return
    conventionDetail.value = { conventionId: id, ...data }
  } catch (error) {
    if (requestId !== currentDetailRequestId) return
    console.error('Error fetching convention detail:', error)
    toast.add({
      title: t('common.error'),
      description: t('conventions.cannot_load_conventions'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
    conventionDetail.value = null
  } finally {
    if (requestId === currentDetailRequestId) {
      detailLoading.value = false
    }
  }
}

// Fonction pour supprimer une convention
const deleteConventionId = ref<number | null>(null)

const { execute: executeDeleteConvention } = useApiAction(
  () => `/api/conventions/${deleteConventionId.value}`,
  {
    method: 'DELETE',
    successMessage: {
      title: t('conventions.convention_deleted'),
      description: t('conventions.convention_deleted_success'),
    },
    errorMessages: { default: t('errors.deletion_error') },
    onSuccess: async () => {
      selectedConventionId.value = null
      conventionDetail.value = null
      await fetchConventionsList()
    },
  }
)

const deleteConvention = (id: number) => {
  if (confirm(t('conventions.confirm_delete_convention'))) {
    deleteConventionId.value = id
    executeDeleteConvention()
  }
}

// Helpers de droits (utilise currentUserRights du serveur)
const hasFullAccess = (conv: ConventionListItem) =>
  !!(
    (authStore.user?.id && conv.authorId && conv.authorId === authStore.user.id) ||
    authStore.isAdminModeActive
  )

const canManageOrganizers = (conv: ConventionListItem) =>
  !!(hasFullAccess(conv) || conv.currentUserRights?.manageOrganizers)

const canAddEdition = (conv: ConventionListItem) =>
  !!(hasFullAccess(conv) || conv.currentUserRights?.addEdition)

const canEditConvention = (conv: ConventionListItem) =>
  !!(hasFullAccess(conv) || conv.currentUserRights?.editConvention)

const canDeleteConvention = (conv: ConventionListItem) =>
  !!(hasFullAccess(conv) || conv.currentUserRights?.deleteConvention)

// Fonction pour obtenir le nom d'affichage d'une édition
const getEditionDisplayName = (edition: DashboardEdition) => {
  return getEditionDisplayNameWithConvention(edition, selectedListItem.value!)
}

// Duplication d'édition
const duplicateEditionId = ref<number | null>(null)

const { execute: executeDuplicateEdition, loading: duplicatingEdition } = useApiAction(
  () => `/api/editions/${duplicateEditionId.value}/duplicate`,
  {
    method: 'POST',
    successMessage: {
      title: t('conventions.edition_duplicated'),
      description: t('conventions.edition_duplicated_desc'),
    },
    errorMessages: { default: t('conventions.duplication_error') },
    onSuccess: async (result: any) => {
      await navigateTo(`/editions/${result.id}/gestion`)
    },
  }
)

const duplicateEdition = (editionId: number) => {
  if (!selectedListItem.value || duplicatingEdition.value) return
  duplicateEditionId.value = editionId
  executeDuplicateEdition()
}

// Update edition status
const statusEditionId = ref<number | null>(null)
const statusValue = ref<string | null>(null)

const { execute: executeUpdateStatus, loading: updatingStatus } = useApiAction(
  () => `/api/editions/${statusEditionId.value}/status`,
  {
    method: 'PATCH',
    body: () => ({ status: statusValue.value }),
    successMessage: { title: t('edition.status_updated') },
    errorMessages: { default: t('errors.status_update_failed') },
    refreshOnSuccess: async () => {
      if (selectedListItem.value) await fetchConventionDetail(selectedListItem.value.id)
    },
  }
)

const updateEditionStatus = (
  editionId: number,
  status: 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'
) => {
  if (!selectedListItem.value || updatingStatus.value) return
  statusEditionId.value = editionId
  statusValue.value = status
  executeUpdateStatus()
}

onMounted(async () => {
  // Vérifier que l'utilisateur est authentifié
  if (!authStore.isAuthenticated) {
    conventionsLoading.value = false
    return
  }

  // Charger la liste des conventions
  await fetchConventionsList()
})
</script>
