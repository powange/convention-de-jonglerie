<template>
  <div class="flex items-stretch gap-2">
    <!-- Sélecteur de pays (drapeau + indicatif) -->
    <USelectMenu
      v-model="selectedCountry"
      :items="countryItems"
      value-key="value"
      :search-input="{ placeholder: $t('common.search') }"
      :disabled="disabled"
      :size="size"
      class="w-32 shrink-0"
      :ui="{ content: 'min-w-[300px]' }"
    >
      <template #leading>
        <FlagIcon :code="selectedCountry" />
      </template>
      <template #default>
        <span class="text-sm">+{{ getCountryCallingCode(selectedCountry as CountryCode) }}</span>
      </template>
      <template #item-label="{ item }">
        <span class="flex items-center gap-2 w-full">
          <FlagIcon :code="item.value" />
          <span class="flex-1 truncate">{{ item.label }}</span>
          <span class="text-gray-500 text-xs">+{{ item.callingCode }}</span>
        </span>
      </template>
    </USelectMenu>

    <!-- Input numéro local -->
    <UInput
      :id="id"
      v-model="nationalNumber"
      type="tel"
      :placeholder="placeholder"
      :disabled="disabled"
      :name="name"
      :size="size"
      class="flex-1"
    />
  </div>
</template>

<script setup lang="ts">
import {
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js'

interface Props {
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  defaultCountry?: CountryCode
  name?: string
  id?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: undefined,
  disabled: false,
  defaultCountry: 'FR',
  name: undefined,
  id: undefined,
  size: 'lg',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { locale } = useI18n()

const selectedCountry = ref<CountryCode>(props.defaultCountry)
const nationalNumber = ref('')
// Évite les rebonds émission ↔ réception quand on synchronise depuis modelValue
const syncing = ref(false)

// Liste des pays avec noms traduits dans la locale courante
const countryItems = computed(() => {
  const displayNames =
    typeof Intl !== 'undefined' && Intl.DisplayNames
      ? new Intl.DisplayNames([locale.value], { type: 'region' })
      : null
  return getCountries()
    .map((code) => ({
      value: code,
      label: displayNames?.of(code) || code,
      callingCode: getCountryCallingCode(code),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale.value))
})

function syncFromModelValue(value: string | null | undefined) {
  syncing.value = true
  try {
    const v = (value || '').trim()
    if (!v) {
      nationalNumber.value = ''
      return
    }
    // 1) Tente d'abord le format international (commence par +)
    let parsed = v.startsWith('+') ? parsePhoneNumberFromString(v) : null
    // 2) Sinon, tente avec le pays sélectionné comme contexte (cas legacy
    //    `06xxxxxxxx` provenant du profil utilisateur)
    if (!parsed) {
      parsed = parsePhoneNumberFromString(v, selectedCountry.value)
    }
    if (parsed && parsed.country) {
      selectedCountry.value = parsed.country
      nationalNumber.value = parsed.formatNational()
      // Si la valeur n'était pas déjà en E.164, on propage la normalisation
      // au parent pour que la valeur stockée/envoyée soit toujours en E.164.
      if (parsed.isValid() && parsed.number !== v) {
        emit('update:modelValue', parsed.number)
      }
    } else {
      nationalNumber.value = v
    }
  } finally {
    nextTick(() => {
      syncing.value = false
    })
  }
}

watch(() => props.modelValue, syncFromModelValue, { immediate: true })

function emitValue() {
  if (syncing.value) return
  const local = nationalNumber.value.trim()
  if (!local) {
    emit('update:modelValue', '')
    return
  }
  const parsed = parsePhoneNumberFromString(local, selectedCountry.value)
  if (parsed && parsed.isValid()) {
    emit('update:modelValue', parsed.number) // E.164
  } else {
    // Numéro incomplet/invalide : on émet une chaîne préfixée par l'indicatif
    // pour que la validation Zod côté serveur la rejette explicitement.
    const digits = local.replace(/\D/g, '')
    emit('update:modelValue', `+${getCountryCallingCode(selectedCountry.value)}${digits}`)
  }
}

watch([selectedCountry, nationalNumber], emitValue)
</script>
