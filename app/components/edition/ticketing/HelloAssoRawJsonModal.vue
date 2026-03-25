<template>
  <UModal v-model:open="isOpen" :ui="{ width: 'sm:max-w-4xl' }">
    <template #header>
      <div class="flex items-center gap-3">
        <img
          src="https://www.helloasso.com/assets/img/logos/helloasso-logo.svg"
          alt="HelloAsso"
          class="w-8 h-8"
        />
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ $t('gestion.ticketing.helloasso_raw_json_title') }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('gestion.ticketing.helloasso_raw_json_description') }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Onglets -->
        <div class="flex gap-2">
          <UButton
            :color="activeTab === 'form' ? 'primary' : 'neutral'"
            :variant="activeTab === 'form' ? 'solid' : 'soft'"
            size="sm"
            @click="activeTab = 'form'"
          >
            {{ $t('gestion.ticketing.helloasso_raw_tab_form') }}
          </UButton>
          <UButton
            :color="activeTab === 'orders' ? 'primary' : 'neutral'"
            :variant="activeTab === 'orders' ? 'solid' : 'soft'"
            size="sm"
            @click="activeTab = 'orders'"
          >
            {{ $t('gestion.ticketing.helloasso_raw_tab_orders') }}
          </UButton>
        </div>
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

interface Props {
  open: boolean
  formData: string
  ordersData: string
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

const activeTab = ref<'form' | 'orders'>('form')

const currentJson = computed(() => (activeTab.value === 'form' ? props.formData : props.ordersData))

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
  if (val) activeTab.value = 'form'
})
</script>
