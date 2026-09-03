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
          <h1 class="text-2xl font-bold">{{ $t('gestion.treasury.title') }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('gestion.treasury.subtitle') }}
          </p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
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
              :items="codeItems"
              size="sm"
              class="w-56"
              :placeholder="$t('gestion.treasury.no_code')"
              :search-input="{ placeholder: $t('common.search') }"
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

const codeItems = computed(() => [
  { value: null, label: t('gestion.treasury.no_code') },
  ...(data.value?.codes ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.label}` })),
])

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
</script>
