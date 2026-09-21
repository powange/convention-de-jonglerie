<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="$t('gestion.treasury.entry_kind')" required>
          <UFieldGroup>
            <UButton
              v-for="option in kindOptions"
              :key="option.value"
              :color="form.kind === option.value ? option.color : 'neutral'"
              :variant="form.kind === option.value ? 'solid' : 'outline'"
              :icon="option.icon"
              :label="option.label"
              @click="choisirSens(option.value)"
            />
          </UFieldGroup>
        </UFormField>

        <UFormField :label="$t('gestion.treasury.entry_title')" required>
          <UInput v-model="form.title" class="w-full" maxlength="150" />
        </UFormField>

        <UFormField :label="$t('common.description')">
          <UTextarea v-model="form.description" class="w-full" :rows="2" maxlength="2000" />
        </UFormField>

        <div class="flex flex-col gap-4 sm:flex-row">
          <UFormField :label="$t('common.amount')" required class="sm:w-48">
            <!-- Saisie en unité courante ; le serveur convertit en centimes. `step-snapping`
                 désactivé, sinon un montant hors du pas serait ramené au multiple le plus proche. -->
            <UInputNumber
              v-model="form.amount"
              :min="0"
              :step="10"
              :step-snapping="false"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.treasury.entry_code')" class="flex-1">
            <USelectMenu
              v-model="form.codeId"
              value-key="value"
              :items="codeItems"
              class="w-full"
              :search-input="{ placeholder: $t('gestion.treasury.code_search_all') }"
              :search-term="rechercheCode"
              @update:search-term="(v: string) => (rechercheCode = v)"
            />
          </UFormField>
        </div>

        <!-- Prévisionnel : bascule le montant du réglé vers l'engagé. Le solde ne change pas,
             mais le réglé cesse de compter ce qui n'a pas été payé. -->
        <UCheckbox
          v-model="form.isForecast"
          :label="$t('gestion.treasury.entry_forecast')"
          :description="$t('gestion.treasury.entry_forecast_hint')"
        />

        <!-- L'avance ne concerne que les dépenses : une recette n'est avancée par personne. -->
        <template v-if="form.kind === 'EXPENSE'">
          <UFormField :label="$t('gestion.treasury.entry_advanced_by')">
            <UserSelector
              v-model="personneAvance"
              v-model:search-term="rechercheAvance"
              :searched-users="candidatsAvance"
              :searching-users="rechercheEnCours"
              :placeholder="$t('gestion.treasury.entry_advanced_by_placeholder')"
            />
          </UFormField>

          <!-- Sans personne désignée, il n'y a rien à rembourser : la case n'aurait aucun sens. -->
          <UCheckbox
            v-if="personneAvance"
            v-model="form.reimbursed"
            :label="$t('gestion.treasury.entry_reimbursed')"
          />
        </template>

        <!-- Le justificatif ferme le formulaire : c'est la dernière chose qu'on fait, souvent
             en photographiant le ticket qu'on a encore en main. -->
        <UFormField :label="$t('gestion.treasury.entry_receipt')">
          <UiImageUpload
            v-model="form.imageUrl"
            allow-camera
            :endpoint="{ type: 'treasury', id: editionId }"
            :alt="$t('gestion.treasury.entry_receipt')"
            :placeholder="$t('gestion.treasury.entry_receipt_placeholder')"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('common.cancel')"
          @click="isOpen = false"
        />
        <UButton :loading="saving" :disabled="!isValid" :label="$t('common.save')" @click="save" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useDebounce } from '@vueuse/core'

import type { UserSelectItem } from '~/components/UserSelector.vue'

/** Ce que l'API rend d'une personne ayant avancé — de quoi l'afficher, rien de plus. */
interface CandidatAvance {
  id: number
  pseudo: string
  profilePicture?: string | null
  emailHash?: string | null
}

const props = defineProps<{
  open: boolean
  /** Ligne existante à modifier, ou `null` pour une création. */
  entry: {
    entryId?: number
    kind: 'EXPENSE' | 'INCOME'
    title: string
    description?: string | null
    settled: number
    code?: { id: number } | null
    imageUrl?: string | null
    isForecast?: boolean
    reimbursed?: boolean
    advancedBy?: CandidatAvance | null
  } | null
  codes: { id: number; code: string; label: string }[]
  currency: string
  editionId: number
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const form = reactive<{
  kind: 'EXPENSE' | 'INCOME'
  title: string
  description: string
  amount: number
  codeId: number | null
  imageUrl: string | null
  isForecast: boolean
  reimbursed: boolean
}>({
  kind: 'EXPENSE',
  title: '',
  description: '',
  amount: 0,
  codeId: null,
  imageUrl: null,
  isForecast: false,
  reimbursed: false,
})

/**
 * La personne qui a avancé, telle que `UserSelector` la manipule. Séparée de `form` parce que le
 * composant travaille sur un objet complet là où l'API n'attend qu'un identifiant.
 */
const personneAvance = ref<UserSelectItem | null>(null)
const rechercheAvance = ref('')
const rechercheDebouncee = useDebounce(rechercheAvance, 300)
const candidatsAvance = ref<UserSelectItem[]>([])
const rechercheEnCours = ref(false)

watch(rechercheDebouncee, async (terme) => {
  rechercheEnCours.value = true
  try {
    const reponse = await $fetch<{ data: { users: CandidatAvance[] } }>(
      `/api/editions/${props.editionId}/treasury/advance-candidates`,
      { params: terme ? { search: terme } : {} }
    )
    candidatsAvance.value = (reponse?.data?.users ?? []).map((u) => ({
      id: u.id,
      label: u.pseudo,
      pseudo: u.pseudo,
      email: '',
      emailHash: u.emailHash ?? '',
      profilePicture: u.profilePicture,
      isRealUser: true,
    }))
  } catch {
    candidatsAvance.value = []
  } finally {
    rechercheEnCours.value = false
  }
})

const kindOptions = computed(() => [
  {
    value: 'EXPENSE' as const,
    label: t('gestion.treasury.expense'),
    icon: 'i-lucide-trending-down',
    color: 'error' as const,
  },
  {
    value: 'INCOME' as const,
    label: t('gestion.treasury.income'),
    icon: 'i-lucide-trending-up',
    color: 'success' as const,
  },
])

/**
 * Les codes proposés dépendent du sens de la ligne.
 *
 * La classe du plan comptable français porte ce sens : 6 pour une charge, 7 pour un produit.
 * Rien ne l'enregistre sur le code lui-même — c'est déduit du premier chiffre.
 *
 * Conséquence assumée : un code qui ne suit pas cette numérotation, saisi librement (« REPAS »,
 * « A1 »), n'est proposé d'aucun côté. Il reste utilisable sur les lignes qui le portent déjà,
 * mais ne peut plus être choisi tant qu'il n'est pas renuméroté.
 */
/** Terme tapé dans le select des codes. */
const rechercheCode = ref('')

/** La règle des codes proposés vit dans `codesProposes` : elle sert aussi à la page. */
const codesAffiches = computed(() =>
  codesProposes(props.codes, {
    sens: form.kind,
    recherche: rechercheCode.value,
    codeCourantId: form.codeId,
  })
)

const codeItems = computed(() => [
  { value: null, label: t('gestion.treasury.no_code') },
  ...codesAffiches.value.map((c) => ({ value: c.id, label: `${c.code} — ${c.label}` })),
])

/**
 * Changer le sens d'une ligne peut rendre son code inéligible. On le retire alors, plutôt que de
 * laisser un identifiant sélectionné qui ne figure plus dans la liste : le champ paraîtrait vide
 * tout en envoyant l'ancien code à l'enregistrement.
 *
 * Rattaché au clic et non à un `watch` sur le sens du formulaire : celui-ci écrit lui-même ce champ à
 * chaque ouverture, et un observateur aurait effacé le code d'une ligne existante au seul motif
 * qu'elle ne suit pas la numérotation — une perte de donnée silencieuse, à l'affichage.
 */
function choisirSens(sens: 'EXPENSE' | 'INCOME') {
  if (form.kind === sens) return
  form.kind = sens
  // Sans recherche : la liste du nouveau sens, celle que la personne va voir. Si le code choisi
  // n'y figure pas, il n'a plus lieu d'être — on ne garde pas une imputation que le formulaire
  // ne montre plus.
  const eligibles = codesProposes(props.codes, { sens })
  if (form.codeId !== null && !eligibles.some((c) => c.id === form.codeId)) {
    form.codeId = null
  }
}

const isEditing = computed(() => !!props.entry?.entryId)
const title = computed(() =>
  isEditing.value ? t('gestion.treasury.edit_entry') : t('gestion.treasury.add_entry')
)
const isValid = computed(() => form.title.trim().length > 0 && form.amount > 0)

// Repartir des valeurs de la ligne à chaque ouverture : sans cela, une modification garderait la
// saisie précédente, et une création rouvrirait le dernier montant tapé.
watch(
  () => [props.open, props.entry] as const,
  ([open, entry]) => {
    if (!open) return
    form.kind = entry?.kind ?? 'EXPENSE'
    form.title = entry?.title ?? ''
    form.description = entry?.description ?? ''
    form.amount = entry ? entry.settled / 100 : 0
    form.codeId = entry?.code?.id ?? null
    form.imageUrl = entry?.imageUrl ?? null
    form.isForecast = entry?.isForecast ?? false
    form.reimbursed = entry?.reimbursed ?? false
    personneAvance.value = entry?.advancedBy
      ? {
          id: entry.advancedBy.id,
          label: entry.advancedBy.pseudo,
          pseudo: entry.advancedBy.pseudo,
          email: '',
          emailHash: entry.advancedBy.emailHash ?? '',
          profilePicture: entry.advancedBy.profilePicture,
          isRealUser: true,
        }
      : null
    rechercheAvance.value = ''
  },
  { immediate: true }
)

const body = () => ({
  kind: form.kind,
  title: form.title.trim(),
  description: form.description.trim() || null,
  amount: form.amount,
  codeId: form.codeId,
  imageUrl: form.imageUrl,
  isForecast: form.isForecast,
  // Le serveur remet ces deux champs à zéro sur une recette : inutile de filtrer ici aussi.
  advancedById: personneAvance.value?.id ?? null,
  reimbursed: form.reimbursed,
})

const { execute: createEntry, loading: creating } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/entries`,
  {
    method: 'POST',
    body,
    successMessage: { title: t('gestion.treasury.entry_saved') },
    errorMessages: { default: t('gestion.treasury.entry_error') },
    onSuccess: () => emit('saved'),
  }
)

const { execute: updateEntry, loading: updating } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/entries/${props.entry?.entryId}`,
  {
    method: 'PUT',
    body,
    successMessage: { title: t('gestion.treasury.entry_saved') },
    errorMessages: { default: t('gestion.treasury.entry_error') },
    onSuccess: () => emit('saved'),
  }
)

const saving = computed(() => creating.value || updating.value)

async function save() {
  if (!isValid.value) return
  if (isEditing.value) await updateEntry()
  else await createEntry()
}
</script>
