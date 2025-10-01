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
          <div class="space-y-6">
            <!-- En-tête avec statut -->
            <div class="flex items-center justify-between">
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
              <UBadge
                v-if="hasExistingConfig"
                color="success"
                variant="soft"
                size="lg"
                class="flex items-center gap-1.5"
              >
                <UIcon name="i-heroicons-check-circle" class="h-4 w-4" />
                Configuré
              </UBadge>
            </div>

            <!-- Alerte d'information -->
            <UAlert
              v-if="!hasExistingConfig"
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              description="Connectez votre compte HelloAsso pour synchroniser automatiquement les billets et participants."
            />

            <!-- Résumé de la configuration (si existante) -->
            <div
              v-if="hasExistingConfig"
              class="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4"
            >
              <div class="flex items-start gap-3">
                <UIcon
                  name="i-heroicons-check-circle"
                  class="text-success-600 dark:text-success-400 h-5 w-5 mt-0.5"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-success-900 dark:text-success-100 mb-2">
                    Configuration active
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div class="flex items-center gap-2">
                      <span class="text-success-700 dark:text-success-300 font-medium">
                        Organisation :
                      </span>
                      <span class="text-success-600 dark:text-success-400">
                        {{ helloAssoOrganizationSlug }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-success-700 dark:text-success-300 font-medium">
                        Formulaire :
                      </span>
                      <span class="text-success-600 dark:text-success-400">
                        {{ helloAssoFormSlug }}
                      </span>
                    </div>
                  </div>
                </div>
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  :icon="showConfigForm ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  @click="showConfigForm = !showConfigForm"
                >
                  {{ showConfigForm ? 'Masquer' : 'Modifier' }}
                </UButton>
              </div>
            </div>

            <!-- Formulaire de connexion HelloAsso -->
            <div v-if="!hasExistingConfig || showConfigForm" class="space-y-6">
              <!-- Étape 1 : Guide et identifiants API -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div
                    class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-sm"
                  >
                    1
                  </div>
                  <h3 class="font-semibold text-base">Identifiants API</h3>
                </div>

                <div
                  class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
                >
                  <div class="flex items-start gap-2">
                    <UIcon
                      name="i-heroicons-information-circle"
                      class="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
                    />
                    <div class="text-sm">
                      <p class="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Obtenir vos identifiants API
                      </p>
                      <p class="text-blue-700 dark:text-blue-300">
                        Consultez le
                        <a
                          href="https://centredaide.helloasso.com/association?question=comment-fonctionne-l-api-helloasso"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="underline hover:text-blue-600 font-medium"
                        >
                          guide HelloAsso
                        </a>
                        pour savoir comment créer un client API et obtenir vos identifiants.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <UFormField
                    label="Client ID"
                    hint="Identifiant public de votre client API"
                    required
                  >
                    <UInput
                      v-model="helloAssoClientId"
                      placeholder="ex: abc123def456"
                      icon="i-heroicons-key"
                      type="text"
                      size="lg"
                      class="font-mono w-full"
                    />
                  </UFormField>

                  <UFormField
                    label="Client Secret"
                    hint="Clé secrète (chiffrée après enregistrement)"
                    required
                  >
                    <UInput
                      v-model="helloAssoClientSecret"
                      placeholder="••••••••••••••••"
                      icon="i-heroicons-lock-closed"
                      type="password"
                      size="lg"
                      class="font-mono w-full"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Étape 2 : Configuration du formulaire -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div
                    class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-sm"
                  >
                    2
                  </div>
                  <h3 class="font-semibold text-base">Identifier votre formulaire</h3>
                </div>

                <div
                  class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    <span class="font-medium">Exemple d'URL HelloAsso :</span>
                  </p>
                  <code
                    class="block text-xs bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 font-mono break-all"
                  >
                    https://www.helloasso.com/associations/<span
                      class="text-primary-600 font-semibold"
                      >slug-organisation</span
                    >/evenements/<span class="text-primary-600 font-semibold">slug-formulaire</span>
                  </code>
                </div>

                <div class="space-y-4">
                  <UFormField
                    label="Slug de l'organisation"
                    hint="Le nom de votre association dans l'URL"
                    required
                  >
                    <UInput
                      v-model="helloAssoOrganizationSlug"
                      placeholder="ex: juggling-convention"
                      icon="i-heroicons-building-office"
                      size="lg"
                    />
                  </UFormField>

                  <UFormField
                    label="Type de formulaire"
                    hint="Le type visible dans l'URL HelloAsso"
                    required
                  >
                    <USelect
                      v-model="helloAssoFormType"
                      :items="formTypeOptions"
                      placeholder="Sélectionnez un type"
                      size="lg"
                    />
                  </UFormField>

                  <UFormField
                    label="Slug du formulaire"
                    hint="Le nom de votre formulaire dans l'URL"
                    required
                  >
                    <UInput
                      v-model="helloAssoFormSlug"
                      placeholder="ex: billeterie-convention-2025"
                      icon="i-heroicons-document-text"
                      size="lg"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <UButton
                  color="primary"
                  icon="i-heroicons-check-circle"
                  :disabled="!canSave"
                  :loading="saving"
                  size="lg"
                  class="flex-1 justify-center"
                  @click="saveHelloAssoConfig"
                >
                  {{ hasExistingConfig ? 'Mettre à jour' : 'Enregistrer la configuration' }}
                </UButton>
                <UButton
                  variant="outline"
                  icon="i-heroicons-arrow-path"
                  :disabled="!canSave"
                  :loading="testing"
                  size="lg"
                  class="flex-1 justify-center"
                  @click="testConnection"
                >
                  Tester la connexion
                </UButton>
              </div>
            </div>

            <!-- Séparateur -->
            <div v-if="hasExistingConfig" class="relative">
              <div class="absolute inset-0 flex items-center" aria-hidden="true">
                <div class="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
            </div>

            <!-- Section tarifs et options (visible si configuré) -->
            <div v-if="hasExistingConfig" class="space-y-5">
              <!-- En-tête avec statistiques -->
              <div class="flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-2">
                  <div
                    class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-sm"
                  >
                    3
                  </div>
                  <div>
                    <h3 class="font-semibold text-base">Tarifs et options</h3>
                    <p class="text-xs text-gray-500">Chargez les données depuis HelloAsso</p>
                  </div>
                </div>
                <UButton
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-arrow-down-tray"
                  :loading="loadingTiers"
                  size="lg"
                  @click="loadHelloAssoTiers"
                >
                  {{ tiersLoaded ? 'Recharger' : 'Charger depuis HelloAsso' }}
                </UButton>
              </div>

              <!-- Statistiques rapides -->
              <div
                v-if="tiersLoaded && (loadedTiers.length > 0 || loadedOptions.length > 0)"
                class="grid grid-cols-2 gap-4"
              >
                <div
                  class="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4"
                >
                  <div class="flex items-center gap-3">
                    <div class="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
                      <UIcon
                        name="i-heroicons-ticket"
                        class="h-5 w-5 text-primary-600 dark:text-primary-400"
                      />
                    </div>
                    <div>
                      <p class="text-2xl font-bold text-primary-900 dark:text-primary-100">
                        {{ loadedTiers.length }}
                      </p>
                      <p class="text-xs text-primary-600 dark:text-primary-400">
                        {{ loadedTiers.length > 1 ? 'Tarifs' : 'Tarif' }}
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
                >
                  <div class="flex items-center gap-3">
                    <div class="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                      <UIcon
                        name="i-heroicons-adjustments-horizontal"
                        class="h-5 w-5 text-orange-600 dark:text-orange-400"
                      />
                    </div>
                    <div>
                      <p class="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {{ loadedOptions.length }}
                      </p>
                      <p class="text-xs text-orange-600 dark:text-orange-400">
                        {{ loadedOptions.length > 1 ? 'Options' : 'Option' }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Affichage des tarifs -->
              <div v-if="loadedTiers && loadedTiers.length > 0" class="space-y-3">
                <div class="flex items-center gap-2 mb-2">
                  <UIcon
                    name="i-heroicons-ticket"
                    class="h-5 w-5 text-primary-600 dark:text-primary-400"
                  />
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Tarifs disponibles
                  </h4>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    v-for="tier in loadedTiers"
                    :key="tier.id"
                    class="group relative bg-white dark:bg-gray-800 rounded-lg border-2 p-4 transition-all"
                    :class="
                      tier.isActive
                        ? 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                        : 'border-gray-100 dark:border-gray-800 opacity-60'
                    "
                  >
                    <!-- Badge statut -->
                    <UBadge
                      v-if="!tier.isActive"
                      color="neutral"
                      variant="soft"
                      size="xs"
                      class="absolute top-3 right-3"
                    >
                      Inactif
                    </UBadge>

                    <div class="space-y-3">
                      <!-- Nom et prix -->
                      <div>
                        <h5 class="font-semibold text-base text-gray-900 dark:text-white">
                          {{ tier.name }}
                        </h5>
                        <div class="mt-1 flex items-baseline gap-1">
                          <span
                            class="text-2xl font-bold"
                            :class="
                              tier.isActive
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-gray-400 dark:text-gray-600'
                            "
                          >
                            {{ (tier.price / 100).toFixed(2) }}
                          </span>
                          <span class="text-sm text-gray-500">€</span>
                        </div>
                      </div>

                      <!-- Description -->
                      <p
                        v-if="tier.description"
                        class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
                      >
                        {{ tier.description }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Affichage des options -->
              <div v-if="loadedOptions && loadedOptions.length > 0" class="space-y-3">
                <div class="flex items-center gap-2 mb-2">
                  <UIcon
                    name="i-heroicons-adjustments-horizontal"
                    class="h-5 w-5 text-orange-600 dark:text-orange-400"
                  />
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Options disponibles
                  </h4>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="option in loadedOptions"
                    :key="option.id"
                    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <!-- Contenu principal -->
                      <div class="flex-1 min-w-0">
                        <!-- En-tête -->
                        <div class="flex items-start gap-2 mb-2">
                          <div class="flex-1">
                            <h5 class="font-semibold text-sm text-gray-900 dark:text-white">
                              {{ option.name }}
                            </h5>
                            <p
                              v-if="option.description"
                              class="text-xs text-gray-600 dark:text-gray-400 mt-0.5"
                            >
                              {{ option.description }}
                            </p>
                          </div>
                        </div>

                        <!-- Choix disponibles -->
                        <div
                          v-if="option.choices && option.choices.length > 0"
                          class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
                        >
                          <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Choix disponibles :
                          </div>
                          <div class="flex flex-wrap gap-1.5">
                            <UBadge
                              v-for="(choice, idx) in option.choices"
                              :key="idx"
                              color="neutral"
                              variant="subtle"
                              size="sm"
                            >
                              {{ choice }}
                            </UBadge>
                          </div>
                        </div>
                      </div>

                      <!-- Badges latéraux -->
                      <div class="flex flex-col gap-2 items-end flex-shrink-0">
                        <UBadge color="primary" variant="soft" size="sm">
                          {{ option.type }}
                        </UBadge>
                        <UBadge v-if="option.isRequired" color="warning" variant="soft" size="sm">
                          Obligatoire
                        </UBadge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Message si aucune donnée chargée -->
              <div
                v-if="tiersLoaded && !loadedTiers?.length && !loadedOptions?.length"
                class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700"
              >
                <UIcon
                  name="i-heroicons-inbox"
                  class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3"
                />
                <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Aucun tarif ou option trouvé
                </p>
                <p class="text-xs text-gray-500 mt-1">
                  Vérifiez que votre formulaire HelloAsso contient des tarifs
                </p>
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
const showConfigForm = ref(false)

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
    })
  } catch (error: any) {
    console.error('Test connection error:', error)
    toast.add({
      title: 'Échec de la connexion',
      description: error.data?.message || 'Impossible de se connecter à HelloAsso',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    testing.value = false
  }
}
</script>
