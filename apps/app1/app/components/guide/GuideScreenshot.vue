<template>
  <figure class="my-4">
    <img
      :src="src"
      :alt="caption"
      loading="lazy"
      class="w-full rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
    />
    <figcaption class="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
      {{ caption }}
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
// Capture d'écran d'un guide. La légende sert aussi de texte alternatif : elle doit donc
// décrire ce que montre l'image, pas seulement la commenter.
defineProps<{
  src: string
  caption: string
}>()
</script>
