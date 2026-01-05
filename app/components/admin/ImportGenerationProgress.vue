<template>
  <div class="space-y-1">
    <!-- Liste unifiée : historique + étape en cours -->
    <template v-for="(entry, idx) in stepHistory" :key="idx">
      <div
        class="flex items-center gap-2 text-sm"
        :class="
          isCurrentStep(idx)
            ? 'text-gray-700 dark:text-gray-200'
            : 'text-gray-500 dark:text-gray-400'
        "
      >
        <!-- Icône : spinner pour l'étape en cours, check pour les autres -->
        <UIcon v-if="isCurrentStep(idx)" :name="currentStepIcon" :class="currentStepIconClass" />
        <UIcon
          v-else-if="entry.step === 'completed'"
          name="i-heroicons-check-circle"
          class="text-success-500"
        />
        <UIcon v-else name="i-heroicons-check" class="text-success-500" />
        <!-- Durée depuis le début -->
        <span class="text-gray-400 font-mono text-xs w-14">
          {{ isCurrentStep(idx) ? formatMs(currentElapsedTime) : formatDuration(entry, idx) }}
        </span>
        <!-- Label -->
        <span>{{ entry.label }}</span>
      </div>
      <!-- Sous-étapes (URLs récupérées) -->
      <div
        v-for="(subStep, subIdx) in entry.subSteps || []"
        :key="`${idx}-${subIdx}`"
        class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 ml-6"
      >
        <UIcon name="i-heroicons-arrow-right-circle" class="text-gray-400" />
        <span class="font-mono w-14">{{ formatSubStep(entry, subStep, subIdx) }}</span>
        <span>{{ getHostname(subStep.url) }}</span>
      </div>
    </template>

    <!-- Barre de progression pour l'exploration (agent uniquement) -->
    <div v-if="method === 'agent' && agentProgress > 0" class="mt-2">
      <UProgress :value="agentProgress" size="sm" color="warning" />
      <p class="text-xs text-gray-500 mt-1">
        {{ $t('admin.import.agent_exploring', { count: agentPagesVisited }) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StepHistoryEntry, SubStepEntry } from '~/composables/useElapsedTimer'

defineProps<{
  /** Historique des étapes */
  stepHistory: StepHistoryEntry[]
  /** Méthode de génération */
  method: 'simple' | 'agent'
  /** Progression de l'agent (0-100) */
  agentProgress: number
  /** Nombre de pages visitées par l'agent */
  agentPagesVisited: number
  /** Temps écoulé en ms */
  currentElapsedTime: number
  /** Icône de l'étape en cours */
  currentStepIcon: string
  /** Classe CSS de l'icône */
  currentStepIconClass: string
  /** Fonction pour vérifier si c'est l'étape en cours */
  isCurrentStep: (idx: number) => boolean
  /** Fonction pour formater le temps en ms */
  formatMs: (ms: number) => string
  /** Fonction pour formater la durée d'une étape */
  formatDuration: (entry: StepHistoryEntry, idx: number) => string
  /** Fonction pour formater la durée d'une sous-étape */
  formatSubStep: (parent: StepHistoryEntry, subStep: SubStepEntry, subIdx: number) => string
  /** Fonction pour extraire le hostname d'une URL */
  getHostname: (url: string) => string
}>()
</script>
