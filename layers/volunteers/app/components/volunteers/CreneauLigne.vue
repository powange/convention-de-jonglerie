<template>
  <span class="block min-w-0">
    <span class="flex flex-wrap items-center gap-2">
      <!-- L'équipe en premier, et colorée comme dans le planning : c'est elle qui situe le
           créneau, un même intitulé pouvant exister dans plusieurs équipes. -->
      <UBadge
        v-if="creneau.team"
        :style="creneau.team.color ? { backgroundColor: creneau.team.color } : undefined"
        :color="creneau.team.color ? undefined : 'neutral'"
        variant="solid"
        size="xs"
      >
        {{ creneau.team.name }}
      </UBadge>
      <span class="font-medium">{{ creneau.title || t('volunteers.swap_slot_untitled') }}</span>
    </span>
    <span class="block text-sm text-gray-600 dark:text-gray-400">{{ horaire(creneau) }}</span>
  </span>
</template>

<script setup lang="ts">
import type { CreneauLisible } from '../../composables/useCreneauLisible'

const props = defineProps<{
  creneau: CreneauLisible
  /** Fuseau de l'édition : un créneau s'annonce à l'heure du LIEU. */
  fuseau?: string | null
}>()

const { t } = useI18n()
// Un getter, et non la valeur : l'édition arrive parfois après le premier rendu.
const { horaire } = useCreneauLisible(() => props.fuseau)
</script>
