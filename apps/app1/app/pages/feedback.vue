<template>
  <div>
    <!-- En-tête de page -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-chat-bubble-left-right" class="text-primary-500" />
        {{ t('feedback.title') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ t('feedback.description') }}
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <!-- Nouveau retour -->
      <UCard>
        <template #header>
          <h2 class="font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-pencil-square" />
            {{ t('feedback.page.new_title') }}
          </h2>
        </template>

        <div v-if="envoye" class="py-8 text-center">
          <div
            class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-6"
          >
            <UIcon
              name="i-heroicons-check-circle"
              class="text-green-600 dark:text-green-400"
              size="32"
            />
          </div>
          <h3 class="text-xl font-semibold mb-3">{{ t('feedback.success.title') }}</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            {{ user ? t('feedback.page.success_tracked') : t('feedback.success.message') }}
          </p>
          <UButton variant="outline" icon="i-heroicons-plus" @click="envoye = false">
            {{ t('feedback.page.new_another') }}
          </UButton>
        </div>

        <FeedbackForm v-else :initial-url="pageConcernee" @submitted="onSubmitted" />
      </UCard>

      <!-- Suivi des retours -->
      <UCard>
        <template #header>
          <h2 class="font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-inbox-stack" />
            {{ t('feedback.page.tracking_title') }}
          </h2>
        </template>

        <!-- Visiteur : le suivi suppose un compte pour rattacher les retours -->
        <UAlert
          v-if="!user"
          icon="i-heroicons-information-circle"
          color="neutral"
          variant="subtle"
          :title="t('feedback.page.tracking_signin_title')"
          :description="t('feedback.page.tracking_signin_description')"
        />

        <div v-else-if="status === 'pending'" class="space-y-3">
          <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
        </div>

        <UAlert
          v-else-if="error"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="subtle"
          :title="t('feedback.page.tracking_error')"
        />

        <p v-else-if="!retours.length" class="text-gray-500 dark:text-gray-400 text-sm py-4">
          {{ t('feedback.page.tracking_empty') }}
        </p>

        <div v-else class="space-y-4">
          <div
            v-for="retour in retours"
            :key="retour.id"
            class="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-start justify-between gap-3 mb-2">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ retour.subject }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ t(libelleType(retour.type)) }} · {{ formatDate(retour.createdAt) }}
                </p>
              </div>
              <UBadge :color="couleurStatut(retour.status)" variant="subtle" class="shrink-0">
                {{ t(`feedback.status.${retour.status}`) }}
              </UBadge>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {{ retour.message }}
            </p>

            <!-- Réponse de l'équipe, quand il y en a une -->
            <div
              v-if="retour.adminReply"
              class="mt-3 p-3 rounded-md bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900"
            >
              <p
                class="text-xs font-medium text-primary-700 dark:text-primary-300 mb-1 flex items-center gap-1"
              >
                <UIcon name="i-heroicons-chat-bubble-bottom-center-text" />
                {{ t('feedback.page.team_reply') }}
                <span v-if="retour.repliedAt" class="font-normal text-primary-600/70">
                  · {{ formatDate(retour.repliedAt) }}
                </span>
              </p>
              <p class="text-sm whitespace-pre-line">{{ retour.adminReply }}</p>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
await useLazyI18n('feedback')

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const { formatDate } = useDateFormat()

useSeoMeta({
  title: `${t('feedback.title')} - Convention de Jonglerie`,
  description: t('feedback.description'),
})

const user = computed(() => authStore.user)
const envoye = ref(false)

/**
 * Page depuis laquelle l'utilisateur a cliqué sur « Nous faire un retour ».
 *
 * N'est retenue que si elle appartient au site : le champ finit dans un retour lu par
 * l'équipe, et une URL arbitraire déposée dans la query en ferait un support d'hameçonnage.
 */
const pageConcernee = computed(() => {
  const depuis = route.query.from
  if (typeof depuis !== 'string' || !depuis) return undefined
  if (depuis.startsWith('/')) return depuis
  if (import.meta.client && depuis.startsWith(window.location.origin)) return depuis
  return undefined
})

const {
  data: reponse,
  status,
  error,
  refresh,
} = await useFetch('/api/feedback/mine', {
  immediate: !!authStore.user,
  watch: [() => authStore.user?.id],
})

const retours = computed(() => reponse.value?.data ?? [])

function onSubmitted() {
  envoye.value = true
  // Le retour tout juste envoyé doit apparaître dans le suivi sans recharger la page
  if (user.value) refresh()
}

const libellesType: Record<string, string> = {
  BUG: 'feedback.types.bug',
  SUGGESTION: 'feedback.types.suggestion',
  GENERAL: 'feedback.types.general',
  COMPLAINT: 'feedback.types.complaint',
}

function libelleType(type: string) {
  return libellesType[type] ?? 'feedback.types.general'
}

function couleurStatut(statut: string) {
  switch (statut) {
    case 'RESOLVED':
      return 'success'
    case 'IN_PROGRESS':
      return 'info'
    case 'REJECTED':
      return 'neutral'
    default:
      return 'warning'
  }
}
</script>
