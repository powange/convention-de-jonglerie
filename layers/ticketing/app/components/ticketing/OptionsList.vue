<template>
  <!-- Bouton ajouter une option -->
  <div class="mb-4 flex justify-end">
    <UButton icon="i-heroicons-plus" color="primary" @click="openOptionModal()">
      Ajouter une option
    </UButton>
  </div>

  <!-- Liste des options -->
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">{{ $t('ticketing.options.list.loading') }}</p>
  </div>

  <div v-else-if="options.length === 0" class="text-center py-12">
    <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
    <p class="text-sm text-gray-500">{{ $t('ticketing.options.list.none_found') }}</p>
    <p class="text-xs text-gray-400 mt-1">
      Ajoutez une option manuelle ou synchronisez depuis votre billeterie externe
    </p>
  </div>

  <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UCard v-for="option in options" :key="option.id">
      <template #header>
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <!-- La provenance AVANT le titre : c'est elle qui situe l'option, et la chercher
                   après un intitulé de longueur variable obligeait à balayer la ligne.

                   Il y en a toujours une — le logo du site quand l'option a été saisie ici, sans
                   quoi l'absence se lirait comme une origine inconnue. -->
              <img
                :src="logoDuFournisseur(option.provider)"
                :alt="nomDuFournisseur(option.provider) ?? $t('gestion.ticketing.origin_site')"
                :title="infobulleProvenance(option)"
                class="h-4 w-4 object-contain flex-shrink-0"
              />
              <h3 class="font-semibold text-gray-900 dark:text-white">
                {{ option.name }}
              </h3>
              <span
                v-if="option.price"
                class="text-sm font-semibold text-primary-600 dark:text-primary-400"
              >
                + {{ money(option.price) }}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <UBadge color="primary" variant="soft" size="xs">
                {{ option.type }}
              </UBadge>
              <UBadge v-if="option.isRequired" color="warning" variant="soft" size="xs">
                Obligatoire
              </UBadge>
            </div>
          </div>
        </div>
      </template>

      <div class="space-y-3">
        <p v-if="option.description" class="text-sm text-gray-600 dark:text-gray-400">
          {{ option.description }}
        </p>

        <!-- Choix disponibles -->
        <div v-if="option.choices && option.choices.length > 0">
          <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Choix :</p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="(choice, idx) in option.choices"
              :key="idx"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ choice }}
            </UBadge>
          </div>
        </div>

        <!-- Quotas associés -->
        <div v-if="option.quotas && option.quotas.length > 0" class="flex flex-wrap gap-1">
          <p class="font-medium text-gray-700 dark:text-gray-300">Quotas :</p>
          <UBadge
            v-for="quotaRelation in option.quotas"
            :key="quotaRelation.quota.id"
            color="warning"
            variant="soft"
          >
            {{ quotaRelation.quota.title }}
          </UBadge>
        </div>

        <!-- Articles à remettre -->
        <div
          v-if="option.handoutItems && option.handoutItems.length > 0"
          class="flex flex-wrap gap-1"
        >
          <p class="font-medium text-gray-700 dark:text-gray-300">À remettre :</p>
          <UBadge
            v-for="itemRelation in option.handoutItems"
            :key="itemRelation.handoutItem.id"
            color="info"
            variant="soft"
          >
            {{ itemRelation.handoutItem.name
            }}{{ itemRelation.quantity > 1 ? ` ×${itemRelation.quantity}` : '' }}
          </UBadge>
        </div>

        <!-- Tarifs associés -->
        <div v-if="option.tiers && option.tiers.length > 0" class="flex flex-wrap gap-1">
          <p class="font-medium text-gray-700 dark:text-gray-300">Tarifs :</p>
          <UBadge
            v-for="tierRelation in option.tiers"
            :key="tierRelation.tier.id"
            color="primary"
            variant="soft"
          >
            {{ tierRelation.tier.name }}
          </UBadge>
        </div>

        <!-- Repas associés -->
        <div
          v-if="edition?.mealsEnabled && option.meals && option.meals.length > 0"
          class="flex flex-wrap gap-1"
        >
          <p class="font-medium text-gray-700 dark:text-gray-300">Repas :</p>
          <UBadge
            v-for="mealRelation in option.meals"
            :key="mealRelation.meal.id"
            color="success"
            variant="soft"
          >
            {{ formatMeal(mealRelation.meal) }}
          </UBadge>
        </div>
      </div>

      <template #footer>
        <!-- Actions -->
        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-pencil"
            color="primary"
            variant="soft"
            @click="openOptionModal(option)"
          >
            Modifier
          </UButton>
          <UButton
            v-if="!option.helloAssoOptionId"
            icon="i-heroicons-trash"
            color="error"
            variant="soft"
            @click="confirmDeleteOption(option)"
          >
            Supprimer
          </UButton>
        </div>
      </template>
    </UCard>
  </div>

  <!-- Modal pour ajouter/modifier une option -->
  <TicketingOptionModal
    v-model:open="optionModalOpen"
    :option="selectedOption"
    :edition-id="editionId"
    @saved="handleOptionSaved"
  />

  <!-- Modal de confirmation de suppression d'option -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    title="Supprimer l'option"
    :description="`Êtes-vous sûr de vouloir supprimer l'option '${optionToDelete?.name}' ?`"
    confirm-label="Supprimer"
    confirm-color="error"
    confirm-icon="i-heroicons-trash"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="deleting"
    @confirm="deleteOptionAction"
    @cancel="deleteConfirmOpen = false"
  />
</template>

<script setup lang="ts">
import { useMealTypeLabel } from '~/composables/useMeals'
import { useEditionStore } from '~/stores/editions'
import { formatMealDate } from '~/utils/meals'

import { logoDuFournisseur, nomDuFournisseur } from '../../utils/ticketing/fournisseur'
import { deleteOption, type TicketingOption } from '../../utils/ticketing/options'

const props = defineProps<{
  options: TicketingOption[]
  loading: boolean
  editionId: number
}>()

const editionStore = useEditionStore()
const edition = computed(() => editionStore.getEditionById(props.editionId))

const emit = defineEmits<{
  refresh: []
}>()

const { getMealTypeLabel } = useMealTypeLabel()

/**
 * Le gabarit appelait `money(...)` sans que rien ne le fournisse : `money` n'est pas un
 * auto-import, c'est une fonction rendue par `useEditionCurrency`. Le prix d'une option faisait
 * donc planter le rendu avec « _ctx.money is not a function ».
 *
 * L'identifiant est passé explicitement : le composable le lit sinon dans la route, ce qui vaut
 * pour une page mais pas forcément pour un composant réutilisable.
 */
const { t } = useI18n()
const { money } = useEditionCurrency(() => props.editionId)

/**
 * L'infobulle du logo de provenance.
 *
 * Reprend l'identifiant chez le fournisseur, que portait le second logo — celui du coin supérieur
 * droit, retiré depuis qu'il faisait doublon. L'information est rare mais utile quand on compare
 * avec la billetterie externe : elle change de place, elle ne disparaît pas.
 */
const infobulleProvenance = (option: TicketingOption) => {
  const fournisseur = nomDuFournisseur(option.provider)
  if (!fournisseur) return t('gestion.ticketing.origin_site')
  return option.helloAssoOptionId
    ? `${fournisseur} (ID : ${option.helloAssoOptionId})`
    : fournisseur
}

const optionModalOpen = ref(false)
const selectedOption = ref<TicketingOption | null>(null)
const deleteConfirmOpen = ref(false)
const optionToDelete = ref<TicketingOption | null>(null)
const deleting = ref(false)

const formatMeal = (meal: any) => {
  const date = formatMealDate(meal.date)
  const mealTypeLabel = getMealTypeLabel(meal.mealType)
  return `${date} - ${mealTypeLabel}`
}

const openOptionModal = (option?: TicketingOption) => {
  selectedOption.value = option || null
  optionModalOpen.value = true
}

const handleOptionSaved = () => {
  emit('refresh')
}

const confirmDeleteOption = (option: TicketingOption) => {
  optionToDelete.value = option
  deleteConfirmOpen.value = true
}

const deleteOptionAction = async () => {
  if (!optionToDelete.value) return

  const toast = useToast()
  deleting.value = true
  try {
    await deleteOption(props.editionId, optionToDelete.value.id)

    toast.add({
      title: 'Option supprimée',
      description: "L'option a été supprimée avec succès",
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    deleteConfirmOpen.value = false
    optionToDelete.value = null
    emit('refresh')
  } catch (error: any) {
    console.error('Failed to delete option:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || "Impossible de supprimer l'option",
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}
</script>
