<template>
  <div>
    <!-- En-tête avec navigation -->
    <EditionHeader v-if="edition" :edition="edition" current-page="workshops" />

    <div class="max-w-6xl mx-auto px-4 py-8">
      <!-- Actions et titre -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-3xl font-bold">{{ $t('workshops.page_title') }}</h1>
          <div class="flex items-center gap-3">
            <!-- Filtre favoris -->
            <URadioGroup
              v-if="authStore.isAuthenticated && workshopsEnabled"
              v-model="filterMode"
              :items="filterOptions"
              orientation="horizontal"
              variant="table"
              indicator="hidden"
              color="primary"
              size="sm"
            />

            <UButton
              v-if="canAddWorkshop"
              icon="i-heroicons-plus"
              color="primary"
              @click="showAddModal = true"
            >
              {{ $t('workshops.add_workshop') }}
            </UButton>
          </div>
        </div>

        <!-- Message d'information -->
        <UAlert v-if="!workshopsEnabled" icon="i-heroicons-information-circle" color="warning">
          {{ $t('workshops.workshops_not_enabled') }}
        </UAlert>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-500" />
      </div>

      <!-- Liste des workshops groupés par jour -->
      <div v-else-if="workshopsByDay.length > 0" class="space-y-8">
        <div v-for="dayGroup in workshopsByDay" :key="dayGroup.date">
          <h2 class="text-2xl font-semibold mb-4">
            {{ formatDate(dayGroup.date) }}
          </h2>
          <div class="space-y-4">
            <UCard v-for="workshop in dayGroup.workshops" :key="workshop.id">
              <template #header>
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="text-xl font-semibold">{{ workshop.title }}</h3>
                    <div
                      class="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                      <div class="flex items-center gap-1">
                        <UIcon name="i-heroicons-clock" />
                        <span
                          >{{ formatTime(workshop.startDateTime) }} -
                          {{ formatTime(workshop.endDateTime) }}</span
                        >
                      </div>
                      <div v-if="workshop.location" class="flex items-center gap-1">
                        <UIcon name="mdi:map-marker-radius" />
                        <span>{{ workshop.location.name }}</span>
                      </div>
                      <div v-if="workshop.maxParticipants" class="flex items-center gap-1">
                        <UIcon name="i-heroicons-users" />
                        <span>Max {{ workshop.maxParticipants }} personnes</span>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <!-- Bouton favori -->
                    <UButton
                      v-if="authStore.isAuthenticated"
                      size="xs"
                      :color="workshop.isFavorite ? 'primary' : 'neutral'"
                      :variant="workshop.isFavorite ? 'solid' : 'soft'"
                      :icon="workshop.isFavorite ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                      :title="
                        workshop.isFavorite
                          ? $t('workshops.remove_from_favorites')
                          : $t('workshops.add_to_favorites')
                      "
                      @click="toggleFavorite(workshop)"
                    />
                    <UButton
                      v-if="canEdit(workshop)"
                      size="xs"
                      color="warning"
                      variant="soft"
                      icon="i-heroicons-pencil"
                      @click="editWorkshop(workshop)"
                    >
                      {{ $t('workshops.edit_workshop') }}
                    </UButton>
                    <UButton
                      v-if="canEdit(workshop)"
                      size="xs"
                      color="error"
                      variant="soft"
                      icon="i-heroicons-trash"
                      @click="deleteWorkshop(workshop.id)"
                    >
                      {{ $t('workshops.delete_workshop') }}
                    </UButton>
                  </div>
                </div>
              </template>

              <!-- Description et créateur -->
              <div class="space-y-4">
                <p v-if="workshop.description" class="text-gray-700 dark:text-gray-300">
                  {{ workshop.description }}
                </p>
                <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <UiUserAvatar :user="workshop.creator" size="sm" />
                  <span>Proposé par {{ workshop.creator.pseudo }}</span>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>

      <!-- État vide -->
      <div v-else class="text-center py-12">
        <UIcon
          :name="filterFavorites ? 'i-heroicons-star' : 'i-heroicons-academic-cap'"
          class="mx-auto h-12 w-12 text-gray-400 mb-4"
        />
        <p class="text-gray-500">
          {{ filterFavorites ? $t('workshops.no_favorites') : $t('workshops.no_workshops') }}
        </p>
        <UButton
          v-if="canAddWorkshop && !filterFavorites"
          class="mt-4"
          color="primary"
          @click="showAddModal = true"
        >
          {{ $t('workshops.propose_workshop') }}
        </UButton>
      </div>
    </div>

    <!-- Modal d'ajout/modification de workshop -->
    <UModal v-model:open="showAddModal" size="lg" prevent-close>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-full bg-primary-100 dark:bg-primary-900">
            <UIcon
              :name="editingWorkshop ? 'i-heroicons-pencil-square' : 'i-heroicons-plus'"
              class="w-5 h-5 text-primary-600 dark:text-primary-400"
            />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ editingWorkshop ? 'Modifier le workshop' : 'Ajouter un workshop' }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{
                editingWorkshop
                  ? 'Modifiez les informations du workshop'
                  : 'Créez un nouveau workshop pour les participants'
              }}
            </p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="space-y-6">
          <!-- Titre -->
          <UFormField label="Titre" required class="w-full">
            <UInput
              v-model="formData.title"
              placeholder="Nom du workshop"
              icon="i-heroicons-academic-cap"
              class="w-full"
              autofocus
            />
          </UFormField>

          <!-- Description -->
          <UFormField label="Description" class="w-full">
            <UTextarea
              v-model="formData.description"
              placeholder="Décrivez le workshop, son contenu et ce que les participants vont apprendre..."
              :rows="4"
              resize
              class="w-full"
            />
          </UFormField>

          <!-- Lieu du workshop -->
          <UFormField :label="$t('workshops.workshop_location_optional')" class="w-full">
            <USelect
              v-model="formData.locationId"
              :items="locationOptions"
              :loading="loadingLocations"
              :placeholder="$t('workshops.workshop_location_placeholder')"
              icon="mdi:map-marker-radius"
              class="w-full"
            />

            <!-- Champ pour nouveau lieu (mode libre uniquement) -->
            <UInput
              v-if="workshopLocationsFreeInput && formData.locationId === 'other'"
              v-model="formData.locationName"
              :placeholder="$t('workshops.workshop_location_new_name')"
              class="w-full mt-2"
            />
          </UFormField>

          <!-- Section horaires -->
          <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-clock" class="w-4 h-4 text-green-600" />
                <h4 class="text-sm font-medium text-green-800 dark:text-green-200">
                  Horaires du workshop
                </h4>
              </div>
              <div
                v-if="calculatedDuration"
                class="text-xs text-green-600 dark:text-green-400 font-medium"
              >
                {{ calculatedDuration }}
              </div>
            </div>

            <!-- Info période de l'édition -->
            <div
              v-if="edition"
              class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded"
            >
              <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5" />
              <span>
                Période de l'édition : {{ formatDate(edition.startDate) }} -
                {{ formatDate(edition.endDate) }}
              </span>
            </div>

            <!-- Dates et heures -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="Date et heure de début" required>
                <UInput
                  v-model="formData.startDateTime"
                  type="datetime-local"
                  icon="i-heroicons-play"
                  :min="editionDateTimeMin"
                  :max="editionDateTimeMax"
                  @change="onStartDateChange"
                />
              </UFormField>
              <UFormField label="Date et heure de fin" required>
                <UInput
                  v-model="formData.endDateTime"
                  type="datetime-local"
                  icon="i-heroicons-stop"
                  :min="editionDateTimeMin"
                  :max="editionDateTimeMax"
                />
              </UFormField>
            </div>

            <!-- Raccourcis durée -->
            <div class="flex flex-wrap gap-2">
              <span class="text-xs text-gray-500 dark:text-gray-400 mr-2">Durée rapide :</span>
              <UButton
                v-for="duration in quickDurations"
                :key="duration.label"
                size="xs"
                variant="soft"
                color="primary"
                @click="setDuration(duration.hours)"
              >
                {{ duration.label }}
              </UButton>
            </div>

            <!-- Message d'erreur de validation -->
            <div
              v-if="dateValidationError"
              class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800"
            >
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5"
              />
              <span class="text-sm text-red-700 dark:text-red-300">
                {{ dateValidationError }}
              </span>
            </div>
          </div>

          <!-- Section participants -->
          <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-4">
            <div class="flex items-center gap-2 mb-3">
              <UIcon name="i-heroicons-users" class="w-4 h-4 text-purple-600" />
              <h4 class="text-sm font-medium text-purple-800 dark:text-purple-200">
                Nombre de participants
              </h4>
            </div>

            <!-- Nombre de participants -->
            <UFormField label="Maximum de participants (optionnel)">
              <div class="flex items-center gap-3">
                <UInput
                  v-model.number="formData.maxParticipants"
                  type="number"
                  min="1"
                  max="9999"
                  placeholder="Illimité"
                  icon="i-heroicons-users"
                  class="w-32"
                />
                <!-- Boutons rapides -->
                <div class="flex flex-wrap gap-1">
                  <UButton
                    v-for="num in [5, 10, 15, 20, 30]"
                    :key="num"
                    size="xs"
                    variant="soft"
                    color="primary"
                    :class="{ 'ring-2 ring-purple-400': formData.maxParticipants === num }"
                    @click="formData.maxParticipants = num"
                  >
                    {{ num }}
                  </UButton>
                </div>
              </div>
              <template #hint>
                <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <UIcon name="i-heroicons-information-circle" class="w-3 h-3" />
                  <span>Laisser vide pour autoriser un nombre illimité de participants</span>
                </div>
              </template>
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="closeModal"> Annuler </UButton>
          <UButton color="primary" :loading="saving" :disabled="!isFormValid" @click="saveWorkshop">
            {{ editingWorkshop ? 'Modifier' : 'Ajouter' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { formatDateTimeLocal, addHoursToDateTimeLocal } from '~/utils/date'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t: $t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))
const workshopsEnabled = computed(() => edition.value?.workshopsEnabled ?? false)

const workshops = ref<any[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const saving = ref(false)
const editingWorkshop = ref<any>(null)
const canCreateWorkshop = ref(false)
const filterMode = ref<'all' | 'favorites'>('all')

const formData = ref({
  title: '',
  description: '',
  startDateTime: '',
  endDateTime: '',
  maxParticipants: null as number | null,
  locationId: null as number | null | 'other',
  locationName: '' as string,
})

// État pour les lieux disponibles
const workshopLocations = ref<Array<{ id: number; name: string }>>([])
const loadingLocations = ref(false)

// Options pour le filtre
const filterOptions = computed(() => [
  {
    label: $t('workshops.show_all'),
    value: 'all',
  },
  {
    label: $t('workshops.show_favorites'),
    value: 'favorites',
  },
])

// Computed pour la compatibilité avec le code existant
const filterFavorites = computed(() => filterMode.value === 'favorites')

// Mode de saisie des lieux
const workshopLocationsFreeInput = computed(
  () => edition.value?.workshopLocationsFreeInput ?? false
)

// Options pour le SelectMenu ou InputMenu
const locationOptions = computed(() => {
  const options = workshopLocations.value.map((loc) => ({
    label: loc.name,
    value: loc.id,
  }))

  const result: Array<{ label: string; value: number | null | 'other' }> = [
    { label: $t('workshops.workshop_location_none'), value: null },
    ...options,
  ]

  // Ajouter l'option "Autre" en mode libre
  if (workshopLocationsFreeInput.value) {
    result.push({ label: $t('workshops.workshop_location_other'), value: 'other' as const })
  }

  return result
})

const canAddWorkshop = computed(() => {
  if (!workshopsEnabled.value || !authStore.isAuthenticated) return false
  return canCreateWorkshop.value
})

// Récupérer les lieux disponibles
const fetchWorkshopLocations = async () => {
  loadingLocations.value = true
  try {
    const data = await $fetch(`/api/editions/${editionId}/workshops/locations`)
    workshopLocations.value = data as Array<{ id: number; name: string }>
  } catch (error) {
    console.error('Failed to fetch workshop locations:', error)
  } finally {
    loadingLocations.value = false
  }
}

const canEdit = (workshop: any) => {
  if (!authStore.user?.id) return false
  // Le créateur peut modifier, ou un orga
  return (
    workshop.creatorId === authStore.user.id ||
    editionStore.canEditEdition(edition.value!, authStore.user.id)
  )
}

const isFormValid = computed(() => {
  if (
    !formData.value.title.trim() ||
    !formData.value.startDateTime ||
    !formData.value.endDateTime
  ) {
    return false
  }

  // Vérifier que le workshop est pendant l'édition
  if (edition.value) {
    const workshopStart = new Date(formData.value.startDateTime)
    const workshopEnd = new Date(formData.value.endDateTime)
    const editionStart = new Date(edition.value.startDate)
    const editionEnd = new Date(edition.value.endDate)

    // Le workshop doit commencer et finir pendant l'édition
    if (workshopStart < editionStart || workshopEnd > editionEnd) {
      return false
    }
  }

  return true
})

// Message d'erreur si les dates sont hors de l'édition
const dateValidationError = computed(() => {
  if (!formData.value.startDateTime || !formData.value.endDateTime || !edition.value) {
    return null
  }

  const workshopStart = new Date(formData.value.startDateTime)
  const workshopEnd = new Date(formData.value.endDateTime)
  const editionStart = new Date(edition.value.startDate)
  const editionEnd = new Date(edition.value.endDate)

  if (workshopStart < editionStart) {
    return `Le workshop ne peut pas commencer avant le début de l'édition (${formatDate(edition.value.startDate)})`
  }

  if (workshopEnd > editionEnd) {
    return `Le workshop ne peut pas finir après la fin de l'édition (${formatDate(edition.value.endDate)})`
  }

  return null
})

// Dates min et max pour le date picker (basées sur les dates de l'édition)
const editionDateTimeMin = computed(() => {
  if (!edition.value) return undefined
  // Convertir la date de début de l'édition au format datetime-local
  return new Date(edition.value.startDate).toISOString().slice(0, 16)
})

const editionDateTimeMax = computed(() => {
  if (!edition.value) return undefined
  // Convertir la date de fin de l'édition au format datetime-local
  return new Date(edition.value.endDate).toISOString().slice(0, 16)
})

// Durée rapide
const quickDurations = [
  { label: '30min', hours: 0.5 },
  { label: '1h', hours: 1 },
  { label: '1h30', hours: 1.5 },
  { label: '2h', hours: 2 },
  { label: '3h', hours: 3 },
]

// Calculer la durée du workshop
const calculatedDuration = computed(() => {
  if (!formData.value.startDateTime || !formData.value.endDateTime) {
    return null
  }

  const start = new Date(formData.value.startDateTime)
  const end = new Date(formData.value.endDateTime)
  const diffMs = end.getTime() - start.getTime()

  if (diffMs <= 0) {
    return null
  }

  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 1) {
    const diffMinutes = Math.round(diffMs / (1000 * 60))
    return `${diffMinutes} min`
  } else if (diffHours === 1) {
    return '1 heure'
  } else if (diffHours < 24) {
    const hours = Math.floor(diffHours)
    const minutes = Math.round((diffHours - hours) * 60)
    return minutes > 0 ? `${hours}h${minutes}` : `${hours} heures`
  } else {
    const days = Math.floor(diffHours / 24)
    return `${days} jour${days > 1 ? 's' : ''}`
  }
})

// Gérer le changement de date de début
const onStartDateChange = () => {
  // Si la date de fin n'est pas définie ou est avant la date de début, l'ajuster
  if (!formData.value.endDateTime || formData.value.endDateTime <= formData.value.startDateTime) {
    formData.value.endDateTime = addHoursToDateTimeLocal(formData.value.startDateTime, 1)
  }
}

// Définir la durée en ajoutant des heures à la date de début
const setDuration = (hours: number) => {
  if (!formData.value.startDateTime) {
    // Si pas de date de début, initialiser avec la date de début de l'édition
    if (edition.value) {
      const editionStart = new Date(edition.value.startDate)
      formData.value.startDateTime = formatDateTimeLocal(editionStart)
    } else {
      return
    }
  }

  // Utiliser l'utilitaire pour ajouter des heures
  formData.value.endDateTime = addHoursToDateTimeLocal(formData.value.startDateTime, hours)
}

// Grouper les workshops par jour
const workshopsByDay = computed(() => {
  // Filtrer les workshops si nécessaire
  const filteredWorkshops = filterFavorites.value
    ? workshops.value.filter((w) => w.isFavorite)
    : workshops.value

  const grouped = new Map<string, any[]>()

  filteredWorkshops.forEach((workshop) => {
    const date = new Date(workshop.startDateTime).toISOString().split('T')[0]
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(workshop)
  })

  // Convertir en array et trier par date
  return Array.from(grouped.entries())
    .map(([date, workshops]) => ({
      date,
      workshops: workshops.sort(
        (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
      ),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
})

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatTime = (dateTimeStr: string) => {
  const date = new Date(dateTimeStr)
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const fetchWorkshops = async () => {
  loading.value = true
  try {
    const data = await $fetch(`/api/editions/${editionId}/workshops`)
    workshops.value = data as any[]
  } catch (error) {
    console.error('Failed to fetch workshops:', error)
    toast.add({
      title: 'Erreur lors du chargement des workshops',
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    loading.value = false
  }
}

const checkCanCreate = async () => {
  if (!authStore.isAuthenticated) {
    canCreateWorkshop.value = false
    return
  }

  try {
    const result = await $fetch(`/api/editions/${editionId}/workshops/can-create`)
    canCreateWorkshop.value = result.canCreate
  } catch {
    // Si l'utilisateur n'est pas connecté ou n'a pas les permissions, on masque le bouton
    canCreateWorkshop.value = false
  }
}

const editWorkshop = (workshop: any) => {
  editingWorkshop.value = workshop
  formData.value = {
    title: workshop.title,
    description: workshop.description || '',
    startDateTime: formatDateTimeLocal(new Date(workshop.startDateTime)),
    endDateTime: formatDateTimeLocal(new Date(workshop.endDateTime)),
    maxParticipants: workshop.maxParticipants,
    locationId: workshop.location?.id || null,
    locationName: workshop.location?.name || '',
  }
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  editingWorkshop.value = null
  formData.value = {
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    maxParticipants: null,
    locationId: null,
    locationName: '',
  }
}

const saveWorkshop = async () => {
  saving.value = true
  try {
    const body: any = {
      title: formData.value.title.trim(),
      description: formData.value.description.trim() || null,
      startDateTime: new Date(formData.value.startDateTime).toISOString(),
      endDateTime: new Date(formData.value.endDateTime).toISOString(),
      maxParticipants: formData.value.maxParticipants || null,
    }

    // Gérer le lieu selon le mode
    if (workshopLocationsFreeInput.value && formData.value.locationId === 'other') {
      // Mode libre avec "Autre" sélectionné : envoyer le nom du nouveau lieu
      if (formData.value.locationName.trim()) {
        body.locationName = formData.value.locationName.trim()
      }
    } else {
      // Mode exclusif ou lieu existant : envoyer l'ID du lieu (même si null pour supprimer)
      body.locationId = formData.value.locationId === 'other' ? null : formData.value.locationId
    }

    if (editingWorkshop.value) {
      // Modifier
      await $fetch(`/api/editions/${editionId}/workshops/${editingWorkshop.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.add({
        title: 'Workshop modifié avec succès',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    } else {
      // Créer
      await $fetch(`/api/editions/${editionId}/workshops`, {
        method: 'POST',
        body,
      })
      toast.add({
        title: 'Workshop ajouté avec succès',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }

    closeModal()
    await fetchWorkshops()
  } catch (error: any) {
    console.error('Failed to save workshop:', error)
    toast.add({
      title: error?.data?.message || 'Erreur lors de la sauvegarde',
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    saving.value = false
  }
}

const deleteWorkshop = async (workshopId: number) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce workshop ?')) {
    return
  }

  try {
    await $fetch(`/api/editions/${editionId}/workshops/${workshopId}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Workshop supprimé avec succès',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
    await fetchWorkshops()
  } catch (error: any) {
    console.error('Failed to delete workshop:', error)
    toast.add({
      title: error?.data?.message || 'Erreur lors de la suppression',
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}

const toggleFavorite = async (workshop: any) => {
  const wasFavorite = workshop.isFavorite

  // Mise à jour optimiste de l'UI
  workshop.isFavorite = !wasFavorite

  try {
    if (wasFavorite) {
      // Retirer des favoris
      await $fetch(`/api/editions/${editionId}/workshops/${workshop.id}/favorite`, {
        method: 'DELETE',
      })
      toast.add({
        title: $t('workshops.favorite_removed'),
        color: 'success',
        icon: 'i-heroicons-star',
      })
    } else {
      // Ajouter aux favoris
      await $fetch(`/api/editions/${editionId}/workshops/${workshop.id}/favorite`, {
        method: 'POST',
      })
      toast.add({
        title: $t('workshops.favorite_added'),
        color: 'success',
        icon: 'i-heroicons-star-solid',
      })
    }
  } catch (error: any) {
    // Annuler le changement optimiste en cas d'erreur
    workshop.isFavorite = wasFavorite
    console.error('Failed to toggle favorite:', error)
    toast.add({
      title: error?.data?.message || $t('workshops.favorite_error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}

// Charger les lieux quand le modal s'ouvre
watch(showAddModal, async (isOpen) => {
  if (isOpen) {
    // Charger les lieux pour les suggestions (mode libre) ou la liste (mode exclusif)
    await fetchWorkshopLocations()
  }
})

// Réinitialiser locationName quand on change de sélection
watch(
  () => formData.value.locationId,
  (newValue) => {
    // Si on ne sélectionne pas "Autre", vider le champ de nom personnalisé
    if (newValue !== 'other') {
      formData.value.locationName = ''
    }
  }
)

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  if (workshopsEnabled.value) {
    await Promise.all([fetchWorkshops(), checkCanCreate()])
  } else {
    loading.value = false
  }
})
</script>
