<template>
  <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
    <UiUserDisplay :user="personne" size="xs" />

    <!-- Deux lignes étiquetées plutôt qu'une flèche : « cède » et « reçoit » se lisent sans
         convention à deviner, et disent d'où part la personne autant que là où elle va.
         La carte est celle du planning : un créneau se reconnaît à sa forme, ici comme ailleurs. -->
    <dl class="mt-2 space-y-2 text-sm">
      <div>
        <dt class="mb-1 font-medium text-gray-500">{{ t('volunteers.swap_gives') }}</dt>
        <dd><VolunteersTimeSlotCard :time-slot="cede" :fuseau="fuseau" show-duration /></dd>
      </div>
      <div>
        <dt class="mb-1 font-medium text-emerald-700 dark:text-emerald-400">
          {{ t('volunteers.swap_receives') }}
        </dt>
        <dd><VolunteersTimeSlotCard :time-slot="recoit" :fuseau="fuseau" show-duration /></dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import type { CreneauLisible } from '../../composables/useCreneauLisible'

defineProps<{
  personne: { id: number; pseudo: string; profilePicture?: string | null }
  cede: CreneauLisible
  recoit: CreneauLisible
  /** Fuseau de l'édition : un créneau s'annonce à l'heure du LIEU. */
  fuseau?: string | null
}>()

const { t } = useI18n()
</script>
