<template>
  <UModal v-model:open="isOpen" :title="$t('admin.merge_user_accounts')" size="xl">
    <template #body>
      <div v-if="user" class="space-y-5">
        <!-- Étape 1 : choix de l'autre compte et du sens de la fusion -->
        <template v-if="step === 'select'">
          <UFormField :label="$t('admin.merge_select_other_user', { pseudo: user.pseudo })">
            <UserSelector
              v-model="otherUser"
              v-model:search-term="searchTerm"
              :searched-users="searchedUsers"
              :searching-users="searchingUsers"
            />
          </UFormField>

          <div v-if="otherUser" class="space-y-3">
            <p class="text-sm font-medium">{{ $t('admin.merge_choose_kept_account') }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                v-for="candidate in mergeCandidates"
                :key="candidate.id"
                type="button"
                class="text-left p-3 rounded-lg border-2 transition-colors"
                :class="
                  keptUserId === candidate.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                "
                @click="keptUserId = candidate.id"
              >
                <div class="flex items-center gap-2">
                  <UiUserAvatar :user="candidate" size="sm" />
                  <div class="min-w-0">
                    <p class="font-medium truncate">{{ candidate.pseudo }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ candidate.email }}</p>
                  </div>
                </div>
                <UBadge
                  :color="keptUserId === candidate.id ? 'primary' : 'neutral'"
                  variant="soft"
                  size="sm"
                  class="mt-2"
                >
                  {{
                    keptUserId === candidate.id
                      ? $t('admin.merge_kept_account')
                      : $t('admin.merge_absorbed_account')
                  }}
                </UBadge>
              </button>
            </div>
          </div>
        </template>

        <!-- Étape 2 : aperçu chiffré et arbitrage du profil -->
        <template v-else-if="step === 'review'">
          <div v-if="loadingPreview" class="space-y-2">
            <USkeleton v-for="i in 4" :key="i" class="h-8 w-full" />
          </div>

          <template v-else>
            <div>
              <p class="text-sm font-medium mb-2">{{ $t('admin.merge_preview_title') }}</p>
              <p v-if="!impact?.groups.length" class="text-sm text-gray-500">
                {{ $t('admin.merge_no_data_to_transfer') }}
              </p>
              <ul v-else class="space-y-1">
                <li
                  v-for="group in impact.groups"
                  :key="group.group"
                  class="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800"
                >
                  <span>{{ $t(`admin.merge_group_${group.group}`) }}</span>
                  <span class="flex items-center gap-2">
                    <UBadge color="primary" variant="soft" size="sm">
                      {{ $t('admin.merge_transferred_count', { count: group.transferred }) }}
                    </UBadge>
                    <UBadge v-if="group.duplicates" color="warning" variant="soft" size="sm">
                      {{ $t('admin.merge_duplicates_removed', { count: group.duplicates }) }}
                    </UBadge>
                  </span>
                </li>
              </ul>
            </div>

            <USeparator />

            <div>
              <p class="text-sm font-medium">{{ $t('admin.merge_field_arbitration') }}</p>
              <p class="text-xs text-gray-500 mt-1 mb-3">
                {{ $t('admin.merge_field_arbitration_description') }}
              </p>

              <p v-if="!divergentFields.length" class="text-sm text-gray-500">
                {{ $t('admin.merge_identical_values') }}
              </p>

              <div
                v-for="field in divergentFields"
                :key="field.key"
                class="py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <p class="text-sm font-medium">{{ $t(`admin.merge_field_${field.key}`) }}</p>
                <p v-if="field.key === 'credentials'" class="text-xs text-gray-500 mb-2">
                  {{ $t('admin.merge_field_credentials_hint') }}
                </p>
                <UFieldGroup class="mt-1 w-full">
                  <UButton
                    v-for="side in ['target', 'source'] as const"
                    :key="side"
                    :variant="fieldChoices[field.key] === side ? 'solid' : 'outline'"
                    :color="fieldChoices[field.key] === side ? 'primary' : 'neutral'"
                    class="flex-1 justify-start"
                    @click="fieldChoices[field.key] = side"
                  >
                    <span class="truncate">
                      {{ field[side] || '—' }}
                    </span>
                  </UButton>
                </UFieldGroup>
              </div>
            </div>
          </template>
        </template>

        <!-- Étape 3 : avertissement et confirmation -->
        <template v-else>
          <UAlert
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            :title="$t('admin.merge_warning_title')"
            :description="$t('admin.merge_warning_description')"
          />

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <p class="text-xs text-gray-500 mb-1">{{ $t('admin.merge_kept_account') }}</p>
              <p class="font-medium">{{ keptUser?.pseudo }}</p>
              <p class="text-xs text-gray-500 truncate">{{ keptUser?.email }}</p>
            </div>
            <div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
              <p class="text-xs text-red-600 dark:text-red-400 mb-1">
                {{ $t('admin.merge_absorbed_account') }}
              </p>
              <p class="font-medium">{{ absorbedUser?.pseudo }}</p>
              <p class="text-xs text-gray-500 truncate">{{ absorbedUser?.email }}</p>
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium">
              {{ $t('admin.type_pseudo_to_confirm') }}
            </label>
            <UInput v-model="confirmationText" :placeholder="absorbedUser?.pseudo" size="md" />
          </div>
        </template>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <UButton variant="ghost" @click="step === 'select' ? close() : goBack()">
          {{ step === 'select' ? $t('common.cancel') : $t('common.back') }}
        </UButton>
        <UButton
          v-if="step !== 'confirm'"
          :disabled="!canGoNext"
          :loading="loadingPreview"
          @click="goNext"
        >
          {{ $t('common.next') }}
        </UButton>
        <UButton v-else color="error" :loading="merging" :disabled="!canConfirm" @click="confirm">
          {{ $t('admin.merge_confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useDebounce } from '@vueuse/core'

import type { UserSelectItem } from '~/components/UserSelector.vue'

interface ModalUser {
  id: number
  email: string
  emailHash?: string
  pseudo: string
  profilePicture?: string | null
}

/** Profil complet renvoyé par `/api/admin/users/[id]`. */
interface MergeProfile extends ModalUser {
  nom: string | null
  prenom: string | null
  phone: string | null
  pronouns: string | null
  preferredLanguage: string
  authProvider: string
  isEmailVerified: boolean
  isGlobalAdmin: boolean
}

interface MergeGroupImpact {
  group: string
  transferred: number
  duplicates: number
}

interface MergeImpact {
  groups: MergeGroupImpact[]
  totalTransferred: number
  totalDuplicates: number
}

const props = defineProps<{ user: ModalUser | null; open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'merged'): void
}>()

const { t } = useI18n()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

type Step = 'select' | 'review' | 'confirm'
const step = ref<Step>('select')

// --- Étape 1 : recherche de l'autre compte ---
const searchTerm = ref('')
const debouncedSearch = useDebounce(searchTerm, 300)
const searchedUsers = ref<UserSelectItem[]>([])
const searchingUsers = ref(false)
const otherUser = ref<UserSelectItem | null>(null)

watch(debouncedSearch, async (query) => {
  if (!query || query.length < 2) {
    searchedUsers.value = []
    return
  }
  searchingUsers.value = true
  try {
    const response = await $fetch<{ data: MergeProfile[] }>('/api/admin/users', {
      query: { search: query, limit: 10 },
    })
    searchedUsers.value = (response?.data ?? [])
      .filter((u) => u.id !== props.user?.id)
      .map((u) => ({
        id: u.id,
        label: `${u.pseudo} (${u.email})`,
        pseudo: u.pseudo,
        email: u.email,
        emailHash: u.emailHash ?? '',
        profilePicture: u.profilePicture,
      }))
  } catch {
    searchedUsers.value = []
  } finally {
    searchingUsers.value = false
  }
})

const mergeCandidates = computed<ModalUser[]>(() =>
  props.user && otherUser.value ? [props.user, otherUser.value] : []
)

const keptUserId = ref<number | null>(null)
watch(otherUser, () => {
  keptUserId.value = props.user?.id ?? null
})

const absorbedUserId = computed(
  () => mergeCandidates.value.find((c) => c.id !== keptUserId.value)?.id ?? null
)

// --- Étape 2 : profils complets, aperçu et arbitrage ---
const keptUser = ref<MergeProfile | null>(null)
const absorbedUser = ref<MergeProfile | null>(null)
const impact = ref<MergeImpact | null>(null)
const loadingPreview = ref(false)

type FieldKey =
  | 'credentials'
  | 'pseudo'
  | 'nom'
  | 'prenom'
  | 'phone'
  | 'pronouns'
  | 'preferredLanguage'
  | 'profilePicture'

const fieldChoices = reactive<Record<FieldKey, 'target' | 'source'>>({
  credentials: 'target',
  pseudo: 'target',
  nom: 'target',
  prenom: 'target',
  phone: 'target',
  pronouns: 'target',
  preferredLanguage: 'target',
  profilePicture: 'target',
})

/** Seuls les champs qui diffèrent réellement entre les deux comptes sont proposés. */
const divergentFields = computed(() => {
  const kept = keptUser.value
  const absorbed = absorbedUser.value
  if (!kept || !absorbed) return []

  const rows: { key: FieldKey; target: string; source: string }[] = []

  const push = (key: FieldKey, target: string | null, source: string | null) => {
    if ((target ?? '') !== (source ?? '')) {
      rows.push({ key, target: target ?? '', source: source ?? '' })
    }
  }

  push('credentials', kept.email, absorbed.email)
  push('pseudo', kept.pseudo, absorbed.pseudo)
  push('nom', kept.nom, absorbed.nom)
  push('prenom', kept.prenom, absorbed.prenom)
  push('phone', kept.phone, absorbed.phone)
  push('pronouns', kept.pronouns, absorbed.pronouns)
  push('preferredLanguage', kept.preferredLanguage, absorbed.preferredLanguage)
  push('profilePicture', kept.profilePicture ?? null, absorbed.profilePicture ?? null)

  return rows
})

/**
 * Charge les deux profils et la simulation de fusion.
 * En cas de refus du serveur (compte absorbé super-administrateur, compte disparu…),
 * revient à la sélection avec le message d'erreur : laisser l'étape 2 vide donnerait un
 * bouton « Suivant » actif menant à une confirmation vouée à l'échec.
 */
const loadReview = async (): Promise<boolean> => {
  if (!keptUserId.value || !absorbedUserId.value) return false
  loadingPreview.value = true
  try {
    const [kept, absorbed] = await Promise.all([
      $fetch<MergeProfile>(`/api/admin/users/${keptUserId.value}`),
      $fetch<MergeProfile>(`/api/admin/users/${absorbedUserId.value}`),
    ])
    keptUser.value = kept
    absorbedUser.value = absorbed

    // Un champ vide côté compte conservé est présélectionné sur la valeur du compte absorbé.
    for (const row of divergentFields.value) {
      fieldChoices[row.key] = row.target ? 'target' : 'source'
    }

    const preview = await $fetch<{ data: MergeImpact }>(
      `/api/admin/users/${keptUserId.value}/merge`,
      { method: 'POST', body: { sourceUserId: absorbedUserId.value, dryRun: true } }
    )
    impact.value = preview.data
    return true
  } catch (error) {
    toast.add({
      title: t('admin.merge_error'),
      description: (error as { data?: { message?: string } })?.data?.message,
      color: 'error',
    })
    keptUser.value = null
    absorbedUser.value = null
    impact.value = null
    return false
  } finally {
    loadingPreview.value = false
  }
}

// --- Étape 3 : confirmation ---
const confirmationText = ref('')

const { execute: executeMerge, loading: merging } = useApiAction(
  () => `/api/admin/users/${keptUserId.value}/merge`,
  {
    method: 'POST',
    body: () => ({
      sourceUserId: absorbedUserId.value,
      fieldChoices: { ...fieldChoices },
      confirmPseudo: confirmationText.value,
    }),
    successMessage: { title: t('admin.users_merged_successfully') },
    errorMessages: { default: t('admin.merge_error') },
    onSuccess: () => {
      emit('merged')
      close()
    },
  }
)

const canGoNext = computed(() => {
  if (step.value === 'select') return Boolean(otherUser.value && keptUserId.value)
  // L'aperçu doit avoir abouti : sans profils chargés, il n'y a rien à confirmer.
  return !loadingPreview.value && Boolean(keptUser.value && absorbedUser.value)
})

const canConfirm = computed(
  () => confirmationText.value === absorbedUser.value?.pseudo && !merging.value
)

const goNext = async () => {
  if (step.value === 'select') {
    step.value = 'review'
    if (!(await loadReview())) step.value = 'select'
  } else {
    step.value = 'confirm'
  }
}

const goBack = () => {
  step.value = step.value === 'confirm' ? 'review' : 'select'
}

const confirm = () => {
  if (canConfirm.value) executeMerge()
}

const resetForm = () => {
  step.value = 'select'
  searchTerm.value = ''
  searchedUsers.value = []
  otherUser.value = null
  keptUserId.value = props.user?.id ?? null
  keptUser.value = null
  absorbedUser.value = null
  impact.value = null
  confirmationText.value = ''
  for (const key of Object.keys(fieldChoices) as FieldKey[]) fieldChoices[key] = 'target'
}

const close = () => {
  isOpen.value = false
  resetForm()
}

watch(
  () => props.open,
  (opened) => {
    if (opened) resetForm()
  }
)
</script>
