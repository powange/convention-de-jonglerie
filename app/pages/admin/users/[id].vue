<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- En-tête de la page -->
    <div class="flex items-center gap-4">
      <UButton
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="neutral"
        @click="$router.push('/admin/users')"
      >
        {{ $t('common.back') }}
      </UButton>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ $t('admin.view_profile') }}
        </h1>
      </div>
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

// État pour le modal de suppression
const userToDelete = ref<UserProfile | null>(null)
const showDeletionModal = ref(false)

// État pour l'édition
const isEditing = ref(false)
const saving = ref(false)
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
const promoteToAdmin = async (user: UserProfile) => {
  try {
    const confirmMessage = t('admin.confirm_promote_to_admin', {
      name: `${user.prenom} ${user.nom}`,
    })

    if (confirm(confirmMessage)) {
      await $fetch<UserProfile>(`/api/admin/users/${user.id}/promote`, {
        method: 'PUT',
        body: { isGlobalAdmin: true },
      })

      // Rafraîchir les données depuis le serveur
      await refresh()

      toast.add({
        title: t('common.success'),
        description: t('admin.user_promoted_successfully'),
        color: 'success',
      })
    }
  } catch (error: any) {
    console.error('Erreur lors de la promotion:', error)

    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('admin.promotion_error'),
      color: 'error',
    })
  }
}

const demoteFromAdmin = async (user: UserProfile) => {
  try {
    const confirmMessage = t('admin.confirm_demote_from_admin', {
      name: `${user.prenom} ${user.nom}`,
    })

    if (confirm(confirmMessage)) {
      await $fetch<UserProfile>(`/api/admin/users/${user.id}/promote`, {
        method: 'PUT',
        body: { isGlobalAdmin: false },
      })

      // Rafraîchir les données depuis le serveur
      await refresh()

      toast.add({
        title: t('common.success'),
        description: t('admin.user_demoted_successfully'),
        color: 'success',
      })
    }
  } catch (error: any) {
    console.error('Erreur lors de la rétrogradation:', error)

    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('admin.demotion_error'),
      color: 'error',
    })
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

const saveChanges = async () => {
  if (!user.value) return

  saving.value = true

  try {
    const updatedUser = await $fetch<UserProfile>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: editForm.value,
    })

    // Mettre à jour les données locales
    Object.assign(user.value, updatedUser)

    isEditing.value = false

    toast.add({
      title: t('common.success'),
      description: 'Informations utilisateur mises à jour',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour:', error)

    toast.add({
      title: t('common.error'),
      description: error.data?.message || 'Erreur lors de la mise à jour',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
