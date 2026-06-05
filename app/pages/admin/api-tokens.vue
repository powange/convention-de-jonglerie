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
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
              {{ $t('admin.api_tokens.title') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <UIcon name="i-heroicons-key" class="text-indigo-600" />
          {{ $t('admin.api_tokens.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ $t('admin.api_tokens.description') }}
        </p>
      </div>
      <UButton color="primary" icon="i-heroicons-plus" @click="openCreateModal">
        {{ $t('admin.api_tokens.create') }}
      </UButton>
    </div>

    <!-- Documentation de l'endpoint -->
    <UCard class="mb-6">
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-information-circle" class="h-5 w-5 text-blue-500 mt-0.5" />
        <div class="text-sm">
          <p class="font-medium mb-1">{{ $t('admin.api_tokens.endpoint_label') }}</p>
          <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs break-all">
            GET {{ baseUrl }}/api/public/editions?token=&lt;token&gt;
          </code>
          <p class="text-gray-500 mt-2">
            {{ $t('admin.api_tokens.endpoint_hint') }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Chargement -->
    <div v-if="pending" class="text-center py-12">
      <UIcon
        name="i-heroicons-arrow-path"
        class="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400"
      />
      <p class="text-gray-500">{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <UIcon name="i-heroicons-exclamation-triangle" class="h-12 w-12 mx-auto mb-4 text-red-400" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('common.error') }}
      </h3>
      <UButton class="mt-4" color="primary" variant="outline" @click="refresh()">
        {{ $t('common.retry') }}
      </UButton>
    </div>

    <!-- État vide -->
    <UCard v-else-if="tokens.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-key" class="h-12 w-12 mx-auto mb-4 text-gray-300" />
      <p class="text-gray-500">{{ $t('admin.api_tokens.empty') }}</p>
    </UCard>

    <!-- Liste des tokens -->
    <div v-else class="space-y-4">
      <UCard v-for="token in tokens" :key="token.id">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-lg font-semibold truncate">{{ token.name }}</h3>
              <UBadge :color="token.isActive ? 'success' : 'neutral'" variant="soft" size="sm">
                {{
                  token.isActive ? $t('admin.api_tokens.active') : $t('admin.api_tokens.revoked')
                }}
              </UBadge>
            </div>

            <div class="flex items-center gap-2 mb-2">
              <code
                class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs break-all font-mono"
              >
                {{ token.token }}
              </code>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-heroicons-clipboard-document"
                :aria-label="$t('admin.api_tokens.copy')"
                @click="copyToken(token.token)"
              />
            </div>

            <div class="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500">
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-calendar-days" class="h-4 w-4" />
                {{ $t('admin.api_tokens.created_at') }}: {{ formatDate(token.createdAt) }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-clock" class="h-4 w-4" />
                {{ $t('admin.api_tokens.last_used') }}:
                {{ token.lastUsedAt ? formatDate(token.lastUsedAt) : $t('admin.api_tokens.never') }}
              </span>
              <span v-if="token.createdBy" class="flex items-center gap-1">
                <UIcon name="i-heroicons-user" class="h-4 w-4" />
                {{ token.createdBy.pseudo }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UButton
              :color="token.isActive ? 'warning' : 'success'"
              variant="soft"
              size="sm"
              :loading="isToggling(token.id)"
              @click="toggleToken(token.id)"
            >
              {{
                token.isActive ? $t('admin.api_tokens.revoke') : $t('admin.api_tokens.reactivate')
              }}
            </UButton>
            <UButton
              color="error"
              variant="soft"
              size="sm"
              icon="i-heroicons-trash"
              :loading="isDeleting(token.id)"
              :aria-label="$t('common.delete')"
              @click="confirmDelete(token)"
            />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Modal de création -->
    <UModal v-model:open="showCreateModal">
      <template #header>
        <h3 class="text-lg font-semibold">{{ $t('admin.api_tokens.create') }}</h3>
      </template>
      <template #body>
        <UFormField :label="$t('admin.api_tokens.name')" required>
          <UInput
            v-model="createForm.name"
            size="lg"
            class="w-full"
            :placeholder="$t('admin.api_tokens.name_placeholder')"
            @keyup.enter="submitCreate"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="showCreateModal = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :loading="creating"
            :disabled="!createForm.name.trim()"
            @click="submitCreate"
          >
            {{ $t('common.create') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

interface ApiTokenItem {
  id: number
  name: string
  token: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
  createdBy: { id: number; pseudo: string } | null
}

const { t } = useI18n()
const toast = useToast()
const { copy } = useClipboard()

const baseUrl = computed(() => (import.meta.client ? window.location.origin : ''))

// Liste des tokens
const { data, pending, error, refresh } = await useFetch<{ tokens: ApiTokenItem[] }>(
  '/api/admin/api-tokens'
)
const tokens = computed(() => data.value?.tokens ?? [])

// Création
const showCreateModal = ref(false)
const createForm = reactive({ name: '' })

const openCreateModal = () => {
  createForm.name = ''
  showCreateModal.value = true
}

const { execute: doCreate, loading: creating } = useApiAction('/api/admin/api-tokens', {
  method: 'POST',
  body: () => ({ name: createForm.name.trim() }),
  successMessage: { title: t('admin.api_tokens.created') },
  errorMessages: { default: t('admin.api_tokens.create_error') },
  onSuccess: async () => {
    showCreateModal.value = false
    await refresh()
  },
})

const submitCreate = () => {
  if (!createForm.name.trim()) return
  doCreate()
}

// Activation / révocation
const { execute: doToggle, isLoading: isToggling } = useApiActionById(
  (id) => `/api/admin/api-tokens/${id}`,
  {
    method: 'PATCH',
    body: (id) => ({ isActive: !tokens.value.find((tk) => tk.id === id)?.isActive }),
    silentSuccess: true,
    errorMessages: { default: t('admin.api_tokens.toggle_error') },
    onSuccess: async () => {
      await refresh()
    },
  }
)
const toggleToken = (id: number) => doToggle(id)

// Suppression
const { execute: doDelete, isLoading: isDeleting } = useApiActionById(
  (id) => `/api/admin/api-tokens/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('admin.api_tokens.deleted') },
    errorMessages: { default: t('admin.api_tokens.delete_error') },
    onSuccess: async () => {
      await refresh()
    },
  }
)

const confirmDelete = (token: ApiTokenItem) => {
  if (window.confirm(t('admin.api_tokens.delete_confirm', { name: token.name }))) {
    doDelete(token.id)
  }
}

// Copie du token
const copyToken = async (token: string) => {
  await copy(token)
  toast.add({
    title: t('admin.api_tokens.copied'),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })
}

const formatDate = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

useSeoMeta({
  title: t('admin.api_tokens.title'),
  description: t('admin.api_tokens.description'),
})
</script>
