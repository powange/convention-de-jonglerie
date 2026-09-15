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

        <!-- Une période par onglet : on ne recrute ni les mêmes personnes ni le même volume pour
             monter un chapiteau le jeudi et pour tenir un bar le samedi soir. -->
        <UTabs v-model="periodeActive" :items="onglets" class="w-full" />

        <!-- Une période que l'édition ne déclare pas n'a pas de bornes : le dire vaut mieux que
             d'afficher un besoin de zéro, qu'on lirait comme « rien à pourvoir ». -->
        <UAlert
          v-if="!periodeDeclaree"
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          :title="t('volunteers.staffing_period_undefined')"
          :description="t('volunteers.staffing_period_undefined_hint')"
        />

        <template v-else>
          <!-- `UInput` plutôt que `UInputNumber` : ce dernier ne publie la valeur qu'à la sortie
               du champ, et le résultat ne suivait donc pas la frappe. La largeur est réduite à ce
               que la saisie demande — un nombre d'heures tient en quelques caractères. -->
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
              <span class="font-medium">{{ periodeCourante.heuresAPourvoir.toFixed(1) }}h</span>
            </div>
            <div
              v-if="periodeCourante.heuresDesOrganisateurs > 0"
              class="flex items-center justify-between gap-3"
            >
              <span class="text-gray-600 dark:text-gray-400">
                {{ t('volunteers.hours_covered_by_organizers') }}
              </span>
              <span class="font-medium">
                − {{ periodeCourante.heuresDesOrganisateurs.toFixed(1) }}h
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-gray-600 dark:text-gray-400">
                {{ t('volunteers.accepted_volunteers') }}
              </span>
              <span class="font-medium">{{ periodeCourante.benevolesAcceptes }}</span>
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
        </template>

        <!-- Sans vue d'ensemble, ces créneaux n'apparaîtraient sur aucun onglet. Les taire
             donnerait un dimensionnement qui ne couvre pas tout le planning, sans le dire. -->
        <UAlert
          v-if="effectif.hors.creneaux > 0"
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="soft"
          :title="t('volunteers.staffing_slots_outside_periods')"
          :description="
            t('volunteers.staffing_slots_outside_periods_hint', {
              count: effectif.hors.creneaux,
              hours: effectif.hors.heuresAPourvoir.toFixed(1),
            })
          "
        />
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
import { PERIODES, type EffectifParPeriode } from '~/utils/effectif-par-periode'

import type { PeriodeEdition } from '~~/shared/utils/presence-edition'

const props = defineProps<{
  modelValue: boolean
  /** Le dimensionnement de chaque période, et ce qui n'en relève d'aucune. */
  effectif: EffectifParPeriode
  /**
   * Les périodes que l'édition déclare réellement.
   *
   * Le montage et le démontage sont facultatifs : sans leurs bornes, l'onglet resterait
   * désespérément vide sans qu'on sache si c'est faute de créneaux ou faute de dates.
   */
  periodesDeclarees: PeriodeEdition[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// L'événement d'abord : c'est la période qu'on dimensionne le plus souvent, et la seule qui
// existe toujours.
const periodeActive = ref<PeriodeEdition>('evenement')

/** Les libellés existent déjà pour la présence des bénévoles : deux jeux divergeraient. */
const LIBELLES: Record<PeriodeEdition, string> = {
  montage: 'volunteers.presence_setup',
  evenement: 'volunteers.presence_event',
  demontage: 'volunteers.presence_teardown',
}

const ICONES: Record<PeriodeEdition, string> = {
  montage: 'i-heroicons-wrench-screwdriver',
  evenement: 'i-heroicons-sparkles',
  demontage: 'i-heroicons-archive-box',
}

const onglets = computed(() =>
  PERIODES.map((periode) => ({
    value: periode,
    label: t(LIBELLES[periode]),
    icon: ICONES[periode],
  }))
)

const periodeDeclaree = computed(() => props.periodesDeclarees.includes(periodeActive.value))
const periodeCourante = computed(() => props.effectif[periodeActive.value])

/**
 * Une hypothèse d'heures PAR PÉRIODE.
 *
 * Un bénévole de montage ne doit pas le même volume qu'un bénévole d'événement : partager la
 * saisie donnerait un besoin de montage calculé sur une exigence qui n'est pas la sienne.
 */
const heuresParPeriode = ref<Record<PeriodeEdition, string>>({
  montage: '',
  evenement: '',
  demontage: '',
})

const heuresParBenevole = computed({
  get: () => heuresParPeriode.value[periodeActive.value],
  set: (valeur: string) => {
    heuresParPeriode.value[periodeActive.value] = valeur
  },
})

const resultat = computed(() =>
  calculerBesoinEnBenevoles({
    heuresAPourvoir: periodeCourante.value.heuresAPourvoir,
    heuresDesOrganisateurs: periodeCourante.value.heuresDesOrganisateurs,
    heuresParBenevole:
      heuresParBenevole.value === '' ? Number.NaN : Number(heuresParBenevole.value),
    benevolesAcceptes: periodeCourante.value.benevolesAcceptes,
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
