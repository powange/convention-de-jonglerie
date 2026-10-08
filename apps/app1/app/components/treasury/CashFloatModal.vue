<template>
  <UModal v-model:open="ouvert" :title="titre">
    <template #body>
      <UForm :state="form" :schema="schema" class="space-y-4" @submit="enregistrer">
        <UFormField name="amount" :label="$t('gestion.treasury.cash_float_amount')" required>
          <!-- Voir la note de `UiMoneyInput` : un champ `type="number"` AVALE la virgule et
               déclare pourtant la saisie valide — « 12,50 » y valait 1 250. -->
          <UiMoneyInput v-model="form.amount" :currency="currency" class="w-full" />
        </UFormField>

        <UFormField :label="$t('gestion.treasury.cash_float_lender')">
          <div class="space-y-2">
            <!--
              Un compte OU un nom libre, deux contrôles exclusifs.

              📍 Le même dispositif que `EntryModal` pour les avances, et c'est une duplication
              assumée : le seuil du dépôt est à trois répétitions, et ce qui compte vraiment — la
              normalisation du nom et son regroupement — est PARTAGÉ, dans
              `shared/utils/avance-nom-libre.ts` et `preteurNormalise`. Ce qui est recopié ici n'est
              que le câblage du formulaire ; divergent, il se voit et ne fausse aucun chiffre.
            -->
            <UFieldGroup>
              <UButton
                v-for="option in modes"
                :key="option.value"
                :color="mode === option.value ? 'primary' : 'neutral'"
                :variant="mode === option.value ? 'solid' : 'outline'"
                :icon="option.icon"
                :label="option.label"
                @click="choisirMode(option.value)"
              />
            </UFieldGroup>

            <UserSelector
              v-if="mode === 'compte'"
              v-model="personne"
              v-model:search-term="recherche"
              :searched-users="candidats"
              :searching-users="rechercheEnCours"
              :placeholder="$t('gestion.treasury.entry_advanced_by_placeholder')"
            />
            <UInput
              v-else
              v-model="nomLibre"
              class="w-full"
              :placeholder="$t('gestion.treasury.entry_advanced_by_free_placeholder')"
            />
          </div>
        </UFormField>

        <!-- Le MÊME sélecteur que la date d'opération d'une entrée (`EntryModal`) : un calendrier,
             et `clearable` parce que la date est facultative — un champ `type="date"` ne se vide
             pas et impose la saisie au clavier dans un format que la locale ne dit pas. -->
        <UFormField name="operationDate" :label="$t('gestion.treasury.cash_float_date')">
          <UiDateField v-model="form.operationDate" size="md" clearable class="w-full" />
        </UFormField>

        <UFormField name="note" :label="$t('gestion.treasury.cash_float_note')">
          <UTextarea
            v-model="form.note"
            :rows="2"
            class="w-full"
            :placeholder="$t('gestion.treasury.cash_float_note_placeholder')"
          />
        </UFormField>

        <!-- Un interrupteur et non une case : c'est un ÉTAT qui bascule, pas un élément qu'on
             sélectionne dans une liste — et c'est la forme que `EntryModal` emploie déjà pour ses
             bascules. Le libellé descriptif passe sur le `UFormField`, qui le place sous le titre. -->
        <UFormField
          :label="$t('gestion.treasury.cash_float_restitution')"
          :description="$t('gestion.treasury.cash_float_restituted')"
        >
          <USwitch v-model="form.restituted" />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="soft" @click="ouvert = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton type="submit" :loading="enCours">{{ $t('common.save') }}</UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { z } from 'zod'

import type { UserSelectItem } from '~/components/UserSelector.vue'

/**
 * Saisir ou corriger un apport au fonds de caisse.
 *
 * ## Ce que cette modale ne fait pas
 *
 * Elle ne touche à **aucune ligne de trésorerie**. Un apport au fonds de caisse n'est ni une
 * charge ni un produit — c'est de l'argent prêté, qui changera de poche et reviendra. Il vit dans
 * sa propre table et son propre point d'API, de sorte que les totaux du compte de résultat ne
 * puissent pas le compter, même par mégarde.
 *
 * ## La restitution, et pourquoi c'est une case et non une date
 *
 * On coche « restitué » ; le serveur pose la date. Réenregistrer un apport déjà restitué **ne
 * déplace pas** sa date — c'est `dateDeSolde`, la règle partagée avec les remboursements d'avances,
 * qui s'en charge. Laisser saisir la date à la main aurait permis de la contredire.
 */
export interface ApportSaisissable {
  id: number
  amount: number
  lentById: number | null
  lentByName: string | null
  operationDate: string | null
  restitutedAt: string | null
  note: string | null
  lentBy?: {
    id: number
    pseudo: string
    profilePicture?: string | null
    emailHash?: string | null
  } | null
}

const props = defineProps<{
  editionId: number
  /** Le CODE de la devise, pas son symbole : `UiMoneyInput` en déduit l'affichage. */
  currency: string
  /** L'apport à corriger, ou `null` pour en créer un. */
  apport?: ApportSaisissable | null
}>()

const emit = defineEmits<{ saved: [] }>()
const ouvert = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const titre = computed(() =>
  props.apport
    ? t('gestion.treasury.cash_float_edit_title')
    : t('gestion.treasury.cash_float_add_title')
)

const form = reactive({
  amount: null as number | null,
  operationDate: '' as string,
  note: '' as string,
  restituted: false,
})

const schema = z.object({
  // Un apport de zéro ne prête rien : il n'encombrerait la liste que pour rien.
  amount: z.number().positive().max(10_000_000),
  note: z.string().max(300).optional(),
})

/* ------------------------------------------------- le prêteur */

const personne = ref<UserSelectItem | null>(null)
const nomLibre = ref('')
const mode = ref<'compte' | 'libre'>('compte')
const modes = computed(() => [
  {
    value: 'compte' as const,
    icon: 'i-heroicons-user',
    label: t('gestion.treasury.entry_advanced_by_member'),
  },
  {
    value: 'libre' as const,
    icon: 'i-heroicons-pencil',
    label: t('gestion.treasury.entry_advanced_by_free'),
  },
])

/** Basculer efface l'autre : les deux ne doivent jamais partir ensemble au serveur. */
function choisirMode(valeur: 'compte' | 'libre') {
  mode.value = valeur
  if (valeur === 'compte') nomLibre.value = ''
  else personne.value = null
}

const recherche = ref('')
const rechercheDebouncee = useDebounce(recherche, 300)
const candidats = ref<UserSelectItem[]>([])
const rechercheEnCours = ref(false)

watch(rechercheDebouncee, async (terme) => {
  rechercheEnCours.value = true
  try {
    // Le même point d'API que les avances : ceux qui sortent de l'argent sur une édition sont les
    // mêmes personnes, et une seconde liste de candidats aurait fini par en proposer d'autres.
    const reponse = await $fetch<{
      data: {
        users: {
          id: number
          pseudo: string
          profilePicture?: string | null
          emailHash?: string | null
        }[]
      }
    }>(`/api/editions/${props.editionId}/treasury/advance-candidates`, {
      params: terme ? { search: terme } : {},
    })
    candidats.value = (reponse?.data?.users ?? []).map((u) => ({
      id: u.id,
      label: u.pseudo,
      pseudo: u.pseudo,
      email: '',
      emailHash: u.emailHash ?? '',
      profilePicture: u.profilePicture,
      isRealUser: true,
    }))
  } catch {
    candidats.value = []
  } finally {
    rechercheEnCours.value = false
  }
})

/* ------------------------------------------------- remplissage et envoi */

/**
 * ⚠️ REMPLIR À L'OUVERTURE, et pas seulement au changement d'apport. La modale reste montée entre
 * deux ouvertures : sans ce `watch` sur `ouvert`, rouvrir pour un AUTRE apport après en avoir
 * corrigé un premier laisserait les valeurs du précédent — et on enregistrerait le mauvais montant
 * sur la bonne ligne.
 */
watch(
  [ouvert, () => props.apport],
  ([estOuvert]) => {
    if (!estOuvert) return
    const a = props.apport
    form.amount = a ? a.amount / 100 : null
    // `operationDate` arrive en ISO complet : l'entrée `type="date"` n'accepte que `AAAA-MM-JJ`,
    // et la découpe se fait en UTC — c'est une date civile, elle ne doit pas glisser d'un jour.
    form.operationDate = a?.operationDate ? a.operationDate.slice(0, 10) : ''
    form.note = a?.note ?? ''
    form.restituted = !!a?.restitutedAt
    nomLibre.value = a?.lentByName ?? ''
    personne.value = a?.lentBy
      ? {
          id: a.lentBy.id,
          label: a.lentBy.pseudo,
          pseudo: a.lentBy.pseudo,
          email: '',
          emailHash: a.lentBy.emailHash ?? '',
          profilePicture: a.lentBy.profilePicture,
          isRealUser: true,
        }
      : null
    mode.value = a?.lentByName ? 'libre' : 'compte'
  },
  { immediate: true }
)

const corps = () => ({
  amount: form.amount ?? 0,
  lentById: mode.value === 'compte' ? (personne.value?.id ?? null) : null,
  lentByName: mode.value === 'libre' ? nomLibre.value || null : null,
  operationDate: form.operationDate || null,
  note: form.note || null,
  restituted: form.restituted,
})

/*
 * ⚠️ DEUX ACTIONS ET NON UNE. `useApiAction` accepte une URL calculée, mais `method` est lue une
 * fois à l'appel : y passer une fonction l'enverrait telle quelle à `$fetch`. Les options sont donc
 * construites une seule fois et partagées entre les deux verbes — ce qui évite aussi que le message
 * de succès de la création diverge de celui de la correction.
 */
const optionsCommunes = {
  body: corps,
  successMessage: { title: t('gestion.treasury.cash_float_saved') },
  errorMessages: { default: t('gestion.treasury.cash_float_save_error') },
  onSuccess: () => {
    ouvert.value = false
    emit('saved')
  },
}

const creation = useApiAction(() => `/api/editions/${props.editionId}/treasury/cash-float`, {
  ...optionsCommunes,
  method: 'POST',
})

const correction = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/cash-float/${props.apport?.id}`,
  { ...optionsCommunes, method: 'PUT' }
)

const enCours = computed(() => creation.loading.value || correction.loading.value)
const enregistrer = () => (props.apport ? correction : creation).execute()
</script>
