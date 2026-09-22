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
                <UiUserName :user="user" />
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
                  >{{ $t('admin.preferred_language') }}:</span
                >
                <span class="font-medium flex items-center gap-2">
                  <UIcon
                    v-if="preferredLanguageFlag"
                    :name="preferredLanguageFlag"
                    class="w-4 h-3 shrink-0"
                  />
                  {{ preferredLanguageLabel }}
                </span>
              </div>

              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400"
                  >{{ $t('profile.member_since') }}:</span
                >
                <span class="font-medium">{{ formatDate(user.createdAt) }}</span>
              </div>

              <!-- Santé. La gravité s'affiche en pastille colorée, comme partout ailleurs sur le
                   site : c'est la seule information de ce bloc qu'on doit saisir d'un coup d'œil,
                   et le mot seul — « Critique » en noir sur blanc — ne se distingue pas du
                   reste. Le contact d'urgence ne s'affiche que s'il existe : une ligne « - » de
                   plus sur une fiche qui en compte déjà huit dilue ce qui compte. -->
              <div class="flex justify-between gap-4">
                <span class="text-gray-600 dark:text-gray-400 shrink-0">
                  {{ $t('profile.health.allergies') }}:
                </span>
                <span class="font-medium text-right">{{ user.allergies || '-' }}</span>
              </div>

              <div v-if="user.allergySeverity" class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">
                  {{ $t('profile.health.allergy_severity') }}:
                </span>
                <UBadge :class="graviteClasses" variant="subtle" size="sm">
                  <UIcon :name="graviteIcone" class="size-4 mr-1" />
                  {{ graviteLibelle }}
                </UBadge>
              </div>

              <div v-if="user.emergencyContactPhone" class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">
                  {{ $t('profile.health.emergency_contact_phone') }}:
                </span>
                <span class="font-medium">{{ user.emergencyContactPhone }}</span>
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
                <UiPhoneInput v-model="editForm.phone" size="md" />
              </div>

              <!-- Les mêmes champs que sur le formulaire du profil, dans le même ordre et avec
                   les mêmes composants : c'est la même information, et un administrateur qui
                   corrige une saisie doit retrouver ce que l'intéressé avait sous les yeux. -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('profile.health.allergies') }} ({{ $t('common.optional') }})
                </label>
                <UTextarea
                  v-model="editForm.allergies"
                  :rows="3"
                  :maxlength="1000"
                  :placeholder="$t('profile.health.allergies_placeholder')"
                  class="w-full"
                />
              </div>

              <!-- Proposée seulement quand une allergie est décrite : sans allergie, une gravité
                   ne veut rien dire. Même règle que sur le profil. -->
              <div v-if="editForm.allergies.trim()">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('profile.health.allergy_severity') }}
                </label>
                <USelect
                  v-model="editForm.allergySeverity"
                  :items="severityOptions"
                  size="md"
                  class="w-full"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('profile.health.emergency_contact_phone') }} ({{ $t('common.optional') }})
                </label>
                <UiPhoneInput v-model="editForm.emergencyContactPhone" size="md" />
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

      <!-- Éditions concernées -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-calendar-days" class="text-primary-500" />
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ $t('admin.related_editions') }}
            </h3>
            <UBadge v-if="editionsConcernees?.length" color="neutral" variant="soft" size="xs">
              {{ editionsConcernees.length }}
            </UBadge>
          </div>
        </template>

        <div v-if="editionsPending" class="space-y-3">
          <USkeleton v-for="n in 2" :key="n" class="h-14 w-full" />
        </div>

        <p
          v-else-if="!editionsConcernees?.length"
          class="text-sm text-gray-500 dark:text-gray-400 text-center py-2"
        >
          {{ $t('admin.no_related_edition') }}
        </p>

        <div v-else class="divide-y divide-gray-200 dark:divide-gray-800">
          <div
            v-for="edition in editionsConcernees"
            :key="edition.id"
            class="py-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2"
          >
            <div class="min-w-0">
              <ULink
                :to="`/editions/${edition.id}`"
                class="font-medium text-gray-900 dark:text-white hover:underline"
              >
                {{ edition.convention.name
                }}<template v-if="edition.name"> — {{ edition.name }}</template>
              </ULink>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(edition.startDate) }} – {{ formatDate(edition.endDate) }} ·
                {{ edition.city }}
              </div>
            </div>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="(role, index) in edition.roles"
                :key="index"
                :color="libelleRole(role).color"
                variant="soft"
                size="xs"
              >
                {{ $t(libelleRole(role).label) }}
              </UBadge>
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
import {
  getAllergySeverityBadgeClasses,
  getAllergySeverityInfo,
  getAllergySeveritySelectOptions,
  isValidAllergySeverityLevel,
} from '~/utils/allergy-severity'
import { formatDate } from '~/utils/date'
import { LOCALES_CONFIG, languageCodeToFlag } from '~/utils/locales'
// Type pour l'utilisateur depuis l'API
interface UserProfile {
  id: number
  email: string
  pseudo: string
  nom: string
  prenom: string
  pronouns?: string | null
  preferredLanguage?: string | null
  phone?: string | null
  allergies?: string | null
  allergySeverity?: string | null
  emergencyContactPhone?: string | null
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
/**
 * « Non précisée » n'est pas une gravité, c'est son absence.
 *
 * Le schéma du serveur n'accepte que les quatre niveaux réels ou `null` : cette valeur ne vit
 * que dans le formulaire, le temps d'offrir un choix qui revient en arrière. Même convention que
 * sur le formulaire du profil, dont cet écran doit être le reflet.
 */
const SEVERITE_NON_PRECISEE = 'UNSET'

// « Non précisée » d'abord : la gravité reste facultative, et il faut pouvoir revenir en arrière
// après l'avoir renseignée une fois.
const severityOptions = computed(() => [
  { value: SEVERITE_NON_PRECISEE, label: t('profile.health.severity_unset') },
  // Les libellés du helper sont des CLÉS de traduction, pas du texte : les passer tels quels
  // afficherait « edition.volunteers.allergy_severity_light_short » à l'écran.
  ...getAllergySeveritySelectOptions().map((o) => ({ value: o.value, label: t(o.label) })),
])

const editForm = ref({
  email: '',
  pseudo: '',
  prenom: '',
  nom: '',
  phone: '',
  allergies: '',
  allergySeverity: SEVERITE_NON_PRECISEE,
  emergencyContactPhone: '',
})

// Récupération des données utilisateur
const {
  data: user,
  pending,
  error,
  refresh,
} = await useFetch<UserProfile>(`/api/admin/users/${userId}`)

/**
 * La gravité telle que la fiche l'affiche : pastille colorée, icône et libellé traduit.
 *
 * Déclarée APRÈS `user`, qu'elle lit. Un `computed` est paresseux, donc l'ordre inverse aurait
 * fonctionné — mais c'est exactement la forme d'une zone morte temporelle, qui a déjà cassé une
 * page de ce dépôt quand c'était un `watch` et non un `computed`. Autant ne pas laisser traîner
 * le motif.
 */
const graviteInfo = computed(() => {
  const niveau = user.value?.allergySeverity
  return niveau && isValidAllergySeverityLevel(niveau) ? getAllergySeverityInfo(niveau) : null
})
const graviteClasses = computed(() =>
  graviteInfo.value ? getAllergySeverityBadgeClasses(graviteInfo.value.value) : ''
)
const graviteIcone = computed(() => graviteInfo.value?.icon ?? '')
const graviteLibelle = computed(() => (graviteInfo.value ? t(graviteInfo.value.label) : ''))

type RoleSurEdition =
  | { type: 'creator' | 'organizer' | 'attendee' | 'artist' }
  | { type: 'volunteer' | 'show'; statut: 'PENDING' | 'ACCEPTED' | 'REJECTED' }

interface EditionConcernee {
  id: number
  name: string | null
  startDate: string
  endDate: string
  city: string
  country: string
  imageUrl: string | null
  convention: { id: number; name: string }
  roles: RoleSurEdition[]
}

// Les éditions rattachées à ce profil. Requête à part : la fiche s'affiche sans l'attendre, et un
// profil ancien peut aligner beaucoup d'éditions.
const { data: editionsConcernees, pending: editionsPending } = await useFetch<EditionConcernee[]>(
  `/api/admin/users/${userId}/editions`,
  { lazy: true, default: () => [] }
)

/**
 * Les clés de libellé, écrites en entier.
 *
 * Une clé assemblée à l'exécution, en concaténant un préfixe et le nom du rôle, passerait pour
 * inutilisée aux yeux de l'outillage i18n : un `--delete-unused` l'emporterait, et rien ne casserait
 * avant l'affichage. Les écrire en entier les rend trouvables.
 */
const CLES_ROLE: Record<string, string> = {
  creator: 'admin.role_creator',
  organizer: 'admin.role_organizer',
  attendee: 'admin.role_attendee',
  artist: 'admin.role_artist',
  volunteer_PENDING: 'admin.role_volunteer_pending',
  volunteer_ACCEPTED: 'admin.role_volunteer_accepted',
  volunteer_REJECTED: 'admin.role_volunteer_rejected',
  show_PENDING: 'admin.role_show_pending',
  show_ACCEPTED: 'admin.role_show_accepted',
  show_REJECTED: 'admin.role_show_rejected',
}

/** Le libellé et la couleur d'un rôle. Un statut de candidature ne se lit pas comme un rôle tenu. */
const libelleRole = (role: RoleSurEdition) => {
  if (role.type === 'volunteer' || role.type === 'show') {
    return {
      label: CLES_ROLE[`${role.type}_${role.statut}`] ?? role.type,
      color:
        role.statut === 'ACCEPTED'
          ? ('success' as const)
          : role.statut === 'REJECTED'
            ? ('neutral' as const)
            : ('warning' as const),
    }
  }
  return { label: CLES_ROLE[role.type] ?? role.type, color: 'primary' as const }
}

// Langue préférée : libellé lisible + classe drapeau (cohérent avec le sélecteur de langue)
const preferredLanguageLabel = computed(() => {
  const code = user.value?.preferredLanguage
  if (!code) return '-'
  return LOCALES_CONFIG.find((l) => l.code === code)?.name || code
})
const preferredLanguageFlag = computed(() => {
  const code = user.value?.preferredLanguage
  return code ? languageCodeToFlag(code) : undefined
})

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
    allergies: user.value.allergies || '',
    allergySeverity: user.value.allergySeverity || SEVERITE_NON_PRECISEE,
    emergencyContactPhone: user.value.emergencyContactPhone || '',
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
    allergies: '',
    allergySeverity: SEVERITE_NON_PRECISEE,
    emergencyContactPhone: '',
  }
}

const { execute: executeSaveChanges, loading: saving } = useApiAction(
  () => `/api/admin/users/${userId}`,
  {
    method: 'PUT',
    body: () => ({
      ...editForm.value,
      allergies: editForm.value.allergies.trim() || null,
      // Une gravité sans allergie décrite n'a pas de sens : on la remet à néant plutôt que de
      // laisser traîner une valeur orpheline si la description est effacée. Même règle que sur
      // le formulaire du profil.
      allergySeverity:
        editForm.value.allergies.trim() && editForm.value.allergySeverity !== SEVERITE_NON_PRECISEE
          ? editForm.value.allergySeverity
          : null,
      emergencyContactPhone: editForm.value.emergencyContactPhone.trim() || null,
    }),
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
