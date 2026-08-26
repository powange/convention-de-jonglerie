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
            <div class="flex flex-wrap gap-2">
              <UButton
                color="info"
                :loading="restaurationActive"
                :disabled="restaurationActive || importing"
                @click="openFileDialog('restore')"
              >
                <UIcon name="i-heroicons-arrow-up-tray" class="h-4 w-4" />
                {{
                  restaurationActive
                    ? $t('admin.backup_restoring')
                    : $t('admin.backup_restore_button')
                }}
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                :loading="importing"
                :disabled="restaurationActive || importing"
                @click="openFileDialog('import')"
              >
                <UIcon name="i-heroicons-inbox-arrow-down" class="h-4 w-4" />
                {{ importing ? $t('admin.backup_importing') : $t('admin.backup_import_button') }}
              </UButton>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              {{ $t('admin.backup_import_hint') }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Avancement de la restauration -->
    <UCard v-if="etatRestauration" class="mb-8">
      <div class="flex items-start gap-4">
        <div class="p-3 rounded-lg shrink-0" :class="restaurationVisuel.fond">
          <UIcon
            :name="restaurationVisuel.icone"
            class="h-6 w-6"
            :class="[restaurationVisuel.teinte, suiviEnCours ? 'animate-spin' : '']"
          />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-lg mb-1">
            {{ titreCarteRestauration }}
          </h3>
          <p class="text-sm text-gray-500 break-all mb-3">{{ etatRestauration.source }}</p>

          <template v-if="suiviEnCours">
            <!-- L'étape SQL est la seule mesurable : les autres n'ont pas de volume connu -->
            <UProgress
              v-if="etatRestauration.etape === 'BASE_DE_DONNEES'"
              :model-value="etatRestauration.pourcentage"
              :max="100"
              class="mb-2"
            />
            <UProgress v-else class="mb-2" />

            <div
              class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400"
            >
              <span>{{ libelleEtape }}</span>
              <span v-if="etatRestauration.etape === 'BASE_DE_DONNEES'">
                {{ etatRestauration.pourcentage }}% —
                {{ formatFileSize(etatRestauration.octetsEnvoyes) }} /
                {{ formatFileSize(etatRestauration.octetsTotal) }}
              </span>
              <span v-if="etatRestauration.tableEnCours" class="flex items-center gap-1">
                <UIcon name="i-heroicons-table-cells" class="h-4 w-4" />
                <code class="break-all">{{ etatRestauration.tableEnCours }}</code>
              </span>
              <span v-if="etatRestauration.tablesVues > 0">
                {{ $t('admin.backup_restore_tables_seen', { count: etatRestauration.tablesVues }) }}
              </span>
            </div>

            <p class="text-xs text-gray-500 mt-2">
              {{ $t('admin.backup_restore_background_hint') }}
            </p>
          </template>

          <UAlert
            v-else-if="etatRestauration.etape === 'TERMINEE'"
            color="success"
            variant="subtle"
            icon="i-heroicons-check-circle"
            :title="$t('admin.backup_restore_success')"
            :description="$t('admin.backup_restore_success_description')"
          />
          <UAlert
            v-else
            :color="etatRestauration.etape === 'INTERROMPUE' ? 'warning' : 'error'"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :title="
              etatRestauration.etape === 'INTERROMPUE'
                ? $t('admin.backup_restore_interrupted')
                : $t('admin.backup_restore_error')
            "
            :description="descriptionEchecRestauration"
          />
        </div>
      </div>
    </UCard>

    <!-- Recherche d'une valeur de champ dans les sauvegardes -->
    <div class="mb-8">
      <AdminBackupSearch />
    </div>

    <!-- Liste des sauvegardes -->
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
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
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <!-- `min-w-0` : sans lui, le nom de fichier impose sa largeur au conteneur flex et
               repousse les actions hors de l'écran au lieu de se couper. -->
          <div class="flex items-center gap-4 min-w-0">
            <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0">
              <UIcon
                name="i-heroicons-document-text"
                class="h-5 w-5 text-gray-600 dark:text-gray-400"
              />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <h4 class="font-medium break-all">{{ backup.filename }}</h4>
                <UBadge v-if="backup.type === 'archive'" color="success" variant="subtle" size="sm">
                  <UIcon name="i-heroicons-photo" class="h-3 w-3" />
                  Avec images
                </UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="sm">
                  <UIcon name="i-heroicons-circle-stack" class="h-3 w-3" />
                  SQL uniquement
                </UBadge>
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
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
          <!-- `shrink-0` : les actions gardent leur largeur, c'est le nom de fichier qui cède. -->
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <UButton
              variant="outline"
              size="xs"
              :disabled="restaurationActive"
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
              :disabled="isDeletingBackup(backup.filename)"
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
    <UModal
      v-model:open="showConfirmModal"
      :title="$t('admin.backup_restore_confirm_title')"
      :dismissible="!restoring"
      :close="!restoring"
    >
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
          <UButton variant="outline" :disabled="restoring" @click="showConfirmModal = false">
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
const loadingBackups = ref(false)
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
  } catch {
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
const { execute: executeCreateBackup, loading: creating } = useApiAction<
  undefined,
  { filename: string }
>('/api/admin/backup/create', {
  method: 'POST',
  silentSuccess: true,
  errorMessages: { default: t('admin.backup_create_error') },
  onSuccess: async (response: { filename: string }) => {
    toast.add({
      color: 'success',
      title: t('admin.backup_create_success'),
      description: t('admin.backup_create_success_description', { filename: response.filename }),
    })
    await loadBackups()
  },
})

const createBackup = () => executeCreateBackup()

// Le même sélecteur de fichier sert aux deux actions : import seul ou restauration
const pendingAction = ref<'restore' | 'import'>('restore')

const openFileDialog = (action: 'restore' | 'import') => {
  pendingAction.value = action
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

    if (pendingAction.value === 'import') {
      // Import seul : rien n'est écrasé, pas de confirmation à demander
      pendingImport.value = file
      executeImport()
    } else {
      pendingRestore.value = file
      showConfirmModal.value = true
    }
  }

  // Reset input
  target.value = ''
}

// Importer une sauvegarde sans la restaurer
const pendingImport = ref<File | null>(null)

const { execute: executeImport, loading: importing } = useApiAction<
  File,
  { storedFilename: string }
>('/api/admin/backup/upload', {
  method: 'POST',
  // Fichier brut plutôt que multipart : le serveur l'écrit en flux sur le disque,
  // ce qui permet d'importer une archive de plusieurs centaines de Mo
  body: () => pendingImport.value as File,
  headers: () => ({
    'content-type': 'application/octet-stream',
    // encodeURIComponent : un en-tête HTTP n'accepte pas les accents ni les emojis
    'x-backup-filename': encodeURIComponent(pendingImport.value?.name ?? ''),
  }),
  silentSuccess: true,
  errorMessages: { default: t('admin.backup_import_error') },
  onSuccess: async (response: { storedFilename: string }) => {
    pendingImport.value = null
    toast.add({
      color: 'success',
      title: t('admin.backup_import_success'),
      description: t('admin.backup_import_success_description', {
        filename: response.storedFilename,
      }),
    })
    await loadBackups()
  },
  onError: () => {
    pendingImport.value = null
  },
})

// Restaurer une sauvegarde existante
const restoreBackup = (filename: string) => {
  pendingRestore.value = filename
  showConfirmModal.value = true
}

// Confirmer la restauration
const buildRestoreBody = () => {
  if (typeof pendingRestore.value === 'string') {
    return { filename: pendingRestore.value }
  }
  const formData = new FormData()
  formData.append('file', pendingRestore.value as File)
  return formData
}

// La restauration tourne côté serveur : la requête ne fait que la lancer, c'est le suivi
// qui dira quand elle est terminée — et ce qu'elle a donné.
const {
  etat: etatRestauration,
  enCours: suiviEnCours,
  suivre,
  reprendre,
} = useBackupRestoreProgress(async (final) => {
  if (final.etape === 'TERMINEE') {
    toast.add({
      color: 'success',
      title: t('admin.backup_restore_success'),
      description: t('admin.backup_restore_success_description'),
    })
  } else {
    toast.add({
      color: final.etape === 'INTERROMPUE' ? 'warning' : 'error',
      title:
        final.etape === 'INTERROMPUE'
          ? t('admin.backup_restore_interrupted')
          : t('admin.backup_restore_error'),
      description:
        final.etape === 'INTERROMPUE'
          ? t('admin.backup_restore_interrupted_description')
          : final.erreur || undefined,
    })
  }
  // Un fichier restauré depuis l'ordinateur est conservé côté serveur, qu'elle ait
  // réussi ou non : il apparaît désormais dans la liste des sauvegardes disponibles
  await loadBackups()
})

const { execute: executeRestore, loading: restoring } = useApiAction<
  unknown,
  { etat: EtatRestauration }
>('/api/admin/backup/restore', {
  method: 'POST',
  body: buildRestoreBody,
  successMessage: { title: t('admin.backup_restore_started') },
  errorMessages: { default: t('admin.backup_restore_error') },
  onSuccess: async (response: { etat: EtatRestauration }) => {
    showConfirmModal.value = false
    pendingRestore.value = null
    suivre(response.etat)
    await loadBackups()
  },
  onError: async () => {
    showConfirmModal.value = false
    pendingRestore.value = null
    await loadBackups()
  },
})

// Le lancement de la requête, puis la restauration elle-même : les deux bloquent les actions
const restaurationActive = computed(() => restoring.value || suiviEnCours.value)

// Une interruption n'a pas de message d'erreur : c'est le serveur qui s'est arrêté,
// et son explication se traduit ici plutôt que d'être écrite en dur côté API
const descriptionEchecRestauration = computed(() =>
  etatRestauration.value?.etape === 'INTERROMPUE'
    ? t('admin.backup_restore_interrupted_description')
    : etatRestauration.value?.erreur || undefined
)

// Une fois la restauration finie, la carte ne raconte plus un événement en cours
// mais le compte rendu du dernier passage
const titreCarteRestauration = computed(() =>
  suiviEnCours.value
    ? t('admin.backup_restore_progress_title')
    : t('admin.backup_restore_last_title')
)

// Libellé de l'étape : une correspondance explicite, pour que l'outillage i18n
// voie ces clés utilisées
const libelleEtape = computed(() => {
  switch (etatRestauration.value?.etape) {
    case 'PREPARATION':
      return t('admin.backup_restore_step_preparation')
    case 'BASE_DE_DONNEES':
      return t('admin.backup_restore_step_database')
    case 'FICHIERS':
      return t('admin.backup_restore_step_files')
    default:
      return ''
  }
})

// L'habillage de la carte d'avancement suit l'étape en cours
const restaurationVisuel = computed(() => {
  const etape = etatRestauration.value?.etape
  if (etape === 'TERMINEE') {
    return {
      icone: 'i-heroicons-check-circle',
      fond: 'bg-green-100 dark:bg-green-900/30',
      teinte: 'text-green-600 dark:text-green-400',
    }
  }
  if (etape === 'ECHOUEE' || etape === 'INTERROMPUE') {
    return {
      icone: 'i-heroicons-exclamation-triangle',
      fond: 'bg-red-100 dark:bg-red-900/30',
      teinte: 'text-red-600 dark:text-red-400',
    }
  }
  return {
    icone: 'i-heroicons-arrow-path',
    fond: 'bg-orange-100 dark:bg-orange-900/30',
    teinte: 'text-orange-600 dark:text-orange-400',
  }
})

const confirmRestore = () => {
  if (!pendingRestore.value) return
  executeRestore()
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
const { execute: executeDeleteBackup, isLoading: isDeletingBackup } = useApiActionById(
  () => '/api/admin/backup/delete',
  {
    method: 'DELETE',
    body: (filename) => ({ filename }),
    silentSuccess: true,
    errorMessages: { default: t('admin.backup_delete_error') },
    onSuccess: async (_result: unknown, filename: string | number) => {
      toast.add({
        color: 'success',
        title: t('admin.backup_delete_success'),
        description: t('admin.backup_delete_success_description', { filename }),
      })
      await loadBackups()
    },
  }
)

const deleteBackup = (filename: string) => {
  if (!confirm(t('admin.backup_delete_confirm', { filename }))) {
    return
  }
  executeDeleteBackup(filename)
}

// Charger les données au montage
onMounted(() => {
  loadBackups()
  // Une restauration lancée avant l'ouverture de la page reprend son affichage ici
  reprendre()
})
</script>
