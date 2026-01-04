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
          <UIcon name="i-heroicons-shopping-cart" class="text-green-600 dark:text-green-400" />
          Commandes et participants
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Consultez les commandes importées depuis votre billeterie externe et celles créées
          manuellement
        </p>
      </div>

      <!-- Message informatif si pas de configuration externe -->
      <UAlert
        v-if="!hasExternalTicketing"
        icon="i-heroicons-information-circle"
        color="info"
        variant="soft"
        class="mb-6"
      >
        <template #title>Billeterie externe non configurée</template>
        <template #description>
          <div class="space-y-2">
            <p>
              Vous pouvez connecter une billeterie externe (HelloAsso, etc.) pour importer
              automatiquement les commandes, mais vous pouvez également créer des commandes
              manuellement via le contrôle d'accès.
            </p>
            <UButton
              :to="`/editions/${edition.id}/gestion/ticketing/external`"
              color="primary"
              variant="soft"
              icon="i-heroicons-arrow-right"
            >
              Configurer une billeterie externe
            </UButton>
          </div>
        </template>
      </UAlert>

      <!-- Contenu principal -->
      <div class="space-y-6">
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <UIcon name="i-heroicons-shopping-cart" class="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Commandes</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ stats.totalOrders }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <UIcon name="i-heroicons-ticket" class="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Billets</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ stats.totalItems }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard
            class="cursor-pointer hover:shadow-lg transition-shadow"
            @click="isAmountDetailsModalOpen = true"
          >
            <div class="flex items-center gap-4">
              <div class="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <UIcon name="i-heroicons-currency-euro" class="h-6 w-6 text-purple-600" />
              </div>
              <div class="flex-1">
                <p class="text-sm text-gray-600 dark:text-gray-400">Montant total</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ (stats.totalAmount / 100).toFixed(2) }}€
                </p>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <UIcon name="i-heroicons-heart" class="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Donations</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ stats.totalDonations }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-500">
                  {{ (stats.totalDonationsAmount / 100).toFixed(2) }}€
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-success-100 dark:bg-success-900/30 rounded-lg">
                <UIcon name="i-heroicons-clock" class="h-6 w-6 text-success-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Dernière sync</p>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ lastSyncText }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Filtre de recherche -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-4">
              <UInput
                v-model="searchQuery"
                placeholder="Rechercher par nom, email, numéro de chèque..."
                icon="i-heroicons-magnifying-glass"
                class="flex-1"
                size="lg"
              />
              <UButton
                color="primary"
                variant="soft"
                icon="i-heroicons-funnel"
                size="lg"
                @click="isFiltersOpen = !isFiltersOpen"
              >
                Filtres
                <UBadge
                  v-if="activeFiltersCount > 0"
                  color="primary"
                  variant="solid"
                  size="sm"
                  class="ml-2"
                >
                  {{ activeFiltersCount }}
                </UBadge>
              </UButton>
            </div>

            <!-- Section des filtres (cachée par défaut) -->
            <div v-if="isFiltersOpen" class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <!-- Filtre par tarifs -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filtrer par tarifs
                  </label>
                  <USelect
                    v-model="selectedTierIds"
                    :items="tierSelectItems"
                    multiple
                    placeholder="Sélectionner des tarifs"
                    value-key="value"
                    size="md"
                    class="w-full"
                    :ui="{ content: 'min-w-fit' }"
                  >
                    <template #default="{ modelValue }">
                      <span v-if="Array.isArray(modelValue) && modelValue.length > 0">
                        {{ modelValue.length }}
                        {{
                          modelValue.length > 1
                            ? $t('common.items_selected')
                            : $t('common.item_selected')
                        }}
                      </span>
                      <span v-else class="text-gray-400 dark:text-gray-500">
                        Sélectionner des tarifs
                      </span>
                    </template>
                    <template #item-label="{ item }">
                      <div class="flex items-center justify-between w-full">
                        <span>{{ item.label }}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                          {{ (item.price / 100).toFixed(2) }}€
                        </span>
                      </div>
                    </template>
                  </USelect>
                </div>

                <!-- Filtre par options -->
                <div v-if="optionSelectItems.length > 0">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filtrer par options
                  </label>
                  <USelect
                    v-model="selectedOptionIds"
                    :items="optionSelectItems"
                    multiple
                    placeholder="Sélectionner des options"
                    value-key="value"
                    size="md"
                    class="w-full"
                    :ui="{ content: 'min-w-fit' }"
                  >
                    <template #default="{ modelValue }">
                      <span v-if="Array.isArray(modelValue) && modelValue.length > 0">
                        {{ modelValue.length }}
                        {{
                          modelValue.length > 1
                            ? $t('common.items_selected')
                            : $t('common.item_selected')
                        }}
                      </span>
                      <span v-else class="text-gray-400 dark:text-gray-500">
                        Sélectionner des options
                      </span>
                    </template>
                    <template #item-label="{ item }">
                      <div class="flex items-center justify-between w-full">
                        <span>{{ item.label }}</span>
                        <span
                          v-if="item.price > 0"
                          class="text-xs text-gray-500 dark:text-gray-400"
                        >
                          +{{ (item.price / 100).toFixed(2) }}€
                        </span>
                      </div>
                    </template>
                  </USelect>
                </div>

                <!-- Filtre par statut d'entrée -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Statut d'entrée
                  </label>
                  <USelect
                    v-model="entryStatusFilter"
                    :items="entryStatusOptions"
                    placeholder="Tous les billets"
                    value-key="value"
                    size="md"
                    class="w-full"
                    :ui="{ content: 'min-w-fit' }"
                  />
                </div>

                <!-- Filtre par méthode de paiement -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Méthode de paiement
                  </label>
                  <USelect
                    v-model="paymentMethodFilter"
                    :items="paymentMethodOptions"
                    placeholder="Toutes les méthodes"
                    value-key="value"
                    size="md"
                    class="w-full"
                    :ui="{ content: 'min-w-fit' }"
                    multiple
                  />
                </div>
              </div>

              <!-- Filtres par champs personnalisés -->
              <div v-if="customFieldNameItems.length > 0" class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Champs personnalisés
                    <span v-if="customFieldFilters.length > 0" class="text-gray-500 font-normal">
                      ({{ customFieldFilters.length }} filtre{{
                        customFieldFilters.length > 1 ? 's' : ''
                      }})
                    </span>
                  </label>

                  <!-- Switch ET/OU (visible quand il y a au moins 2 filtres) -->
                  <div
                    v-if="customFieldFilters.length >= 2"
                    class="flex items-center gap-2 text-sm"
                  >
                    <span
                      :class="
                        customFieldFilterMode === 'and'
                          ? 'text-primary-600 dark:text-primary-400 font-medium'
                          : 'text-gray-500'
                      "
                    >
                      ET
                    </span>
                    <USwitch
                      :model-value="customFieldFilterMode === 'or'"
                      color="primary"
                      @update:model-value="customFieldFilterMode = $event ? 'or' : 'and'"
                    />
                    <span
                      :class="
                        customFieldFilterMode === 'or'
                          ? 'text-primary-600 dark:text-primary-400 font-medium'
                          : 'text-gray-500'
                      "
                    >
                      OU
                    </span>
                  </div>
                </div>

                <!-- Filtres existants -->
                <div v-if="customFieldFilters.length > 0" class="space-y-2">
                  <div
                    v-for="(filter, index) in customFieldFilters"
                    :key="index"
                    class="flex items-center gap-2 p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
                  >
                    <UIcon
                      name="i-heroicons-funnel"
                      class="h-4 w-4 text-primary-600 flex-shrink-0"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      <span class="font-medium">{{ filter.name }}</span>
                      <span class="mx-1">=</span>
                      <span class="text-primary-600 dark:text-primary-400">{{ filter.value }}</span>
                    </span>
                    <UButton
                      color="error"
                      variant="ghost"
                      size="sm"
                      icon="i-heroicons-x-mark"
                      @click="removeCustomFieldFilter(index)"
                    />
                  </div>
                </div>

                <!-- Formulaire pour ajouter un nouveau filtre -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <USelect
                    v-model="newFilterName"
                    :items="customFieldNameItems"
                    placeholder="Sélectionner un champ"
                    value-key="value"
                    size="md"
                    class="w-full"
                    :ui="{ content: 'min-w-fit' }"
                  />
                  <USelect
                    v-model="newFilterValue"
                    :items="newFilterValueItems"
                    :disabled="!newFilterName"
                    placeholder="Sélectionner une valeur"
                    value-key="value"
                    size="md"
                    class="w-full"
                    :ui="{ content: 'min-w-fit' }"
                  />
                  <UButton
                    color="primary"
                    variant="soft"
                    size="md"
                    icon="i-heroicons-plus"
                    :disabled="!newFilterName || !newFilterValue"
                    @click="addCustomFieldFilter"
                  >
                    Ajouter
                  </UButton>
                </div>
              </div>

              <!-- Bouton de réinitialisation -->
              <div v-if="activeFiltersCount > 0" class="pt-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-heroicons-x-mark"
                  @click="resetFilters"
                >
                  Réinitialiser tous les filtres
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Liste des commandes -->
        <div v-if="loading" class="text-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin mx-auto" />
          <p class="text-sm text-gray-500 mt-2">Chargement...</p>
        </div>

        <div v-else-if="orders.length === 0" class="text-center py-12">
          <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
          <p class="text-sm text-gray-500">
            {{
              searchQuery || entryStatusFilter !== 'all'
                ? 'Aucun résultat trouvé'
                : 'Aucune commande trouvée'
            }}
          </p>
          <p v-if="!searchQuery && entryStatusFilter === 'all'" class="text-xs text-gray-400 mt-1">
            Importez les commandes depuis votre billeterie externe
          </p>
        </div>

        <div v-else class="space-y-4">
          <UCard v-for="order in orders" :key="order.id" class="hover:shadow-md transition-shadow">
            <!-- En-tête de la commande -->
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <UIcon name="i-heroicons-shopping-cart" class="h-5 w-5 text-primary-600" />
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ order.payerFirstName }} {{ order.payerLastName }}
                  </h3>
                  <!-- Badge Annulée (seulement si la commande est annulée) -->
                  <UBadge v-if="order.status === 'Refunded'" color="error" variant="soft">
                    Annulée
                  </UBadge>
                  <!-- Badge origine : En ligne vs Sur place -->
                  <UPopover
                    v-if="order.externalTicketing?.provider === 'HELLOASSO'"
                    mode="hover"
                    :open-delay="200"
                  >
                    <img
                      src="~/assets/img/helloasso/logo.svg"
                      alt="HelloAsso"
                      class="h-5 w-auto cursor-help"
                    />
                    <template #content>
                      <div class="p-3 max-w-xs">
                        <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          HelloAsso
                        </p>
                        <p class="text-xs text-gray-600 dark:text-gray-400">
                          Commande importée depuis HelloAsso
                        </p>
                        <p
                          v-if="order.helloAssoOrderId"
                          class="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono"
                        >
                          ID: {{ order.helloAssoOrderId }}
                        </p>
                      </div>
                    </template>
                  </UPopover>
                  <UPopover v-else-if="!order.externalTicketing" mode="hover" :open-delay="200">
                    <img src="/logos/logo-jc.svg" alt="Sur place" class="h-5 w-auto cursor-help" />
                    <template #content>
                      <div class="p-3 max-w-xs">
                        <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Sur place
                        </p>
                        <p class="text-xs text-gray-600 dark:text-gray-400">
                          Commande créée manuellement sur place
                        </p>
                      </div>
                    </template>
                  </UPopover>
                  <!-- Badge statut de paiement -->
                  <UBadge
                    v-if="
                      (order.status === 'Processed' || order.status === 'Onsite') &&
                      !order.paymentMethod
                    "
                    color="warning"
                    variant="soft"
                    class="cursor-pointer hover:ring-2 hover:ring-warning-500 transition-all"
                    @click="openPaymentMethodModal(order)"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-exclamation-triangle" class="h-3 w-3" />
                    </template>
                    Payé - Méthode non renseignée
                  </UBadge>
                  <UBadge v-else-if="order.paymentMethod === 'cash'" color="success" variant="soft">
                    <template #leading>
                      <UIcon name="i-heroicons-banknotes" class="h-3 w-3" />
                    </template>
                    Payé - Liquide
                  </UBadge>
                  <UBadge v-else-if="order.paymentMethod === 'card'" color="success" variant="soft">
                    <template #leading>
                      <UIcon name="i-heroicons-credit-card" class="h-3 w-3" />
                    </template>
                    Payé - Carte
                  </UBadge>
                  <UBadge
                    v-else-if="order.paymentMethod === 'check'"
                    color="success"
                    variant="soft"
                    :title="order.checkNumber ? `Chèque n°${order.checkNumber}` : undefined"
                  >
                    <template #leading>
                      <UIcon name="i-heroicons-document-text" class="h-3 w-3" />
                    </template>
                    Payé - Chèque{{ order.checkNumber ? ` n°${order.checkNumber}` : '' }}
                  </UBadge>
                  <UBadge v-else-if="order.status === 'Pending'" color="warning" variant="soft">
                    <template #leading>
                      <UIcon name="i-heroicons-clock" class="h-3 w-3" />
                    </template>
                    En attente de paiement
                  </UBadge>
                </div>
                <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div class="flex items-center gap-1">
                    <UIcon name="i-heroicons-envelope" class="h-4 w-4" />
                    {{ order.payerEmail }}
                  </div>
                  <div class="flex items-center gap-1">
                    <UIcon name="i-heroicons-calendar" class="h-4 w-4" />
                    {{ formatDate(order.orderDate) }}
                  </div>
                  <div class="flex items-center gap-1">
                    <UIcon name="i-heroicons-hashtag" class="h-4 w-4" />
                    <span class="font-mono text-xs">{{ order.id }}</span>
                  </div>
                </div>
              </div>
              <div class="text-right flex flex-col items-end gap-2">
                <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {{ (order.amount / 100).toFixed(2) }}€
                </div>
                <!-- Bouton d'annulation/suppression (seulement pour les commandes manuelles) -->
                <UButton
                  v-if="!order.externalTicketing"
                  :color="order.status === 'Refunded' ? 'error' : 'warning'"
                  variant="soft"
                  size="sm"
                  :icon="order.status === 'Refunded' ? 'i-heroicons-trash' : 'i-heroicons-x-circle'"
                  @click="showCancelModal(order)"
                >
                  {{
                    order.status === 'Refunded'
                      ? $t('ticketing.orders.delete_order')
                      : $t('ticketing.orders.cancel_order')
                  }}
                </UButton>
              </div>
            </div>

            <!-- Items de la commande -->
            <div class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ order.items?.length || 0 }} billet{{ (order.items?.length || 0) > 1 ? 's' : '' }}
              </h4>
            </div>
            <div class="space-y-2">
              <div
                v-for="item in order.items"
                :key="item.id"
                class="flex items-start justify-between gap-4 p-3 rounded-lg"
                :class="
                  item.entryValidated
                    ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-900/50 border-2 border-gray-200 dark:border-gray-700'
                "
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon
                      name="i-heroicons-ticket"
                      class="h-4 w-4 flex-shrink-0"
                      :class="item.entryValidated ? 'text-green-600' : 'text-gray-500'"
                    />
                    <span
                      class="font-medium text-sm"
                      :class="
                        item.entryValidated
                          ? 'text-gray-700 dark:text-gray-300'
                          : 'text-gray-900 dark:text-white'
                      "
                    >
                      {{ item.name || item.type }}
                    </span>
                    <UBadge v-if="item.entryValidated" color="success" variant="soft">
                      <UIcon name="i-heroicons-check-circle" class="h-3 w-3 mr-1" />
                      Entrée validée
                    </UBadge>
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                    <div class="flex items-center gap-1">
                      <UIcon name="i-heroicons-hashtag" class="h-3 w-3" />
                      <span class="font-mono text-xs">{{ item.id }}</span>
                    </div>
                    <div v-if="item.firstName || item.lastName">
                      <UIcon name="i-heroicons-user" class="h-3 w-3 inline mr-1" />
                      {{ item.firstName }} {{ item.lastName }}
                      <span v-if="item.email" class="ml-1">({{ item.email }})</span>
                    </div>
                    <div
                      v-if="
                        item.customFields &&
                        Array.isArray(item.customFields) &&
                        item.customFields.length > 0
                      "
                      class="space-y-0.5 mt-1"
                    >
                      <div
                        v-for="field in item.customFields"
                        :key="field.name"
                        class="flex items-start gap-1"
                      >
                        <UIcon name="i-heroicons-tag" class="h-3 w-3 inline flex-shrink-0 mt-0.5" />
                        <span class="font-medium">{{ field.name }} :</span>
                        <span class="text-gray-500 dark:text-gray-500">{{ field.answer }}</span>
                      </div>
                    </div>
                    <!-- Options sélectionnées -->
                    <div
                      v-if="item.selectedOptions && item.selectedOptions.length > 0"
                      class="space-y-0.5 mt-1"
                    >
                      <div
                        v-for="selectedOption in item.selectedOptions"
                        :key="selectedOption.id"
                        class="flex items-start gap-1"
                      >
                        <UIcon
                          name="i-heroicons-check-circle"
                          class="h-3 w-3 inline flex-shrink-0 mt-0.5 text-primary-500"
                        />
                        <span class="font-medium">{{ selectedOption.option.name }}</span>
                        <span
                          v-if="selectedOption.amount > 0"
                          class="text-gray-500 dark:text-gray-500"
                        >
                          (+{{ (selectedOption.amount / 100).toFixed(2) }}€)
                        </span>
                      </div>
                    </div>
                    <div
                      v-if="
                        item.qrCode &&
                        item.type !== 'Donation' &&
                        item.type !== 'Membership' &&
                        item.type !== 'Payment'
                      "
                    >
                      <UButton
                        color="primary"
                        variant="soft"
                        size="sm"
                        icon="i-heroicons-qr-code"
                        @click="showQrCode(item)"
                      >
                        QR Code
                      </UButton>
                    </div>
                  </div>
                </div>
                <div class="text-right flex-shrink-0 flex flex-col items-end gap-2">
                  <div class="font-semibold text-sm text-primary-600 dark:text-primary-400">
                    {{ getItemTotalAmount(item) }}€
                  </div>
                  <UBadge
                    :color="
                      item.state === 'Processed'
                        ? 'success'
                        : item.state === 'Pending'
                          ? 'warning'
                          : item.state === 'Canceled'
                            ? 'error'
                            : 'neutral'
                    "
                    variant="subtle"
                    size="sm"
                  >
                    {{
                      item.state === 'Processed'
                        ? 'Traité'
                        : item.state === 'Pending'
                          ? 'En attente'
                          : item.state === 'Canceled'
                            ? 'Annulé'
                            : item.state
                    }}
                  </UBadge>
                  <!-- Bouton de validation/invalidation -->
                  <UButton
                    v-if="
                      item.type !== 'Donation' &&
                      item.type !== 'Membership' &&
                      item.type !== 'Payment'
                    "
                    :color="item.entryValidated ? 'warning' : 'success'"
                    variant="soft"
                    size="sm"
                    :icon="
                      item.entryValidated ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'
                    "
                    @click="showValidateModal(item)"
                  >
                    {{ item.entryValidated ? 'Invalider' : 'Valider' }}
                  </UButton>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex justify-center">
            <UPagination
              :page="currentPage"
              :total="totalOrders"
              :items-per-page="pageSize"
              @update:page="onPageChange"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Modal QR Code -->
    <UModal v-model:open="isQrModalOpen" title="QR Code du billet">
      <template #body>
        <div v-if="selectedItem" class="space-y-4">
          <!-- Informations du billet -->
          <div class="pb-4 border-b border-gray-200 dark:border-gray-700">
            <p class="font-medium text-gray-900 dark:text-white">{{ selectedItem.name }}</p>
            <p
              v-if="selectedItem.firstName || selectedItem.lastName"
              class="text-sm text-gray-600 dark:text-gray-400"
            >
              {{ selectedItem.firstName }} {{ selectedItem.lastName }}
            </p>
          </div>

          <!-- QR Code généré -->
          <div class="flex justify-center py-4">
            <Qrcode :value="selectedItem.qrCode" variant="default" />
          </div>

          <!-- Valeur brute du QR Code -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Valeur du QR Code :</p>
            <div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p class="text-xs font-mono text-gray-900 dark:text-white break-all">
                {{ selectedItem.qrCode }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Modal d'annulation/suppression de commande -->
    <UModal
      v-model:open="isCancelModalOpen"
      :title="
        orderToCancel?.status === 'Refunded'
          ? $t('ticketing.orders.delete_order_confirm')
          : $t('ticketing.orders.cancel_order_confirm')
      "
    >
      <template #body>
        <div v-if="orderToCancel" class="space-y-4">
          <UAlert
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :description="
              orderToCancel.status === 'Refunded'
                ? $t('ticketing.orders.delete_order_confirm_message')
                : $t('ticketing.orders.cancel_order_confirm_message')
            "
          />

          <!-- Informations de la commande -->
          <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Payeur :</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ orderToCancel.payerFirstName }} {{ orderToCancel.payerLastName }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Email :</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ orderToCancel.payerEmail }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Montant :</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ (orderToCancel.amount / 100).toFixed(2) }}€
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Billets :</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ orderToCancel.items?.length || 0 }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-3">
          <UButton
            color="neutral"
            variant="soft"
            :disabled="isCanceling"
            @click="isCancelModalOpen = false"
          >
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            color="error"
            variant="solid"
            :loading="isCanceling"
            :disabled="isCanceling"
            @click="cancelOrder"
          >
            {{
              isCanceling
                ? orderToCancel?.status === 'Refunded'
                  ? $t('ticketing.orders.deleting_order')
                  : $t('ticketing.orders.canceling_order')
                : orderToCancel?.status === 'Refunded'
                  ? $t('ticketing.orders.delete_order')
                  : $t('ticketing.orders.cancel_order')
            }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal de validation/invalidation d'entrée -->
    <UModal
      v-model:open="isValidateModalOpen"
      :title="itemToValidate?.entryValidated ? 'Invalider l\'entrée' : 'Valider l\'entrée'"
    >
      <template #body>
        <div v-if="itemToValidate" class="space-y-4">
          <UAlert
            :icon="
              itemToValidate.entryValidated
                ? 'i-heroicons-exclamation-triangle'
                : 'i-heroicons-information-circle'
            "
            :color="itemToValidate.entryValidated ? 'warning' : 'info'"
            variant="soft"
          >
            <template #description>
              {{
                itemToValidate.entryValidated
                  ? "Cette action marquera le billet comme non validé. Le participant pourra à nouveau scanner son billet au contrôle d'accès."
                  : "Cette action marquera le billet comme validé sans vérifier les objets à restituer. Le participant ne pourra plus scanner son billet au contrôle d'accès."
              }}
            </template>
          </UAlert>

          <!-- Informations du billet -->
          <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Billet :</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ itemToValidate.name || itemToValidate.type }}
              </span>
            </div>
            <div
              v-if="itemToValidate.firstName || itemToValidate.lastName"
              class="flex items-center justify-between"
            >
              <span class="text-sm text-gray-600 dark:text-gray-400">Participant :</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ itemToValidate.firstName }} {{ itemToValidate.lastName }}
              </span>
            </div>
            <div v-if="itemToValidate.email" class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Email :</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ itemToValidate.email }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Montant :</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ (itemToValidate.amount / 100).toFixed(2) }}€
              </span>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-3">
          <UButton
            color="neutral"
            variant="soft"
            :disabled="isValidating"
            @click="isValidateModalOpen = false"
          >
            Annuler
          </UButton>
          <UButton
            :color="itemToValidate?.entryValidated ? 'warning' : 'success'"
            variant="solid"
            :loading="isValidating"
            :disabled="isValidating"
            @click="validateEntry"
          >
            {{
              isValidating
                ? itemToValidate?.entryValidated
                  ? 'Invalidation...'
                  : 'Validation...'
                : itemToValidate?.entryValidated
                  ? "Invalider l'entrée"
                  : "Valider l'entrée"
            }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal détails des montants -->
    <UModal
      v-model:open="isAmountDetailsModalOpen"
      title="Détail des montants par méthode de paiement"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-y-3">
            <!-- Carte HelloAsso -->
            <div
              v-if="
                stats?.amountsByPaymentMethod?.cardHelloAsso &&
                stats.amountsByPaymentMethod.cardHelloAsso > 0
              "
              class="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <UIcon name="i-heroicons-credit-card" class="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    Carte bancaire (HelloAsso)
                  </p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    Paiements en ligne via HelloAsso
                  </p>
                </div>
              </div>
              <p class="text-lg font-bold text-green-600">
                {{ (stats.amountsByPaymentMethod.cardHelloAsso / 100).toFixed(2) }}€
              </p>
            </div>

            <!-- Carte sur place -->
            <div
              v-if="
                stats?.amountsByPaymentMethod?.cardOnsite &&
                stats.amountsByPaymentMethod.cardOnsite > 0
              "
              class="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                  <UIcon name="i-heroicons-credit-card" class="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    Carte bancaire (sur place)
                  </p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    Paiements par terminal sur place
                  </p>
                </div>
              </div>
              <p class="text-lg font-bold text-teal-600">
                {{ (stats.amountsByPaymentMethod.cardOnsite / 100).toFixed(2) }}€
              </p>
            </div>

            <!-- Liquide -->
            <div
              v-if="stats?.amountsByPaymentMethod?.cash && stats.amountsByPaymentMethod.cash > 0"
              class="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <UIcon name="i-heroicons-banknotes" class="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">Liquide</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    Paiements en espèces sur place
                  </p>
                </div>
              </div>
              <p class="text-lg font-bold text-blue-600">
                {{ (stats.amountsByPaymentMethod.cash / 100).toFixed(2) }}€
              </p>
            </div>

            <!-- Chèque -->
            <div
              v-if="stats?.amountsByPaymentMethod?.check && stats.amountsByPaymentMethod.check > 0"
              class="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <UIcon name="i-heroicons-document-text" class="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">Chèque</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">Paiements par chèque</p>
                </div>
              </div>
              <p class="text-lg font-bold text-purple-600">
                {{ (stats.amountsByPaymentMethod.check / 100).toFixed(2) }}€
              </p>
            </div>

            <!-- Paiements en ligne (anciennes commandes) -->
            <div
              v-if="
                stats?.amountsByPaymentMethod?.online && stats.amountsByPaymentMethod.online > 0
              "
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                  <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    Payé (méthode non spécifiée)
                  </p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">Anciennes commandes payées</p>
                </div>
              </div>
              <p class="text-lg font-bold text-gray-600">
                {{ (stats.amountsByPaymentMethod.online / 100).toFixed(2) }}€
              </p>
            </div>

            <!-- En attente -->
            <div
              v-if="
                stats?.amountsByPaymentMethod?.pending && stats.amountsByPaymentMethod.pending > 0
              "
              class="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <UIcon name="i-heroicons-clock" class="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">En attente de paiement</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">Commandes non finalisées</p>
                </div>
              </div>
              <p class="text-lg font-bold text-yellow-600">
                {{ (stats.amountsByPaymentMethod.pending / 100).toFixed(2) }}€
              </p>
            </div>

            <!-- Remboursé -->
            <div
              v-if="
                stats?.amountsByPaymentMethod?.refunded && stats.amountsByPaymentMethod.refunded > 0
              "
              class="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <UIcon name="i-heroicons-arrow-uturn-left" class="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">Remboursé</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    Commandes annulées et remboursées
                  </p>
                </div>
              </div>
              <p class="text-lg font-bold text-red-600">
                {{ (stats.amountsByPaymentMethod.refunded / 100).toFixed(2) }}€
              </p>
            </div>
          </div>

          <!-- Total -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div
              class="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <UIcon name="i-heroicons-currency-euro" class="h-6 w-6 text-primary-600" />
                </div>
                <p class="text-lg font-semibold text-gray-900 dark:text-white">Total général</p>
              </div>
              <p class="text-2xl font-bold text-primary-600">
                {{ (stats.totalAmount / 100).toFixed(2) }}€
              </p>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Modal de définition de la méthode de paiement -->
    <UModal
      v-model:open="isPaymentMethodModalOpen"
      title="Définir la méthode de paiement"
      :description="
        selectedOrder
          ? `Commande de ${selectedOrder.payerFirstName} ${selectedOrder.payerLastName} - ${(selectedOrder.amount / 100).toFixed(2)}€`
          : ''
      "
    >
      <template #body>
        <div v-if="selectedOrder" class="space-y-6">
          <!-- Sélection de la méthode de paiement -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Méthode de paiement
            </label>
            <div class="grid grid-cols-1 gap-3">
              <!-- Liquide -->
              <button
                type="button"
                class="relative flex items-center gap-3 p-4 border-2 rounded-lg transition-all"
                :class="
                  selectedPaymentMethod === 'cash'
                    ? 'border-success-500 bg-success-50 dark:bg-success-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-success-300 dark:hover:border-success-700'
                "
                @click="selectedPaymentMethod = 'cash'"
              >
                <div
                  class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg"
                  :class="
                    selectedPaymentMethod === 'cash'
                      ? 'bg-success-100 dark:bg-success-900/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  "
                >
                  <UIcon
                    name="i-heroicons-banknotes"
                    class="h-5 w-5"
                    :class="
                      selectedPaymentMethod === 'cash'
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-gray-500 dark:text-gray-400'
                    "
                  />
                </div>
                <div class="flex-1 text-left">
                  <p
                    class="font-medium"
                    :class="
                      selectedPaymentMethod === 'cash'
                        ? 'text-success-900 dark:text-success-100'
                        : 'text-gray-900 dark:text-white'
                    "
                  >
                    Liquide
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Paiement en espèces</p>
                </div>
                <UIcon
                  v-if="selectedPaymentMethod === 'cash'"
                  name="i-heroicons-check-circle-solid"
                  class="h-5 w-5 text-success-600 dark:text-success-400"
                />
              </button>

              <!-- Carte bancaire -->
              <button
                type="button"
                class="relative flex items-center gap-3 p-4 border-2 rounded-lg transition-all"
                :class="
                  selectedPaymentMethod === 'card'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                "
                @click="selectedPaymentMethod = 'card'"
              >
                <div
                  class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg"
                  :class="
                    selectedPaymentMethod === 'card'
                      ? 'bg-primary-100 dark:bg-primary-900/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  "
                >
                  <UIcon
                    name="i-heroicons-credit-card"
                    class="h-5 w-5"
                    :class="
                      selectedPaymentMethod === 'card'
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-500 dark:text-gray-400'
                    "
                  />
                </div>
                <div class="flex-1 text-left">
                  <p
                    class="font-medium"
                    :class="
                      selectedPaymentMethod === 'card'
                        ? 'text-primary-900 dark:text-primary-100'
                        : 'text-gray-900 dark:text-white'
                    "
                  >
                    Carte bancaire
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Paiement par carte</p>
                </div>
                <UIcon
                  v-if="selectedPaymentMethod === 'card'"
                  name="i-heroicons-check-circle-solid"
                  class="h-5 w-5 text-primary-600 dark:text-primary-400"
                />
              </button>

              <!-- Chèque -->
              <button
                type="button"
                class="relative flex items-center gap-3 p-4 border-2 rounded-lg transition-all"
                :class="
                  selectedPaymentMethod === 'check'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                "
                @click="selectedPaymentMethod = 'check'"
              >
                <div
                  class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg"
                  :class="
                    selectedPaymentMethod === 'check'
                      ? 'bg-purple-100 dark:bg-purple-900/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  "
                >
                  <UIcon
                    name="i-heroicons-document-text"
                    class="h-5 w-5"
                    :class="
                      selectedPaymentMethod === 'check'
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-500 dark:text-gray-400'
                    "
                  />
                </div>
                <div class="flex-1 text-left">
                  <p
                    class="font-medium"
                    :class="
                      selectedPaymentMethod === 'check'
                        ? 'text-purple-900 dark:text-purple-100'
                        : 'text-gray-900 dark:text-white'
                    "
                  >
                    Chèque
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Paiement par chèque</p>
                </div>
                <UIcon
                  v-if="selectedPaymentMethod === 'check'"
                  name="i-heroicons-check-circle-solid"
                  class="h-5 w-5 text-purple-600 dark:text-purple-400"
                />
              </button>
            </div>
          </div>

          <!-- Numéro de chèque -->
          <div v-if="selectedPaymentMethod === 'check'">
            <UFormField label="Numéro de chèque (optionnel)">
              <UInput v-model="selectedCheckNumber" placeholder="Ex: 1234567" />
            </UFormField>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-3">
          <UButton
            color="neutral"
            variant="soft"
            :disabled="isUpdatingPaymentMethod"
            @click="closePaymentMethodModal"
          >
            Annuler
          </UButton>
          <UButton
            color="primary"
            variant="solid"
            :loading="isUpdatingPaymentMethod"
            :disabled="!selectedPaymentMethod || isUpdatingPaymentMethod"
            @click="updatePaymentMethod"
          >
            Définir la méthode de paiement
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { fetchOrders, type Order, type CustomFieldFilter } from '~/utils/ticketing/orders'
import { fetchTiers, type TicketingTier } from '~/utils/ticketing/tiers'

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t: $t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

const loading = ref(true)
const hasExternalTicketing = ref(false)
const lastSync = ref<Date | null>(null)
const orders = ref<Order[]>([])
const stats = ref({
  totalOrders: 0,
  totalItems: 0,
  totalAmount: 0,
  totalDonations: 0,
  totalDonationsAmount: 0,
})

const searchQuery = ref('')
const debouncedSearchQuery = refDebounced(searchQuery, 400) // Délai de 400ms avant recherche
const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(0)
const totalOrders = ref(0)

// Filtres
const tiers = ref<TicketingTier[]>([])
const selectedTierIds = ref<number[]>([])
const selectedOptionIds = ref<number[]>([])
const entryStatusFilter = ref<'all' | 'validated' | 'not_validated'>('all')
const paymentMethodFilter = ref<Array<'cash' | 'card' | 'check' | 'pending' | 'unknown'>>([])
const isFiltersOpen = ref(false)

// Filtres par champs personnalisés (support de plusieurs filtres)
const customFieldFilters = ref<CustomFieldFilter[]>([])
const customFieldFilterMode = ref<'and' | 'or'>('and')
const distinctCustomFields = ref<{ name: string; values: string[] }[]>([])
// Refs pour le formulaire d'ajout d'un nouveau filtre
const newFilterName = ref('')
const newFilterValue = ref('')

// Options pour le filtre par options
interface TicketingOption {
  id: number
  name: string
  price: number
}
const options = ref<TicketingOption[]>([])

// Options pour le filtre de statut d'entrée
const entryStatusOptions = [
  { label: 'Tous les billets', value: 'all' },
  { label: 'Entrée validée', value: 'validated' },
  { label: 'Entrée non validée', value: 'not_validated' },
]

// Options pour le filtre de méthode de paiement
const paymentMethodOptions = [
  { label: 'Liquide', value: 'cash' },
  { label: 'Carte bancaire', value: 'card' },
  { label: 'Chèque', value: 'check' },
  { label: 'En attente', value: 'pending' },
  { label: 'Méthode non renseignée', value: 'unknown' },
]

// Modal QR Code
const isQrModalOpen = ref(false)
const selectedItem = ref<any>(null)

const showQrCode = (item: any) => {
  selectedItem.value = item
  isQrModalOpen.value = true
}

// Modal détails des montants
const isAmountDetailsModalOpen = ref(false)

// Modal et logique d'annulation de commande
const isCancelModalOpen = ref(false)
const orderToCancel = ref<Order | null>(null)
const isCanceling = ref(false)

const showCancelModal = (order: Order) => {
  orderToCancel.value = order
  isCancelModalOpen.value = true
}

const cancelOrder = async () => {
  if (!orderToCancel.value) return

  const isDeleting = orderToCancel.value.status === 'Refunded'
  isCanceling.value = true
  try {
    const response = await $fetch<{ success: boolean; message: string }>(
      `/api/editions/${editionId}/ticketing/orders/${orderToCancel.value.id}`,
      {
        method: 'DELETE',
      }
    )

    // Fermer la modal
    isCancelModalOpen.value = false
    orderToCancel.value = null

    // Recharger les commandes
    await loadOrders()

    // Message de succès
    useToast().add({
      title: isDeleting
        ? $t('ticketing.orders.order_deleted')
        : $t('ticketing.orders.order_canceled'),
      description: response.message,
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (error: any) {
    console.error('Failed to cancel/delete order:', error)
    useToast().add({
      title: $t('common.error'),
      description:
        error.data?.message ||
        (isDeleting
          ? $t('ticketing.orders.delete_order_error')
          : $t('ticketing.orders.cancel_order_error')),
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  } finally {
    isCanceling.value = false
  }
}

// Modal et logique de définition de méthode de paiement
const isPaymentMethodModalOpen = ref(false)
const selectedOrder = ref<Order | null>(null)
const selectedPaymentMethod = ref<'cash' | 'card' | 'check' | null>(null)
const selectedCheckNumber = ref('')
const isUpdatingPaymentMethod = ref(false)

const openPaymentMethodModal = (order: Order) => {
  selectedOrder.value = order
  selectedPaymentMethod.value = null
  selectedCheckNumber.value = ''
  isPaymentMethodModalOpen.value = true
}

const closePaymentMethodModal = () => {
  isPaymentMethodModalOpen.value = false
  selectedOrder.value = null
  selectedPaymentMethod.value = null
  selectedCheckNumber.value = ''
}

const updatePaymentMethod = async () => {
  if (!selectedOrder.value || !selectedPaymentMethod.value) return

  isUpdatingPaymentMethod.value = true
  try {
    await $fetch(
      `/api/editions/${editionId}/ticketing/orders/${selectedOrder.value.id}/payment-method`,
      {
        method: 'PATCH',
        body: {
          paymentMethod: selectedPaymentMethod.value,
          checkNumber:
            selectedPaymentMethod.value === 'check' ? selectedCheckNumber.value : undefined,
        },
      }
    )

    // Fermer la modal
    closePaymentMethodModal()

    // Recharger les commandes
    await loadOrders()

    // Message de succès
    useToast().add({
      title: 'Méthode de paiement définie',
      description: 'La méthode de paiement a été enregistrée avec succès',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (error: any) {
    console.error('Failed to update payment method:', error)
    useToast().add({
      title: 'Erreur',
      description: error.data?.message || 'Erreur lors de la mise à jour de la méthode de paiement',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  } finally {
    isUpdatingPaymentMethod.value = false
  }
}

// Modal et logique de validation/invalidation d'entrée
const isValidateModalOpen = ref(false)
const itemToValidate = ref<any>(null)
const isValidating = ref(false)

const showValidateModal = (item: any) => {
  itemToValidate.value = item
  isValidateModalOpen.value = true
}

const validateEntry = async () => {
  if (!itemToValidate.value) return

  const isInvalidating = itemToValidate.value.entryValidated
  isValidating.value = true
  try {
    if (isInvalidating) {
      // Invalider l'entrée
      await $fetch(`/api/editions/${editionId}/ticketing/invalidate-entry`, {
        method: 'POST',
        body: {
          participantId: itemToValidate.value.id,
          type: 'ticket',
        },
      })
    } else {
      // Valider l'entrée
      await $fetch(`/api/editions/${editionId}/ticketing/validate-entry`, {
        method: 'POST',
        body: {
          participantIds: [itemToValidate.value.id],
          type: 'ticket',
        },
      })
    }

    // Fermer la modal
    isValidateModalOpen.value = false
    itemToValidate.value = null

    // Recharger les commandes
    await loadOrders()

    // Message de succès
    useToast().add({
      title: isInvalidating ? 'Entrée invalidée' : 'Entrée validée',
      description: isInvalidating
        ? 'Le billet a été marqué comme non validé'
        : 'Le billet a été validé avec succès',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (error: any) {
    console.error('Failed to validate/invalidate entry:', error)
    useToast().add({
      title: 'Erreur',
      description:
        error.data?.message ||
        (isInvalidating
          ? "Erreur lors de l'invalidation de l'entrée"
          : "Erreur lors de la validation de l'entrée"),
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  } finally {
    isValidating.value = false
  }
}

const lastSyncText = computed(() => {
  if (!lastSync.value) return 'Jamais'
  const now = new Date()
  const diff = now.getTime() - lastSync.value.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `Il y a ${days} jour${days > 1 ? 's' : ''}`
  if (hours > 0) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`
  return "À l'instant"
})

const formatDate = (date: string | Date) => {
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Calculer le montant total d'un item (tarif + options)
const getItemTotalAmount = (item: any) => {
  const baseAmount = item.amount || 0
  const optionsAmount =
    item.selectedOptions?.reduce((sum: number, opt: any) => sum + (opt.amount || 0), 0) || 0
  return ((baseAmount + optionsAmount) / 100).toFixed(2)
}

// Charger les commandes avec pagination
const loadOrders = async () => {
  loading.value = true
  try {
    const response = await fetchOrders(editionId, {
      page: currentPage.value,
      limit: pageSize.value,
      search: debouncedSearchQuery.value,
      tierIds: selectedTierIds.value.length > 0 ? selectedTierIds.value : undefined,
      optionIds: selectedOptionIds.value.length > 0 ? selectedOptionIds.value : undefined,
      entryStatus: entryStatusFilter.value,
      paymentMethods: paymentMethodFilter.value.length > 0 ? paymentMethodFilter.value : undefined,
      customFieldFilters:
        customFieldFilters.value.length > 0 ? customFieldFilters.value : undefined,
      customFieldFilterMode: customFieldFilterMode.value,
    })

    orders.value = response.data || []
    totalPages.value = response.pagination?.totalPages || 1
    totalOrders.value = response.pagination?.totalCount || 0

    // Mettre à jour les stats si elles sont retournées
    if (response.stats) {
      stats.value = response.stats
    }
  } catch (error) {
    console.error('Failed to load orders:', error)
    orders.value = []
  } finally {
    loading.value = false
  }
}

// Computed pour transformer les tarifs en items pour le select
const tierSelectItems = computed(() => {
  return tiers.value.map((tier) => ({
    label: tier.name,
    value: tier.id,
    price: tier.price,
  }))
})

// Computed pour transformer les options en items pour le select
const optionSelectItems = computed(() => {
  return options.value.map((option) => ({
    label: option.name,
    value: option.id,
    price: option.price,
  }))
})

// Computed pour les noms de champs personnalisés
const customFieldNameItems = computed(() => {
  return distinctCustomFields.value.map((field) => ({
    label: field.name,
    value: field.name,
  }))
})

// Computed pour les valeurs du champ personnalisé sélectionné pour le nouveau filtre
const newFilterValueItems = computed(() => {
  if (!newFilterName.value) return []
  const field = distinctCustomFields.value.find((f) => f.name === newFilterName.value)
  if (!field) return []
  return field.values.map((value) => ({
    label: value,
    value: value,
  }))
})

// Ajouter un nouveau filtre de champ personnalisé
const addCustomFieldFilter = () => {
  if (!newFilterName.value || !newFilterValue.value) return
  // Éviter les doublons (même champ + même valeur)
  const alreadyExists = customFieldFilters.value.some(
    (f) => f.name === newFilterName.value && f.value === newFilterValue.value
  )
  if (!alreadyExists) {
    customFieldFilters.value.push({
      name: newFilterName.value,
      value: newFilterValue.value,
    })
  }
  // Réinitialiser le formulaire
  newFilterName.value = ''
  newFilterValue.value = ''
}

// Supprimer un filtre de champ personnalisé
const removeCustomFieldFilter = (index: number) => {
  customFieldFilters.value.splice(index, 1)
}

// Compter le nombre de filtres actifs
const activeFiltersCount = computed(() => {
  let count = 0
  if (selectedTierIds.value.length > 0) count += selectedTierIds.value.length
  if (selectedOptionIds.value.length > 0) count += selectedOptionIds.value.length
  if (entryStatusFilter.value !== 'all') count += 1
  if (paymentMethodFilter.value.length > 0) count += paymentMethodFilter.value.length
  count += customFieldFilters.value.length
  return count
})

// Fonction pour réinitialiser tous les filtres
const resetFilters = () => {
  selectedTierIds.value = []
  selectedOptionIds.value = []
  entryStatusFilter.value = 'all'
  paymentMethodFilter.value = []
  customFieldFilters.value = []
  customFieldFilterMode.value = 'and'
  newFilterName.value = ''
  newFilterValue.value = ''
}

// Fonction pour gérer le changement de page
const onPageChange = (page: number) => {
  currentPage.value = page
  loadOrders()
}

// Réinitialiser à la page 1 quand on effectue une recherche ou change les filtres
watch(
  [
    debouncedSearchQuery,
    selectedTierIds,
    selectedOptionIds,
    entryStatusFilter,
    paymentMethodFilter,
    customFieldFilters,
    customFieldFilterMode,
  ],
  () => {
    currentPage.value = 1
    loadOrders()
  },
  { deep: true }
)

// Réinitialiser la valeur quand on change le nom du champ personnalisé (pour le formulaire d'ajout)
watch(newFilterName, () => {
  newFilterValue.value = ''
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

  if (canAccess.value) {
    await loadData()
  }
})

const loadData = async () => {
  try {
    // Charger la configuration, les tarifs, les options et les champs personnalisés en parallèle
    const [configResponse, tiersData, optionsData, customFieldsData] = await Promise.all([
      $fetch(`/api/editions/${editionId}/ticketing/external`),
      fetchTiers(editionId),
      $fetch<TicketingOption[]>(`/api/editions/${editionId}/ticketing/options`),
      $fetch<{ name: string; values: string[] }[]>(
        `/api/editions/${editionId}/ticketing/custom-fields/distinct`
      ),
    ])

    hasExternalTicketing.value = configResponse.hasConfig
    tiers.value = tiersData
    options.value = optionsData || []
    distinctCustomFields.value = customFieldsData || []

    if (configResponse.hasConfig) {
      lastSync.value = configResponse.config?.lastSyncAt
        ? new Date(configResponse.config.lastSyncAt)
        : null
    }

    // Charger les commandes paginées dans tous les cas (les stats seront aussi chargées si pas de recherche)
    await loadOrders()
  } catch (error) {
    console.error('Failed to load data:', error)
  }
}

// Permissions
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  if (authStore.user.id === edition.value.creatorId) return true
  if (canEdit.value || canManageVolunteers.value) return true
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }
  return false
})
</script>
