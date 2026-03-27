<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <!-- Loading -->
    <div v-if="loading" class="py-16 text-center">
      <p class="text-gray-500">{{ $t('common.loading') }}</p>
    </div>

    <!-- Not found -->
    <div v-else-if="error" class="py-16 text-center">
      <UIcon name="i-heroicons-exclamation-triangle" class="size-16 text-gray-400 mx-auto mb-4" />
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {{ $t('survey.not_found') }}
      </h2>
      <p class="text-gray-500">{{ $t('survey.not_found_description') }}</p>
    </div>

    <!-- Survey content -->
    <div v-else-if="surveyData">
      <!-- Header -->
      <div class="mb-8">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {{
            $t('survey.edition_info', {
              conventionName: surveyData.showCall.edition.convention.name,
              editionName: surveyData.showCall.edition.name,
            })
          }}
        </p>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t('survey.title', { showCallName: surveyData.showCall.name }) }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mb-3">
          {{ $t('survey.subtitle') }}
        </p>
        <UBadge
          :color="surveyData.showCall.surveyOpen ? 'success' : 'warning'"
          variant="soft"
          size="lg"
        >
          {{ surveyData.showCall.surveyOpen ? $t('survey.open_badge') : $t('survey.closed_badge') }}
        </UBadge>
      </div>

      <!-- Closed notice -->
      <UAlert
        v-if="!surveyData.showCall.surveyOpen"
        icon="i-heroicons-information-circle"
        color="warning"
        variant="soft"
        :title="$t('survey.closed_notice')"
        class="mb-6"
      />

      <!-- No applications -->
      <div v-if="surveyData.applications.length === 0" class="py-12 text-center">
        <UIcon name="i-heroicons-inbox" class="size-16 text-gray-400 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ $t('survey.no_applications') }}
        </h3>
        <p class="text-gray-500">{{ $t('survey.no_applications_description') }}</p>
      </div>

      <!-- Applications list -->
      <div v-else class="space-y-4">
        <SurveyApplicationCard
          v-for="app in surveyData.applications"
          :key="app.id"
          :application="app"
          :score="myVotes[app.id] ?? null"
          :survey-open="surveyData.showCall.surveyOpen"
          :result="getResult(app.id)"
          @vote="handleVote"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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

interface SurveyData {
  showCall: {
    id: number
    name: string
    surveyOpen: boolean
    edition: {
      id: number
      name: string
      convention: { id: number; name: string }
    }
  }
  applications: SurveyApplication[]
  myVotes: Record<number, number>
  results: SurveyResult[] | null
}

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const { t } = useI18n()
const toast = useToast()

const token = route.params.token as string

// State
const loading = ref(true)
const error = ref(false)
const surveyData = ref<SurveyData | null>(null)
const myVotes = ref<Record<number, number>>({})
const resultsMap = ref<Map<number, { avgScore: number | null; voteCount: number }>>(new Map())

// SEO
useHead({
  title: computed(() =>
    surveyData.value
      ? t('survey.title', { showCallName: surveyData.value.showCall.name })
      : t('survey.title', { showCallName: '...' })
  ),
})

// Fetch survey data
const fetchSurvey = async () => {
  loading.value = true
  error.value = false
  try {
    const data = await $fetch(`/api/survey/${token}`)
    surveyData.value = data
    myVotes.value = data.myVotes || {}

    // Build results map if survey is closed
    if (data.results) {
      const map = new Map<number, { avgScore: number | null; voteCount: number }>()
      for (const r of data.results) {
        map.set(r.applicationId, { avgScore: r.avgScore, voteCount: r.voteCount })
      }
      resultsMap.value = map
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

const getResult = (applicationId: number) => {
  return resultsMap.value.get(applicationId) ?? null
}

// Handle vote
const handleVote = async (payload: { applicationId: number; score: number }) => {
  // Save previous value for revert
  const previousScore = myVotes.value[payload.applicationId] ?? null

  // Optimistic update
  myVotes.value[payload.applicationId] = payload.score

  try {
    await $fetch(`/api/survey/${token}/vote`, {
      method: 'PUT',
      body: payload,
    })
    toast.add({ title: t('survey.vote_saved'), color: 'success' })
  } catch {
    // Revert to previous value
    if (previousScore !== null) {
      myVotes.value[payload.applicationId] = previousScore
    } else {
      const { [payload.applicationId]: _, ...rest } = myVotes.value
      myVotes.value = rest
    }
    toast.add({ title: t('survey.vote_error'), color: 'error' })
  }
}

// Load on mount
onMounted(() => {
  fetchSurvey()
})
</script>
