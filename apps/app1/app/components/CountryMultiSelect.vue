<template>
  <div class="relative">
    <!--
      `search-input` ET NON `searchable` + `searchable-placeholder`, qui sont deux props de
      Nuxt UI v2. Même panne muette que les créneaux plus bas : une prop non déclarée est acceptée
      sans un mot, et le texte traduit n'atteignait jamais l'écran — le champ de recherche
      affichait le placeholder par défaut de Nuxt UI, dans les 13 langues. `searchable` lui-même
      était inerte, mais sans conséquence visible : `searchInput` vaut déjà `true`.
    -->
    <!--
      ⚠️ PAS de `value-key`, bien que les props et émissions soient déclarées `string[]` et que ce
      composant émette en réalité des OBJETS — `server/api/editions/index.get.ts` compense
      d'ailleurs en extrayant `item.value`. Ce mensonge de typage est réel, mais le corriger est un
      changement de COMPORTEMENT et non un renommage : `valueKey` vaut `undefined` par défaut sur
      `USelectMenu`, donc l'ajouter change le contrat. Traité à part, avec le retrait de la
      compensation serveur. Ce lot ne touche qu'au rendu.
    -->
    <USelectMenu
      v-model="selectedCountries"
      :items="data || []"
      multiple
      :placeholder="dynamicPlaceholder"
      :loading="status === 'pending'"
      :search-input="{
        placeholder: $t('components.country_select.search_country_placeholder'),
      }"
      class="w-full"
      :ui="{ content: 'min-w-fit' }"
    >
      <!--
        ⚠️ `#item` ET NON `#option`, et `#empty` ET NON `#option-empty`.
        Les deux noms d'avant ne sont pas invalides : ils sont INCONNUS, donc ignorés EN SILENCE.
        C'est pourquoi les drapeaux ne s'affichaient pas dans la liste déroulante, et pourquoi
        « aucun pays trouvé » ne s'affichait jamais. Métadonnée de `USelectMenu` à l'appui :
        les créneaux sont `item`, `item-leading`, `item-label`, `item-trailing`, `empty`.
      -->
      <template #item="{ item }">
        <div class="flex items-center gap-2">
          <FlagIcon :code="getCountryCode(item.value)" />
          <span>{{ item.label }}</span>
        </div>
      </template>
      <template #empty>
        <span class="text-sm text-gray-500">{{
          $t('components.country_select.no_countries_found')
        }}</span>
      </template>
    </USelectMenu>
  </div>
</template>

<script setup lang="ts">
import { getCountryCode } from '~/utils/countries'

interface Props {
  modelValue: string[]
  placeholder?: string
  /** Filtres à appliquer pour filtrer la liste des pays disponibles */
  filters?: Record<string, unknown>
}

const { t } = useI18n()
const props = defineProps<Props>()

const propsWithDefaults = computed(() => ({
  placeholder: t('components.country_multi_select.placeholder'),
  ...props,
}))

// Utiliser la traduction dynamiquement pour le placeholder
const dynamicPlaceholder = computed(() => propsWithDefaults.value.placeholder)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const selectedCountries = ref<string[]>([])

// Construire les query params à partir des filtres (sauf countries)
const queryParams = computed(() => {
  if (!props.filters) return {}

  const params: Record<string, string> = {}

  // Copier tous les filtres sauf countries
  for (const [key, value] of Object.entries(props.filters)) {
    if (key === 'countries') continue // Ne pas inclure le filtre pays lui-même

    if (typeof value === 'boolean') {
      if (value) params[key] = 'true'
    } else if (typeof value === 'string' && value) {
      params[key] = value
    } else if (Array.isArray(value) && value.length > 0) {
      params[key] = JSON.stringify(value)
    }
  }

  return params
})

/*
 * ⚠️ LA RÉPONSE EST SOUS ENVELOPPE `{ success, data }`.
 *
 * Elle arrivait nue, et ce point d'API faisait partie des 125 qui répondent hors de l'enveloppe du
 * projet : le client devait deviner, point d'API par point d'API, s'il lit `res` ou `res.data`.
 * Les deux côtés bougent dans le même lot — c'est la seule façon de ne pas casser l'écran.
 */
const { data: reponse, status } = useFetch<{ success: boolean; data: string[] }>('/api/countries', {
  query: queryParams,
  watch: [queryParams], // Rafraîchir quand les filtres changent
})

// Transformer les pays en objets avec icônes
const data = computed(() => {
  const pays = reponse.value?.data
  if (!pays) return []
  return pays.map((country) => ({
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
.fi {
  background-size: contain;
  background-position: 50%;
  background-repeat: no-repeat;
  display: inline-block;
  border-radius: 2px;
}
</style>
