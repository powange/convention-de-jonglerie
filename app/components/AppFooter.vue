<template>
  <footer class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mt-auto">
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
        <!-- Copyright -->
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('footer.copyright', { year: new Date().getFullYear() }) }}
        </div>

        <!-- Liens footer -->
        <div class="flex items-center gap-4 text-sm">
          <NuxtLink
            to="/privacy-policy"
            class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            {{ t('footer.privacy') }}
          </NuxtLink>
          <UButton variant="ghost" color="neutral" size="sm" @click="openFeedbackModal">
            {{ t('footer.feedback') }}
          </UButton>
          <NuxtLink
            to="https://www.facebook.com/profile.php?id=61582110660179"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
            :title="t('footer.facebook')"
          >
            <UIcon name="i-simple-icons-facebook" class="w-5 h-5" />
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Modal de feedback -->
    <FeedbackModal v-model:open="showFeedbackModal" />
  </footer>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// Lazy loading du composant FeedbackModal
const FeedbackModal = defineAsyncComponent(() => import('~/components/feedback/FeedbackModal.vue'))

// Composables
const { t } = useI18n()

const showFeedbackModal = ref(false)

function openFeedbackModal() {
  showFeedbackModal.value = true
}
</script>

<style scoped>
/* Import des drapeaux si pas déjà fait */
@import 'flag-icons/css/flag-icons.min.css';
</style>
