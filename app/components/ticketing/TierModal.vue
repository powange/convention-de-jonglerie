<template>
  <UModal
    v-model:open="isOpen"
    :title="tier ? 'Modifier le tarif' : 'Ajouter un tarif'"
    :ui="{ width: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form class="space-y-6" @submit.prevent="handleSubmit">
        <UAlert
          v-if="isHelloAssoTier"
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          title="Tarif HelloAsso"
          description="Ce tarif est synchronisé depuis HelloAsso. Seuls les quotas et articles à restituer peuvent être modifiés."
        />

        <UFormField label="Nom du tarif" name="name" required>
          <UInput
            v-model="form.name"
            :disabled="isHelloAssoTier"
            placeholder="Ex: Pass 3 jours"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Description" name="description">
          <UTextarea
            v-model="form.description"
            :disabled="isHelloAssoTier"
            placeholder="Description du tarif (optionnel)"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Prix (€)" name="price" required>
          <UInput
            v-model="form.priceInEuros"
            :disabled="isHelloAssoTier"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <div
          class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <UFormField label="Tarif libre" name="isFree">
            <div class="flex items-start gap-3">
              <USwitch v-model="form.isFree" :disabled="isHelloAssoTier" class="mt-1" />
              <div class="flex-1">
                <label for="isFree" class="text-sm font-medium text-gray-900 dark:text-white">
                  Permettre au participant de choisir le montant
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Le participant pourra définir le montant qu'il souhaite payer dans la plage
                  définie
                </p>
              </div>
            </div>
          </UFormField>

          <div v-if="form.isFree" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <UFormField label="Montant minimum (€)" name="minAmount">
              <UInput
                v-model="form.minAmountInEuros"
                :disabled="isHelloAssoTier"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Montant maximum (€)" name="maxAmount">
              <UInput
                v-model="form.maxAmountInEuros"
                :disabled="isHelloAssoTier"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField
            label="Position d'affichage"
            name="position"
            help="Ordre d'affichage (0 = premier)"
          >
            <UInput
              v-model.number="form.position"
              :disabled="isHelloAssoTier"
              type="number"
              min="0"
              placeholder="0"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Statut" name="isActive">
            <div class="flex items-start gap-3 pt-2">
              <USwitch v-model="form.isActive" :disabled="isHelloAssoTier" class="mt-1" />
              <div class="flex-1">
                <label for="isActive" class="text-sm font-medium text-gray-900 dark:text-white">
                  Tarif actif
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Visible et sélectionnable par les participants
                </p>
              </div>
            </div>
          </UFormField>
        </div>

        <UFormField label="Quotas associés" name="quotas">
          <USelectMenu
            v-model="form.quotaIds"
            :items="quotas.map((q) => ({ label: q.title, value: q.id }))"
            value-key="value"
            multiple
            searchable
            placeholder="Sélectionner des quotas"
            class="w-full"
          >
            <template #label>
              <span v-if="form.quotaIds.length === 0">Aucun quota sélectionné</span>
              <span v-else>{{ form.quotaIds.length }} quota(s) sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField label="Articles à restituer" name="returnableItems">
          <USelectMenu
            v-model="form.returnableItemIds"
            :items="returnableItems.map((item) => ({ label: item.name, value: item.id }))"
            value-key="value"
            multiple
            searchable
            placeholder="Sélectionner des articles"
            class="w-full"
          >
            <template #label>
              <span v-if="form.returnableItemIds.length === 0">Aucun article sélectionné</span>
              <span v-else>{{ form.returnableItemIds.length }} article(s) sélectionné(s)</span>
            </template>
          </USelectMenu>
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton color="neutral" variant="soft" @click="isOpen = false"> Annuler </UButton>
        <UButton color="primary" icon="i-heroicons-check" :loading="saving" @click="handleSubmit">
          {{ tier ? 'Enregistrer' : 'Ajouter' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { createTier, updateTier } from '~/utils/ticketing/tiers'

interface TicketingTier {
  id: number
  name: string
  description?: string
  price: number
  minAmount?: number
  maxAmount?: number
  isActive: boolean
  position: number
  helloAssoTierId?: number
  quotas?: any[]
  returnableItems?: any[]
}

const props = defineProps<{
  open: boolean
  tier?: TicketingTier
  editionId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const saving = ref(false)

// Vérifie si c'est un tarif HelloAsso (lecture seule sauf quotas et items)
const isHelloAssoTier = computed(
  () => props.tier?.helloAssoTierId !== null && props.tier?.helloAssoTierId !== undefined
)

const form = ref({
  name: '',
  description: '',
  priceInEuros: '0',
  minAmountInEuros: '',
  maxAmountInEuros: '',
  position: 0,
  isActive: true,
  isFree: false,
  quotaIds: [] as number[],
  returnableItemIds: [] as number[],
})

// Charger les quotas et items disponibles
const quotas = ref<any[]>([])
const returnableItems = ref<any[]>([])

const loadQuotasAndItems = async () => {
  try {
    const [quotasData, itemsData] = await Promise.all([
      $fetch(`/api/editions/${props.editionId}/ticketing/quotas`),
      $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items`),
    ])
    quotas.value = quotasData
    returnableItems.value = itemsData
  } catch (error) {
    console.error('Failed to load quotas and items:', error)
  }
}

// Réinitialiser le formulaire quand la modal s'ouvre
watch(
  () => props.open,
  async (newValue) => {
    if (newValue) {
      await loadQuotasAndItems()

      if (props.tier) {
        // Mode édition
        form.value = {
          name: props.tier.name,
          description: props.tier.description || '',
          priceInEuros: (props.tier.price / 100).toFixed(2),
          minAmountInEuros: props.tier.minAmount ? (props.tier.minAmount / 100).toFixed(2) : '',
          maxAmountInEuros: props.tier.maxAmount ? (props.tier.maxAmount / 100).toFixed(2) : '',
          position: props.tier.position,
          isActive: props.tier.isActive,
          isFree: !!(props.tier.minAmount || props.tier.maxAmount),
          quotaIds: props.tier.quotas?.map((q: any) => q.quotaId) || [],
          returnableItemIds: props.tier.returnableItems?.map((r: any) => r.returnableItemId) || [],
        }
      } else {
        // Mode création
        form.value = {
          name: '',
          description: '',
          priceInEuros: '0',
          minAmountInEuros: '',
          maxAmountInEuros: '',
          position: 0,
          isActive: true,
          isFree: false,
          quotaIds: [],
          returnableItemIds: [],
        }
      }
    }
  }
)

const handleSubmit = async () => {
  const toast = useToast()

  if (!form.value.name.trim()) {
    toast.add({
      title: 'Erreur',
      description: 'Le nom du tarif est obligatoire',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }

  saving.value = true
  try {
    const data = {
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      price: Math.round(parseFloat(form.value.priceInEuros) * 100),
      minAmount:
        form.value.isFree && form.value.minAmountInEuros
          ? Math.round(parseFloat(form.value.minAmountInEuros) * 100)
          : null,
      maxAmount:
        form.value.isFree && form.value.maxAmountInEuros
          ? Math.round(parseFloat(form.value.maxAmountInEuros) * 100)
          : null,
      position: form.value.position,
      isActive: form.value.isActive,
      quotaIds: form.value.quotaIds,
      returnableItemIds: form.value.returnableItemIds,
    }

    if (props.tier) {
      // Mode édition
      await updateTier(props.editionId, props.tier.id, data)
      toast.add({
        title: 'Tarif modifié',
        description: 'Le tarif a été modifié avec succès',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      // Mode création
      await createTier(props.editionId, data)
      toast.add({
        title: 'Tarif créé',
        description: 'Le tarif a été créé avec succès',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }

    emit('saved')
    isOpen.value = false
  } catch (error: any) {
    console.error('Failed to save tier:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible d'enregistrer le tarif",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
