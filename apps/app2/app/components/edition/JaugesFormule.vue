<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="font-semibold">
          Formule {{ nomFormule }}
          <span class="text-sm font-normal text-muted">
            {{ quotas.payant ? '' : '· gratuite' }}
          </span>
        </p>
        <UButton
          v-if="estProprietaire"
          to="/pricing"
          size="xs"
          variant="link"
          color="primary"
          class="px-0"
          trailing-icon="i-heroicons-arrow-right"
          :label="quotas.formule === 'grand' ? 'Voir les formules' : 'Voir plus grand'"
        />
      </div>
    </template>

    <div class="grid gap-4 sm:grid-cols-2">
      <div v-for="c in compteurs" :key="c.cle" class="space-y-1.5">
        <div class="flex items-baseline justify-between gap-2 text-sm">
          <span>{{ c.libelle }}</span>
          <span class="font-semibold tabular-nums" :class="c.classeTexte">
            {{ c.usage }} / {{ c.plafond === null ? '∞' : c.plafond }}
          </span>
        </div>
        <UProgress
          v-if="c.plafond !== null"
          :model-value="Math.min(c.usage, c.plafond)"
          :max="c.plafond || 1"
          :color="c.couleur"
          size="sm"
        />
        <p v-if="c.note" class="text-xs" :class="c.classeTexte">{{ c.note }}</p>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
/**
 * Les jauges de la formule du propriétaire sur l'accueil de la gestion : où en est chaque compteur
 * (événements en cours, et pour cet événement bénévoles acceptés, artistes, co-organisateurs).
 * Orange dès 80 %, rouge une fois la limite atteinte (shared/formules.ts, `etatQuota`).
 */
import type { Compteur, EtatQuota } from '#shared/formules'

import { COMPTEURS, formule, plafondTolere } from '#shared/formules'

const props = defineProps<{
  quotas: {
    formule: string
    payant: boolean
    compteurs: { cle: Compteur; usage: number; plafond: number | null; etat: EtatQuota }[]
  }
  estProprietaire: boolean
}>()

const nomFormule = computed(() => formule(props.quotas.formule)?.libelle ?? props.quotas.formule)

const compteurs = computed(() =>
  props.quotas.compteurs.map((c) => {
    const def = COMPTEURS.find((x) => x.cle === c.cle)!
    const marge = c.plafond === null ? 0 : (plafondTolere(c.plafond) ?? 0) - c.usage
    const plein = c.etat === 'atteint' || c.etat === 'tolerance' || c.etat === 'bloque'
    // Les événements pleins, c'est le cas ordinaire (« 1 / 1 » en formule gratuite) : on dit
    // comment en ouvrir un autre, sans alarme.
    if (c.cle === 'evenements' && plein) {
      return {
        ...c,
        libelle: `${def.libelle} ${props.estProprietaire ? '(tous vos événements)' : 'du propriétaire'}`,
        note: 'Pour un événement de plus : archivez-en un passé, ou passez à une formule plus grande.',
        couleur: 'warning' as 'error' | 'warning' | 'primary',
        classeTexte: 'text-warning',
      }
    }
    const note =
      c.etat === 'atteint' || c.etat === 'tolerance'
        ? `Limite atteinte : encore ${marge} dans la marge de 10 %, puis plus d'ajout.`
        : c.etat === 'bloque'
          ? "Limite atteinte : plus d'ajout possible avec cette formule."
          : ''
    return {
      ...c,
      libelle: def.parEvenement
        ? def.libelle
        : `${def.libelle} ${props.estProprietaire ? '(tous vos événements)' : 'du propriétaire'}`,
      note,
      couleur: (plein ? 'error' : c.etat === 'alerte' ? 'warning' : 'primary') as
        | 'error'
        | 'warning'
        | 'primary',
      classeTexte: plein ? 'text-error' : c.etat === 'alerte' ? 'text-warning' : '',
    }
  })
)
</script>
