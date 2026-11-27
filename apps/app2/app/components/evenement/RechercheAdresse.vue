<template>
  <UFormField
    label="Rechercher l'adresse"
    name="rechercheAdresse"
    description="Choisissez une proposition : l'adresse, le code postal, la ville, le pays et les coordonnées se remplissent."
  >
    <UInput
      v-model="texte"
      icon="i-heroicons-magnifying-glass"
      placeholder="Commencez à taper l'adresse ou le nom du lieu…"
      class="w-full"
      autocomplete="off"
      :loading="chargement"
      :disabled="disabled"
      @update:model-value="temporiser"
    />
    <ul
      v-if="propositions.length"
      class="mt-2 divide-y divide-default overflow-hidden rounded-md border border-default"
    >
      <li v-for="(proposition, i) in propositions" :key="i">
        <button
          type="button"
          class="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-elevated"
          @click="choisir(proposition)"
        >
          <UIcon name="i-heroicons-map-pin" class="mt-0.5 size-4 shrink-0 text-muted" />
          <span class="min-w-0">{{ proposition.libelle }}</span>
        </button>
      </li>
    </ul>
    <p v-else-if="aucune" class="mt-2 text-sm text-muted">
      Aucune adresse trouvée : remplissez les champs ci-dessous à la main.
    </p>
  </UFormField>
</template>

<script setup lang="ts">
/**
 * Recherche d'adresse (Nominatim, relayée par `GET /api/adresses/recherche`) : le choix d'une
 * proposition émet de quoi remplir tous les champs du lieu, coordonnées comprises.
 */
export interface AdresseTrouvee {
  libelle: string
  nomDuLieu: string
  addressLine1: string
  postalCode: string
  city: string
  country: string
  latitude: number
  longitude: number
}

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ choisie: [adresse: AdresseTrouvee] }>()

const texte = ref('')
const propositions = ref<AdresseTrouvee[]>([])
const chargement = ref(false)
const aucune = ref(false)
let minuterie: ReturnType<typeof setTimeout> | undefined
// Seule la réponse à la DERNIÈRE frappe s'affiche : une réponse lente ne remplace pas une plus récente.
let numero = 0

function temporiser() {
  clearTimeout(minuterie)
  aucune.value = false
  if (texte.value.trim().length < 3) {
    propositions.value = []
    return
  }
  // Nominatim demande une requête par seconde au plus : on attend la fin de la frappe.
  minuterie = setTimeout(rechercher, 500)
}

async function rechercher() {
  const demande = ++numero
  chargement.value = true
  try {
    const { adresses } = await $fetch<{ adresses: AdresseTrouvee[] }>('/api/adresses/recherche', {
      query: { q: texte.value },
    })
    if (demande !== numero) return
    propositions.value = adresses
    aucune.value = adresses.length === 0
  } catch {
    if (demande === numero) propositions.value = []
  } finally {
    if (demande === numero) chargement.value = false
  }
}

function choisir(adresse: AdresseTrouvee) {
  emit('choisie', adresse)
  texte.value = ''
  propositions.value = []
}

onBeforeUnmount(() => clearTimeout(minuterie))
</script>
