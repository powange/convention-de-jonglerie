<template>
  <UCard variant="outline">
    <div class="space-y-4">
      <!-- Header: artist name + rating -->
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {{ application.showTitle }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <UIcon name="i-heroicons-user" class="size-4 shrink-0" />
            {{ application.artistName }}
            <UBadge v-if="application.showCategory" variant="subtle" size="xs" class="ml-1">
              {{ application.showCategory }}
            </UBadge>
          </p>
        </div>

        <!-- Vote or results -->
        <div class="shrink-0 text-right">
          <template v-if="surveyOpen">
            <p class="text-xs text-gray-500 mb-1">{{ t('survey.your_vote') }}</p>
            <SurveyStarRating
              :model-value="score"
              @update:model-value="emit('vote', { applicationId: application.id, score: $event })"
            />
          </template>
          <template v-else-if="result">
            <div class="text-center">
              <p class="text-xs text-gray-500 mb-1">{{ t('survey.avg_score') }}</p>
              <p class="text-2xl font-bold text-yellow-500">
                {{ result.avgScore != null ? result.avgScore.toFixed(1) : '—' }}
              </p>
              <p class="text-xs text-gray-500">
                {{ t('survey.votes_count', { count: result.voteCount }) }}
              </p>
            </div>
          </template>
        </div>
      </div>

      <!-- Show details -->
      <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div class="flex items-center gap-3 flex-wrap">
          <span v-if="application.showDuration" class="flex items-center gap-1">
            <UIcon name="i-heroicons-clock" class="size-4" />
            {{ t('survey.duration_minutes', { duration: application.showDuration }) }}
          </span>
          <span v-if="application.additionalPerformersCount > 0" class="flex items-center gap-1">
            <UIcon name="i-heroicons-users" class="size-4" />
            {{ t('survey.performers_count', { count: application.additionalPerformersCount }) }}
          </span>
        </div>

        <!-- Artist bio + show description : markdown rendu (rehype-sanitize + rehypeExternalLinks) -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-if="application.artistBio"
          class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
          v-html="artistBioHtml"
        />

        <details v-if="application.showDescription" class="group">
          <summary
            class="cursor-pointer text-primary-500 hover:text-primary-600 font-medium text-xs"
          >
            {{ t('survey.show_info') }}
          </summary>
          <div
            class="mt-2 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
            v-html="showDescriptionHtml"
          />
        </details>
      </div>

      <!-- Links -->
      <div
        v-if="application.portfolioUrl || application.videoUrl || application.socialLinks"
        class="flex items-center gap-3 flex-wrap"
      >
        <a
          v-if="application.portfolioUrl"
          :href="application.portfolioUrl"
          target="_blank"
          rel="noopener"
          class="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1"
        >
          <UIcon name="i-heroicons-globe-alt" class="size-4" />
          {{ t('survey.portfolio') }}
        </a>
        <a
          v-if="application.videoUrl"
          :href="application.videoUrl"
          target="_blank"
          rel="noopener"
          class="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1"
        >
          <UIcon name="i-heroicons-play-circle" class="size-4" />
          {{ t('survey.video') }}
        </a>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { markdownToHtml } from '~/utils/markdown'

interface SurveyApplication {
  id: number
  artistName: string
  artistBio: string | null
  portfolioUrl: string | null
  videoUrl: string | null
  socialLinks: string | null
  showTitle: string
  showDescription: string
  showDuration: number
  showCategory: string | null
  additionalPerformersCount: number
}

interface SurveyResult {
  applicationId: number
  avgScore: number | null
  voteCount: number
}

const props = defineProps<{
  application: SurveyApplication
  score: number | null
  surveyOpen: boolean
  result: SurveyResult | null
}>()

const emit = defineEmits<{
  (e: 'vote', payload: { applicationId: number; score: number }): void
}>()

const { t } = useI18n()

// Champs UGC rendus en HTML (markdown + liens cliquables target=_blank rel=noopener)
const artistBioHtml = ref('')
const showDescriptionHtml = ref('')

watch(
  () => props.application.artistBio,
  async (text) => {
    artistBioHtml.value = text ? await markdownToHtml(text) : ''
  },
  { immediate: true }
)
watch(
  () => props.application.showDescription,
  async (text) => {
    showDescriptionHtml.value = text ? await markdownToHtml(text) : ''
  },
  { immediate: true }
)
</script>
