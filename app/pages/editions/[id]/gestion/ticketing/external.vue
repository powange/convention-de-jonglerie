<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
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
                <div class="flex gap-2">
                  <UButton
                    variant="ghost"
                    color="error"
                    size="sm"
                    icon="i-heroicons-trash"
                    @click="confirmDisconnect"
                  >
                    Désassocier
                  </UButton>
                  <UButton
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    icon="i-heroicons-pencil"
                    @click="openConfigModal"
                  >
                    Modifier
                  </UButton>
                </div>
              </div>
            </div>

            <!-- Bouton pour ouvrir la modal de configuration -->
            <div v-if="!hasExistingConfig" class="pt-4">
              <UButton
                color="primary"
                icon="i-heroicons-plus-circle"
                size="lg"
                class="justify-center"
                @click="openConfigModal"
              >
                Configurer HelloAsso
              </UButton>
            </div>

            <!-- Ancien formulaire (caché, remplacé par la modal) -->
            <div v-if="false" class="space-y-6">
              <!-- Étape 1 : Guide et identifiants API -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div
                    class="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-sm"
                  >
                    1
                  </div>
                  <h3 class="font-semibold text-base">
                    {{ $t('edition.ticketing.api_credentials') }}
                  </h3>
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
                    :label="$t('edition.ticketing.client_id_label')"
                    hint="Identifiant public de votre client API"
                    required
                  >
                    <UInput
                      v-model="helloAssoClientId"
                      :placeholder="$t('edition.ticketing.client_id_placeholder')"
                      icon="i-heroicons-key"
                      type="text"
                      size="lg"
                      class="font-mono w-full"
                    />
                  </UFormField>

                  <UFormField
                    :label="$t('edition.ticketing.client_secret_label')"
                    hint="Clé secrète (chiffrée après enregistrement)"
                    required
                  >
                    <UInput
                      v-model="helloAssoClientSecret"
                      :placeholder="$t('edition.ticketing.client_secret_placeholder')"
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
                  <h3 class="font-semibold text-base">
                    {{ $t('edition.ticketing.identify_form') }}
                  </h3>
                </div>

                <div
                  class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    <span class="font-medium">{{
                      $t('edition.ticketing.helloasso_url_example')
                    }}</span>
                  </p>
                  <code
                    class="block text-xs bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 font-mono break-all"
                  >
                    https://www.helloasso.com/associations/<span
                      class="text-primary-600 font-semibold"
                      >slug-organisation</span
                    >{{ $t('edition.ticketing.helloasso_url_path')
                    }}<span class="text-primary-600 font-semibold">slug-formulaire</span>
                  </code>
                </div>

                <div class="space-y-4">
                  <UFormField
                    :label="$t('edition.ticketing.organization_slug_label')"
                    hint="Le nom de votre association dans l'URL"
                    required
                  >
                    <UInput
                      v-model="helloAssoOrganizationSlug"
                      :placeholder="$t('edition.ticketing.organization_slug_placeholder')"
                      icon="i-heroicons-building-office"
                      size="lg"
                    />
                  </UFormField>

                  <UFormField
                    :label="$t('edition.ticketing.form_type_label')"
                    hint="Le type visible dans l'URL HelloAsso"
                    required
                  >
                    <USelect
                      v-model="helloAssoFormType"
                      :items="formTypeOptions"
                      :placeholder="$t('edition.ticketing.form_type_placeholder')"
                      size="lg"
                    />
                  </UFormField>

                  <UFormField
                    :label="$t('edition.ticketing.form_slug_label')"
                    hint="Le nom de votre formulaire dans l'URL"
                    required
                  >
                    <UInput
                      v-model="helloAssoFormSlug"
                      :placeholder="$t('edition.ticketing.form_slug_placeholder')"
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

            <!-- Section tarifs et options (visible si configuré) -->
            <div v-if="hasExistingConfig" class="space-y-5">
              <!-- En-tête avec statistiques -->
              <div class="flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-2">
                  <div>
                    <h3 class="font-semibold text-base">
                      {{ $t('edition.ticketing.tiers_options_participants') }}
                    </h3>
                    <p class="text-xs text-gray-500">
                      {{ $t('edition.ticketing.load_data_from_helloasso') }}
                    </p>
                  </div>
                </div>
                <div class="flex gap-2">
                  <UButton
                    color="primary"
                    variant="soft"
                    icon="i-heroicons-arrow-down-tray"
                    :loading="loadingTiers"
                    size="lg"
                    @click="loadHelloAssoTiers"
                  >
                    {{ tiersLoaded ? 'Recharger' : 'Charger' }} tarifs
                  </UButton>
                  <UButton
                    color="success"
                    variant="soft"
                    icon="i-heroicons-users"
                    :loading="loadingOrders"
                    size="lg"
                    @click="loadOrdersFromHelloAsso"
                  >
                    {{ ordersLoaded ? 'Recharger' : 'Charger' }} participants
                  </UButton>
                </div>
              </div>

              <UTabs
                v-if="tiersLoaded || ordersLoaded"
                :items="items"
                variant="link"
                :ui="{ trigger: 'grow' }"
                class="gap-4 w-full"
              >
                <template #tarifs>
                  <!-- Affichage des tarifs -->
                  <div v-if="loadedTiers && loadedTiers.length > 0" class="space-y-3">
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
                </template>

                <template #options>
                  <!-- Affichage des options -->
                  <div v-if="loadedOptions && loadedOptions.length > 0" class="space-y-3">
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
                                <div class="flex items-center gap-2">
                                  <h5 class="font-semibold text-sm text-gray-900 dark:text-white">
                                    {{ option.name }}
                                  </h5>
                                  <span
                                    v-if="option.price"
                                    class="text-sm font-semibold text-primary-600 dark:text-primary-400"
                                  >
                                    + {{ (option.price / 100).toFixed(2) }} €
                                  </span>
                                </div>
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
                            <UBadge
                              v-if="option.isRequired"
                              color="warning"
                              variant="soft"
                              size="sm"
                            >
                              Obligatoire
                            </UBadge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <template #customFields>
                  <!-- Affichage des custom fields -->
                  <div v-if="loadedCustomFields && loadedCustomFields.length > 0" class="space-y-3">
                    <div class="space-y-2">
                      <div
                        v-for="customField in loadedCustomFields"
                        :key="customField.id"
                        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                      >
                        <div class="flex items-start justify-between gap-4">
                          <!-- Contenu principal -->
                          <div class="flex-1 min-w-0">
                            <!-- En-tête -->
                            <div class="flex items-start gap-2 mb-2">
                              <div class="flex-1">
                                <div class="flex items-center gap-2">
                                  <h5 class="font-semibold text-sm text-gray-900 dark:text-white">
                                    {{ customField.label }}
                                  </h5>
                                </div>
                              </div>
                            </div>

                            <!-- Tarifs associés -->
                            <div
                              v-if="customField.tiers && customField.tiers.length > 0"
                              class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
                            >
                              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Tarifs concernés :
                              </div>
                              <div class="flex flex-wrap gap-1.5">
                                <UBadge
                                  v-for="tier in customField.tiers"
                                  :key="tier"
                                  color="neutral"
                                  variant="subtle"
                                  size="sm"
                                >
                                  {{ tier }}
                                </UBadge>
                              </div>
                            </div>

                            <!-- Valeurs disponibles -->
                            <div
                              v-if="customField.values && customField.values.length > 0"
                              class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
                            >
                              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Valeurs possibles :
                              </div>
                              <div class="flex flex-wrap gap-1.5">
                                <UBadge
                                  v-for="(value, idx) in customField.values"
                                  :key="idx"
                                  color="primary"
                                  variant="subtle"
                                  size="sm"
                                >
                                  {{ value }}
                                </UBadge>
                              </div>
                            </div>
                          </div>

                          <!-- Badges latéraux -->
                          <div class="flex flex-col gap-2 items-end flex-shrink-0">
                            <UBadge color="purple" variant="soft" size="sm">
                              {{ customField.type }}
                            </UBadge>
                            <UBadge
                              v-if="customField.isRequired"
                              color="warning"
                              variant="soft"
                              size="sm"
                            >
                              Obligatoire
                            </UBadge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <template #participants>
                  <!-- Affichage des participants -->
                  <div v-if="loadedOrders && loadedOrders.length > 0" class="space-y-3">
                    <div class="space-y-4">
                      <div
                        v-for="order in loadedOrders"
                        :key="order.id"
                        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                      >
                        <!-- En-tête de la commande -->
                        <div
                          class="flex items-start justify-between mb-3 pb-3 border-b border-gray-200 dark:border-gray-700"
                        >
                          <div>
                            <div class="flex items-center gap-2">
                              <UIcon
                                name="i-heroicons-shopping-cart"
                                class="h-5 w-5 text-primary-600 dark:text-primary-400"
                              />
                              <h5 class="font-semibold text-base text-gray-900 dark:text-white">
                                {{ order.payer.firstName }} {{ order.payer.lastName }}
                              </h5>
                            </div>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {{ order.payer.email }}
                            </p>
                          </div>
                          <UBadge color="success" variant="soft">
                            {{ order.items.length }}
                            {{ order.items.length > 1 ? 'billets' : 'billet' }}
                          </UBadge>
                        </div>

                        <!-- Items de la commande -->
                        <div class="space-y-2">
                          <div
                            v-for="item in order.items"
                            :key="item.id"
                            class="flex items-start justify-between gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50"
                          >
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 mb-1">
                                <UIcon name="i-heroicons-ticket" class="h-4 w-4 text-gray-500" />
                                <span class="font-medium text-sm text-gray-900 dark:text-white">
                                  {{ item.name || item.type + ' - ' + item.priceCategory }}
                                </span>
                              </div>
                              <div
                                v-if="item.user"
                                class="text-xs text-gray-600 dark:text-gray-400"
                              >
                                {{ item.user.firstName }} {{ item.user.lastName }}
                                <span v-if="item.user.email" class="ml-1"
                                  >({{ item.user.email }})</span
                                >
                              </div>
                              <div
                                v-if="item.qrCode"
                                class="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono"
                              >
                                QR: {{ item.qrCode }}
                              </div>
                            </div>
                            <div class="text-right flex-shrink-0">
                              <div
                                class="font-semibold text-sm text-primary-600 dark:text-primary-400"
                              >
                                {{ (item.amount / 100).toFixed(2) }} €
                              </div>
                              <UBadge
                                :color="item.state === 'Processed' ? 'success' : 'neutral'"
                                variant="subtle"
                                size="xs"
                                class="mt-1"
                              >
                                {{ item.state }}
                              </UBadge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </UTabs>

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

      <!-- Modal de configuration HelloAsso -->
      <HelloAssoConfigModal
        ref="configModalRef"
        v-model:open="showConfigModal"
        :config="currentConfig"
        :ticketing-url="edition?.ticketingUrl || undefined"
        @save="handleConfigSave"
        @test="handleConfigTest"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import HelloAssoConfigModal from '~/components/edition/ticketing/HelloAssoConfigModal.vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

import type { TabsItem } from '@nuxt/ui'

definePageMeta({
  layout: 'edition-dashboard',
})

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

// Options pour le type de formulaire HelloAsso
const formTypeOptions = [
  { label: 'Événement', value: 'Event' },
  { label: 'Billetterie', value: 'Ticketing' },
  { label: 'Adhésion', value: 'Membership' },
  { label: 'Formulaire', value: 'Form' },
  { label: 'Crowdfunding', value: 'CrowdFunding' },
  { label: 'Boutique', value: 'Shop' },
  { label: 'Don', value: 'Donation' },
]

// Modal
const showConfigModal = ref(false)
const configModalRef = ref<InstanceType<typeof HelloAssoConfigModal> | null>(null)

const currentConfig = computed(() => {
  if (!hasExistingConfig.value) return undefined

  return {
    clientId: helloAssoClientId.value,
    clientSecret: helloAssoClientSecret.value,
    organizationSlug: helloAssoOrganizationSlug.value,
    formType: helloAssoFormType.value,
    formSlug: helloAssoFormSlug.value,
  }
})

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
      return
    }
  }

  // Charger la configuration existante uniquement si l'utilisateur a accès
  if (canAccess.value) {
    await loadExistingConfig()
  }
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
  loadedCustomFields.value = []

  try {
    const response = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/tiers`)

    loadedTiers.value = response.tiers || []
    loadedOptions.value = response.options || []

    // Extraire les custom fields des tarifs
    const customFieldsMap = new Map()
    if (response.tiers) {
      for (const tier of response.tiers) {
        if (tier.customFields && tier.customFields.length > 0) {
          for (const customField of tier.customFields) {
            if (!customFieldsMap.has(customField.id)) {
              customFieldsMap.set(customField.id, {
                id: customField.id,
                label: customField.label,
                type: customField.type,
                isRequired: customField.isRequired,
                values: customField.values || [],
                tiers: [],
              })
            }
            // Ajouter le nom du tarif à la liste des tarifs concernés
            customFieldsMap.get(customField.id).tiers.push(tier.name)
          }
        }
      }
    }
    loadedCustomFields.value = Array.from(customFieldsMap.values())

    tiersLoaded.value = true

    toast.add({
      title: 'Tarifs chargés',
      description: `${response.tiers?.length || 0} tarif(s), ${response.options?.length || 0} option(s) et ${loadedCustomFields.value.length} champ(s) personnalisé(s) trouvé(s)`,
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

  // Tous les organisateurs de la convention (même sans droits)
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// Surveiller les changements de permissions (mode admin, etc.)
watch(canAccess, async (newValue, oldValue) => {
  // Si l'accès vient de passer à true et qu'on n'a pas encore chargé la config
  if (newValue && !oldValue && !hasExistingConfig.value) {
    await loadExistingConfig()
  }
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

// Ouvrir la modal de configuration
const openConfigModal = () => {
  showConfigModal.value = true
}

// Gestion de la sauvegarde depuis la modal
const handleConfigSave = async (config: any) => {
  try {
    await $fetch(`/api/editions/${editionId}/ticketing/external`, {
      method: 'POST',
      body: {
        provider: 'HELLOASSO',
        helloAsso: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          organizationSlug: config.organizationSlug,
          formType: config.formType,
          formSlug: config.formSlug,
        },
      },
    })

    // Mettre à jour les valeurs locales
    helloAssoClientId.value = config.clientId
    helloAssoOrganizationSlug.value = config.organizationSlug
    helloAssoFormType.value = config.formType
    helloAssoFormSlug.value = config.formSlug
    helloAssoClientSecret.value = ''

    hasExistingConfig.value = true

    toast.add({
      title: 'Configuration enregistrée',
      description: `HelloAsso configuré pour ${config.organizationSlug}`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Fermer la modal
    showConfigModal.value = false
  } catch (error: any) {
    console.error('Failed to save config:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de sauvegarder la configuration',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    configModalRef.value?.setSaving(false)
  }
}

// Gestion du test de connexion depuis la modal
const handleConfigTest = async (config: any) => {
  try {
    const result = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/test`, {
      method: 'POST',
      body: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        organizationSlug: config.organizationSlug,
        formType: config.formType,
        formSlug: config.formSlug,
      },
    })

    toast.add({
      title: 'Connexion réussie !',
      description: `Formulaire trouvé : ${(result as any).form.name} (${(result as any).form.organizationName})`,
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
    configModalRef.value?.setTesting(false)
  }
}

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
const disconnecting = ref(false)

const testConnection = async () => {
  if (!canSave.value || testing.value) return

  testing.value = true

  try {
    const result = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/test`, {
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

const confirmDisconnect = async () => {
  if (disconnecting.value) return

  const confirmed = confirm(
    'Êtes-vous sûr de vouloir désassocier la billeterie HelloAsso ?\n\nCette action supprimera toutes les configurations et est irréversible.'
  )

  if (confirmed) {
    await disconnectHelloAsso()
  }
}

const disconnectHelloAsso = async () => {
  if (disconnecting.value) return

  disconnecting.value = true

  try {
    await $fetch(`/api/editions/${editionId}/ticketing/external`, {
      method: 'DELETE',
    })

    toast.add({
      title: 'Configuration supprimée',
      description: 'La billeterie HelloAsso a été désassociée avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    // Réinitialiser l'état
    hasExistingConfig.value = false
    tiersLoaded.value = false
    loadedTiers.value = []
    loadedOptions.value = []

    // Réinitialiser les champs du formulaire
    helloAssoClientId.value = ''
    helloAssoClientSecret.value = ''
    helloAssoOrganizationSlug.value = ''
    helloAssoFormType.value = 'Event'
    helloAssoFormSlug.value = ''
  } catch (error: any) {
    console.error('Failed to disconnect:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de supprimer la configuration',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    disconnecting.value = false
  }
}

const loadingOrders = ref(false)
const ordersLoaded = ref(false)
const loadedOrders = ref<any[]>([])
const ordersStats = ref({ totalOrders: 0, totalItems: 0 })

const loadOrdersFromHelloAsso = async () => {
  if (loadingOrders.value) return

  loadingOrders.value = true
  ordersLoaded.value = false
  loadedOrders.value = []

  try {
    const response = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/orders`)

    loadedOrders.value = response.orders || []
    ordersStats.value = response.stats || { totalOrders: 0, totalItems: 0 }
    ordersLoaded.value = true

    toast.add({
      title: 'Participants chargés',
      description: `${response.stats?.totalOrders || 0} commande(s) et ${response.stats?.totalItems || 0} participant(s) trouvé(s)`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Failed to load orders:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de charger les participants',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loadingOrders.value = false
  }
}

const loadedCustomFields = ref<any[]>([])

const items = computed(
  () =>
    [
      {
        label: 'Tarifs disponibles',
        description: 'Modifiez les tarifs disponibles pour cet événement.',
        icon: 'i-heroicons-ticket',
        slot: 'tarifs' as const,
        badge: loadedTiers.value.length,
      },
      {
        label: 'Options disponibles',
        description: 'Modifiez les options disponibles pour cet événement.',
        icon: 'i-heroicons-adjustments-horizontal',
        slot: 'options' as const,
        badge: loadedOptions.value.length,
      },
      {
        label: 'Champs personnalisés',
        description: 'Consultez les champs personnalisés des tarifs.',
        icon: 'i-heroicons-pencil-square',
        slot: 'customFields' as const,
        badge: loadedCustomFields.value.length,
      },
      {
        label: 'Participants',
        description: 'Consultez la liste des participants.',
        icon: 'i-heroicons-users',
        slot: 'participants' as const,
        badge: ordersStats.value.totalItems,
      },
    ] satisfies TabsItem[]
)
</script>
