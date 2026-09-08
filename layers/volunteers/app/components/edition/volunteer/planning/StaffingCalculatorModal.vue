<template>
  <UModal v-model:open="isOpen" size="md">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-calculator" class="w-5 h-5 text-primary-600" />
        <h3 class="text-lg font-semibold">{{ t('volunteers.staffing_calculator') }}</h3>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('volunteers.staffing_calculator_intro') }}
        </p>

        <!-- `UInput` plutôt que `UInputNumber` : ce dernier ne publie la valeur qu'à la sortie du
             champ, et le résultat ne suivait donc pas la frappe. La largeur est réduite à ce que
             la saisie demande — un nombre d'heures tient en quelques caractères. -->
        <UFormField :label="t('volunteers.hours_per_volunteer_expected')">
          <UInput v-model="heuresParBenevole" type="number" min="0" step="0.5" class="w-20" />
        </UFormField>

        <!-- Ce sur quoi le calcul s'appuie, dit à voix haute : sans cela, un résultat surprenant
             ne s'explique pas, et l'organisateur n'a aucun moyen de savoir d'où il sort. -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1 text-sm">
          <div class="flex items-center justify-between gap-3">
            <span class="text-gray-600 dark:text-gray-400">
              {{ t('volunteers.hours_to_cover') }}
            </span>
            <span class="font-medium">{{ heuresAPourvoir.toFixed(1) }}h</span>
          </div>
          <div v-if="heuresDesOrganisateurs > 0" class="flex items-center justify-between gap-3">
            <span class="text-gray-600 dark:text-gray-400">
              {{ t('volunteers.hours_covered_by_organizers') }}
            </span>
            <span class="font-medium">− {{ heuresDesOrganisateurs.toFixed(1) }}h</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-gray-600 dark:text-gray-400">
              {{ t('volunteers.accepted_volunteers') }}
            </span>
            <span class="font-medium">{{ benevolesAcceptes }}</span>
          </div>
        </div>

        <!-- Le résultat se recalcule à la saisie : rien à valider, la modale répond à une
             question qu'on se pose plusieurs fois de suite en faisant varier l'hypothèse. -->
        <UAlert
          v-if="resultat"
          :icon="icone"
          :color="couleur"
          variant="soft"
          :title="titre"
          :description="t('volunteers.staffing_need', { count: resultat.besoin })"
        />
        <p v-else class="text-sm text-gray-500 italic">
          {{ t('volunteers.staffing_calculator_awaiting_input') }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">
          {{ t('common.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { calculerBesoinEnBenevoles } from '~/utils/besoin-benevoles'

const props = defineProps<{
  modelValue: boolean
  /** Heures à pourvoir sur l'ensemble du planning. */
  heuresAPourvoir: number
  /** Heures déjà tenues par des organisateurs, qui se retranchent du besoin. */
  heuresDesOrganisateurs: number
  /** Bénévoles acceptés sur l'édition — l'effectif auquel le besoin se compare. */
  benevolesAcceptes: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Le champ rend une chaîne, y compris vide : la conversion est faite ici, et une saisie
// inexploitable devient `NaN`, ce que le calcul traduit par « pas encore de réponse ».
const heuresParBenevole = ref<string>('')

const resultat = computed(() =>
  calculerBesoinEnBenevoles({
    heuresAPourvoir: props.heuresAPourvoir,
    heuresDesOrganisateurs: props.heuresDesOrganisateurs,
    heuresParBenevole:
      heuresParBenevole.value === '' ? Number.NaN : Number(heuresParBenevole.value),
    benevolesAcceptes: props.benevolesAcceptes,
  })
)

const couleur = computed(() => {
  if (!resultat.value) return 'neutral'
  if (resultat.value.manque > 0) return 'warning'
  return 'success'
})

const icone = computed(() =>
  resultat.value?.manque ? 'i-heroicons-user-plus' : 'i-heroicons-check-circle'
)

const titre = computed(() => {
  const r = resultat.value
  if (!r) return ''
  if (r.manque > 0) return t('volunteers.staffing_missing', { count: r.manque })
  if (r.surplus > 0) return t('volunteers.staffing_surplus', { count: r.surplus })
  return t('volunteers.staffing_exact')
})
</script>
