<template>
  <div>
    <div v-if="pending" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="error">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="error.data?.message || error.message"
      />
    </div>

    <div v-else class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <ManagementPageHeader
            :titre="$t('gestion.treasury.title')"
            :description="$t('gestion.treasury.subtitle')"
          />
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <!-- L'export n'a rien à produire sur une trésorerie vide : un PDF de deux tableaux sans
               lignes se lit comme un export raté, et l'on cherche l'erreur là où il n'y en a pas. -->
          <UButton
            icon="i-lucide-file-down"
            color="neutral"
            variant="outline"
            :label="$t('gestion.treasury.export_pdf')"
            :loading="exportEnCours"
            :disabled="!(data?.lines?.length ?? 0)"
            @click="exporterPdf"
          />
          <UButton
            icon="i-lucide-tags"
            color="neutral"
            variant="outline"
            :label="$t('gestion.treasury.manage_codes')"
            @click="codesModalOpen = true"
          />
          <UButton
            icon="i-lucide-plus"
            :label="$t('gestion.treasury.add_entry')"
            @click="openEntryModal()"
          />
        </div>
      </div>

      <!-- Totaux : le solde ne retient que ce qui est réglé, l'engagé est annoncé à part pour ne
           pas laisser croire qu'il est encaissé ou décaissé. -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UCard
          v-for="card in totalCards"
          :key="card.key"
          :class="card.onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''"
          @click="card.onClick?.()"
        >
          <div class="flex items-center gap-3">
            <div class="rounded-full p-2" :class="card.iconBg">
              <UIcon :name="card.icon" class="h-5 w-5" :class="card.iconColor" />
            </div>
            <div class="min-w-0">
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</p>
              <p class="text-xl font-semibold" :class="card.valueClass">{{ card.value }}</p>
              <p v-if="card.hint" class="text-xs text-gray-500 dark:text-gray-400">
                {{ card.hint }}
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <UCard v-for="group in groups" :key="group.kind">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon :name="group.icon" class="h-5 w-5" :class="group.iconColor" />
            <h2 class="font-semibold">{{ group.label }}</h2>
            <UBadge color="neutral" variant="subtle" size="sm">{{ group.lines.length }}</UBadge>
          </div>
        </template>

        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          <div
            v-for="line in group.lines"
            :key="line.key"
            data-testid="treasury-line"
            class="flex flex-col gap-3 py-3 lg:flex-row lg:items-center"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate font-medium">{{ lineTitle(line) }}</p>
                <!-- Simple marque de présence : la liste reste dense, et le ticket s'ouvre en
                     grand d'un clic quand on veut vraiment le relire. -->
                <UTooltip v-if="line.imageUrl" :text="$t('gestion.treasury.entry_receipt')">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-receipt"
                    :aria-label="$t('gestion.treasury.entry_receipt')"
                    @click="justificatifOuvert = line.imageUrl"
                  />
                </UTooltip>
                <!-- Deux états qui changent la lecture du montant : l'un dit qu'il n'est pas
                     encore payé, l'autre qu'il est dû à quelqu'un. -->
                <UBadge v-if="line.isForecast" color="neutral" variant="subtle" size="sm">
                  {{ $t('gestion.treasury.entry_forecast') }}
                </UBadge>
                <UBadge
                  v-if="line.advancedBy && !line.reimbursed"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  :title="$t('gestion.treasury.advanced_by_name', { name: line.advancedBy.pseudo })"
                >
                  {{ $t('gestion.treasury.advanced_by_name', { name: line.advancedBy.pseudo }) }}
                </UBadge>
              </div>
              <p v-if="line.description" class="truncate text-xs text-gray-500 dark:text-gray-400">
                {{ line.description }}
              </p>
            </div>

            <!-- Code d'imputation : modifiable même sur une ligne calculée, c'est la seule chose
                 que la trésorerie décide pour elle. -->
            <USelectMenu
              :model-value="line.code?.id ?? null"
              value-key="value"
              :items="codeItems(line)"
              size="sm"
              class="w-56"
              :placeholder="$t('gestion.treasury.no_code')"
              :search-input="{ placeholder: $t('gestion.treasury.code_search_all') }"
              :search-term="recherchesCode[line.key] ?? ''"
              @update:search-term="(v: string) => (recherchesCode[line.key] = v)"
              @update:model-value="(v: number | null) => assignCode(line, v)"
            />

            <div class="flex items-center gap-3 lg:w-56 lg:justify-end">
              <!-- Le montant engagé est le chiffre principal : une charge existe dès qu'elle est
                   due, pas quand elle est payée. Le réglé n'apparaît que s'il diffère, pour ne pas
                   alourdir les lignes déjà soldées. -->
              <div class="text-right">
                <p class="font-semibold">{{ money(lineTotal(line)) }}</p>
                <p
                  v-if="line.pending"
                  class="text-xs text-gray-500 dark:text-gray-400"
                  :class="{ 'text-amber-600 dark:text-amber-400': !line.settled }"
                >
                  {{ $t('gestion.treasury.settled_amount', { amount: money(line.settled) }) }}
                </p>
              </div>

              <UButton
                v-if="line.readOnly"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-external-link"
                :to="sourceLink(line)"
                :title="$t('gestion.treasury.open_source')"
              />
              <template v-else>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  @click="openEntryModal(line)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :loading="deleteEntry.isLoading(line.entryId!)"
                  @click="removeEntry(line)"
                />
              </template>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Détail des avances : c'est au moment de rembourser qu'on veut savoir qui attend combien,
         et le total seul ne le dit pas. -->
    <UModal v-model:open="detailRemboursements" :title="$t('gestion.treasury.to_reimburse')">
      <template #body>
        <ul class="divide-y divide-gray-100 dark:divide-gray-800">
          <li
            v-for="ligne in data?.totals?.toReimburse?.detail ?? []"
            :key="ligne.personne.id"
            class="flex flex-wrap items-center justify-between gap-3 py-2"
          >
            <UiUserDisplay :user="ligne.personne" size="sm" />
            <div class="flex items-center gap-3">
              <span class="font-semibold">{{ money(ligne.montant) }}</span>
              <!-- On rembourse en un versement : pointer les lignes une par une était le geste
                   le plus fastidieux de la page, et le plus facile à laisser à moitié fait. -->
              <UButton
                size="xs"
                color="success"
                variant="soft"
                icon="i-lucide-check"
                :loading="rembourser.isLoading(ligne.personne.id)"
                :label="$t('gestion.treasury.mark_reimbursed')"
                @click="rembourser.execute(ligne.personne.id)"
              />
            </div>
          </li>
        </ul>
      </template>
    </UModal>

    <UModal
      :open="!!justificatifOuvert"
      size="xl"
      :title="$t('gestion.treasury.entry_receipt')"
      @update:open="(v: boolean) => !v && (justificatifOuvert = null)"
    >
      <template #body>
        <img
          v-if="justificatifOuvert"
          :src="justificatifOuvert"
          :alt="$t('gestion.treasury.entry_receipt')"
          class="w-full"
        />
      </template>
    </UModal>

    <TreasuryEntryModal
      v-model:open="entryModalOpen"
      :entry="editedLine"
      :codes="data?.codes ?? []"
      :currency="currency"
      :edition-id="editionId"
      @saved="onEntrySaved"
    />

    <TreasuryCodesModal
      v-model:open="codesModalOpen"
      :codes="data?.codes ?? []"
      :edition-id="editionId"
      @changed="refresh()"
    />
  </div>
</template>

<script setup lang="ts">
import {
  montantPourPdf,
  nomFichierTresorerie,
  preparerTableau,
  regrouperParCode,
  soldeDe,
  totalDesGroupes,
  type GroupeDeCode,
  type TotalDeNature,
} from '~/utils/export-tresorerie'

import { DEFAULT_CURRENCY, formatCents } from '~~/shared/utils/money'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t, locale } = useI18n()

const editionId = computed(() => parseInt(route.params.id as string))

interface TreasuryCodeRef {
  id: number
  code: string
  label: string
}

/** Qui a avancé une dépense — de quoi l'afficher, rien de plus. */
interface PersonneAvance {
  id: number
  pseudo: string
  profilePicture?: string | null
  emailHash?: string | null
  updatedAt?: string | null
}

interface TreasuryLine {
  key: string
  origin: 'source' | 'manual'
  source?: string
  entryId?: number
  kind: 'EXPENSE' | 'INCOME'
  title: string
  description?: string | null
  code?: TreasuryCodeRef | null
  imageUrl?: string | null
  isForecast?: boolean
  advancedBy?: PersonneAvance | null
  reimbursed?: boolean
  readOnly: boolean
  settled: number
  pending: number
}

const { data, pending, error, refresh } = await useFetch<{
  currency: string
  codes: TreasuryCodeRef[]
  lines: TreasuryLine[]
  totals: {
    expense: { settled: number; pending: number }
    income: { settled: number; pending: number }
    balance: number
    toReimburse: {
      total: number
      detail: { personne: PersonneAvance; montant: number }[]
    }
  }
}>(() => `/api/editions/${editionId.value}/treasury`, {
  transform: (payload: any) => payload?.data ?? payload,
})

const currency = computed(() => data.value?.currency || DEFAULT_CURRENCY)
const money = (cents: number) => formatCents(cents, currency.value, locale.value)

/** Les origines calculées portent une clé, pas un libellé : elles se traduisent ici. */
const lineTitle = (line: TreasuryLine) =>
  line.origin === 'source' ? t(`gestion.treasury.source.${line.source}`) : line.title

/** Chaque origine renvoie vers la page où son montant se corrige. */
const sourceLink = (line: TreasuryLine) =>
  line.source?.startsWith('TICKETING_')
    ? `/editions/${editionId.value}/gestion/ticketing/orders`
    : `/editions/${editionId.value}/gestion/artists`

/** Terme tapé dans le select de chaque ligne. Une ligne, une recherche. */
const recherchesCode = ref<Record<string, string>>({})

/** La règle des codes proposés vit dans `codesProposes` : elle sert aussi au formulaire. */
const codeItems = (line: TreasuryLine) => {
  const proposes = codesProposes(data.value?.codes ?? [], {
    sens: line.kind,
    recherche: recherchesCode.value[line.key] ?? '',
    codeCourantId: line.code?.id ?? null,
  })

  return [
    { value: null, label: t('gestion.treasury.no_code') },
    ...proposes.map((c) => ({ value: c.id, label: `${c.code} — ${c.label}` })),
  ]
}

const groups = computed(() => {
  const lines = data.value?.lines ?? []
  return [
    {
      kind: 'EXPENSE' as const,
      label: t('gestion.treasury.expenses'),
      icon: 'i-lucide-trending-down',
      iconColor: 'text-red-500',
      lines: lines.filter((l) => l.kind === 'EXPENSE'),
    },
    {
      kind: 'INCOME' as const,
      label: t('gestion.treasury.incomes'),
      icon: 'i-lucide-trending-up',
      iconColor: 'text-emerald-500',
      lines: lines.filter((l) => l.kind === 'INCOME'),
    },
  ]
})

/** Montant d'une ligne : ce qui est dû, réglé ou non. */
const lineTotal = (line: TreasuryLine) => line.settled + line.pending

const totalCards = computed(() => {
  const totals = data.value?.totals
  const engaged = (amounts?: { settled: number; pending: number }) =>
    (amounts?.settled ?? 0) + (amounts?.pending ?? 0)
  const hint = (amounts?: { settled: number; pending: number }) =>
    amounts?.pending ? t('gestion.treasury.settled_amount', { amount: money(amounts.settled) }) : ''

  return [
    {
      key: 'expense',
      label: t('gestion.treasury.expenses'),
      value: money(engaged(totals?.expense)),
      hint: hint(totals?.expense),
      icon: 'i-lucide-trending-down',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
      iconColor: 'text-red-600 dark:text-red-400',
      valueClass: '',
    },
    {
      key: 'income',
      label: t('gestion.treasury.incomes'),
      value: money(engaged(totals?.income)),
      hint: hint(totals?.income),
      icon: 'i-lucide-trending-up',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      valueClass: '',
    },
    {
      key: 'to_reimburse',
      label: t('gestion.treasury.to_reimburse'),
      value: money(totals?.toReimburse?.total ?? 0),
      hint: totals?.toReimburse?.total
        ? t('gestion.treasury.to_reimburse_hint', { count: totals.toReimburse.detail.length })
        : '',
      icon: 'i-lucide-hand-coins',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      valueClass: totals?.toReimburse?.total ? 'text-amber-600 dark:text-amber-400' : '',
      // Cliquable seulement s'il y a un détail à montrer : une carte à zéro qui s'ouvre sur une
      // liste vide promet quelque chose qu'elle n'a pas.
      onClick: totals?.toReimburse?.total ? () => (detailRemboursements.value = true) : undefined,
    },
    {
      key: 'balance',
      label: t('gestion.treasury.balance'),
      value: money(totals?.balance ?? 0),
      hint: t('gestion.treasury.balance_hint'),
      icon: 'i-lucide-scale',
      iconBg: 'bg-sky-100 dark:bg-sky-900/40',
      iconColor: 'text-sky-600 dark:text-sky-400',
      valueClass:
        (totals?.balance ?? 0) < 0
          ? 'text-red-600 dark:text-red-400'
          : 'text-emerald-600 dark:text-emerald-400',
    },
  ]
})

/** Détail des avances par personne, ouvert depuis la carte « à rembourser ». */
const detailRemboursements = ref(false)

/**
 * Solde en une fois toutes les avances d'une personne.
 *
 * La modale se referme quand il ne reste plus rien à rembourser : la laisser ouverte sur une liste
 * vide donnerait l'impression que l'action a échoué.
 */
const rembourser = useApiActionById<{ count: number }>(
  () => `/api/editions/${editionId.value}/treasury/entries/reimburse`,
  {
    method: 'POST',
    body: (personneId) => ({ advancedById: personneId }),
    successMessage: { title: t('gestion.treasury.reimbursed_done') },
    errorMessages: { default: t('gestion.treasury.reimbursed_error') },
    onSuccess: async () => {
      await refresh()
      if (!data.value?.totals?.toReimburse?.total) detailRemboursements.value = false
    },
  }
)

/** Justificatif affiché en grand, ou `null`. */
const justificatifOuvert = ref<string | null>(null)

const entryModalOpen = ref(false)
const codesModalOpen = ref(false)
const editedLine = ref<TreasuryLine | null>(null)

function openEntryModal(line?: TreasuryLine) {
  editedLine.value = line ?? null
  entryModalOpen.value = true
}

async function onEntrySaved() {
  entryModalOpen.value = false
  await refresh()
}

/**
 * `execute()` ne prend pas de corps : celui-ci vient d'une fabrique. La sélection en cours est
 * donc déposée ici avant l'appel, plutôt que passée en argument.
 */
const pendingCodeChange = ref<{ source?: string; codeId: number | null }>({ codeId: null })

const assignSourceCode = useApiAction(
  () => `/api/editions/${editionId.value}/treasury/source-codes`,
  {
    method: 'PUT',
    body: () => pendingCodeChange.value,
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('gestion.treasury.code_error') },
  }
)

const assignEntryCode = useApiActionById(
  (id) => `/api/editions/${editionId.value}/treasury/entries/${id}`,
  {
    method: 'PUT',
    body: () => ({ codeId: pendingCodeChange.value.codeId }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('gestion.treasury.code_error') },
  }
)

/** Le code se choisit ligne par ligne, mais son enregistrement diffère selon l'origine. */
async function assignCode(line: TreasuryLine, codeId: number | null) {
  pendingCodeChange.value = { source: line.source, codeId }
  if (line.origin === 'source') {
    await assignSourceCode.execute()
  } else {
    await assignEntryCode.execute(line.entryId!)
  }
  await refresh()
}

const deleteEntry = useApiActionById(
  (id) => `/api/editions/${editionId.value}/treasury/entries/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.treasury.entry_deleted') },
    errorMessages: { default: t('gestion.treasury.entry_delete_error') },
    onSuccess: () => refresh(),
  }
)

async function removeEntry(line: TreasuryLine) {
  if (line.entryId) await deleteEntry.execute(line.entryId)
}

// --- Export PDF ---
/**
 * L'édition, pour l'en-tête du document.
 *
 * Un PDF détaché de l'écran n'a plus rien pour se situer : deux exercices d'années différentes se
 * ressemblent trop pour qu'on les distingue sans le nom de la convention et celui de l'édition.
 */
const editionStore = useEditionStore()
const edition = computed(() => editionStore.getEditionById(editionId.value))
const exportEnCours = ref(false)

onMounted(() => {
  // Sans `force` : la page ne l'affiche pas, elle ne s'en sert que pour titrer l'export, et la
  // valeur déjà en cache fait l'affaire.
  editionStore.fetchEditionById(editionId.value).catch(() => {
    // Un en-tête sans nom d'édition vaut mieux qu'une page qui refuse de s'afficher : l'export
    // retombe sur le titre générique.
  })
})

/**
 * Le document que l'on envoie au trésorier, au comptable ou à l'assemblée générale.
 *
 * Ce qui en sort est décidé dans `export-tresorerie`, éprouvé par des tests : un PDF ne se
 * rattrape pas une fois envoyé, et un sous-total faux ne se voit qu'à la lecture.
 *
 * `jspdf` est importé à la demande — quelques centaines de kilo-octets qui n'ont rien à faire dans
 * le chargement d'une page que l'on n'exporte pas à chaque visite.
 */
async function exporterPdf() {
  const lignes = (data.value?.lines ?? []) as TreasuryLine[]
  if (lignes.length === 0) return

  exportEnCours.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)

    // Portrait : cinq colonnes dont une seule de texte libre y tiennent, et un document comptable
    // se range et s'imprime plus volontiers dans ce sens.
    const doc = new jsPDF()
    const MARGE = 14
    const maintenant = new Date()

    // Le montant tel que jsPDF sait l'imprimer : sans les espaces insécables que ses polices
    // standard ne connaissent pas. Voir `montantPourPdf`.
    const montant = (centimes: number) => montantPourPdf(money(centimes))

    const charges = regrouperParCode(lignes, 'EXPENSE')
    const produits = regrouperParCode(lignes, 'INCOME')
    const totalCharges = totalDesGroupes(charges)
    const totalProduits = totalDesGroupes(produits)
    const solde = soldeDe(totalCharges, totalProduits)

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(t('gestion.treasury.title'), MARGE, 16)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const sousTitre = [edition.value?.convention?.name, edition.value?.name]
      .filter(Boolean)
      .join(' - ')
    if (sousTitre) doc.text(sousTitre, MARGE, 22)

    doc.setFontSize(9)
    doc.text(`${formatDate(maintenant)} - ${currency.value}`, MARGE, sousTitre ? 28 : 22)

    // Les chiffres clés d'abord, comme à l'écran : c'est ce qu'on lit en premier, et souvent la
    // seule chose que retiendra une assemblée.
    // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
    doc.autoTable({
      startY: sousTitre ? 33 : 27,
      margin: { left: MARGE, right: MARGE },
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [14, 116, 144] },
      head: [['', t('gestion.treasury.export_settled'), t('gestion.treasury.export_engaged')]],
      body: [
        [t('gestion.treasury.expenses'), montant(totalCharges.regle), montant(totalCharges.engage)],
        [
          t('gestion.treasury.incomes'),
          montant(totalProduits.regle),
          montant(totalProduits.engage),
        ],
        [t('gestion.treasury.balance'), montant(solde.regle), montant(solde.engage)],
      ],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      // Le solde est la ligne qu'on cherche du regard : elle se distingue des deux autres.
      didParseCell: (donnees: any) => {
        if (donnees.section === 'body' && donnees.row.index === 2) {
          donnees.cell.styles.fontStyle = 'bold'
        }
      },
    })

    /**
     * Les fonds des lignes de synthèse.
     *
     * Un gris neutre plutôt qu'une déclinaison du rouge ou du vert de l'en-tête : ces couleurs-là
     * disent déjà la nature du tableau, et les réemployer ferait croire à une information de plus.
     * Le total est le plus soutenu des deux, parce que c'est le chiffre qu'on cherche en dernier.
     */
    const TEINTE_SOUS_TOTAL: [number, number, number] = [237, 240, 243]
    const TEINTE_TOTAL: [number, number, number] = [214, 220, 227]

    const enTeteTableau = [
      t('gestion.treasury.export_code'),
      t('gestion.treasury.export_code_label'),
      t('gestion.treasury.entry_title'),
      t('gestion.treasury.export_settled'),
      t('gestion.treasury.export_engaged'),
    ]
    const sansCode = t('gestion.treasury.export_without_code')
    const sousTotal = t('gestion.treasury.export_subtotal')

    /** Un tableau par nature, précédé de son titre et suivi de son total. */
    const tableauDeNature = (
      titre: string,
      // ⚠️ Le type est nommé, et non déduit par `ReturnType<typeof regrouperParCode>` : la
      // fonction étant générique, `ReturnType` l'instancie sur sa CONTRAINTE — donc sur le type
      // minimal de l'util —, et la fonction de titrage ne pourrait plus lire `origin` ni
      // `source`. C'est ainsi que l'erreur de typage s'était déplacée ici après un premier
      // correctif.
      groupes: GroupeDeCode<TreasuryLine>[],
      total: TotalDeNature,
      teinte: [number, number, number]
    ) => {
      // @ts-expect-error - `lastAutoTable` est posé par le plugin après chaque tableau
      const y = (doc.lastAutoTable?.finalY ?? 40) + 12
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(titre, MARGE, y)

      const { lignes: corps, sousTotaux } = preparerTableau(
        groupes,
        montant,
        lineTitle,
        sansCode,
        sousTotal
      )
      // Le total ferme le tableau : son rang est celui qui suit la dernière écriture.
      const rangDuTotal = corps.length

      // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
      doc.autoTable({
        startY: y + 4,
        margin: { left: MARGE, right: MARGE },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: teinte },
        head: [enTeteTableau],
        body: [
          ...corps,
          [
            {
              content: t('gestion.treasury.export_total'),
              colSpan: 3,
              styles: { fontStyle: 'bold' },
            },
            { content: montant(total.regle), styles: { fontStyle: 'bold' } },
            { content: montant(total.engage), styles: { fontStyle: 'bold' } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 38 },
          3: { cellWidth: 26, halign: 'right' },
          4: { cellWidth: 26, halign: 'right' },
        },
        // Les lignes de synthèse se détachent du fond, pour qu'on les repère sans les lire. Deux
        // teintes et non une : un sous-total et un total ne se lisent pas au même niveau, et le
        // zébrage du thème par défaut suffirait sinon à les confondre avec une écriture.
        didParseCell: (donnees: any) => {
          if (donnees.section !== 'body') return
          if (donnees.row.index === rangDuTotal) {
            donnees.cell.styles.fillColor = TEINTE_TOTAL
            donnees.cell.styles.fontStyle = 'bold'
          } else if (sousTotaux.includes(donnees.row.index)) {
            donnees.cell.styles.fillColor = TEINTE_SOUS_TOTAL
            donnees.cell.styles.fontStyle = 'bold'
          }
        },
      })
    }

    tableauDeNature(t('gestion.treasury.expenses'), charges, totalCharges, [153, 27, 27])
    tableauDeNature(t('gestion.treasury.incomes'), produits, totalProduits, [6, 95, 70])

    doc.save(nomFichierTresorerie(edition.value?.name, maintenant))
  } catch (e: any) {
    useToast().add({
      title: e?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    exportEnCours.value = false
  }
}
</script>
