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
    <div v-if="expenses.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
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
          <template v-if="getCurrentRate(expense) as currentRate">
            <div class="text-right shrink-0">
              <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {{ parseFloat(currentRate.amount).toFixed(2) }}
                {{ currentRate.currency }}
              </p>
              <p class="text-sm text-gray-500">
                {{ periodLabel(currentRate.period) }}
              </p>
            </div>
          </template>
        </div>

        <!-- Historique des tarifs -->
        <div v-if="expense.rates.length > 1" class="mt-4 pt-4 border-t dark:border-gray-700">
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
            {{ t('project_costs.price_history') }} ({{ expense.rates.length }})
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

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>
