<template>
  <UCard variant="soft" :ui="ouverte ? undefined : { body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <!-- Sur mobile, l'en-tête devient la commande de repli ; ailleurs il reste un titre,
             sans effet de survol qui laisserait croire qu'on peut cliquer dessus. -->
        <UButton
          v-if="repliableIci"
          variant="ghost"
          color="neutral"
          class="group flex-1 justify-between p-0 hover:bg-transparent min-w-0"
          :ui="{
            trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
          }"
          trailing-icon="i-heroicons-chevron-down"
          :data-state="deplie ? 'open' : 'closed'"
          :aria-expanded="deplie"
          @click="deplie = !deplie"
        >
          <span class="text-lg font-semibold flex items-center gap-2 min-w-0">
            <UIcon :name="icone" :class="classeIcone" />
            <span class="truncate">{{ titre }}</span>
          </span>
        </UButton>

        <h3 v-else class="text-lg font-semibold flex items-center gap-2 min-w-0">
          <UIcon :name="icone" :class="classeIcone" />
          <span class="truncate">{{ titre }}</span>
        </h3>

        <slot name="actions" />
      </div>
    </template>

    <!-- `v-show` plutôt qu'un démontage : les cartes chargent leurs données au montage, et les
         redemander à chaque dépliage rendrait le repli coûteux au lieu de le rendre pratique. -->
    <div v-show="ouverte">
      <slot />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const props = withDefaults(
  defineProps<{
    titre: string
    icone: string
    classeIcone?: string
    /** Repli proposé sur les petits écrans seulement. Ailleurs, la carte reste entière. */
    repliableSurMobile?: boolean
    /** La carte qui compte le plus pour le bénévole s'ouvre d'emblée. */
    deplieParDefaut?: boolean
  }>(),
  {
    classeIcone: 'text-primary-500',
    repliableSurMobile: false,
    deplieParDefaut: false,
  }
)

// Même seuil que le `sm:` de Tailwind : la frontière est celle du CSS, pas une taille mesurée.
const estBureau = useMediaQuery('(min-width: 640px)')

const deplie = ref(props.deplieParDefaut)

const repliableIci = computed(() => props.repliableSurMobile && !estBureau.value)
const ouverte = computed(() => !repliableIci.value || deplie.value)
</script>
