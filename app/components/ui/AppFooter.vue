<template>
  <footer class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mt-auto">
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
        <!-- Copyright -->
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('footer.copyright', { year: new Date().getFullYear() }) }}
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
// Le footer ne contient plus que le copyright
</script>

<style scoped>
/* Import des drapeaux si pas déjà fait */
@import 'flag-icons/css/flag-icons.min.css';
</style>