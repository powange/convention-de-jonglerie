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
              {{ $t('admin.backup_management') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-archive-box" class="text-orange-600" />
        {{ $t('admin.backup_management') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ $t('admin.backup_management_description') }}
      </p>
    </div>

    <!-- Actions de sauvegarde -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- Créer une sauvegarde -->
      <UCard>
        <div class="flex items-start gap-4">
          <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <UIcon
              name="i-heroicons-arrow-down-tray"
              class="h-6 w-6 text-green-600 dark:text-green-400"
            />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-lg mb-2">{{ $t('admin.backup_create') }}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
              {{ $t('admin.backup_create_description') }}
            </p>
            <UButton color="success" :loading="creating" :disabled="creating" @click="createBackup">
              <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" />
              {{ creating ? $t('admin.backup_creating') : $t('admin.backup_create_button') }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Importer une sauvegarde -->
      <UCard>
        <div class="flex items-start gap-4">
          <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <UIcon
              name="i-heroicons-arrow-up-tray"
              class="h-6 w-6 text-blue-600 dark:text-blue-400"
            />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-lg mb-2">{{ $t('admin.backup_restore') }}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
              {{ $t('admin.backup_restore_description') }}
            </p>
            <input
              ref="fileInput"
              type="file"
              accept=".sql,.tar.gz"
              class="hidden"
              @change="handleFileUpload"
            />
            <UButton
              color="info"
              :loading="restoring"
              :disabled="restoring"
              @click="openFileDialog"
            >
              <UIcon name="i-heroicons-arrow-up-tray" class="h-4 w-4" />
              {{ restoring ? $t('admin.backup_restoring') : $t('admin.backup_restore_button') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Liste des sauvegardes -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">{{ $t('admin.backup_list') }}</h2>
          <UButton variant="outline" size="sm" :loading="loadingBackups" @click="loadBackups">
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" />
            {{ $t('common.refresh') }}
          </UButton>
        </div>
      </template>

      <div v-if="loadingBackups" class="text-center py-6">
        <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin mx-auto mb-2" />
        <p class="text-gray-500">{{ $t('admin.backup_loading') }}</p>
      </div>

      <div v-else-if="backups.length === 0" class="text-center py-6">
        <UIcon name="i-heroicons-archive-box-x-mark" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p class="text-gray-500">{{ $t('admin.backup_empty') }}</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="backup in backups"
          :key="backup.filename"
          class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <div class="flex items-center gap-4">
            <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <UIcon
                name="i-heroicons-document-text"
                class="h-5 w-5 text-gray-600 dark:text-gray-400"
              />
            </div>
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h4 class="font-medium">{{ backup.filename }}</h4>
                <UBadge v-if="backup.type === 'archive'" color="success" variant="subtle" size="sm">
                  <UIcon name="i-heroicons-photo" class="h-3 w-3" />
                  Avec images
                </UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="sm">
                  <UIcon name="i-heroicons-circle-stack" class="h-3 w-3" />
                  SQL uniquement
                </UBadge>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="h-4 w-4" />
                  {{ formatDate(backup.createdAt) }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-scale" class="h-4 w-4" />
                  {{ formatFileSize(backup.size) }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              variant="outline"
              size="xs"
              :disabled="restoring"
              @click="restoreBackup(backup.filename)"
            >
              <UIcon name="i-heroicons-arrow-up-tray" class="h-3 w-3" />
              {{ $t('admin.backup_restore_action') }}
            </UButton>
            <UButton
              color="success"
              variant="outline"
              size="xs"
              @click="downloadBackup(backup.filename)"
            >
              <UIcon name="i-heroicons-arrow-down-tray" class="h-3 w-3" />
              {{ $t('common.download') }}
            </UButton>
            <UButton
              color="error"
              variant="outline"
              size="xs"
              :disabled="deleting.includes(backup.filename)"
              @click="deleteBackup(backup.filename)"
            >
              <UIcon name="i-heroicons-trash" class="h-3 w-3" />
              {{ $t('common.delete') }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Modal de confirmation -->
    <UModal v-model:open="showConfirmModal" :title="$t('admin.backup_restore_confirm_title')">
      <template #body>
        <div class="space-y-4">
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('admin.backup_restore_confirm_message') }}
          </p>
          <div
            class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p class="text-red-700 dark:text-red-400 text-sm font-medium">
              <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 inline mr-1" />
              {{ $t('admin.backup_restore_warning') }}
            </p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="outline" @click="showConfirmModal = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="restoring" @click="confirmRestore">
            <UIcon name="i-heroicons-arrow-up-tray" class="h-4 w-4" />
            {{ $t('admin.backup_restore_confirm') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// Middleware de protection pour super admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()
const toast = useToast()

// Métadonnées de la page
useSeoMeta({
  title: t('admin.backup_management') + ' - Administration',
  description: t('admin.backup_management_description'),
})

// État réactif
const creating = ref(false)
const restoring = ref(false)
const loadingBackups = ref(false)
const deleting = ref<string[]>([])
const showConfirmModal = ref(false)
const pendingRestore = ref<string | File | null>(null)

interface Backup {
  filename: string
  createdAt: string
  size: number
  type?: 'archive' | 'sql'
}

const backups = ref<Backup[]>([])
const fileInput = ref<HTMLInputElement>()

// Fonctions utilitaires
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
}

const formatFileSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
}

// Charger la liste des sauvegardes
const loadBackups = async () => {
  try {
    loadingBackups.value = true
    const data = await $fetch<Backup[]>('/api/admin/backup/list')
    backups.value = data
  } catch (error) {
    console.error('Error loading backups:', error)
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('admin.backup_load_error'),
    })
  } finally {
    loadingBackups.value = false
  }
}

// Créer une sauvegarde
const createBackup = async () => {
  try {
    creating.value = true
    const response = await $fetch<{ filename: string }>('/api/admin/backup/create', {
      method: 'POST',
    })

    toast.add({
      color: 'success',
      title: t('admin.backup_create_success'),
      description: t('admin.backup_create_success_description', { filename: response.filename }),
    })

    // Recharger la liste
    await loadBackups()
  } catch (error) {
    console.error('Error creating backup:', error)
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('admin.backup_create_error'),
    })
  } finally {
    creating.value = false
  }
}

// Ouvrir le dialogue de fichier
const openFileDialog = () => {
  fileInput.value?.click()
}

// Gérer l'upload de fichier
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    if (!file.name.endsWith('.sql') && !file.name.endsWith('.tar.gz')) {
      toast.add({
        color: 'error',
        title: t('common.error'),
        description: t('admin.backup_invalid_file'),
      })
      return
    }

    pendingRestore.value = file
    showConfirmModal.value = true
  }

  // Reset input
  target.value = ''
}

// Restaurer une sauvegarde existante
const restoreBackup = (filename: string) => {
  pendingRestore.value = filename
  showConfirmModal.value = true
}

// Confirmer la restauration
const confirmRestore = async () => {
  if (!pendingRestore.value) return

  try {
    restoring.value = true

    if (typeof pendingRestore.value === 'string') {
      // Restaurer depuis un fichier existant
      await $fetch('/api/admin/backup/restore', {
        method: 'POST',
        body: { filename: pendingRestore.value },
      })
    } else {
      // Restaurer depuis un fichier uploadé
      const formData = new FormData()
      formData.append('file', pendingRestore.value)

      await $fetch('/api/admin/backup/restore', {
        method: 'POST',
        body: formData,
      })
    }

    toast.add({
      color: 'success',
      title: t('admin.backup_restore_success'),
      description: t('admin.backup_restore_success_description'),
    })

    showConfirmModal.value = false
    pendingRestore.value = null
  } catch (error) {
    console.error('Error restoring backup:', error)
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('admin.backup_restore_error'),
    })
  } finally {
    restoring.value = false
  }
}

// Télécharger une sauvegarde
const downloadBackup = (filename: string) => {
  const url = `/api/admin/backup/download?filename=${encodeURIComponent(filename)}`
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Supprimer une sauvegarde
const deleteBackup = async (filename: string) => {
  if (!confirm(t('admin.backup_delete_confirm', { filename }))) {
    return
  }

  try {
    deleting.value.push(filename)
    await $fetch('/api/admin/backup/delete', {
      method: 'DELETE',
      body: { filename },
    })

    toast.add({
      color: 'success',
      title: t('admin.backup_delete_success'),
      description: t('admin.backup_delete_success_description', { filename }),
    })

    // Recharger la liste
    await loadBackups()
  } catch (error) {
    console.error('Error deleting backup:', error)
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('admin.backup_delete_error'),
    })
  } finally {
    deleting.value = deleting.value.filter((f) => f !== filename)
  }
}

// Charger les données au montage
onMounted(() => {
  loadBackups()
})
</script>
