<template>
  <div class="max-w-4xl mx-auto py-8 px-4">
    <!-- En-tête -->
    <div class="text-center mb-10">
      <h1 class="text-3xl font-bold flex items-center justify-center gap-3">
        <UIcon name="i-heroicons-banknotes" class="text-emerald-600" />
        {{ t('project_costs.title') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-3 max-w-2xl mx-auto">
        {{ t('project_costs.description') }}
      </p>
    </div>

    <!-- Résumé des coûts -->
    <div v-if="expenses.length > 0" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
      <UCard variant="soft">
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {{ t('project_costs.total_monthly') }}
          </p>
          <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {{ totalMonthly.toFixed(2) }} {{ mainCurrency }}
          </p>
        </div>
      </UCard>
      <UCard variant="soft">
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {{ t('project_costs.total_yearly') }}
          </p>
          <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ totalYearly.toFixed(2) }} {{ mainCurrency }}
          </p>
        </div>
      </UCard>
      <UCard v-if="totalOneTime > 0" variant="soft">
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {{ t('project_costs.one_time_total') }}
          </p>
          <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {{ totalOneTime.toFixed(2) }} {{ mainCurrency }}
          </p>
        </div>
      </UCard>
      <UCard v-if="donations" variant="soft">
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {{
              balance >= 0
                ? t('project_costs.balance_positive')
                : t('project_costs.balance_negative')
            }}
          </p>
          <p
            class="text-2xl font-bold"
            :class="
              balance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            "
          >
            {{ Math.abs(balance).toFixed(2) }} {{ mainCurrency }}
          </p>
          <p
            v-if="balance > 0 && totalMonthly > 0"
            class="text-xs text-gray-500 dark:text-gray-400 mt-1"
          >
            {{ t('project_costs.months_covered') }} : {{ autonomyLabel }}
          </p>
        </div>
      </UCard>
      <UCard v-if="donations && donations.estimatedHours" variant="soft">
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {{ t('project_costs.estimated_time') }}
          </p>
          <p class="text-2xl font-bold text-violet-600 dark:text-violet-400">
            ~{{ t('project_costs.estimated_time_hours', { count: donations.estimatedHours }) }}
          </p>
        </div>
      </UCard>
    </div>

    <!-- État vide -->
    <div
      v-if="!pending && expenses.length === 0"
      class="text-center py-16 text-gray-500 dark:text-gray-400"
    >
      <UIcon name="i-heroicons-banknotes" class="w-16 h-16 mx-auto mb-4 opacity-30" />
      <p class="text-lg">{{ t('project_costs.no_expenses') }}</p>
    </div>

    <!-- Liste des dépenses -->
    <div class="space-y-4">
      <UCard v-for="expense in expenses" :key="expense.id" variant="outline">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <div class="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg mt-0.5">
              <UIcon
                :name="expense.icon || categoryIcons[expense.category]"
                class="w-5 h-5 text-primary"
              />
            </div>
            <div>
              <h3 class="font-semibold text-lg">{{ expense.name }}</h3>
              <UBadge
                :label="t(`project_costs.categories.${expense.category}`)"
                color="primary"
                variant="subtle"
                size="sm"
                class="mt-1"
              />
              <p v-if="expense.description" class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {{ expense.description }}
              </p>
            </div>
          </div>

          <!-- Tarif actuel -->
          <div v-if="getCurrentRate(expense)" class="text-right shrink-0">
            <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {{ parseFloat(getCurrentRate(expense)!.amount).toFixed(2) }}
              {{ getCurrentRate(expense)!.currency }}
            </p>
            <p class="text-sm text-gray-500">
              {{ periodLabel(getCurrentRate(expense)!.period) }}
            </p>
          </div>
        </div>

        <!-- Historique des tarifs -->
        <div v-if="expense.rates.length > 0" class="mt-4 pt-4 border-t dark:border-gray-700">
          <button
            class="text-sm text-primary hover:underline flex items-center gap-1"
            @click="toggleHistory(expense.id)"
          >
            <UIcon
              :name="
                expandedExpenses.has(expense.id)
                  ? 'i-heroicons-chevron-up'
                  : 'i-heroicons-chevron-down'
              "
              class="w-4 h-4"
            />
            {{ t('project_costs.rate_details') }} ({{ expense.rates.length }})
          </button>
          <div v-if="expandedExpenses.has(expense.id)" class="mt-3 space-y-2">
            <div
              v-for="rate in expense.rates"
              :key="rate.id"
              class="flex items-center justify-between text-sm py-1.5 px-3 rounded"
              :class="
                isCurrentRate(rate)
                  ? 'bg-emerald-50 dark:bg-emerald-900/10'
                  : 'bg-gray-50 dark:bg-gray-800/50'
              "
            >
              <div class="flex items-center gap-3">
                <span class="font-medium">
                  {{ parseFloat(rate.amount).toFixed(2) }} {{ rate.currency }}
                </span>
                <UBadge
                  :label="periodLabel(rate.period)"
                  :color="rate.period === 'ONE_TIME' ? 'warning' : 'primary'"
                  variant="subtle"
                  size="sm"
                />
              </div>
              <span class="text-gray-500">
                {{ t('project_costs.since') }} {{ formatDate(rate.startDate) }}
                <template v-if="rate.endDate">
                  — {{ t('project_costs.until') }} {{ formatDate(rate.endDate) }}
                </template>
                <template v-else>
                  <UBadge
                    :label="t('project_costs.ongoing')"
                    color="success"
                    variant="subtle"
                    size="sm"
                    class="ml-2"
                  />
                </template>
              </span>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Section "Un café pour Pierre" -->
    <div
      v-if="donations && (donations.donationsEnabled || donations.totalCoffees > 0)"
      class="mt-12 pt-8 border-t dark:border-gray-700"
    >
      <UCard
        variant="soft"
        class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800"
      >
        <div class="text-center space-y-6">
          <div>
            <h2 class="text-2xl font-bold">{{ t('project_costs.coffee.title') }}</h2>
            <p class="text-gray-600 dark:text-gray-400 mt-2 max-w-xl mx-auto">
              {{ t('project_costs.coffee.description') }}
            </p>
          </div>

          <!-- Compteur -->
          <div v-if="donations.totalCoffees > 0" class="flex items-center justify-center gap-6">
            <div class="text-center">
              <p class="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {{ donations.totalCoffees }} ☕
              </p>
              <p class="text-sm text-gray-500">
                {{ t('project_costs.coffee.total_coffees', { count: donations.totalCoffees }) }}
              </p>
            </div>
            <div v-if="donations.totalNetCents > 0" class="text-center">
              <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {{ (donations.totalNetCents / 100).toFixed(2) }} €
              </p>
              <p class="text-sm text-gray-500">
                {{
                  t('project_costs.coffee.total_received', {
                    amount: (donations.totalNetCents / 100).toFixed(2),
                  })
                }}
              </p>
            </div>
          </div>

          <!-- Formulaire de don (uniquement si les dons sont actifs) -->
          <template v-if="donations.donationsEnabled">
            <!-- Sélecteur de quantité -->
            <div class="space-y-3">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('project_costs.coffee.quantity_label') }}
                <span class="text-gray-500"
                  >({{ t('project_costs.coffee.price_per_coffee') }})</span
                >
              </p>
              <div class="flex items-center justify-center gap-2 flex-wrap">
                <!-- prettier-ignore -->
                <UButton
                  v-for="qty in [1, 2, 3, 5, 10]"
                  :key="qty"
                  :color="selectedQuantity === qty ? 'primary' : 'neutral'"
                  :variant="selectedQuantity === qty ? 'solid' : 'soft'"
                  size="lg"
                  @click="selectedQuantity = qty; customQuantity = ''"
                >
                  {{ qty }} ☕
                </UButton>
                <UInput
                  v-model.number="customQuantity"
                  type="number"
                  min="1"
                  max="50"
                  :placeholder="t('project_costs.coffee.custom_quantity')"
                  size="lg"
                  class="w-24"
                  @input="selectedQuantity = 0"
                />
              </div>
            </div>

            <!-- Bouton d'achat -->
            <UButton
              color="primary"
              size="xl"
              icon="i-heroicons-heart"
              :loading="checkoutLoading"
              :disabled="finalQuantity < 1"
              @click="handleCheckout"
            >
              {{ t('project_costs.coffee.donate_button', { count: finalQuantity }) }}
              ({{ finalQuantity }} €)
            </UButton>
          </template>

          <!-- Message quand les dons sont désactivés -->
          <p v-else class="text-sm text-gray-500 italic">
            {{ t('project_costs.coffee.donations_paused') }}
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Rate {
  id: number
  amount: string
  currency: string
  period: string
  startDate: string
  endDate: string | null
  note: string | null
}

interface Expense {
  id: number
  name: string
  description: string | null
  category: string
  icon: string | null
  isActive: boolean
  sortOrder: number
  rates: Rate[]
}

const { t, locale } = useI18n()

const { data, pending } = await useFetch<{ expenses: Expense[] }>('/api/project-costs')

const expenses = computed(() => data.value?.expenses || [])

// Devise principale (basée sur le premier tarif actif trouvé)
const mainCurrency = computed(() => {
  for (const expense of expenses.value) {
    const rate = getCurrentRate(expense)
    if (rate) return rate.currency
  }
  return 'EUR'
})

const expandedExpenses = ref(new Set<number>())

const categoryIcons: Record<string, string> = {
  DOMAIN: 'i-heroicons-globe-alt',
  HOSTING: 'i-heroicons-server',
  HARDWARE: 'i-heroicons-cpu-chip',
  ELECTRICITY: 'i-heroicons-bolt',
  SOFTWARE: 'i-heroicons-code-bracket',
  SERVICE: 'i-heroicons-wrench-screwdriver',
  OTHER: 'i-heroicons-ellipsis-horizontal-circle',
}

const toggleHistory = (id: number) => {
  if (expandedExpenses.value.has(id)) {
    expandedExpenses.value.delete(id)
  } else {
    expandedExpenses.value.add(id)
  }
}

const getCurrentRate = (expense: Expense): Rate | null => {
  const now = new Date()
  return (
    expense.rates.find((r) => {
      const start = new Date(r.startDate)
      const end = r.endDate ? new Date(r.endDate) : null
      return start <= now && (!end || end >= now)
    }) || null
  )
}

const isCurrentRate = (rate: Rate): boolean => {
  const now = new Date()
  const start = new Date(rate.startDate)
  const end = rate.endDate ? new Date(rate.endDate) : null
  return start <= now && (!end || end >= now)
}

const periodLabel = (period: string): string => {
  if (period === 'MONTHLY') return t('project_costs.per_month')
  if (period === 'YEARLY') return t('project_costs.per_year')
  return t('project_costs.one_time')
}

// Calcul des totaux (en EUR)
const totalMonthly = computed(() => {
  return expenses.value.reduce((sum, expense) => {
    const rate = getCurrentRate(expense)
    if (!rate) return sum
    const amount = parseFloat(rate.amount)
    if (rate.period === 'MONTHLY') return sum + amount
    if (rate.period === 'YEARLY') return sum + amount / 12
    return sum
  }, 0)
})

const totalYearly = computed(() => {
  return expenses.value.reduce((sum, expense) => {
    const rate = getCurrentRate(expense)
    if (!rate) return sum
    const amount = parseFloat(rate.amount)
    if (rate.period === 'MONTHLY') return sum + amount * 12
    if (rate.period === 'YEARLY') return sum + amount
    return sum
  }, 0)
})

const totalOneTime = computed(() => {
  return expenses.value.reduce((sum, expense) => {
    const rate = getCurrentRate(expense)
    if (!rate || rate.period !== 'ONE_TIME') return sum
    return sum + parseFloat(rate.amount)
  }, 0)
})

// Période d'autonomie couverte par les dons en avance
const autonomyLabel = computed(() => {
  if (balance.value <= 0 || totalMonthly.value <= 0) return ''
  const totalMonths = Math.floor(balance.value / totalMonthly.value)
  if (totalMonths < 1) return t('project_costs.autonomy_less_than_month')
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return t('project_costs.autonomy_months', { count: months })
  if (months === 0) return t('project_costs.autonomy_years', { count: years })
  return t('project_costs.autonomy_years_months', { years, months })
})

// Solde exact : dons nets - coût total cumulé depuis le début
const balance = computed(() => {
  const donationsNetCents = donations.value?.totalNetCents || 0
  const totalCostCents = donations.value?.totalCostCents || 0
  return (donationsNetCents - totalCostCents) / 100
})

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Donations café
const { data: donationsData } = await useFetch<{
  donationsEnabled: boolean
  totalCoffees: number
  totalDonations: number
  totalCents: number
  totalNetCents: number
  totalCostCents: number
  estimatedHours: number | null
}>('/api/project-costs/donations')

const donations = computed(() => donationsData.value)

const selectedQuantity = ref(1)
const customQuantity = ref<number | string>('')
const checkoutLoading = ref(false)
const toast = useToast()

const finalQuantity = computed(() => {
  if (customQuantity.value && Number(customQuantity.value) > 0) {
    return Math.min(Math.floor(Number(customQuantity.value)), 50)
  }
  return selectedQuantity.value
})

const handleCheckout = async () => {
  if (finalQuantity.value < 1) return
  checkoutLoading.value = true
  try {
    const result: any = await $fetch('/api/project-costs/checkout', {
      method: 'POST',
      body: { quantity: finalQuantity.value },
    })
    if (result.url) {
      navigateTo(result.url, { external: true })
    }
  } catch {
    toast.add({
      title: t('project_costs.coffee.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    checkoutLoading.value = false
  }
}
</script>
