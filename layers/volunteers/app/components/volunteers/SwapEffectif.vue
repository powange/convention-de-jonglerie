<template>
  <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
    <p class="mb-2 text-xs font-medium text-gray-500">{{ titre }}</p>

    <p v-if="membres.length === 0" class="text-xs text-gray-400">
      {{ t('volunteers.swap_effectif_vide') }}
    </p>

    <ul v-else class="space-y-2">
      <li v-for="membre in membres" :key="membre.id" class="space-y-1">
        <span class="flex flex-wrap items-center gap-2">
          <UiUserDisplay :user="membre" size="xs" />
          <UBadge v-if="membre.arrivant" color="success" variant="subtle" size="xs">
            {{ t('volunteers.swap_effectif_arrivant') }}
          </UBadge>
        </span>

        <!--
          Mention libre de la candidature, affichée telle quelle. Elle n'est jamais rapprochée
          d'un pseudo : « éviter Marie », « pas avec l'équipe bar » ou « personne » ne se
          comparent pas à un compte. Un rapprochement automatique produirait des faux positifs
          et, plus grave, des silences rassurants. C'est à l'organisateur de juger.
        -->
        <p
          v-if="membre.avoidList"
          class="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400"
        >
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3 shrink-0" />
          <span>
            <span class="font-medium">{{ t('volunteers.swap_effectif_eviter') }}</span>
            {{ membre.avoidList }}
          </span>
        </p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  titre: string
  membres: {
    id: number
    pseudo: string
    profilePicture?: string | null
    avoidList?: string | null
    arrivant?: boolean
  }[]
}>()

const { t } = useI18n()
</script>
