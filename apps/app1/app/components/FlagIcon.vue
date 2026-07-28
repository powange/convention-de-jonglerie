<template>
  <UIcon v-if="iconName" :name="iconName" class="flag-icon" :title="normalized" role="img" />
  <span v-else class="flag-icon" :title="props.code || ''" />
</template>

<script setup lang="ts">
const props = defineProps<{
  code: string | null | undefined
}>()

// Normalise : garde les deux premières lettres, en minuscules
const normalized = computed(() => (props.code ? props.code.slice(0, 2).toLowerCase() : ''))

/**
 * Drapeaux servis par la collection Iconify `flag`, comme le reste des icônes du site, plutôt
 * que par la feuille globale de flag-icons.
 *
 * Celle-ci embarquait les ~250 pays du monde dans entry.css — 77 ko compressés, soit 69 % de la
 * feuille principale, téléchargés par chaque visiteur même s'il ne voyait aucun drapeau. Ici,
 * seuls les drapeaux réellement affichés produisent du CSS, à quelques centaines d'octets pièce.
 *
 * Le suffixe `4x3` conserve les proportions de flag-icons, et Nuxt Icon rend les icônes
 * multicolores en `background-image` (et non en masque monochrome) : les drapeaux gardent
 * leurs couleurs.
 */
const iconName = computed(() => (normalized.value ? `i-flag:${normalized.value}-4x3` : ''))
</script>

<style scoped>
.flag-icon {
  width: 1.1rem;
  height: 0.8rem;
  display: inline-block;
  border-radius: 2px;
}
</style>
