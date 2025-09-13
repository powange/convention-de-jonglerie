<template>
  <div class="relative">
    <USelectMenu
      v-model="selectedCountries"
      :items="data || []"
      multiple
      :placeholder="dynamicPlaceholder"
      :loading="pending"
      searchable
      :searchable-placeholder="$t('components.country_select.search_country_placeholder')"
      value-attribute="value"
      option-attribute="label"
      class="w-full"
      :ui="{ content: 'min-w-fit' }"
    >
      <template #option="{ option }">
        <div class="flex items-center gap-2">
          <FlagIcon :code="getCountryCode(option.value)" />
          <span>{{ option.label }}</span>
        </div>
      </template>
      <template #option-empty>
        <span class="text-sm text-gray-500">{{
          $t('components.country_select.no_countries_found')
        }}</span>
      </template>
    </USelectMenu>
  </div>
</template>

<script setup lang="ts">
import FlagIcon from '~/components/FlagIcon.vue'
import { getCountryCode } from '~/utils/countries'

interface Props {
  modelValue: string[]
  placeholder?: string
}

const { t } = useI18n()
// define props puis appliquer défaut dynamiquement après (pas de computed inline qui capture $t avant useI18n)
const props = defineProps<Props>()
const propsWithDefaults = computed(() => ({
  placeholder: t('components.country_multi_select.placeholder'),
  ...props,
  // si l'utilisateur a fourni une valeur, elle est déjà dans props
}))

// Utiliser la traduction dynamiquement pour le placeholder
const dynamicPlaceholder = computed(() => propsWithDefaults.value.placeholder)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const selectedCountries = ref<string[]>([])

// Utiliser useFetch qui est plus adapté pour Nuxt
const { data: rawCountries, pending } = await useFetch<string[]>('/api/countries')

// Transformer les pays en objets avec icônes
const data = computed(() => {
  if (!rawCountries.value) return []
  return rawCountries.value.map((country) => ({
    label: country,
    value: country,
    icon: `flag:${getCountryCode(country)}-4x3`,
  }))
})

// Watcher pour synchroniser avec le modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    selectedCountries.value = newValue || []
  },
  { immediate: true }
)

// Watcher pour émettre les changements
watch(selectedCountries, (newValue) => {
  emit('update:modelValue', newValue)
})
</script>

<style>
@import 'flag-icons/css/flag-icons.min.css';

.fi {
  background-size: contain;
  background-position: 50%;
  background-repeat: no-repeat;
  display: inline-block;
  border-radius: 2px;
}
</style>
