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
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <UCard v-for="card in totalCards" :key="card.key">
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
              <p class="truncate font-medium">{{ lineTitle(line) }}</p>
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
              <div class="text-right">
                <p class="font-semibold">{{ money(line.settled) }}</p>
                <p v-if="line.pending" class="text-xs text-amber-600 dark:text-amber-400">
                  {{ $t('gestion.treasury.pending_amount', { amount: money(line.pending) }) }}
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

interface TreasuryLine {
  key: string
  origin: 'source' | 'manual'
  source?: string
  entryId?: number
  kind: 'EXPENSE' | 'INCOME'
  title: string
  description?: string | null
  code?: TreasuryCodeRef | null
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
  line.source === 'TICKETING_ORDERS'
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

const totalCards = computed(() => {
  const totals = data.value?.totals
  const hint = (amount: number) =>
    amount ? t('gestion.treasury.pending_amount', { amount: money(amount) }) : ''

  return [
    {
      key: 'expense',
      label: t('gestion.treasury.expenses'),
      value: money(totals?.expense.settled ?? 0),
      hint: hint(totals?.expense.pending ?? 0),
      icon: 'i-lucide-trending-down',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
      iconColor: 'text-red-600 dark:text-red-400',
      valueClass: '',
    },
    {
      key: 'income',
      label: t('gestion.treasury.incomes'),
      value: money(totals?.income.settled ?? 0),
      hint: hint(totals?.income.pending ?? 0),
      icon: 'i-lucide-trending-up',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      valueClass: '',
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
