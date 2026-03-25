<template>
  <div>
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
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
              {{ t('admin.project_costs.title') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <UIcon name="i-heroicons-banknotes" class="text-emerald-600" />
          {{ t('admin.project_costs.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ t('admin.project_costs.description') }}
        </p>
      </div>
      <UButton icon="i-heroicons-plus" color="primary" size="lg" @click="openCreateModal">
        {{ t('admin.project_costs.add_expense') }}
      </UButton>
    </div>

    <!-- Configuration Stripe -->
    <UCard variant="outline" class="mb-8">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-credit-card" class="w-6 h-6 text-indigo-600" />
            <div>
              <h3 class="text-lg font-semibold">
                {{ t('admin.project_costs.stripe_config.title') }}
              </h3>
              <p class="text-sm text-gray-500">
                {{ t('admin.project_costs.stripe_config.description') }}
              </p>
            </div>
          </div>
          <UBadge
            v-if="stripeConfig"
            :label="t('admin.project_costs.stripe_config.configured')"
            color="success"
            variant="subtle"
          />
        </div>
      </template>

      <div class="space-y-4">
        <div v-if="stripeConfig && !editingStripe" class="space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="font-medium w-40">{{
              t('admin.project_costs.stripe_config.public_key')
            }}</span>
            <code class="text-gray-500">{{ stripeConfig.publicKey }}</code>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium w-40">{{
              t('admin.project_costs.stripe_config.secret_key')
            }}</span>
            <code class="text-gray-500">{{ stripeConfig.secretKey }}</code>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium w-40">{{
              t('admin.project_costs.stripe_config.webhook_secret')
            }}</span>
            <code class="text-gray-500">{{ stripeConfig.webhookSecret }}</code>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <UBadge
              :label="
                stripeConfig.isActive
                  ? t('admin.project_costs.stripe_config.is_active')
                  : t('admin.project_costs.inactive')
              "
              :color="stripeConfig.isActive ? 'success' : 'neutral'"
              variant="subtle"
            />
          </div>
          <div class="mt-4">
            <UButton
              variant="soft"
              color="neutral"
              icon="i-heroicons-pencil-square"
              @click="startEditStripe"
            >
              {{ t('common.edit') }}
            </UButton>
          </div>
        </div>

        <div v-else class="space-y-4">
          <p v-if="!stripeConfig" class="text-sm text-gray-500 italic">
            {{ t('admin.project_costs.stripe_config.not_configured') }}
          </p>
          <UFormField
            :label="t('admin.project_costs.stripe_config.public_key')"
            :required="!stripeConfig"
          >
            <UInput
              v-model="stripeForm.publicKey"
              :placeholder="
                stripeConfig ? t('admin.project_costs.stripe_config.keep_current') : 'pk_...'
              "
              type="password"
              size="lg"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField
            :label="t('admin.project_costs.stripe_config.secret_key')"
            :required="!stripeConfig"
          >
            <UInput
              v-model="stripeForm.secretKey"
              :placeholder="
                stripeConfig ? t('admin.project_costs.stripe_config.keep_current') : 'sk_...'
              "
              type="password"
              size="lg"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField
            :label="t('admin.project_costs.stripe_config.webhook_secret')"
            :required="!stripeConfig"
          >
            <UInput
              v-model="stripeForm.webhookSecret"
              :placeholder="
                stripeConfig ? t('admin.project_costs.stripe_config.keep_current') : 'whsec_...'
              "
              type="password"
              size="lg"
              class="w-full font-mono"
            />
          </UFormField>
          <USwitch
            v-model="stripeForm.isActive"
            :label="t('admin.project_costs.stripe_config.is_active')"
          />
          <div class="flex gap-3">
            <UButton
              v-if="stripeConfig"
              variant="soft"
              color="neutral"
              @click="editingStripe = false"
            >
              {{ $t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="savingStripe"
              :disabled="
                !stripeConfig &&
                (!stripeForm.publicKey || !stripeForm.secretKey || !stripeForm.webhookSecret)
              "
              @click="saveStripeConfig"
            >
              {{ $t('common.save') }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Estimation du temps passé -->
    <UCard variant="outline" class="mb-8">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-clock" class="w-6 h-6 text-violet-600" />
            <div>
              <h3 class="text-lg font-semibold">
                {{ t('admin.project_costs.time_estimate.title') }}
              </h3>
              <p class="text-sm text-gray-500">
                {{ t('admin.project_costs.time_estimate.description') }}
              </p>
            </div>
          </div>
          <UBadge
            v-if="timeEstimate && currentEstimatedHours !== null"
            :label="
              t('admin.project_costs.time_estimate.current_estimate', {
                count: currentEstimatedHours,
              })
            "
            color="info"
            variant="subtle"
          />
        </div>
      </template>

      <div class="space-y-4">
        <div v-if="timeEstimate && !editingTimeEstimate" class="space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="font-medium w-48">{{
              t('admin.project_costs.time_estimate.fixed_hours')
            }}</span>
            <span>{{ timeEstimate.fixedHours }}h</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium w-48">{{
              t('admin.project_costs.time_estimate.reference_date')
            }}</span>
            <span>{{ formatDate(timeEstimate.referenceDate) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium w-48">{{
              t('admin.project_costs.time_estimate.weekly_hours')
            }}</span>
            <span
              >{{ timeEstimate.weeklyHours
              }}{{ t('admin.project_costs.time_estimate.per_week') }}</span
            >
          </div>
          <div class="mt-4">
            <UButton
              variant="soft"
              color="neutral"
              icon="i-heroicons-pencil-square"
              @click="startEditTimeEstimate"
            >
              {{ t('common.edit') }}
            </UButton>
          </div>
        </div>

        <div v-else class="space-y-4">
          <p v-if="!timeEstimate" class="text-sm text-gray-500 italic">
            {{ t('admin.project_costs.time_estimate.not_configured') }}
          </p>
          <UFormField
            :label="t('admin.project_costs.time_estimate.fixed_hours')"
            :hint="t('admin.project_costs.time_estimate.fixed_hours_hint')"
            required
          >
            <UInput
              v-model.number="timeEstimateForm.fixedHours"
              type="number"
              step="0.5"
              min="0"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('admin.project_costs.time_estimate.reference_date')"
            :hint="t('admin.project_costs.time_estimate.reference_date_hint')"
            required
          >
            <UPopover :popper="{ placement: 'bottom-start' }" class="w-full">
              <UButton
                icon="i-heroicons-calendar-days"
                size="lg"
                color="neutral"
                variant="outline"
                class="w-full justify-start text-left font-normal"
                :label="
                  timeEstimateForm.referenceDate
                    ? formatCalendarDate(timeEstimateForm.referenceDate)
                    : t('admin.project_costs.rates.select_date')
                "
                block
              />
              <template #content>
                <UCalendar v-model="timeEstimateForm.referenceDate" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
          <UFormField
            :label="t('admin.project_costs.time_estimate.weekly_hours')"
            :hint="t('admin.project_costs.time_estimate.weekly_hours_hint')"
            required
          >
            <UInput
              v-model.number="timeEstimateForm.weeklyHours"
              type="number"
              step="0.5"
              min="0"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <div class="flex gap-3">
            <UButton
              v-if="timeEstimate"
              variant="soft"
              color="neutral"
              @click="editingTimeEstimate = false"
            >
              {{ $t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="savingTimeEstimate"
              :disabled="
                (!timeEstimateForm.fixedHours && timeEstimateForm.fixedHours !== 0) ||
                !timeEstimateForm.referenceDate
              "
              @click="saveTimeEstimate"
            >
              {{ $t('common.save') }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- État vide -->
    <div
      v-if="!loading && expenses.length === 0"
      class="text-center py-16 text-gray-500 dark:text-gray-400"
    >
      <UIcon name="i-heroicons-banknotes" class="w-16 h-16 mx-auto mb-4 opacity-30" />
      <p class="text-lg">{{ t('admin.project_costs.empty') }}</p>
    </div>

    <!-- Liste des dépenses -->
    <div class="space-y-6">
      <UCard v-for="expense in expenses" :key="expense.id" variant="outline">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon
                :name="expense.icon || categoryIcons[expense.category]"
                class="w-6 h-6 text-primary"
              />
              <div>
                <h3 class="text-lg font-semibold">{{ expense.name }}</h3>
                <div class="flex items-center gap-2 mt-1">
                  <UBadge
                    :label="t(`admin.project_costs.categories.${expense.category}`)"
                    color="primary"
                    variant="subtle"
                    size="sm"
                  />
                  <UBadge
                    v-if="!expense.isActive"
                    :label="t('admin.project_costs.inactive')"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  />
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <!-- Tarif actuel -->
              <span
                v-if="getCurrentRate(expense)"
                class="text-lg font-bold text-emerald-600 dark:text-emerald-400 mr-2"
              >
                {{ formatAmount(getCurrentRate(expense)!) }}
              </span>
              <UButton
                icon="i-heroicons-plus"
                variant="soft"
                color="primary"
                size="sm"
                @click="openRateModal(expense)"
              >
                {{ t('admin.project_costs.rates.add') }}
              </UButton>
              <UButton
                icon="i-heroicons-pencil-square"
                variant="soft"
                color="neutral"
                size="sm"
                @click="openEditModal(expense)"
              />
              <UButton
                icon="i-heroicons-trash"
                variant="soft"
                color="error"
                size="sm"
                @click="confirmDeleteExpense(expense)"
              />
            </div>
          </div>
        </template>

        <!-- Description -->
        <p v-if="expense.description" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {{ expense.description }}
        </p>

        <!-- Tableau des tarifs -->
        <div v-if="expense.rates.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b dark:border-gray-700">
                <th class="text-left py-2 px-3 font-medium text-gray-500">
                  {{ t('admin.project_costs.rates.amount') }}
                </th>
                <th class="text-left py-2 px-3 font-medium text-gray-500">
                  {{ t('admin.project_costs.rates.period') }}
                </th>
                <th class="text-left py-2 px-3 font-medium text-gray-500">
                  {{ t('admin.project_costs.rates.start_date') }}
                </th>
                <th class="text-left py-2 px-3 font-medium text-gray-500">
                  {{ t('admin.project_costs.rates.end_date') }}
                </th>
                <th class="text-left py-2 px-3 font-medium text-gray-500">
                  {{ t('admin.project_costs.rates.note') }}
                </th>
                <th class="w-10"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="rate in expense.rates"
                :key="rate.id"
                class="border-b dark:border-gray-700/50"
                :class="{ 'bg-emerald-50 dark:bg-emerald-900/10': isCurrentRate(rate) }"
              >
                <td class="py-2 px-3 font-semibold">
                  {{ parseFloat(rate.amount) }} {{ rate.currency }}
                </td>
                <td class="py-2 px-3">
                  <UBadge
                    :label="t(`admin.project_costs.periods.${rate.period}`)"
                    :color="rate.period === 'ONE_TIME' ? 'warning' : 'primary'"
                    variant="subtle"
                    size="sm"
                  />
                </td>
                <td class="py-2 px-3">{{ formatDate(rate.startDate) }}</td>
                <td class="py-2 px-3">
                  <span v-if="rate.endDate">{{ formatDate(rate.endDate) }}</span>
                  <UBadge
                    v-else
                    :label="t('admin.project_costs.ongoing')"
                    color="success"
                    variant="subtle"
                    size="sm"
                  />
                </td>
                <td class="py-2 px-3 text-gray-500">{{ rate.note || '—' }}</td>
                <td class="py-2 px-3">
                  <div class="flex gap-1">
                    <UButton
                      icon="i-heroicons-pencil-square"
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      @click="openEditRateModal(expense.id, rate)"
                    />
                    <UButton
                      icon="i-heroicons-trash"
                      variant="ghost"
                      color="error"
                      size="xs"
                      @click="confirmDeleteRate(expense.id, rate)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-gray-400 italic">
          {{ t('admin.project_costs.no_rates') }}
        </p>
      </UCard>
    </div>

    <!-- Modal création/édition dépense -->
    <UModal v-model:open="showExpenseModal">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{
            editingExpense
              ? t('admin.project_costs.edit_expense')
              : t('admin.project_costs.add_expense')
          }}
        </h3>
      </template>

      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('admin.project_costs.name')" required>
            <UInput v-model="expenseForm.name" size="lg" class="w-full" />
          </UFormField>

          <UFormField :label="t('admin.project_costs.category')" required>
            <USelect
              v-model="expenseForm.category"
              :items="categoryOptions"
              size="lg"
              :ui="{ content: 'min-w-fit' }"
            />
          </UFormField>

          <UFormField :label="t('admin.project_costs.description_field')">
            <UTextarea v-model="expenseForm.description" :rows="3" class="w-full" />
          </UFormField>

          <UFormField
            :label="t('admin.project_costs.icon')"
            :hint="t('admin.project_costs.icon_hint')"
          >
            <UInput v-model="expenseForm.icon" size="lg" class="w-full" />
          </UFormField>

          <UFormField :label="t('admin.project_costs.sort_order')">
            <UInput v-model.number="expenseForm.sortOrder" type="number" size="lg" class="w-full" />
          </UFormField>

          <USwitch v-model="expenseForm.isActive" :label="t('admin.project_costs.is_active')" />
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="showExpenseModal = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :loading="savingExpense"
            :disabled="!expenseForm.name.trim()"
            @click="saveExpense"
          >
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal ajout tarif -->
    <UModal v-model:open="showRateModal">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{
            editingRate ? t('admin.project_costs.rates.edit') : t('admin.project_costs.rates.add')
          }}
        </h3>
      </template>

      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="t('admin.project_costs.rates.amount')" required>
              <UInput
                v-model.number="rateForm.amount"
                type="number"
                step="0.01"
                min="0"
                size="lg"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('admin.project_costs.rates.currency')">
              <USelect
                v-model="rateForm.currency"
                :items="currencyOptions"
                size="lg"
                :ui="{ content: 'min-w-fit' }"
              />
            </UFormField>
          </div>

          <UFormField :label="t('admin.project_costs.rates.period')" required>
            <USelect
              v-model="rateForm.period"
              :items="periodOptions"
              size="lg"
              :ui="{ content: 'min-w-fit' }"
            />
          </UFormField>

          <UFormField :label="t('admin.project_costs.rates.start_date')" required>
            <UPopover :popper="{ placement: 'bottom-start' }" class="w-full">
              <UButton
                icon="i-heroicons-calendar-days"
                size="lg"
                color="neutral"
                variant="outline"
                class="w-full justify-start text-left font-normal"
                :label="
                  rateForm.startDate
                    ? formatCalendarDate(rateForm.startDate)
                    : t('admin.project_costs.rates.select_date')
                "
                block
              />
              <template #content>
                <UCalendar v-model="rateForm.startDate" class="p-2" />
              </template>
            </UPopover>
          </UFormField>

          <UFormField
            :label="t('admin.project_costs.rates.end_date')"
            :description="t('admin.project_costs.rates.end_date_hint')"
          >
            <UPopover :popper="{ placement: 'bottom-start' }" class="w-full">
              <UButton
                icon="i-heroicons-calendar-days"
                size="lg"
                color="neutral"
                variant="outline"
                class="w-full justify-start text-left font-normal"
                :label="rateForm.endDate ? formatCalendarDate(rateForm.endDate) : '—'"
                block
              />
              <template #content>
                <UCalendar v-model="rateForm.endDate" class="p-2" />
              </template>
            </UPopover>
          </UFormField>

          <UFormField :label="t('admin.project_costs.rates.note')">
            <UInput v-model="rateForm.note" size="lg" class="w-full" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="showRateModal = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :loading="savingRate"
            :disabled="!rateForm.amount || !rateForm.startDate"
            @click="saveRate"
          >
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'

definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

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
const toast = useToast()

const expenses = ref<Expense[]>([])
const loading = ref(true)

// Icônes par catégorie
const categoryIcons: Record<string, string> = {
  DOMAIN: 'i-heroicons-globe-alt',
  HOSTING: 'i-heroicons-server',
  HARDWARE: 'i-heroicons-cpu-chip',
  ELECTRICITY: 'i-heroicons-bolt',
  SOFTWARE: 'i-heroicons-code-bracket',
  SERVICE: 'i-heroicons-wrench-screwdriver',
  OTHER: 'i-heroicons-ellipsis-horizontal-circle',
}

const categoryOptions = computed(() =>
  Object.keys(categoryIcons).map((key) => ({
    label: t(`admin.project_costs.categories.${key}`),
    value: key,
  }))
)

const periodOptions = computed(() =>
  ['MONTHLY', 'YEARLY', 'ONE_TIME'].map((key) => ({
    label: t(`admin.project_costs.periods.${key}`),
    value: key,
  }))
)

const currencyOptions = [
  { label: 'EUR (€)', value: 'EUR' },
  { label: 'CHF (Fr.)', value: 'CHF' },
  { label: 'USD ($)', value: 'USD' },
]

// Time estimate config
interface TimeEstimateData {
  id: number
  fixedHours: string
  referenceDate: string
  weeklyHours: string
}

const timeEstimate = ref<TimeEstimateData | null>(null)
const editingTimeEstimate = ref(false)
const savingTimeEstimate = ref(false)
const timeEstimateForm = ref<{
  fixedHours: number
  referenceDate: CalendarDate | null
  weeklyHours: number
}>({
  fixedHours: 0,
  referenceDate: null,
  weeklyHours: 0,
})

const currentEstimatedHours = computed(() => {
  if (!timeEstimate.value) return null
  const refDate = new Date(timeEstimate.value.referenceDate)
  const now = new Date()
  const weeksSinceRef = Math.max(0, (now.getTime() - refDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.round(
    parseFloat(timeEstimate.value.fixedHours) +
      weeksSinceRef * parseFloat(timeEstimate.value.weeklyHours)
  )
})

const startEditTimeEstimate = () => {
  if (timeEstimate.value) {
    timeEstimateForm.value = {
      fixedHours: parseFloat(timeEstimate.value.fixedHours),
      referenceDate: dateToCalendarDate(timeEstimate.value.referenceDate),
      weeklyHours: parseFloat(timeEstimate.value.weeklyHours),
    }
  }
  editingTimeEstimate.value = true
}

const loadTimeEstimate = async () => {
  try {
    const result: any = await $fetch('/api/admin/project-costs/time-estimate')
    timeEstimate.value = result.data?.config || result.config || null
  } catch {
    toast.add({
      title: t('admin.project_costs.time_estimate.load_error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const saveTimeEstimate = async () => {
  if (!timeEstimateForm.value.referenceDate) return
  savingTimeEstimate.value = true
  try {
    await $fetch('/api/admin/project-costs/time-estimate', {
      method: 'POST',
      body: {
        fixedHours: timeEstimateForm.value.fixedHours,
        referenceDate: timeEstimateForm.value.referenceDate.toString(),
        weeklyHours: timeEstimateForm.value.weeklyHours,
      },
    })
    toast.add({ title: t('admin.project_costs.time_estimate.save_success'), color: 'success' })
    editingTimeEstimate.value = false
    await loadTimeEstimate()
  } catch {
    toast.add({ title: t('admin.project_costs.time_estimate.save_error'), color: 'error' })
  } finally {
    savingTimeEstimate.value = false
  }
}

// Stripe config
interface StripeConfigData {
  id: number
  publicKey: string
  secretKey: string
  webhookSecret: string
  isActive: boolean
}

const stripeConfig = ref<StripeConfigData | null>(null)
const editingStripe = ref(false)
const savingStripe = ref(false)
const stripeForm = ref({
  publicKey: '',
  secretKey: '',
  webhookSecret: '',
  isActive: true,
})

const startEditStripe = () => {
  if (stripeConfig.value) {
    stripeForm.value = {
      publicKey: '',
      secretKey: '',
      webhookSecret: '',
      isActive: stripeConfig.value.isActive,
    }
  }
  editingStripe.value = true
}

const loadStripeConfig = async () => {
  try {
    const result: any = await $fetch('/api/admin/project-costs/stripe-config')
    stripeConfig.value = result.data?.config || result.config || null
  } catch {
    toast.add({
      title: t('admin.project_costs.stripe_config.load_error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const saveStripeConfig = async () => {
  savingStripe.value = true
  try {
    const body: Record<string, unknown> = { isActive: stripeForm.value.isActive }
    if (stripeForm.value.publicKey) body.publicKey = stripeForm.value.publicKey
    if (stripeForm.value.secretKey) body.secretKey = stripeForm.value.secretKey
    if (stripeForm.value.webhookSecret) body.webhookSecret = stripeForm.value.webhookSecret
    await $fetch('/api/admin/project-costs/stripe-config', {
      method: 'POST',
      body,
    })
    toast.add({ title: t('admin.project_costs.stripe_config.save_success'), color: 'success' })
    editingStripe.value = false
    stripeForm.value = { publicKey: '', secretKey: '', webhookSecret: '', isActive: true }
    await loadStripeConfig()
  } catch {
    toast.add({ title: t('admin.project_costs.stripe_config.save_error'), color: 'error' })
  } finally {
    savingStripe.value = false
  }
}

// Charger les dépenses
const loadExpenses = async () => {
  loading.value = true
  try {
    const result: any = await $fetch('/api/admin/project-costs')
    expenses.value = result.data?.expenses || result.expenses || []
  } catch {
    toast.add({
      title: t('admin.project_costs.error.load'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadExpenses()
  loadStripeConfig()
  loadTimeEstimate()
})

// Dépense : modal création/édition
const showExpenseModal = ref(false)
const editingExpense = ref<Expense | null>(null)
const savingExpense = ref(false)
const expenseForm = ref({
  name: '',
  description: '',
  category: 'HOSTING',
  icon: '',
  isActive: true,
  sortOrder: 0,
})

const openCreateModal = () => {
  editingExpense.value = null
  expenseForm.value = {
    name: '',
    description: '',
    category: 'HOSTING',
    icon: '',
    isActive: true,
    sortOrder: 0,
  }
  showExpenseModal.value = true
}

const openEditModal = (expense: Expense) => {
  editingExpense.value = expense
  expenseForm.value = {
    name: expense.name,
    description: expense.description || '',
    category: expense.category,
    icon: expense.icon || '',
    isActive: expense.isActive,
    sortOrder: expense.sortOrder,
  }
  showExpenseModal.value = true
}

const saveExpense = async () => {
  savingExpense.value = true
  try {
    const body = {
      ...expenseForm.value,
      description: expenseForm.value.description || null,
      icon: expenseForm.value.icon || null,
    }

    if (editingExpense.value) {
      await $fetch(`/api/admin/project-costs/${editingExpense.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.add({ title: t('admin.project_costs.success.updated'), color: 'success' })
    } else {
      await $fetch('/api/admin/project-costs', { method: 'POST', body })
      toast.add({ title: t('admin.project_costs.success.created'), color: 'success' })
    }

    showExpenseModal.value = false
    await loadExpenses()
  } catch {
    toast.add({
      title: t(
        editingExpense.value
          ? 'admin.project_costs.error.update'
          : 'admin.project_costs.error.create'
      ),
      color: 'error',
    })
  } finally {
    savingExpense.value = false
  }
}

const confirmDeleteExpense = async (expense: Expense) => {
  if (!confirm(t('admin.project_costs.confirm_delete_expense'))) return
  try {
    await $fetch(`/api/admin/project-costs/${expense.id}`, { method: 'DELETE' })
    toast.add({ title: t('admin.project_costs.success.deleted'), color: 'success' })
    await loadExpenses()
  } catch {
    toast.add({ title: t('admin.project_costs.error.delete'), color: 'error' })
  }
}

// Tarifs : modal
const showRateModal = ref(false)
const rateExpenseId = ref<number | null>(null)
const editingRate = ref<Rate | null>(null)
const savingRate = ref(false)
const rateForm = ref<{
  amount: number
  currency: string
  period: string
  startDate: CalendarDate | null
  endDate: CalendarDate | null
  note: string
}>({
  amount: 0,
  currency: 'EUR',
  period: 'MONTHLY',
  startDate: null,
  endDate: null,
  note: '',
})

const openRateModal = (expense: Expense) => {
  rateExpenseId.value = expense.id
  editingRate.value = null
  const now = new Date()
  rateForm.value = {
    amount: 0,
    currency: 'EUR',
    period: 'MONTHLY',
    startDate: new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()),
    endDate: null,
    note: '',
  }
  showRateModal.value = true
}

const dateToCalendarDate = (dateStr: string): CalendarDate => {
  const d = new Date(dateStr)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

const openEditRateModal = (expenseId: number, rate: Rate) => {
  rateExpenseId.value = expenseId
  editingRate.value = rate
  rateForm.value = {
    amount: parseFloat(rate.amount),
    currency: rate.currency,
    period: rate.period,
    startDate: dateToCalendarDate(rate.startDate),
    endDate: rate.endDate ? dateToCalendarDate(rate.endDate) : null,
    note: rate.note || '',
  }
  showRateModal.value = true
}

const saveRate = async () => {
  if (!rateExpenseId.value) return
  savingRate.value = true
  try {
    const body = {
      amount: rateForm.value.amount,
      currency: rateForm.value.currency,
      period: rateForm.value.period,
      startDate: rateForm.value.startDate?.toString(),
      endDate: rateForm.value.endDate?.toString() || null,
      note: rateForm.value.note || null,
    }

    if (editingRate.value) {
      await $fetch(
        `/api/admin/project-costs/${rateExpenseId.value}/rates/${editingRate.value.id}`,
        { method: 'PUT', body }
      )
      toast.add({ title: t('admin.project_costs.success.rate_updated'), color: 'success' })
    } else {
      await $fetch(`/api/admin/project-costs/${rateExpenseId.value}/rates`, {
        method: 'POST',
        body,
      })
      toast.add({ title: t('admin.project_costs.success.rate_added'), color: 'success' })
    }

    showRateModal.value = false
    await loadExpenses()
  } catch {
    toast.add({
      title: t(
        editingRate.value
          ? 'admin.project_costs.error.rate_update'
          : 'admin.project_costs.error.rate_add'
      ),
      color: 'error',
    })
  } finally {
    savingRate.value = false
  }
}

const confirmDeleteRate = async (expenseId: number, rate: Rate) => {
  if (!confirm(t('admin.project_costs.rates.confirm_delete'))) return
  try {
    await $fetch(`/api/admin/project-costs/${expenseId}/rates/${rate.id}`, { method: 'DELETE' })
    toast.add({ title: t('admin.project_costs.success.rate_deleted'), color: 'success' })
    await loadExpenses()
  } catch {
    toast.add({ title: t('admin.project_costs.error.rate_delete'), color: 'error' })
  }
}

// Helpers
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

const formatAmount = (rate: Rate): string => {
  const amount = parseFloat(rate.amount)
  const suffix = t(`admin.project_costs.periods.${rate.period}`)
  return `${amount.toFixed(2)} ${rate.currency} (${suffix})`
}

const formatCalendarDate = (calDate: CalendarDate): string => {
  const jsDate = new Date(calDate.year, calDate.month - 1, calDate.day)
  return jsDate.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>
