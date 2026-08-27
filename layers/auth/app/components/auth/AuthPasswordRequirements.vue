<template>
  <div v-if="password" class="mt-2 space-y-2">
    <!-- Barre de force : un indice de robustesse, pas un verdict d'acceptation -->
    <div class="flex gap-1">
      <div v-for="i in 4" :key="i" class="h-1 flex-1 rounded" :class="getStrengthBarColor(i)" />
    </div>
    <p class="text-xs" :class="strengthTextColor">{{ strengthText }}</p>

    <!-- Les exigences, cochées au fil de la saisie : ce sont elles qui décident -->
    <ul class="space-y-1">
      <li
        v-for="regle in regles"
        :key="regle.cle"
        class="flex items-center gap-1.5 text-xs"
        :class="
          regle.satisfaite
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-500 dark:text-gray-400'
        "
      >
        <UIcon
          :name="regle.satisfaite ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'"
          class="h-4 w-4 shrink-0"
        />
        {{ regle.libelle }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * Force du mot de passe et liste des exigences, affichées pendant la saisie.
 *
 * La liste existe parce que la seule barre de force induisait en erreur : un mot de passe sans
 * chiffre pouvait s'afficher « fort » en vert, puis se faire refuser à la validation. Les
 * exigences affichées ici sont celles-là mêmes que le serveur applique.
 */
const props = defineProps<{ password: string }>()

const motDePasse = computed(() => props.password)
const { strengthText, strengthTextColor, getStrengthBarColor, regles } =
  usePasswordStrength(motDePasse)
</script>
