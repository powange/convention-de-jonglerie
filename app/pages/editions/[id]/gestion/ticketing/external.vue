<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader :edition="edition" current-page="gestion" />

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-link" class="text-purple-600 dark:text-purple-400" />
          Lier une billeterie externe
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Connectez votre billetterie HelloAsso ou autre plateforme externe
        </p>
      </div>

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <!-- HelloAsso -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <UIcon
                  name="i-heroicons-ticket"
                  class="h-8 w-8 text-orange-600 dark:text-orange-400"
                />
              </div>
              <div>
                <h2 class="text-lg font-semibold">HelloAsso</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Plateforme de billetterie pour associations
                </p>
              </div>
            </div>

            <UAlert
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              description="Connectez votre compte HelloAsso pour synchroniser automatiquement les billets et participants."
            />

            <!-- Formulaire de connexion HelloAsso -->
            <div class="space-y-4 pt-4">
              <div
                class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
              >
                <div class="flex items-start gap-2">
                  <UIcon
                    name="i-heroicons-information-circle"
                    class="text-blue-600 dark:text-blue-400 mt-0.5"
                  />
                  <div class="text-sm">
                    <p class="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Obtenir vos identifiants API
                    </p>
                    <p class="text-blue-700 dark:text-blue-300">
                      Rendez-vous sur votre
                      <a
                        href="https://auth.helloasso.com/admin/api"
                        target="_blank"
                        class="underline hover:text-blue-600"
                      >
                        espace HelloAsso → API & Webhooks
                      </a>
                      pour créer un client API et obtenir votre Client ID et Client Secret.
                    </p>
                  </div>
                </div>
              </div>

              <div class="border-t pt-4">
                <h3 class="font-medium mb-4">Identifiants API</h3>

                <div class="space-y-4">
                  <UFormField label="Client ID" required>
                    <UInput
                      v-model="helloAssoClientId"
                      placeholder="votre_client_id"
                      icon="i-heroicons-key"
                      type="text"
                    />
                  </UFormField>

                  <UFormField label="Client Secret" required>
                    <UInput
                      v-model="helloAssoClientSecret"
                      placeholder="votre_client_secret"
                      icon="i-heroicons-lock-closed"
                      type="password"
                    />
                  </UFormField>
                </div>
              </div>

              <div class="border-t pt-4">
                <h3 class="font-medium mb-4">Configuration du formulaire</h3>

                <div class="space-y-4">
                  <UFormField label="Slug de l'organisation" required>
                    <UInput
                      v-model="helloAssoOrganizationSlug"
                      placeholder="mon-association"
                      icon="i-heroicons-building-office"
                    />
                  </UFormField>

                  <UFormField label="Type de formulaire" required>
                    <USelect
                      v-model="helloAssoFormType"
                      :items="formTypeOptions"
                      placeholder="Sélectionnez un type"
                    />
                  </UFormField>

                  <UFormField label="Slug du formulaire" required>
                    <UInput
                      v-model="helloAssoFormSlug"
                      placeholder="billeterie-convention-2024"
                      icon="i-heroicons-document-text"
                    />
                  </UFormField>
                </div>
              </div>

              <div class="flex gap-2 pt-4 border-t">
                <UButton
                  color="primary"
                  icon="i-heroicons-check-circle"
                  :disabled="!canSave"
                  :loading="saving"
                  @click="saveHelloAssoConfig"
                >
                  Enregistrer la configuration
                </UButton>
                <UButton
                  variant="ghost"
                  icon="i-heroicons-arrow-path"
                  :disabled="!canSave"
                  :loading="testing"
                  @click="testConnection"
                >
                  Tester la connexion
                </UButton>
              </div>
            </div>

            <!-- Section tarifs et options (visible si configuré) -->
            <div v-if="hasExistingConfig" class="space-y-4 pt-4 border-t">
              <div class="flex items-center justify-between">
                <h3 class="font-medium">Tarifs et options</h3>
                <UButton
                  size="sm"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-arrow-down-tray"
                  :loading="loadingTiers"
                  @click="loadHelloAssoTiers"
                >
                  Charger depuis HelloAsso
                </UButton>
              </div>

              <!-- Affichage des tarifs -->
              <div v-if="loadedTiers && loadedTiers.length > 0" class="space-y-3">
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 class="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Tarifs disponibles ({{ loadedTiers.length }})
                  </h4>
                  <div class="space-y-2">
                    <div
                      v-for="tier in loadedTiers"
                      :key="tier.id"
                      class="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                    >
                      <div class="flex-1">
                        <div class="font-medium text-sm">{{ tier.name }}</div>
                        <div v-if="tier.description" class="text-xs text-gray-500 mt-1">
                          {{ tier.description }}
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="font-semibold text-primary-600 dark:text-primary-400">
                          {{ (tier.price / 100).toFixed(2) }} €
                        </div>
                        <UBadge
                          v-if="!tier.isActive"
                          color="neutral"
                          variant="soft"
                          size="xs"
                          class="mt-1"
                        >
                          Inactif
                        </UBadge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Affichage des options -->
              <div v-if="loadedOptions && loadedOptions.length > 0" class="space-y-3">
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 class="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Options disponibles ({{ loadedOptions.length }})
                  </h4>
                  <div class="space-y-2">
                    <div
                      v-for="option in loadedOptions"
                      :key="option.id"
                      class="p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-sm">{{ option.name }}</span>
                            <UBadge
                              v-if="option.isRequired"
                              color="warning"
                              variant="soft"
                              size="xs"
                            >
                              Obligatoire
                            </UBadge>
                          </div>
                          <div v-if="option.description" class="text-xs text-gray-500 mt-1">
                            {{ option.description }}
                          </div>
                          <div v-if="option.choices && option.choices.length > 0" class="mt-2">
                            <div class="text-xs text-gray-400 mb-1">Choix disponibles :</div>
                            <div class="flex flex-wrap gap-1">
                              <UBadge
                                v-for="(choice, idx) in option.choices"
                                :key="idx"
                                color="neutral"
                                variant="subtle"
                                size="xs"
                              >
                                {{ choice }}
                              </UBadge>
                            </div>
                          </div>
                        </div>
                        <UBadge color="primary" variant="soft" size="xs">
                          {{ option.type }}
                        </UBadge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Message si aucune donnée chargée -->
              <div
                v-if="tiersLoaded && !loadedTiers?.length && !loadedOptions?.length"
                class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <UIcon name="i-heroicons-inbox" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p class="text-sm text-gray-500">Aucun tarif ou option trouvé</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Autres plateformes (à venir) -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-ellipsis-horizontal-circle" class="text-gray-500" />
              <h2 class="text-lg font-semibold">Autres plateformes</h2>
            </div>

            <div class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <UIcon
                name="i-heroicons-rocket-launch"
                class="mx-auto h-12 w-12 text-gray-400 mb-2"
              />
              <p class="text-sm text-gray-500">
                D'autres plateformes de billetterie seront bientôt disponibles
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

const helloAssoClientId = ref('')
const helloAssoClientSecret = ref('')
const helloAssoOrganizationSlug = ref('')
const helloAssoFormType = ref('Event')
const helloAssoFormSlug = ref('')

const formTypeOptions = [
  { label: 'Événement', value: 'Event' },
  { label: 'Billetterie', value: 'Ticketing' },
  { label: 'Adhésion', value: 'Membership' },
  { label: 'Don', value: 'Donation' },
  { label: 'Crowdfunding', value: 'CrowdFunding' },
  { label: 'Boutique', value: 'Shop' },
]

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger la configuration existante
  await loadExistingConfig()
})

const loadExistingConfig = async () => {
  try {
    const response = await $fetch(`/api/editions/${editionId}/ticketing/external`)
    if (response.hasConfig && response.config?.helloAssoConfig) {
      const haConfig = response.config.helloAssoConfig
      helloAssoClientId.value = haConfig.clientId
      helloAssoOrganizationSlug.value = haConfig.organizationSlug
      helloAssoFormType.value = haConfig.formType
      helloAssoFormSlug.value = haConfig.formSlug
      hasExistingConfig.value = true
      // Le clientSecret n'est pas retourné pour des raisons de sécurité
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

const loadHelloAssoTiers = async () => {
  if (loadingTiers.value) return

  loadingTiers.value = true
  tiersLoaded.value = false
  loadedTiers.value = []
  loadedOptions.value = []

  try {
    const response = await $fetch(`/api/editions/${editionId}/ticketing/helloasso-tiers`)

    loadedTiers.value = response.tiers || []
    loadedOptions.value = response.options || []
    tiersLoaded.value = true

    toast.add({
      title: 'Tarifs chargés',
      description: `${response.tiers?.length || 0} tarif(s) et ${response.options?.length || 0} option(s) trouvé(s)`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Failed to load tiers:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de charger les tarifs',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loadingTiers.value = false
  }
}

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) return true

  // Tous les collaborateurs de la convention (même sans droits)
  if (edition.value.convention?.collaborators) {
    return edition.value.convention.collaborators.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

const canSave = computed(() => {
  return (
    helloAssoClientId.value.trim() !== '' &&
    helloAssoClientSecret.value.trim() !== '' &&
    helloAssoOrganizationSlug.value.trim() !== '' &&
    helloAssoFormType.value !== '' &&
    helloAssoFormSlug.value.trim() !== ''
  )
})

const saving = ref(false)
const loadingTiers = ref(false)
const tiersLoaded = ref(false)
const loadedTiers = ref<any[]>([])
const loadedOptions = ref<any[]>([])
const hasExistingConfig = ref(false)

const saveHelloAssoConfig = async () => {
  if (!canSave.value || saving.value) return

  saving.value = true

  try {
    await $fetch(`/api/editions/${editionId}/ticketing/external`, {
      method: 'POST',
      body: {
        provider: 'HELLOASSO',
        helloAsso: {
          clientId: helloAssoClientId.value,
          clientSecret: helloAssoClientSecret.value,
          organizationSlug: helloAssoOrganizationSlug.value,
          formType: helloAssoFormType.value,
          formSlug: helloAssoFormSlug.value,
        },
      },
    })

    toast.add({
      title: 'Configuration enregistrée',
      description: `HelloAsso configuré pour ${helloAssoOrganizationSlug.value}`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Marquer qu'une configuration existe maintenant
    hasExistingConfig.value = true

    // Effacer le client secret du formulaire (il ne sera plus retourné)
    helloAssoClientSecret.value = ''
  } catch (error: any) {
    console.error('Failed to save config:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de sauvegarder la configuration',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

const testing = ref(false)

const testConnection = async () => {
  if (!canSave.value || testing.value) return

  testing.value = true

  try {
    const result = await $fetch(`/api/editions/${editionId}/ticketing/test-helloasso`, {
      method: 'POST',
      body: {
        clientId: helloAssoClientId.value,
        clientSecret: helloAssoClientSecret.value,
        organizationSlug: helloAssoOrganizationSlug.value,
        formType: helloAssoFormType.value,
        formSlug: helloAssoFormSlug.value,
      },
    })

    toast.add({
      title: 'Connexion réussie !',
      description: `Formulaire trouvé : ${result.form.name} (${result.form.organizationName})`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
      timeout: 5000,
    })
  } catch (error: any) {
    console.error('Test connection error:', error)
    toast.add({
      title: 'Échec de la connexion',
      description: error.data?.message || 'Impossible de se connecter à HelloAsso',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
      timeout: 5000,
    })
  } finally {
    testing.value = false
  }
}
</script>
