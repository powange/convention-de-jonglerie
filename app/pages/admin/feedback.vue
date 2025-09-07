<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">{{
              $t('admin.feedback.title')
            }}</span>
          </div>
        </li>
      </ol>
    </nav>

    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="text-green-600" />
        {{ t('admin.feedback.title') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ t('admin.feedback.description') }}
      </p>
    </div>

    <!-- Statistiques -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <UIcon
              name="i-heroicons-chat-bubble-left-ellipsis"
              class="h-6 w-6 text-blue-600 dark:text-blue-400"
            />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ stats?.total || 0 }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('admin.feedback.stats.total') }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <UIcon name="i-heroicons-clock" class="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ stats?.byStatus?.pending || 0 }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('admin.feedback.stats.pending') }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <UIcon
              name="i-heroicons-check-circle"
              class="h-6 w-6 text-green-600 dark:text-green-400"
            />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ stats?.byStatus?.resolved || 0 }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('admin.feedback.stats.resolved') }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <div class="flex items-center">
          <div class="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
            <UIcon name="i-heroicons-bug-ant" class="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ stats?.byType?.BUG || 0 }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('admin.feedback.stats.bugs') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtres -->
    <UCard class="mb-6">
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1">
          <UInput
            v-model="filters.search"
            icon="i-heroicons-magnifying-glass-20-solid"
            :placeholder="t('admin.feedback.search')"
            @input="debouncedSearch"
          />
        </div>
        <USelect
          v-model="filters.type"
          :options="typeOptions"
          :placeholder="t('admin.feedback.filter.type')"
          @change="fetchFeedbacks"
        />
        <USelect
          v-model="filters.resolved"
          :options="statusOptions"
          :placeholder="t('admin.feedback.filter.status')"
          @change="fetchFeedbacks"
        />
      </div>
    </UCard>

    <!-- Liste des feedbacks -->
    <UCard>
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        <div v-if="loading" class="p-8 text-center">
          <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p class="text-gray-500 mt-2">{{ t('common.loading') }}</p>
        </div>

        <div v-else-if="feedbacks.length === 0" class="p-8 text-center">
          <UIcon name="i-heroicons-inbox" class="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p class="text-gray-500">{{ t('admin.feedback.empty') }}</p>
        </div>

        <div v-else>
          <div
            v-for="feedback in feedbacks"
            :key="feedback.id"
            class="p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <UBadge
                    :color="getTypeColor(feedback.type)"
                    :label="t(`admin.feedback.types.${feedback.type.toLowerCase()}`)"
                  />
                  <UBadge
                    :color="feedback.resolved ? 'green' : 'yellow'"
                    :label="
                      feedback.resolved ? t('admin.feedback.resolved') : t('admin.feedback.pending')
                    "
                  />
                </div>

                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {{ feedback.subject }}
                </h3>

                <p class="text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                  {{ feedback.message }}
                </p>

                <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <div class="flex items-center gap-1">
                    <UIcon name="i-heroicons-user" class="h-4 w-4" />
                    <span v-if="feedback.user">
                      {{ feedback.user.pseudo }} ({{ feedback.user.email }})
                    </span>
                    <span v-else> {{ feedback.name }} ({{ feedback.email }}) </span>
                  </div>
                  <div class="flex items-center gap-1">
                    <UIcon name="i-heroicons-calendar" class="h-4 w-4" />
                    <time>{{ formatDate(feedback.createdAt) }}</time>
                  </div>
                  <div v-if="feedback.url" class="flex items-center gap-1">
                    <UIcon name="i-heroicons-link" class="h-4 w-4" />
                    <a
                      :href="feedback.url"
                      target="_blank"
                      class="hover:underline truncate max-w-xs"
                    >
                      {{ feedback.url }}
                    </a>
                  </div>
                </div>

                <div
                  v-if="feedback.adminNotes"
                  class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mt-3"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon
                      name="i-heroicons-user-circle"
                      class="h-4 w-4 text-blue-600 dark:text-blue-400"
                    />
                    <span class="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {{ t('admin.feedback.admin_notes') }}
                    </span>
                  </div>
                  <p class="text-sm text-blue-700 dark:text-blue-300">
                    {{ feedback.adminNotes }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 ml-4">
                <UButton
                  v-if="!feedback.resolved"
                  color="green"
                  variant="soft"
                  size="sm"
                  @click="openResolveModal(feedback)"
                >
                  {{ t('admin.feedback.resolve') }}
                </UButton>
                <UButton
                  v-else
                  color="neutral"
                  variant="soft"
                  size="sm"
                  @click="openResolveModal(feedback)"
                >
                  {{ t('admin.feedback.unresolve') }}
                </UButton>
                <UButton
                  color="secondary"
                  variant="soft"
                  size="sm"
                  @click="openDetailsModal(feedback)"
                >
                  {{ t('admin.feedback.view') }}
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.pages > 1" class="flex justify-center mt-6">
        <UPagination
          v-model="pagination.page"
          :page-count="pagination.limit"
          :total="pagination.total"
          @update:model-value="fetchFeedbacks"
        />
      </div>
    </UCard>

    <!-- Modal de résolution -->
    <UModal
      v-model:open="resolveModal.isOpen"
      :title="
        resolveModal.feedback?.resolved
          ? t('admin.feedback.unresolve')
          : t('admin.feedback.resolve')
      "
    >
      <template #content>
        <UCard>
          <div class="space-y-4 p-4">
            <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 class="font-medium mb-2">{{ resolveModal.feedback?.subject }}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ resolveModal.feedback?.message }}
              </p>
            </div>

            <UFormField :label="t('admin.feedback.admin_notes')">
              <UTextarea
                v-model="resolveModal.adminNotes"
                :placeholder="t('admin.feedback.admin_notes_placeholder')"
                :rows="4"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <UButton color="neutral" variant="outline" @click="resolveModal.isOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton :loading="resolveModal.loading" @click="resolveFeedback">
                {{
                  resolveModal.feedback?.resolved
                    ? t('admin.feedback.mark_unresolved')
                    : t('admin.feedback.mark_resolved')
                }}
              </UButton>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Modal de détails -->
    <UModal v-model:open="detailsModal.isOpen" :title="t('admin.feedback.details')" size="lg">
      <template #content>
        <UCard>
          <div v-if="detailsModal.feedback" class="space-y-6 p-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('admin.feedback.type.label') }}
                </label>
                <UBadge
                  :color="getTypeColor(detailsModal.feedback.type)"
                  :label="t(`admin.feedback.types.${detailsModal.feedback.type.toLowerCase()}`)"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('admin.feedback.status') }}
                </label>
                <UBadge
                  :color="detailsModal.feedback.resolved ? 'green' : 'yellow'"
                  :label="
                    detailsModal.feedback.resolved
                      ? t('admin.feedback.resolved')
                      : t('admin.feedback.pending')
                  "
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('admin.feedback.subject.label') }}
              </label>
              <p class="text-gray-900 dark:text-white">{{ detailsModal.feedback.subject }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('admin.feedback.message.label') }}
              </label>
              <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p class="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {{ detailsModal.feedback.message }}
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('admin.feedback.user') }}
                </label>
                <p class="text-gray-900 dark:text-white">
                  <span v-if="detailsModal.feedback.user">
                    {{ detailsModal.feedback.user.pseudo }} ({{ detailsModal.feedback.user.email }})
                  </span>
                  <span v-else>
                    {{ detailsModal.feedback.name }} ({{ detailsModal.feedback.email }})
                  </span>
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('admin.feedback.created_at') }}
                </label>
                <p class="text-gray-900 dark:text-white">
                  {{ formatDate(detailsModal.feedback.createdAt) }}
                </p>
              </div>
            </div>

            <div v-if="detailsModal.feedback.url">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('admin.feedback.url') }}
              </label>
              <a
                :href="detailsModal.feedback.url"
                target="_blank"
                class="text-blue-600 hover:underline break-all"
              >
                {{ detailsModal.feedback.url }}
              </a>
            </div>

            <div v-if="detailsModal.feedback.userAgent">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('admin.feedback.user_agent') }}
              </label>
              <p class="text-sm text-gray-600 dark:text-gray-400 break-all">
                {{ detailsModal.feedback.userAgent }}
              </p>
            </div>

            <div v-if="detailsModal.feedback.adminNotes">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('admin.feedback.admin_notes') }}
              </label>
              <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p class="text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                  {{ detailsModal.feedback.adminNotes }}
                </p>
              </div>
            </div>

            <div class="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <UButton color="neutral" variant="outline" @click="detailsModal.isOpen = false">
                {{ t('common.close') }}
              </UButton>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['super-admin'],
})

const { t } = useI18n()
const toast = useToast()

// État
const loading = ref(false)
const feedbacks = ref([])
const stats = ref(null)
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
})

// Filtres
const filters = reactive({
  search: '',
  type: '',
  resolved: '',
})

// Options pour les filtres
const typeOptions = computed(() => [
  { value: '', label: t('admin.feedback.filter.all_types') },
  { value: 'BUG', label: t('admin.feedback.types.bug') },
  { value: 'SUGGESTION', label: t('admin.feedback.types.suggestion') },
  { value: 'GENERAL', label: t('admin.feedback.types.general') },
  { value: 'COMPLAINT', label: t('admin.feedback.types.complaint') },
])

const statusOptions = computed(() => [
  { value: '', label: t('admin.feedback.filter.all_status') },
  { value: 'false', label: t('admin.feedback.pending') },
  { value: 'true', label: t('admin.feedback.resolved') },
])

// Modals
const resolveModal = reactive({
  isOpen: false,
  feedback: null,
  adminNotes: '',
  loading: false,
})

const detailsModal = reactive({
  isOpen: false,
  feedback: null,
})

// Fonctions
async function fetchFeedbacks() {
  loading.value = true
  try {
    const query = new URLSearchParams({
      page: pagination.value.page.toString(),
      limit: pagination.value.limit.toString(),
    })

    if (filters.search) query.append('search', filters.search)
    if (filters.type) query.append('type', filters.type)
    if (filters.resolved) query.append('resolved', filters.resolved)

    const response = await $fetch(`/api/admin/feedback?${query.toString()}`)

    feedbacks.value = response.feedbacks
    pagination.value = response.pagination
    stats.value = response.stats
  } catch (error) {
    console.error('Erreur lors du chargement des feedbacks:', error)
    toast.add({
      title: t('admin.feedback.error.load'),
      color: 'red',
    })
  } finally {
    loading.value = false
  }
}

// Fonction de debounce simple
let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.value.page = 1
    fetchFeedbacks()
  }, 300)
}

function openResolveModal(feedback: any) {
  resolveModal.feedback = feedback
  resolveModal.adminNotes = feedback.adminNotes || ''
  resolveModal.isOpen = true
}

function openDetailsModal(feedback: any) {
  detailsModal.feedback = feedback
  detailsModal.isOpen = true
}

async function resolveFeedback() {
  if (resolveModal.loading || !resolveModal.feedback) return

  resolveModal.loading = true
  try {
    await $fetch(`/api/admin/feedback/${resolveModal.feedback.id}/resolve`, {
      method: 'PUT',
      body: {
        resolved: !resolveModal.feedback.resolved,
        adminNotes: resolveModal.adminNotes,
      },
    })

    toast.add({
      title: resolveModal.feedback.resolved
        ? t('admin.feedback.success.unresolve')
        : t('admin.feedback.success.resolve'),
      color: 'green',
    })

    resolveModal.isOpen = false
    await fetchFeedbacks()
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error)
    toast.add({
      title: t('admin.feedback.error.resolve'),
      color: 'red',
    })
  } finally {
    resolveModal.loading = false
  }
}

function getTypeColor(type: string) {
  const colors = {
    BUG: 'red',
    SUGGESTION: 'blue',
    GENERAL: 'gray',
    COMPLAINT: 'orange',
  }
  return colors[type] || 'gray'
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Charger les données au montage
onMounted(() => {
  fetchFeedbacks()
})
</script>
