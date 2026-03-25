<template>
  <UModal v-model:open="isOpen" :ui="{ width: 'sm:max-w-5xl' }">
    <template #header>
      <div class="flex items-center gap-3">
        <img src="~/assets/img/infomaniak/logo.svg" alt="Infomaniak" class="w-8 h-8 rounded-lg" />
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ $t('gestion.ticketing.infomaniak_raw_json_title') }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('gestion.ticketing.infomaniak_raw_json_description') }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Onglets -->
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="tab in tabs"
            :key="tab.key"
            :color="activeTab === tab.key ? 'primary' : 'neutral'"
            :variant="activeTab === tab.key ? 'solid' : 'soft'"
            size="sm"
            :icon="tab.icon"
            :disabled="tab.disabled"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <UBadge
              v-if="tab.count !== undefined"
              :label="String(tab.count)"
              size="sm"
              :color="activeTab === tab.key ? 'neutral' : 'primary'"
              variant="subtle"
              class="ml-1"
            />
          </UButton>
        </div>

        <!-- Message si pas de clé guichet et onglet guichet sélectionné -->
        <UAlert
          v-if="isGuichetTab && !hasGuichetKey"
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="soft"
          :description="$t('gestion.ticketing.infomaniak_raw_no_guichet_key')"
        />

        <!-- Message d'erreur si l'API guichet a retourné une erreur -->
        <UAlert
          v-if="currentError"
          icon="i-heroicons-exclamation-circle"
          color="error"
          variant="soft"
          :description="currentError"
        />

        <!-- Contenu JSON -->
        <div class="max-h-[60vh] overflow-auto">
          <pre
            class="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap"
            >{{ currentJson }}</pre
          >
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="soft" color="neutral" icon="i-heroicons-clipboard" @click="copyJson">
          {{ $t('common.copy') }}
        </UButton>
        <UButton color="primary" @click="isOpen = false">
          {{ $t('common.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type TabKey = 'event' | 'zones' | 'passCategories' | 'orders' | 'tickets'

interface RawData {
  event: unknown
  zones: unknown[]
  passCategories: unknown[]
  orders: unknown[] | { error: string } | null
  tickets: unknown[] | { error: string } | null
  config: {
    currency: string
    eventId?: number
    eventName?: string
    hasGuichetKey: boolean
  }
}

interface Props {
  open: boolean
  data: RawData | null
}

interface Emits {
  (e: 'update:open', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const activeTab = ref<TabKey>('event')
const hasGuichetKey = computed(() => props.data?.config?.hasGuichetKey ?? false)
const isGuichetTab = computed(() => activeTab.value === 'orders' || activeTab.value === 'tickets')

const getArrayLength = (data: unknown[] | { error: string } | null | undefined): number => {
  if (!data || !Array.isArray(data)) return 0
  return data.length
}

const tabs = computed(() => [
  {
    key: 'event' as TabKey,
    label: t('gestion.ticketing.infomaniak_raw_tab_event'),
    icon: 'i-heroicons-calendar',
    count: undefined,
    disabled: false,
  },
  {
    key: 'zones' as TabKey,
    label: t('gestion.ticketing.infomaniak_raw_tab_zones'),
    icon: 'i-heroicons-rectangle-group',
    count: props.data?.zones?.length ?? 0,
    disabled: false,
  },
  {
    key: 'passCategories' as TabKey,
    label: t('gestion.ticketing.infomaniak_raw_tab_pass_categories'),
    icon: 'i-heroicons-ticket',
    count: props.data?.passCategories?.length ?? 0,
    disabled: false,
  },
  {
    key: 'orders' as TabKey,
    label: t('gestion.ticketing.infomaniak_raw_tab_orders'),
    icon: 'i-heroicons-shopping-cart',
    count: getArrayLength(props.data?.orders),
    disabled: !hasGuichetKey.value,
  },
  {
    key: 'tickets' as TabKey,
    label: t('gestion.ticketing.infomaniak_raw_tab_tickets'),
    icon: 'i-heroicons-qr-code',
    count: getArrayLength(props.data?.tickets),
    disabled: !hasGuichetKey.value,
  },
])

const currentJson = computed(() => {
  if (!props.data) return '{}'
  const dataByTab: Record<TabKey, unknown> = {
    event: { event: props.data.event, config: props.data.config },
    zones: props.data.zones,
    passCategories: props.data.passCategories,
    orders: props.data.orders,
    tickets: props.data.tickets,
  }
  return JSON.stringify(dataByTab[activeTab.value], null, 2) || '{}'
})

const currentError = computed(() => {
  if (!props.data) return null
  const data =
    activeTab.value === 'orders'
      ? props.data.orders
      : activeTab.value === 'tickets'
        ? props.data.tickets
        : null
  if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
    return (data as { error: string }).error
  }
  return null
})

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(currentJson.value)
    toast.add({
      title: t('ticketing.external.json_copied'),
      description: t('ticketing.external.json_copied_description'),
      icon: 'i-heroicons-clipboard-document-check',
      color: 'success',
    })
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('ticketing.external.json_copy_error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

// Reset tab quand la modal s'ouvre
watch(isOpen, (val) => {
  if (val) activeTab.value = 'event'
})
</script>
