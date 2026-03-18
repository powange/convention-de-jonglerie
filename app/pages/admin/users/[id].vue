<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <NuxtLink
              to="/admin/users"
              class="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ml-2 dark:text-gray-400 dark:hover:text-white"
            >
              {{ $t('admin.users') }}
            </NuxtLink>
          </div>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
              {{ $t('admin.view_profile') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête de la page -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ $t('admin.view_profile') }}
      </h1>
    </div>

    <!-- Chargement -->
    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" size="24" />
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="mx-auto mb-4 text-error-500"
        size="48"
      />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('common.error') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ error.message || $t('errors.loading_error') }}
      </p>
    </div>

    <!-- Profil utilisateur -->
    <div v-else-if="user" class="space-y-6">
      <!-- Informations principales -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-4">
            <AdminProfilePictureUpload
              v-if="!isEditing"
              v-model="user.profilePicture"
              :user="user"
              @changed="onProfilePictureChanged"
            />
            <UiUserAvatar v-else :user="user" size="lg" border />
            <div class="flex-1">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ user.prenom }} {{ user.nom }}
              </h2>
              <p class="text-gray-600 dark:text-gray-400">@{{ user.pseudo }}</p>
              <div class="flex items-center gap-2 mt-2">
                <UBadge v-if="user.isGlobalAdmin" color="primary" variant="soft" size="sm">
                  {{ $t('admin.super_admin') }}
                </UBadge>
                <UBadge
                  :color="user.isEmailVerified ? 'success' : 'error'"
                  variant="soft"
                  size="sm"
                >
                  {{ user.isEmailVerified ? $t('admin.verified') : $t('admin.not_verified') }}
                </UBadge>
              </div>
            </div>
            <div class="flex gap-2">
              <UButton
                v-if="!isEditing"
                icon="i-heroicons-pencil"
                color="primary"
                variant="soft"
                @click="startEditing"
              >
                {{ $t('common.edit') }}
              </UButton>
              <template v-else>
                <UButton
                  icon="i-heroicons-x-mark"
                  color="neutral"
                  variant="ghost"
                  @click="cancelEditing"
                >
                  {{ $t('common.cancel') }}
                </UButton>
                <UButton
                  icon="i-heroicons-check"
                  color="success"
                  :loading="saving"
                  @click="saveChanges"
                >
                  {{ $t('common.save') }}
                </UButton>
              </template>
            </div>
          </div>
        </template>

        <div class="grid md:grid-cols-2 gap-6">
          <!-- Informations personnelles -->
          <div class="space-y-4">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ $t('profile.personal_info') }}
            </h3>

            <!-- Mode lecture -->
            <div v-if="!isEditing" class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">{{ $t('common.email') }}:</span>
                <span class="font-medium">{{ user.email }}</span>
              </div>

              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">{{ $t('auth.username') }}:</span>
                <span class="font-medium">{{ user.pseudo }}</span>
              </div>

              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">{{ $t('auth.first_name') }}:</span>
                <span class="font-medium">{{ user.prenom }}</span>
              </div>

              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">{{ $t('auth.last_name') }}:</span>
                <span class="font-medium">{{ user.nom }}</span>
              </div>

              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">{{ $t('profile.phone') }}:</span>
                <span class="font-medium">{{ user.phone || '-' }}</span>
              </div>

              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('profile.member_since') }}:</span
                >
                <span class="font-medium">{{ formatDate(user.createdAt) }}</span>
              </div>
            </div>

            <!-- Mode édition -->
            <div v-else class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('common.email') }}
                </label>
                <UInput v-model="editForm.email" type="email" size="md" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('auth.username') }}
                </label>
                <UInput v-model="editForm.pseudo" size="md" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('auth.first_name') }}
                </label>
                <UInput v-model="editForm.prenom" size="md" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('auth.last_name') }}
                </label>
                <UInput v-model="editForm.nom" size="md" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('profile.phone') }} ({{ $t('common.optional') }})
                </label>
                <UInput v-model="editForm.phone" type="tel" size="md" />
              </div>
            </div>
          </div>

          <!-- Statistiques d'activité -->
          <div class="space-y-4">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ $t('admin.activity') }}
            </h3>

            <div class="space-y-3">
              <div class="flex items-center gap-3 text-sm">
                <UIcon name="i-heroicons-building-library" class="w-4 h-4 text-blue-500" />
                <span
                  >{{ user._count?.createdConventions || 0 }}
                  {{ $t('admin.conventions_count') }}</span
                >
              </div>

              <div class="flex items-center gap-3 text-sm">
                <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-green-500" />
                <span
                  >{{ user._count?.createdEditions || 0 }} {{ $t('admin.editions_count') }}</span
                >
              </div>

              <div class="flex items-center gap-3 text-sm">
                <UIcon name="i-heroicons-heart" class="w-4 h-4 text-red-500" />
                <span
                  >{{ user._count?.favoriteEditions || 0 }} {{ $t('admin.favorites_count') }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Données liées -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-link" class="text-blue-500" />
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ $t('admin.linked_data') }}
            </h3>
          </div>
        </template>

        <!-- Légende -->
        <div class="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <div class="flex items-center gap-1">
            <UIcon name="i-heroicons-trash" class="w-3 h-3 text-error-500" />
            {{ $t('admin.on_delete_cascade') }}
          </div>
          <div class="flex items-center gap-1">
            <UIcon name="i-heroicons-link-slash" class="w-3 h-3 text-warning-500" />
            {{ $t('admin.on_delete_unlink') }}
          </div>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="section in linkedDataSections" :key="section.titleKey" class="space-y-2">
            <h4
              class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1"
            >
              <UIcon :name="section.icon" class="w-4 h-4" />
              {{ $t(section.titleKey) }}
            </h4>
            <div class="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <template v-for="item in section.items" :key="item.label">
                <div v-if="item.count > 0" class="flex items-center justify-between">
                  <span class="flex items-center gap-1">
                    <UIcon :name="item.icon" :class="item.iconClass" class="w-3 h-3" />
                    {{ $t(item.label) }}
                  </span>
                  <UBadge :color="item.color" variant="soft" size="xs">{{ item.count }}</UBadge>
                </div>
              </template>
            </div>
          </div>
        </div>

        <p
          v-if="totalLinkedData === 0"
          class="text-sm text-gray-500 dark:text-gray-400 text-center py-2"
        >
          {{ $t('admin.no_linked_data') }}
        </p>

        <!-- Alerte de suppression si données liées -->
        <UAlert
          v-if="totalLinkedData > 0"
          class="mt-4"
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="soft"
          :title="$t('admin.deletion_warning')"
          :description="$t('admin.deletion_warning_description', { count: totalLinkedData })"
        />
      </UCard>

      <!-- Actions administrateur -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-gray-900 dark:text-white">
            {{ $t('common.actions') }}
          </h3>
        </template>

        <div class="flex gap-3">
          <UButton
            v-if="!user.isGlobalAdmin"
            icon="i-heroicons-shield-check"
            color="primary"
            variant="soft"
            @click="promoteToAdmin(user)"
          >
            {{ $t('admin.promote_to_admin') }}
          </UButton>

          <UButton
            v-else
            icon="i-heroicons-shield-exclamation"
            color="warning"
            variant="soft"
            @click="demoteFromAdmin(user)"
          >
            {{ $t('admin.demote') }}
          </UButton>

          <UButton
            v-if="!user.isGlobalAdmin"
            icon="i-heroicons-trash"
            color="error"
            variant="soft"
            @click="openDeletionModal(user)"
          >
            {{ $t('admin.delete_account') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Modal de suppression -->
    <AdminUserDeletionModal
      v-model:open="showDeletionModal"
      :user="userToDelete"
      @deleted="onUserDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~/utils/date'
// Type pour l'utilisateur depuis l'API
interface UserProfile {
  id: number
  email: string
  pseudo: string
  nom: string
  prenom: string
  phone?: string | null
  profilePicture?: string | null
  isEmailVerified: boolean
  isGlobalAdmin: boolean
  createdAt: string
  updatedAt: string
  _count: {
    createdConventions: number
    createdEditions: number
    favoriteEditions: number
    attendingEditions: number
    organizations: number
    volunteerApplications: number
    artistProfiles: number
    showApplications: number
    workshops: number
    workshopFavorites: number
    carpoolOffers: number
    carpoolRequests: number
    carpoolBookings: number
    carpoolComments: number
    carpoolRequestComments: number
    editionPosts: number
    editionPostComments: number
    lostFoundItems: number
    lostFoundComments: number
    conversationParticipants: number
    notifications: number
    feedbacks: number
    claimRequests: number
    manuallyAddedVolunteers: number
    validatedArtistEntries: number
    decidedShowApplications: number
  }
}

// Protection de la page - seulement pour les super admins
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const userId = parseInt(route.params.id as string)

// Helper pour construire un item de données liées
const cascadeIcon = 'i-heroicons-trash'
const cascadeClass = 'text-error-500'
const unlinkIcon = 'i-heroicons-link-slash'
const unlinkClass = 'text-warning-500'

// Items par catégorie avec indicateur cascade/unlink
const conventionItems = computed(() => {
  const c = user.value?._count
  if (!c) return []
  return [
    {
      label: 'admin.conventions_created',
      count: c.createdConventions || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.editions_created',
      count: c.createdEditions || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.organizer_roles',
      count: c.organizations || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.claim_requests',
      count: c.claimRequests || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
  ]
})

const participationItems = computed(() => {
  const c = user.value?._count
  if (!c) return []
  return [
    {
      label: 'admin.volunteer_applications',
      count: c.volunteerApplications || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.artist_profiles',
      count: c.artistProfiles || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.show_applications',
      count: c.showApplications || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.workshops_created',
      count: c.workshops || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.manually_added_volunteers',
      count: c.manuallyAddedVolunteers || 0,
      color: 'warning' as const,
      icon: unlinkIcon,
      iconClass: unlinkClass,
    },
    {
      label: 'admin.decided_applications',
      count: c.decidedShowApplications || 0,
      color: 'warning' as const,
      icon: unlinkIcon,
      iconClass: unlinkClass,
    },
    {
      label: 'admin.validated_artist_entries',
      count: c.validatedArtistEntries || 0,
      color: 'warning' as const,
      icon: unlinkIcon,
      iconClass: unlinkClass,
    },
  ]
})

const interactionItems = computed(() => {
  const c = user.value?._count
  if (!c) return []
  return [
    {
      label: 'admin.favorites',
      count: (c.favoriteEditions || 0) + (c.workshopFavorites || 0),
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.carpool_items',
      count: (c.carpoolOffers || 0) + (c.carpoolRequests || 0),
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.posts_and_comments',
      count: (c.editionPosts || 0) + (c.editionPostComments || 0),
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.lost_found_items',
      count: (c.lostFoundItems || 0) + (c.lostFoundComments || 0),
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.conversations',
      count: c.conversationParticipants || 0,
      color: 'error' as const,
      icon: cascadeIcon,
      iconClass: cascadeClass,
    },
    {
      label: 'admin.feedbacks_count',
      count: c.feedbacks || 0,
      color: 'warning' as const,
      icon: unlinkIcon,
      iconClass: unlinkClass,
    },
  ]
})

const linkedDataSections = computed(() => [
  {
    titleKey: 'admin.linked_conventions',
    icon: 'i-heroicons-building-library',
    items: conventionItems.value,
  },
  {
    titleKey: 'admin.linked_participation',
    icon: 'i-heroicons-user-group',
    items: participationItems.value,
  },
  {
    titleKey: 'admin.linked_interactions',
    icon: 'i-heroicons-chat-bubble-left-right',
    items: interactionItems.value,
  },
])

const totalLinkedData = computed(() => {
  return linkedDataSections.value.reduce(
    (sum, section) => sum + section.items.reduce((s, item) => s + item.count, 0),
    0
  )
})

// État pour le modal de suppression
const userToDelete = ref<UserProfile | null>(null)
const showDeletionModal = ref(false)

// État pour l'édition
const isEditing = ref(false)
const editForm = ref({
  email: '',
  pseudo: '',
  prenom: '',
  nom: '',
  phone: '',
})

// Récupération des données utilisateur
const {
  data: user,
  pending,
  error,
  refresh,
} = await useFetch<UserProfile>(`/api/admin/users/${userId}`)

// Gestionnaire de changement de photo de profil
const onProfilePictureChanged = async (newProfilePicture: string | null) => {
  if (user.value) {
    // Mettre à jour temporairement la valeur locale
    user.value.profilePicture = newProfilePicture
    // Rafraîchir les données depuis le serveur pour obtenir le bon format
    await refresh()
  }
}

// Actions administrateur
const { execute: executePromote } = useApiAction(() => `/api/admin/users/${userId}/promote`, {
  method: 'PUT',
  body: () => ({ isGlobalAdmin: true }),
  successMessage: {
    title: t('common.success'),
    description: t('admin.user_promoted_successfully'),
  },
  errorMessages: { default: t('admin.promotion_error') },
  refreshOnSuccess: () => refresh(),
})

const promoteToAdmin = (targetUser: UserProfile) => {
  const confirmMessage = t('admin.confirm_promote_to_admin', {
    name: `${targetUser.prenom} ${targetUser.nom}`,
  })
  if (confirm(confirmMessage)) {
    executePromote()
  }
}

const { execute: executeDemote } = useApiAction(() => `/api/admin/users/${userId}/promote`, {
  method: 'PUT',
  body: () => ({ isGlobalAdmin: false }),
  successMessage: { title: t('common.success'), description: t('admin.user_demoted_successfully') },
  errorMessages: { default: t('admin.demotion_error') },
  refreshOnSuccess: () => refresh(),
})

const demoteFromAdmin = (targetUser: UserProfile) => {
  const confirmMessage = t('admin.confirm_demote_from_admin', {
    name: `${targetUser.prenom} ${targetUser.nom}`,
  })
  if (confirm(confirmMessage)) {
    executeDemote()
  }
}

const openDeletionModal = (user: UserProfile) => {
  userToDelete.value = user
  showDeletionModal.value = true
}

const onUserDeleted = () => {
  // Rediriger vers la liste des utilisateurs après suppression
  showDeletionModal.value = false
  userToDelete.value = null
  router.push('/admin/users')

  toast.add({
    title: t('admin.user_deleted_successfully'),
    color: 'success',
  })
}

// Fonctions d'édition
const startEditing = () => {
  if (!user.value) return

  // Remplir le formulaire avec les données actuelles
  editForm.value = {
    email: user.value.email,
    pseudo: user.value.pseudo,
    prenom: user.value.prenom,
    nom: user.value.nom,
    phone: user.value.phone || '',
  }

  isEditing.value = true
}

const cancelEditing = () => {
  isEditing.value = false
  // Réinitialiser le formulaire
  editForm.value = {
    email: '',
    pseudo: '',
    prenom: '',
    nom: '',
    phone: '',
  }
}

const { execute: executeSaveChanges, loading: saving } = useApiAction(
  () => `/api/admin/users/${userId}`,
  {
    method: 'PUT',
    body: () => editForm.value,
    successMessage: {
      title: t('common.success'),
      description: 'Informations utilisateur mises à jour',
    },
    errorMessages: { default: 'Erreur lors de la mise à jour' },
    onSuccess: (result) => {
      if (user.value) {
        Object.assign(user.value, result)
      }
      isEditing.value = false
    },
  }
)

const saveChanges = () => {
  if (!user.value) return
  executeSaveChanges()
}
</script>
