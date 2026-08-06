<template>
  <div>
    <!-- Loading initial -->
    <div v-if="initialLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <!-- Erreur : édition non trouvée -->
    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <!-- Erreur : accès refusé -->
    <div v-else-if="!canEdit">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>

    <!-- Contenu principal -->
    <div v-else class="space-y-6">
      <!-- En-tête -->
      <div>
        <h1 class="text-2xl font-bold">{{ $t('gestion.about.title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.about.description') }}
        </p>
      </div>

      <!-- Formulaire -->
      <div class="space-y-6">
        <!-- Affiche -->
        <UFormField :label="$t('components.edition_form.convention_poster_optional')" name="image">
          <UiImageUpload
            v-model="imageUrl"
            :endpoint="uploadEndpoint"
            :options="{
              validation: {
                maxSize: 10 * 1024 * 1024,
                allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
              },
              resetAfterUpload: false,
            }"
            :alt="$t('components.edition_form.poster_alt')"
            :placeholder="$t('components.edition_form.poster_placeholder')"
            @uploaded="onImageUploaded"
            @deleted="onImageDeleted"
            @error="onImageError"
          />
        </UFormField>

        <!-- Description -->
        <UFormField :label="$t('common.description')" name="description">
          <MarkdownEditor
            v-model="description"
            :placeholder="$t('components.edition_form.convention_description_placeholder')"
            class="min-h-40"
            @blur="description = description?.trim() || ''"
          />
        </UFormField>

        <!-- Programme général : ce qui ne se rattache à aucune date -->
        <UFormField
          :label="$t('common.program')"
          :description="$t('gestion.about.program_general_help')"
          name="program"
        >
          <MarkdownEditor
            v-model="program"
            :placeholder="$t('components.edition_form.program_placeholder')"
            class="min-h-40"
            @blur="program = program?.trim() || ''"
          />
        </UFormField>

        <!-- Programme jour par jour -->
        <div v-if="programDaysLoaded && programDays.length > 0" class="space-y-4">
          <div>
            <h3 class="font-semibold">{{ $t('gestion.about.program_days') }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('gestion.about.program_days_help') }}
            </p>
          </div>

          <UFormField v-for="jour in programDays" :key="jour.date">
            <template #label>
              <span class="capitalize">{{ formatDayLabel(jour.date) }}</span>
              <!-- Une journée sortie des dates n'est pas effacée : le dire évite de laisser
                   croire qu'elle s'affichera encore publiquement. -->
              <UBadge
                v-if="jour.outsideDates"
                color="warning"
                variant="subtle"
                size="sm"
                class="ml-2"
              >
                {{ $t('gestion.about.program_day_outside') }}
              </UBadge>
            </template>
            <MarkdownEditor
              v-model="jour.content"
              :placeholder="$t('gestion.about.program_day_placeholder')"
              class="min-h-32"
            />
          </UFormField>
        </div>
      </div>

      <!-- Bouton enregistrer -->
      <div class="flex justify-end">
        <UButton
          icon="i-lucide-save"
          :label="$t('gestion.about.save')"
          :loading="saving"
          @click="save()"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

import {
  buildProgramDays,
  type ProgramDayRecord,
  type ProgramDaySlot,
} from '~~/shared/utils/program-days'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t, locale } = useI18n()
const toast = useToast()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

const initialLoading = ref(true)

// Permissions
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// État local
const imageUrl = ref<string | null>(null)
const description = ref('')
const program = ref('')

/**
 * Programme jour par jour.
 *
 * Les jours proposés se déduisent des dates de l'édition. Ceux qui en sont sortis — report,
 * correction de dates — restent présents et signalés : effacer un texte déjà écrit ferait perdre
 * du travail que personne n'a demandé à jeter.
 */
const programDays = ref<ProgramDaySlot[]>([])

/**
 * Vrai quand le programme par jour a bien été chargé.
 *
 * Sans ce garde-fou, un échec de chargement laissait la liste vide, et l'enregistrement — qui
 * remplace l'ensemble — aurait supprimé tout le programme existant. Un incident réseau passager
 * aurait suffi à effacer le travail de l'organisateur, sans le moindre signal.
 */
const programDaysLoaded = ref(false)

const formatDayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

// Endpoint d'upload
const uploadEndpoint = computed(() => ({
  type: 'edition' as const,
  id: editionId.value,
}))

// Synchroniser les valeurs avec l'édition chargée
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      imageUrl.value = newEdition.imageUrl || null
      description.value = newEdition.description || ''
      program.value = newEdition.program || ''
    }
  },
  { immediate: true }
)

// Gestionnaires d'événements pour l'upload d'image
const onImageUploaded = (result: { imageUrl?: string; edition?: { imageUrl?: string } }) => {
  const newImageUrl = result.imageUrl || result.edition?.imageUrl
  if (newImageUrl) {
    imageUrl.value = newImageUrl
  }
  toast.add({
    title: t('upload.success_message'),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })
}

const onImageDeleted = () => {
  imageUrl.value = null
  toast.add({
    title: t('upload.delete_message'),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })
}

const onImageError = (error: string) => {
  toast.add({
    title: t('upload.error_message'),
    description: error,
    icon: 'i-heroicons-exclamation-triangle',
    color: 'error',
  })
}

/** Recompose la liste des jours dès que les dates de l'édition ou les contenus arrivent. */
const chargerProgrammeParJour = async () => {
  if (!edition.value) return
  try {
    const reponse = await $fetch<{ data: { days: ProgramDayRecord[] } }>(
      `/api/editions/${editionId.value}/program-days`
    )
    programDays.value = buildProgramDays(
      edition.value.startDate,
      edition.value.endDate,
      reponse.data.days
    )
    programDaysLoaded.value = true
  } catch (error) {
    // La page reste utilisable pour le programme général, mais les jours ne seront pas
    // enregistrés : mieux vaut ne rien écrire que d'écraser ce qu'on n'a pas su lire.
    console.error('Programme par jour non chargé :', error)
    programDays.value = []
    programDaysLoaded.value = false
  }
}

// Sauvegarde
const { execute: saveEdition, loading: savingEdition } = useApiAction(
  () => `/api/editions/${editionId.value}`,
  {
    method: 'PUT',
    body: () => ({
      imageUrl: imageUrl.value?.trim() || null,
      description: description.value?.trim() || null,
      program: program.value?.trim() || null,
    }),
    silentSuccess: true,
    errorMessages: { default: t('gestion.about.save_error') },
    onSuccess: (response: any) => {
      if (response && edition.value) {
        editionStore.setEdition({ ...edition.value, ...response })
      }
    },
  }
)

const { execute: saveDays, loading: savingDays } = useApiAction(
  () => `/api/editions/${editionId.value}/program-days`,
  {
    method: 'PUT',
    body: () => ({
      days: programDays.value.map((jour) => ({ date: jour.date, content: jour.content })),
    }),
    silentSuccess: true,
    errorMessages: { default: t('gestion.about.save_error') },
  }
)

const saving = computed(() => savingEdition.value || savingDays.value)

/**
 * Les deux enregistrements sont séquentiels et non parallèles : un échec sur le second ne doit
 * pas laisser croire que rien n'a été enregistré, ni l'inverse. Un seul message conclut.
 */
const save = async () => {
  const okEdition = await saveEdition()
  if (!okEdition) return
  // Ne rien écrire tant que la lecture a échoué : l'enregistrement remplace l'ensemble.
  const okDays = !programDaysLoaded.value || (await saveDays())
  if (okDays) toast.add({ title: t('gestion.about.save_success'), color: 'success' })
}

// Charger l'édition
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId.value, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  await chargerProgrammeParJour()
  initialLoading.value = false
})

// Les dates de l'édition peuvent changer ailleurs : la liste des jours suit, sans perdre ce qui
// est déjà saisi à l'écran.
watch(
  () => [edition.value?.startDate, edition.value?.endDate],
  () => {
    if (!edition.value || initialLoading.value) return
    const saisis = programDays.value.map((j) => ({ date: j.date, content: j.content }))
    programDays.value = buildProgramDays(edition.value.startDate, edition.value.endDate, saisis)
  }
)
</script>
