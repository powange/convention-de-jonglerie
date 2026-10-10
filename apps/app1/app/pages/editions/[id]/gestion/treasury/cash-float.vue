<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">{{ $t('gestion.treasury.cash_float_title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('gestion.treasury.cash_float_subtitle') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          :to="`/editions/${editionId}/gestion/treasury`"
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
        >
          {{ $t('gestion.treasury.result_title') }}
        </UButton>
        <UButton icon="i-heroicons-plus" @click="ouvrirAjout">
          {{ $t('gestion.treasury.cash_float_add') }}
        </UButton>
      </div>
    </div>

    <!--
      L'encart qui dit POURQUOI cette page est à part. Sans lui, un trésorier peut légitimement
      croire que ces montants manquent au compte de résultat par oubli.
    -->
    <UAlert
      color="info"
      variant="subtle"
      icon="i-heroicons-information-circle"
      :title="$t('gestion.treasury.cash_float_notice_title')"
      :description="$t('gestion.treasury.cash_float_notice')"
    />

    <USkeleton v-if="pending" class="h-64 w-full" />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-triangle"
      :title="$t('common.error')"
      :description="error.message"
    />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <UCard v-for="carte in cartes" :key="carte.cle" data-carte-fonds-de-caisse>
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ carte.libelle }}
          </p>
          <p class="text-xl font-semibold mt-1 tabular-nums" :class="carte.classe">
            {{ carte.valeur }}
          </p>
          <p v-if="carte.aide" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ carte.aide }}
          </p>
        </UCard>
      </div>

      <!-- Le comptage de clôture : un montant RELEVÉ, saisi à la main. -->
      <UCard>
        <div class="flex flex-wrap items-end justify-between gap-4">
          <UFormField
            :label="$t('gestion.treasury.cash_float_count')"
            :help="$t('gestion.treasury.cash_float_count_help')"
            class="min-w-60"
          >
            <UiMoneyInput v-model="comptage" :currency="currency" class="w-full" />
          </UFormField>
          <div class="flex items-center gap-2">
            <UButton
              v-if="etat.compte !== null"
              color="neutral"
              variant="soft"
              :loading="comptageEnCours"
              @click="effacerLeComptage"
            >
              {{ $t('gestion.treasury.cash_float_count_clear') }}
            </UButton>
            <UButton :loading="comptageEnCours" @click="enregistrerLeComptage">
              {{ $t('common.save') }}
            </UButton>
          </div>
        </div>
        <p v-if="data?.countedAt" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {{ $t('gestion.treasury.cash_float_counted_at', { date: dateCourte(data.countedAt) }) }}
        </p>
      </UCard>

      <!-- Les prêteurs : à qui on doit encore quoi. C'est l'information qu'on vient chercher. -->
      <UCard v-if="etat.preteurs.length">
        <template #header>
          <h2 class="font-semibold">{{ $t('gestion.treasury.cash_float_lenders') }}</h2>
        </template>
        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          <div
            v-for="preteur in etat.preteurs"
            :key="preteur.cle"
            data-preteur
            class="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <span class="font-medium">{{ nomDuPreteur(preteur) }}</span>
            <div class="flex items-center gap-3">
              <UBadge v-if="preteur.resteARestituer === 0" color="success" variant="subtle">
                {{ $t('gestion.treasury.cash_float_all_restituted') }}
              </UBadge>
              <span class="tabular-nums text-sm text-gray-500 dark:text-gray-400">
                {{ money(preteur.total) }}
              </span>
              <span class="tabular-nums font-semibold">{{ money(preteur.resteARestituer) }}</span>
            </div>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-semibold">{{ $t('gestion.treasury.cash_float_entries') }}</h2>
            <!-- Choisir ses colonnes, puis les emporter : l'export reprend ce que le tableau
                 montre, et rien d'autre. -->
            <div v-if="apports.length" class="flex items-center gap-2">
              <UiColumnsMenu
                size="xs"
                variant="ghost"
                :table-api="tableauApports?.tableApi"
                :libelle="libelleDeColonne"
              />
              <UiExportMenu size="xs" :on-csv="exporterCsv" :on-pdf="exporterPdf" />
            </div>
          </div>
        </template>

        <p v-if="!apports.length" class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.treasury.cash_float_empty') }}
        </p>

        <UTable
          v-else
          ref="tableauApports"
          v-model:column-visibility="colonnesVisibles"
          :data="apports"
          :columns="colonnes"
        >
          <template #lender-cell="{ row }">
            {{ nomDeLApport(row.original) }}
          </template>
          <template #amount-cell="{ row }">
            <span class="tabular-nums">{{ money(row.original.amount) }}</span>
          </template>
          <template #operationDate-cell="{ row }">
            {{ row.original.operationDate ? dateCourte(row.original.operationDate) : '—' }}
          </template>
          <template #restitution-cell="{ row }">
            <UTooltip
              v-if="row.original.restitutedAt"
              :text="
                $t('gestion.treasury.cash_float_restituted_on', {
                  date: dateCourte(row.original.restitutedAt),
                })
              "
            >
              <UBadge color="success" variant="subtle">
                {{ $t('gestion.treasury.cash_float_restituted_badge') }}
              </UBadge>
            </UTooltip>
            <UBadge v-else color="warning" variant="subtle">
              {{ $t('gestion.treasury.cash_float_due_badge') }}
            </UBadge>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                icon="i-heroicons-pencil-square"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="$t('gestion.treasury.cash_float_edit')"
                @click="ouvrirCorrection(row.original)"
              />
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="$t('gestion.treasury.cash_float_delete')"
                @click="supprimer(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UCard>
    </template>

    <TreasuryCashFloatModal
      v-model:open="modaleOuverte"
      :edition-id="editionId"
      :currency="currency"
      :apport="apportEnCours"
      @saved="refresh()"
    />

    <UiConfirmationDemandee :confirmation="confirmation" />
  </div>
</template>

<script setup lang="ts">
import type { ApportSaisissable } from '~/components/treasury/CashFloatModal.vue'

import type { EtatDuFondsDeCaisse, PreteurDeFondsDeCaisse } from '~~/shared/utils/fonds-de-caisse'

const { succes } = useNotificateur()

/**
 * Le fonds de caisse d'une édition : qui a prêté de l'espèce pour rendre la monnaie, ce qu'on leur
 * doit encore, et ce que la caisse contient à la clôture.
 *
 * ## ⚠️ POURQUOI UNE PAGE À PART, ET NON UNE SECTION DU COMPTE DE RÉSULTAT
 *
 * Un fonds de caisse est un **stock**, pas un flux : l'argent n'est ni consommé ni gagné, il change
 * de poche et reviendra. Il n'a donc rien à faire dans un compte de résultat ni dans une
 * répartition par imputation.
 *
 * Une page séparée, avec son propre point d'API, fait que **ces montants ne sont même pas dans la
 * charge utile de `/treasury`** : quiconque ajoutera un total là-bas ne les aura pas sous la main,
 * et ne *peut* pas les y compter par mégarde. L'invariant est tenu par la forme, pas par la
 * vigilance — et la vigilance, sur cinq calculs qui dérivent des lignes de trésorerie, cède
 * toujours une fois.
 *
 * ## Le comptage de clôture, et le piège qu'il cache
 *
 * Le chiffre « disponible après restitutions » vaut `compté − reste à restituer`, et **surtout pas
 * `compté − apporté`** : un prêt rendu avant le comptage a déjà quitté la caisse, et la
 * soustraction naïve le compterait comme s'il y était encore. La règle vit dans
 * `etatDuFondsDeCaisse`, avec le test qui la fige.
 *
 * Et ce chiffre n'est pas appelé « recettes en espèces », parce qu'il ne l'est pas : il faudrait
 * pour cela connaître les dépenses réglées en espèces, donc le moyen de paiement de chaque ligne —
 * que `TreasuryEntry` ne porte pas.
 */
definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t, locale } = useI18n()

const editionId = computed(() => parseInt(route.params.id as string))

interface ReponseFondsDeCaisse {
  currency: string
  countedAt: string | null
  apports: ApportSaisissable[]
  etat: EtatDuFondsDeCaisse
}

const { data, pending, error, refresh } = await useFetch<ReponseFondsDeCaisse>(
  () => `/api/editions/${editionId.value}/treasury/cash-float`,
  {
    key: `treasury-cash-float-${editionId.value}`,
    transform: (reponse: any) => reponse?.data ?? reponse,
  }
)

const currency = computed(() => data.value?.currency || DEFAULT_CURRENCY)
const money = (cents: number) => formatCents(cents, currency.value, locale.value)
const apports = computed(() => data.value?.apports ?? [])

const etatVide: EtatDuFondsDeCaisse = {
  totalApporte: 0,
  totalRestitue: 0,
  resteARestituer: 0,
  compte: null,
  disponibleApresRestitutions: null,
  preteurs: [],
}
const etat = computed(() => data.value?.etat ?? etatVide)

/**
 * La date d'un apport se lit en UTC, comme `TreasuryEntry.operationDate` : c'est une date CIVILE,
 * et la relire dans le fuseau du lecteur la ferait changer de jour à l'ouest de Greenwich.
 */
const dateCourte = (valeur: string) =>
  new Date(valeur).toLocaleDateString(locale.value, { timeZone: 'UTC' })

/* ------------------------------------------------- les cartes du haut */

const cartes = computed(() => [
  {
    cle: 'apporte',
    libelle: t('gestion.treasury.cash_float_total_lent'),
    valeur: money(etat.value.totalApporte),
    classe: '',
    aide: '',
  },
  {
    cle: 'restitue',
    libelle: t('gestion.treasury.cash_float_total_restituted'),
    valeur: money(etat.value.totalRestitue),
    classe: '',
    aide: '',
  },
  {
    cle: 'reste',
    libelle: t('gestion.treasury.cash_float_remaining'),
    valeur: money(etat.value.resteARestituer),
    // Une dette encore ouverte se voit : c'est la seule information que la couleur ajoute.
    classe: etat.value.resteARestituer > 0 ? 'text-warning' : '',
    aide: '',
  },
  {
    cle: 'disponible',
    libelle: t('gestion.treasury.cash_float_available'),
    valeur:
      etat.value.disponibleApresRestitutions === null
        ? '—'
        : money(etat.value.disponibleApresRestitutions),
    // Négatif, la caisse ne couvre plus les prêts : c'est une alerte, pas une nuance.
    classe: (etat.value.disponibleApresRestitutions ?? 0) < 0 ? 'text-error' : '',
    aide:
      etat.value.disponibleApresRestitutions === null
        ? t('gestion.treasury.cash_float_not_counted')
        : t('gestion.treasury.cash_float_available_help'),
  },
])

/* ------------------------------------------------- le comptage */

const comptage = ref<number | null>(null)
// Le champ suit la valeur enregistrée, y compris après un rafraîchissement : sans cela, corriger un
// apport remettrait le champ à vide et un clic sur « Enregistrer » effacerait le comptage.
watch(
  () => etat.value.compte,
  (valeur) => {
    comptage.value = valeur === null ? null : valeur / 100
  },
  { immediate: true }
)

const { execute: envoyerLeComptage, loading: comptageEnCours } = useApiAction<{
  count: number | null
}>(() => `/api/editions/${editionId.value}/treasury/cash-float-count`, {
  method: 'PUT',
  body: () => ({ count: comptage.value }),
  successMessage: { title: t('gestion.treasury.cash_float_count_saved') },
  errorMessages: { default: t('gestion.treasury.cash_float_count_error') },
  onSuccess: () => refresh(),
})

const enregistrerLeComptage = () => envoyerLeComptage()

const effacerLeComptage = () => {
  comptage.value = null
  return envoyerLeComptage()
}

/* ------------------------------------------------- le tableau et la modale */

/*
 * Les colonnes, triables et masquables — comme sur les autres tableaux de gestion.
 *
 * ⚠️ Les `accessorFn` rendent la valeur À ORDONNER, qui n'est pas celle qu'on affiche : le prêteur
 * se trie sur son nom et non sur l'objet `lentBy`, et la restitution sur un booléen plutôt que sur
 * la pastille. Sans eux, l'en-tête serait cliquable et ne ferait rien.
 */
const colonnes = computed(() => [
  {
    id: 'lender',
    accessorFn: (a: ApportSaisissable) => nomDeLApport(a),
    header: ({ column }: any) => enTeteTriable(column, t('gestion.treasury.cash_float_lender')),
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: ({ column }: any) => enTeteTriable(column, t('gestion.treasury.cash_float_amount')),
  },
  {
    id: 'operationDate',
    accessorKey: 'operationDate',
    header: ({ column }: any) => enTeteTriable(column, t('gestion.treasury.cash_float_date')),
  },
  {
    id: 'restitution',
    // Rendu d'abord : c'est l'état sur lequel on trie pour voir ce qu'il reste à rembourser.
    accessorFn: (a: ApportSaisissable) => (a.restitutedAt ? 0 : 1),
    header: ({ column }: any) =>
      enTeteTriable(column, t('gestion.treasury.cash_float_restitution')),
  },
  { id: 'actions', accessorKey: 'actions', header: '', enableHiding: false },
])

const COLONNES_MASQUABLES = ['lender', 'amount', 'operationDate', 'restitution']
const tableauApports = useTemplateRef<{ tableApi?: unknown }>('tableauApports')
const { visibilite: colonnesVisibles } = useColonnesDansUrl(COLONNES_MASQUABLES)

const libelleDeColonne = (id: string) =>
  ({
    lender: t('gestion.treasury.cash_float_lender'),
    amount: t('gestion.treasury.cash_float_amount'),
    operationDate: t('gestion.treasury.cash_float_date'),
    restitution: t('gestion.treasury.cash_float_restitution'),
  })[id] ?? id

/** Ce que l'export emporte : les colonnes affichées, dans leur ordre, avec leurs valeurs. */
function colonnesExportables(): ColonneExportable<ApportSaisissable>[] {
  return [
    {
      id: 'lender',
      entete: t('gestion.treasury.cash_float_lender'),
      valeur: (a) => nomDeLApport(a),
    },
    {
      id: 'amount',
      entete: t('gestion.treasury.cash_float_amount'),
      // Le montant mis en forme comme à l'écran : un CSV qui porterait des centimes bruts
      // obligerait à diviser par cent avant de s'en servir.
      valeur: (a) => money(a.amount),
    },
    {
      id: 'operationDate',
      entete: t('gestion.treasury.cash_float_date'),
      valeur: (a) => (a.operationDate ? formatDate(a.operationDate) : ''),
    },
    {
      id: 'restitution',
      entete: t('gestion.treasury.cash_float_restitution'),
      // Les MÊMES libellés que les pastilles du tableau — « Rendu » / « Dû ». Inventer une paire
      // de clés pour l'export ferait dire deux choses différentes au même état.
      valeur: (a) =>
        a.restitutedAt
          ? t('gestion.treasury.cash_float_restituted_badge')
          : t('gestion.treasury.cash_float_due_badge'),
    },
  ]
}

const nomDuFichier = `fonds-de-caisse-edition-${editionId.value}`

function exporterCsv() {
  const { entetes, lignes } = tableauAExporter(
    colonnesExportables(),
    colonnesVisibles.value,
    apports.value
  )
  telechargerFichier(`${nomDuFichier}.csv`, versCsv(entetes, lignes), 'text/csv;charset=utf-8')
  succes(t('common.export_success'))
}

async function exporterPdf() {
  const { entetes, lignes } = tableauAExporter(
    colonnesExportables(),
    colonnesVisibles.value,
    apports.value
  )
  await exporterTableauEnPdf({
    nomFichier: nomDuFichier,
    titre: t('gestion.treasury.cash_float_entries'),
    entetes,
    lignes,
  })
  succes(t('common.export_success'))
}

const anonyme = () => t('gestion.treasury.cash_float_unknown_lender')
const nomDeLApport = (a: ApportSaisissable) => a.lentBy?.pseudo ?? a.lentByName ?? anonyme()
const nomDuPreteur = (p: PreteurDeFondsDeCaisse) => {
  if (p.nomLibre) return p.nomLibre
  const avecCompte = apports.value.find((a) => a.lentById && a.lentById === p.lentById)
  return avecCompte?.lentBy?.pseudo ?? anonyme()
}

const modaleOuverte = ref(false)
const apportEnCours = ref<ApportSaisissable | null>(null)

const ouvrirAjout = () => {
  apportEnCours.value = null
  modaleOuverte.value = true
}
const ouvrirCorrection = (apport: ApportSaisissable) => {
  apportEnCours.value = apport
  modaleOuverte.value = true
}

/*
 * ⚠️ `demanderConfirmation`, SURTOUT PAS `confirmer`. Le composable expose les deux : le premier
 * POSE la question, le second EXÉCUTE l'action — c'est ce que le bouton de la modale appelle.
 * S'en servir ici supprimerait sans rien demander, et l'écran paraîtrait seulement « un peu trop
 * réactif ». La modale se rend par `UiConfirmationDemandee`, qui reçoit l'objet entier.
 */
const confirmation = useConfirmation()

const { execute: supprimerApport } = useApiActionById(
  (id) => `/api/editions/${editionId.value}/treasury/cash-float/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.treasury.cash_float_deleted') },
    errorMessages: { default: t('gestion.treasury.cash_float_delete_error') },
    onSuccess: () => refresh(),
  }
)

const supprimer = (apport: ApportSaisissable) => {
  confirmation.demanderConfirmation({
    description: t('gestion.treasury.cash_float_delete_confirm', {
      montant: money(apport.amount),
      preteur: nomDeLApport(apport),
    }),
    libelleConfirmer: t('common.delete'),
    agir: () => supprimerApport(apport.id),
  })
}

useSeoMeta({
  title: t('gestion.treasury.cash_float_title'),
})
</script>
