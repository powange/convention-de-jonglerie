<template>
  <UModal
    v-model:open="isOpen"
    :title="currentStepTitle"
    size="xl"
    :prevent-close="loading"
    @close="closeModal"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Indicateur d'étapes (masqué pour l'étape de choix du type) -->
        <UStepper
          v-if="currentStep >= 0"
          v-model="currentStep"
          :items="stepperItems"
          class="mb-6"
        />

        <!-- Étape -1 : Choix du type de participant -->
        <div v-if="currentStep === -1" class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400 text-center">
            Choisissez le type de participant à ajouter
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Option 1 : Participant avec informations -->
            <button
              class="p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-all hover:bg-primary-50 dark:hover:bg-primary-900/20"
              @click="selectParticipantType('identified')"
            >
              <UIcon
                name="i-heroicons-user"
                class="h-12 w-12 mx-auto mb-3 text-primary-600 dark:text-primary-400"
              />
              <h3 class="font-semibold text-gray-900 dark:text-white">Avec informations</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Participant identifié avec nom, prénom et email
              </p>
            </button>

            <!-- Option 2 : Participant anonyme -->
            <button
              v-if="allowAnonymousOrders"
              class="p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
              @click="selectParticipantType('anonymous')"
            >
              <UIcon
                name="i-heroicons-user-circle"
                class="h-12 w-12 mx-auto mb-3 text-gray-600 dark:text-gray-400"
              />
              <h3 class="font-semibold text-gray-900 dark:text-white">Anonyme</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Participant sans informations personnelles
              </p>
            </button>
          </div>
        </div>

        <!-- Étape 0 : Informations acheteur -->
        <div v-if="currentStep === 0" class="space-y-4">
          <!-- Email en premier -->
          <UFormField
            :label="$t('edition.ticketing.payer_email')"
            required
            :error="errors.payerEmail"
          >
            <UFieldGroup class="w-full">
              <UInput
                v-model="form.payerEmail"
                type="email"
                :placeholder="$t('edition.ticketing.email_placeholder')"
                class="w-full"
                @keydown.enter="searchUserByEmail"
              />
              <UButton
                icon="i-heroicons-magnifying-glass"
                color="primary"
                :disabled="!form.payerEmail || searchingUser"
                :loading="searchingUser"
                @click="searchUserByEmail"
              >
                Vérifier
              </UButton>
            </UFieldGroup>
          </UFormField>

          <!-- Message si utilisateur trouvé -->
          <UAlert
            v-if="userFound"
            icon="i-heroicons-check-circle"
            color="success"
            variant="soft"
            title="Utilisateur trouvé"
            description="Les informations ont été pré-remplies automatiquement"
          />

          <!-- Prénom -->
          <UFormField
            v-if="showNameFields"
            :label="$t('edition.ticketing.payer_first_name')"
            required
            :error="errors.payerFirstName"
          >
            <UInput
              v-model="form.payerFirstName"
              :placeholder="$t('edition.ticketing.first_name_placeholder')"
              class="w-full"
            />
          </UFormField>

          <!-- Nom -->
          <UFormField
            v-if="showNameFields"
            :label="$t('edition.ticketing.payer_last_name')"
            required
            :error="errors.payerLastName"
          >
            <UInput
              v-model="form.payerLastName"
              :placeholder="$t('edition.ticketing.last_name_placeholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Étape 2 : Sélection des tarifs -->
        <div v-if="currentStep === 1" class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('edition.ticketing.select_tiers_description') }}
          </p>

          <div v-if="loadingTiers" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-gray-400" />
          </div>

          <div v-else-if="availableTiers.length === 0" class="text-center py-8">
            <p class="text-gray-500">{{ $t('edition.ticketing.no_tiers_available') }}</p>
          </div>

          <div v-else class="space-y-3">
            <!-- Switch pour afficher tous les tarifs -->
            <USwitch
              v-model="showAllTiers"
              label="Afficher tous les tarifs"
              description="Y compris les tarifs hors période de validité"
            />
            <div
              v-for="tier in availableTiers"
              :key="tier.id"
              class="p-4 border rounded-lg dark:border-gray-700"
            >
              <div class="flex items-center justify-between gap-4">
                <div class="flex-1">
                  <h4 class="font-medium text-gray-900 dark:text-white">{{ tier.name }}</h4>
                  <p v-if="tier.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {{ tier.description }}
                  </p>
                  <!-- Prix fixe ou fourchette de prix libre -->
                  <p
                    v-if="tier.minAmount == null && tier.maxAmount == null"
                    class="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-2"
                  >
                    {{ formatPrice(tier.price) }}
                  </p>
                  <p
                    v-else
                    class="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-2"
                  >
                    Prix libre
                    <span v-if="tier.minAmount != null" class="text-xs text-gray-500">
                      (min: {{ formatPrice(tier.minAmount) }})
                    </span>
                    <span v-if="tier.maxAmount != null" class="text-xs text-gray-500">
                      (max: {{ formatPrice(tier.maxAmount) }})
                    </span>
                  </p>
                </div>
                <div class="flex flex-col items-center gap-2">
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {{ $t('common.quantity') }}
                  </span>
                  <div class="flex items-center gap-2">
                    <UButton
                      icon="i-heroicons-minus"
                      size="lg"
                      color="neutral"
                      variant="outline"
                      :disabled="!tierQuantities[tier.id] || tierQuantities[tier.id] === 0"
                      @click="decrementQuantity(tier.id)"
                    />
                    <div
                      class="w-14 h-11 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <span class="text-xl font-semibold text-gray-900 dark:text-white">
                        {{ tierQuantities[tier.id] || 0 }}
                      </span>
                    </div>
                    <UButton
                      icon="i-heroicons-plus"
                      size="lg"
                      color="primary"
                      variant="outline"
                      @click="incrementQuantity(tier.id)"
                    />
                  </div>
                  <span
                    v-if="
                      tierQuantities[tier.id] &&
                      tierQuantities[tier.id] > 0 &&
                      tier.minAmount == null &&
                      tier.maxAmount == null
                    "
                    class="text-xs font-semibold text-primary-600 dark:text-primary-400"
                  >
                    Total: {{ formatPrice(tier.price * tierQuantities[tier.id]) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Étape 2 : Sélection des options (uniquement si des options existent) -->
        <div v-if="hasOptions && currentStep === optionsStepIndex" class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Sélectionnez les options pour chaque billet
          </p>

          <div v-if="selectedItems.length === 0" class="text-center py-8">
            <p class="text-gray-500">Aucun billet sélectionné</p>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="(item, index) in selectedItems"
              :key="`${item.tierId}-${index}`"
              class="p-4 border rounded-lg dark:border-gray-700"
            >
              <div class="space-y-3">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-900 dark:text-white">{{ item.tierName }}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Billet {{ index + 1 }}</p>
                  </div>
                  <UBadge color="primary" variant="soft"
                    >{{ $t('common.item') }} {{ index + 1 }}</UBadge
                  >
                </div>

                <!-- Options pour ce billet -->
                <div v-if="getOptionsForTier(item.tierId).length > 0" class="space-y-3 mt-3">
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Options :</p>
                  <div
                    v-for="option in getOptionsForTier(item.tierId)"
                    :key="option.id"
                    class="space-y-2 p-3 border rounded-lg dark:border-gray-700"
                  >
                    <!-- Checkbox pour activer/désactiver l'option -->
                    <div class="flex items-center justify-between">
                      <UCheckbox
                        :model-value="isOptionEnabled(item, option.id)"
                        :disabled="option.isRequired && option.type !== 'YesNo'"
                        :label="option.name + (option.isRequired ? ' *' : '')"
                        @update:model-value="
                          (enabled: boolean) => toggleOption(item, option.id, option.name, enabled)
                        "
                      />
                      <span
                        v-if="option.price"
                        class="text-sm font-medium text-gray-900 dark:text-white"
                      >
                        + {{ formatPrice(option.price) }}
                      </span>
                    </div>

                    <!-- Champ de saisie si l'option est activée -->
                    <div v-if="isOptionEnabled(item, option.id)" class="pl-6 mt-2">
                      <!-- TextInput -->
                      <div v-if="option.type === 'TextInput'">
                        <UInput
                          :model-value="getOptionAnswer(item, option.name)"
                          :placeholder="`Saisir ${option.name.toLowerCase()}`"
                          @update:model-value="
                            (value: string) => setOptionAnswer(item, option.id, option.name, value)
                          "
                        />
                      </div>

                      <!-- FreeText (texte long) -->
                      <div v-else-if="option.type === 'FreeText'">
                        <UTextarea
                          :model-value="getOptionAnswer(item, option.name)"
                          :placeholder="`Saisir ${option.name.toLowerCase()}`"
                          :rows="3"
                          @update:model-value="
                            (value: string) => setOptionAnswer(item, option.id, option.name, value)
                          "
                        />
                      </div>

                      <!-- YesNo (valeur oui/non) -->
                      <div v-else-if="option.type === 'YesNo'">
                        <UCheckbox
                          :model-value="getOptionAnswer(item, option.name) === 'true'"
                          label="Oui"
                          @update:model-value="
                            (value: boolean) =>
                              setOptionAnswer(
                                item,
                                option.id,
                                option.name,
                                value ? 'true' : 'false'
                              )
                          "
                        />
                      </div>

                      <!-- ChoiceList (liste de choix) -->
                      <div v-else-if="option.type === 'ChoiceList' && option.choices">
                        <USelect
                          :model-value="getOptionAnswer(item, option.name)"
                          :items="
                            option.choices.map((choice: string) => ({
                              label: choice,
                              value: choice,
                            }))
                          "
                          placeholder="Sélectionner une option"
                          @update:model-value="
                            (value: string) => setOptionAnswer(item, option.id, option.name, value)
                          "
                        />
                      </div>

                      <!-- Date -->
                      <div v-else-if="option.type === 'Date'">
                        <UInput
                          :model-value="getOptionAnswer(item, option.name)"
                          type="date"
                          @update:model-value="
                            (value: string) => setOptionAnswer(item, option.id, option.name, value)
                          "
                        />
                      </div>

                      <!-- Phone -->
                      <div v-else-if="option.type === 'Phone'">
                        <UInput
                          :model-value="getOptionAnswer(item, option.name)"
                          type="tel"
                          placeholder="Numéro de téléphone"
                          @update:model-value="
                            (value: string) => setOptionAnswer(item, option.id, option.name, value)
                          "
                        />
                      </div>

                      <!-- Zipcode -->
                      <div v-else-if="option.type === 'Zipcode'">
                        <UInput
                          :model-value="getOptionAnswer(item, option.name)"
                          placeholder="Code postal"
                          @update:model-value="
                            (value: string) => setOptionAnswer(item, option.id, option.name, value)
                          "
                        />
                      </div>

                      <!-- Number -->
                      <div v-else-if="option.type === 'Number'">
                        <UInput
                          :model-value="getOptionAnswer(item, option.name)"
                          type="number"
                          placeholder="Nombre"
                          @update:model-value="
                            (value: string) => setOptionAnswer(item, option.id, option.name, value)
                          "
                        />
                      </div>

                      <!-- File -->
                      <div v-else-if="option.type === 'File'">
                        <UInput
                          type="file"
                          @change="(event: any) => handleFileUpload(event, item, option)"
                        />
                        <p class="text-xs text-gray-500 mt-1">
                          {{ getOptionAnswer(item, option.name) || 'Aucun fichier sélectionné' }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="text-sm text-gray-500 italic">
                  Aucune option disponible pour ce tarif
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Étape 3 : Récapitulatif et personnalisation -->
        <div v-if="currentStep === summaryStepIndex" class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('edition.ticketing.customize_participants_description') }}
          </p>

          <div class="space-y-4">
            <div
              v-for="(item, index) in selectedItems"
              :key="`${item.tierId}-${index}`"
              class="p-4 border rounded-lg dark:border-gray-700"
            >
              <div class="space-y-3">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-900 dark:text-white">{{ item.tierName }}</h4>
                    <p
                      v-if="item.minAmount == null && item.maxAmount == null"
                      class="text-sm text-gray-600 dark:text-gray-400"
                    >
                      {{ formatPrice(item.price) }}
                    </p>
                    <p v-else class="text-sm text-gray-600 dark:text-gray-400">Prix libre</p>
                  </div>
                  <UBadge color="primary" variant="soft"
                    >{{ $t('common.item') }} {{ index + 1 }}</UBadge
                  >
                </div>

                <!-- Champ de montant personnalisé pour les tarifs à prix libre -->
                <div v-if="item.minAmount != null || item.maxAmount != null">
                  <UFormField label="Montant (€)" :error="getItemAmountError(item)">
                    <UInput
                      :model-value="item.price / 100"
                      type="number"
                      :min="item.minAmount != null ? item.minAmount / 100 : 0"
                      :max="item.maxAmount != null ? item.maxAmount / 100 : undefined"
                      step="0.01"
                      placeholder="Montant en euros"
                      @update:model-value="
                        (value: number) => (item.price = Math.round(value * 100))
                      "
                    />
                  </UFormField>
                  <p v-if="item.minAmount != null || item.maxAmount != null" class="text-xs text-gray-500 mt-1">
                    <span v-if="item.minAmount != null"> Min: {{ formatPrice(item.minAmount) }} </span>
                    <span v-if="item.minAmount != null && item.maxAmount != null"> - </span>
                    <span v-if="item.maxAmount != null"> Max: {{ formatPrice(item.maxAmount) }} </span>
                  </p>
                </div>

                <UCheckbox
                  v-model="item.isDifferentParticipant"
                  :label="$t('edition.ticketing.different_participant')"
                />

                <div
                  v-if="item.isDifferentParticipant"
                  class="space-y-3 pl-6 border-l-2 border-primary-200"
                >
                  <UFormField :label="$t('edition.ticketing.participant_first_name')" required>
                    <UInput
                      v-model="item.firstName"
                      :placeholder="$t('edition.ticketing.first_name_placeholder')"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField :label="$t('edition.ticketing.participant_last_name')" required>
                    <UInput
                      v-model="item.lastName"
                      :placeholder="$t('edition.ticketing.last_name_placeholder')"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField :label="$t('edition.ticketing.participant_email')" required>
                    <UInput
                      v-model="item.email"
                      type="email"
                      :placeholder="$t('edition.ticketing.email_placeholder')"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <!-- Custom Fields du tarif -->
                <div
                  v-if="getTierCustomFields(item.tierId).length > 0"
                  class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                >
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Informations complémentaires :
                  </p>
                  <div class="space-y-3">
                    <div
                      v-for="customField in getTierCustomFields(item.tierId)"
                      :key="customField.id"
                      class="space-y-2"
                    >
                      <UFormField
                        :label="customField.label + (customField.isRequired ? ' *' : '')"
                        :required="customField.isRequired"
                      >
                        <!-- TextInput -->
                        <UInput
                          v-if="customField.type === 'TextInput'"
                          :model-value="getTierCustomFieldAnswer(item, customField.id)"
                          :placeholder="`Saisir ${customField.label.toLowerCase()}`"
                          @update:model-value="
                            (value: string) =>
                              setTierCustomFieldAnswer(
                                item,
                                customField.id,
                                customField.label,
                                value
                              )
                          "
                        />

                        <!-- YesNo -->
                        <UCheckbox
                          v-else-if="customField.type === 'YesNo'"
                          :model-value="getTierCustomFieldAnswer(item, customField.id) === 'true'"
                          label="Oui"
                          @update:model-value="
                            (value: boolean) =>
                              setTierCustomFieldAnswer(
                                item,
                                customField.id,
                                customField.label,
                                value ? 'true' : 'false'
                              )
                          "
                        />

                        <!-- ChoiceList -->
                        <USelect
                          v-else-if="customField.type === 'ChoiceList' && customField.values"
                          :model-value="getTierCustomFieldAnswer(item, customField.id)"
                          :items="
                            customField.values.map((choice: string) => ({
                              label: choice,
                              value: choice,
                            }))
                          "
                          placeholder="Sélectionner une option"
                          @update:model-value="
                            (value: string) =>
                              setTierCustomFieldAnswer(
                                item,
                                customField.id,
                                customField.label,
                                value
                              )
                          "
                        />

                        <!-- FreeText -->
                        <UTextarea
                          v-else-if="customField.type === 'FreeText'"
                          :model-value="getTierCustomFieldAnswer(item, customField.id)"
                          :placeholder="`Saisir ${customField.label.toLowerCase()}`"
                          :rows="3"
                          @update:model-value="
                            (value: string) =>
                              setTierCustomFieldAnswer(
                                item,
                                customField.id,
                                customField.label,
                                value
                              )
                          "
                        />

                        <!-- Type par défaut : TextInput -->
                        <UInput
                          v-else
                          :model-value="getTierCustomFieldAnswer(item, customField.id)"
                          :placeholder="`Saisir ${customField.label.toLowerCase()}`"
                          @update:model-value="
                            (value: string) =>
                              setTierCustomFieldAnswer(
                                item,
                                customField.id,
                                customField.label,
                                value
                              )
                          "
                        />
                      </UFormField>
                    </div>
                  </div>
                </div>

                <!-- Options sélectionnées -->
                <div
                  v-if="item.customFields && item.customFields.filter((f) => f.optionId).length > 0"
                  class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                >
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Options sélectionnées :
                  </p>
                  <div class="space-y-1.5">
                    <div
                      v-for="field in item.customFields"
                      :key="field.name"
                      class="flex items-start justify-between text-sm"
                    >
                      <div class="flex-1">
                        <span class="text-gray-600 dark:text-gray-400">{{ field.name }}:</span>
                        <span class="ml-1 text-gray-900 dark:text-white">{{ field.answer }}</span>
                      </div>
                      <span
                        v-if="getOptionPrice(field.optionId)"
                        class="text-sm font-medium text-primary-600 dark:text-primary-400 ml-2"
                      >
                        + {{ formatPrice(getOptionPrice(field.optionId)) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div class="flex items-center justify-between">
              <span class="font-medium text-gray-900 dark:text-white">
                {{ $t('common.total') }}
              </span>
              <span class="text-lg font-bold text-primary-600 dark:text-primary-400">
                {{ formatPrice(totalAmount) }}
              </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ selectedItems.length }} {{ $t('common.items') }}
            </p>
          </div>
        </div>

        <!-- Étape 4 : Confirmation du paiement -->
        <div v-if="currentStep === paymentStepIndex" class="space-y-4">
          <div class="text-center py-6">
            <div
              class="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4"
            >
              <UIcon
                name="i-heroicons-credit-card"
                class="h-8 w-8 text-blue-600 dark:text-blue-400"
              />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Paiement de la commande
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Souhaitez-vous marquer cette commande comme payée ?
            </p>
          </div>

          <div class="space-y-3">
            <div
              class="p-4 rounded-lg border-2 cursor-pointer transition-all"
              :class="
                paymentConfirmed
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
              "
              @click="paymentConfirmed = true"
            >
              <div class="flex items-center gap-3">
                <UIcon
                  :name="paymentConfirmed ? 'i-heroicons-check-circle' : 'i-heroicons-circle'"
                  :class="
                    paymentConfirmed
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400 dark:text-gray-600'
                  "
                  class="h-6 w-6"
                />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">Paiement reçu</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Le participant a payé {{ formatPrice(totalAmount) }}
                  </p>
                </div>
              </div>
            </div>

            <div
              class="p-4 rounded-lg border-2 cursor-pointer transition-all"
              :class="
                !paymentConfirmed
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
              "
              @click="paymentConfirmed = false"
            >
              <div class="flex items-center gap-3">
                <UIcon
                  :name="!paymentConfirmed ? 'i-heroicons-check-circle' : 'i-heroicons-circle'"
                  :class="
                    !paymentConfirmed
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-400 dark:text-gray-600'
                  "
                  class="h-6 w-6"
                />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    Paiement non reçu (inscription en attente)
                  </p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    La commande sera enregistrée mais marquée comme non payée
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Message d'erreur -->
        <UAlert v-if="error" color="error" variant="soft" :title="error" />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between">
        <UButton
          v-if="currentStep > 0 || (currentStep === 0 && participantType === 'identified')"
          color="neutral"
          variant="ghost"
          @click="previousStep"
        >
          {{ $t('common.previous') }}
        </UButton>
        <div v-else />

        <div v-if="currentStep >= 0" class="flex gap-2">
          <UButton color="neutral" variant="ghost" @click="closeModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            v-if="currentStep < paymentStepIndex"
            color="primary"
            :disabled="!canGoNext"
            @click="nextStep"
          >
            {{ $t('common.next') }}
          </UButton>
          <UButton
            v-else
            color="primary"
            :disabled="loading"
            :loading="loading"
            @click="submitOrder"
          >
            {{ $t('edition.ticketing.create_order') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface TicketingOption {
  id: number
  name: string
  type:
    | 'Date'
    | 'TextInput'
    | 'FreeText'
    | 'ChoiceList'
    | 'File'
    | 'YesNo'
    | 'Phone'
    | 'Zipcode'
    | 'Number'
  isRequired: boolean
  choices: string[] | null
  price: number | null
  tiers?: Array<{
    tierId: number
  }>
}

interface TicketingQuota {
  id: number
  name: string
  options: Array<{
    option: TicketingOption
  }>
}

interface TierCustomField {
  id: number
  label: string
  type: string // YesNo, ChoiceList, TextInput, etc.
  isRequired: boolean
  values?: string[] // Valeurs possibles pour les ChoiceList
}

interface TicketingTier {
  id: number
  name: string
  price: number
  description: string | null
  minAmount: number | null
  maxAmount: number | null
  customFields?: TierCustomField[]
  quotas?: Array<{
    quota: TicketingQuota
  }>
}

interface CustomField {
  optionId?: number // ID de l'option (pour les billets créés manuellement)
  customFieldId?: number // ID du custom field du tarif
  name: string
  answer: string
}

interface SelectedItem {
  tierId: number
  tierName: string
  price: number
  minAmount: number | null
  maxAmount: number | null
  isDifferentParticipant: boolean
  firstName: string
  lastName: string
  email: string
  customFields?: CustomField[]
  enabledOptions?: number[] // IDs des options activées pour cet item
}

interface Props {
  open: boolean
  editionId: number
  allowAnonymousOrders?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'order-created', qrCode: string): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

// Utiliser une valeur par défaut pour allowAnonymousOrders
const allowAnonymousOrders = computed(() => props.allowAnonymousOrders ?? false)

// Démarrer à -1 pour l'étape de choix du type si les commandes anonymes sont autorisées, sinon à 0
const getInitialStep = () => (allowAnonymousOrders.value ? -1 : 0)
const currentStep = ref(getInitialStep())
const participantType = ref<'identified' | 'anonymous'>('identified')
const loading = ref(false)
const loadingTiers = ref(false)
const error = ref('')
const paymentConfirmed = ref(true)
const searchingUser = ref(false)
const userFound = ref(false)
const showNameFields = ref(false)

// Fonction pour sélectionner le type de participant
const selectParticipantType = (type: 'identified' | 'anonymous') => {
  participantType.value = type

  if (type === 'anonymous') {
    // Utiliser des valeurs fixes pour tous les participants anonymes
    form.value.payerEmail = 'anonyme@convention.local'
    form.value.payerFirstName = 'Anonyme'
    form.value.payerLastName = 'Anonyme'

    showNameFields.value = true
    userFound.value = false

    // Passer directement à l'étape de sélection des tarifs
    currentStep.value = 1
  } else {
    // Réinitialiser les champs pour le flux normal
    form.value.payerEmail = ''
    form.value.payerFirstName = ''
    form.value.payerLastName = ''
    showNameFields.value = false
    userFound.value = false

    // Passer à l'étape de saisie des informations
    currentStep.value = 0
  }
}

const stepperItems = computed(() => {
  const steps = []

  // Ne pas afficher l'étape "Informations acheteur" pour les anonymes
  if (participantType.value === 'identified') {
    steps.push({ title: t('edition.ticketing.buyer_info') })
  }

  steps.push({ title: t('edition.ticketing.select_tiers') })

  // N'ajouter l'étape "Options" que s'il y a des options disponibles
  if (editionOptions.value && editionOptions.value.length > 0) {
    steps.push({ title: 'Options' })
  }

  steps.push({ title: t('edition.ticketing.summary') })
  steps.push({ title: 'Paiement' })

  return steps
})

// Indices des étapes (s'adaptent selon le type de participant et la présence d'options)
const hasOptions = computed(() => editionOptions.value && editionOptions.value.length > 0)

// Vérifie si les tarifs sélectionnés ont des options disponibles
const hasOptionsForSelectedTiers = computed(() => {
  // Récupérer les IDs des tarifs sélectionnés
  const selectedTierIds = Object.entries(tierQuantities.value)
    .filter(([_, qty]) => qty > 0)
    .map(([id]) => parseInt(id))

  if (selectedTierIds.length === 0) return false

  // Vérifier si au moins un tarif a des options
  return selectedTierIds.some((tierId) => getOptionsForTier(tierId).length > 0)
})

// Pour identifié: étape 0 (info) -> 1 (tarifs) -> 2 (options si présentes) -> récap -> paiement
// Pour anonyme: étape 1 (tarifs) -> 2 (options si présentes) -> récap -> paiement
const optionsStepIndex = 2
const summaryStepIndex = computed(() => (hasOptions.value ? 3 : 2))
const paymentStepIndex = computed(() => (hasOptions.value ? 4 : 3))

const currentStepTitle = computed(() => {
  if (currentStep.value === -1) return 'Type de participant'
  if (currentStep.value === 0) return t('edition.ticketing.add_participant_title')
  if (currentStep.value === 1) return t('edition.ticketing.select_tiers')
  if (hasOptions.value && currentStep.value === optionsStepIndex) return 'Sélection des options'
  if (currentStep.value === summaryStepIndex.value)
    return t('edition.ticketing.summary_and_customize')
  return 'Confirmation du paiement'
})

const form = ref({
  payerFirstName: '',
  payerLastName: '',
  payerEmail: '',
})

const errors = ref({
  payerFirstName: '',
  payerLastName: '',
  payerEmail: '',
})

const availableTiers = ref<TicketingTier[]>([])
const tierQuantities = ref<Record<number, number>>({})
const selectedItems = ref<SelectedItem[]>([])
const showAllTiers = ref(false)
const editionOptions = ref<TicketingOption[]>([])

// Fonctions pour gérer les quantités avec boutons +/-
const incrementQuantity = (tierId: number) => {
  if (!tierQuantities.value[tierId]) {
    tierQuantities.value[tierId] = 0
  }
  tierQuantities.value[tierId]++
}

const decrementQuantity = (tierId: number) => {
  if (tierQuantities.value[tierId] && tierQuantities.value[tierId] > 0) {
    tierQuantities.value[tierId]--
  }
}

const canGoNext = computed(() => {
  if (currentStep.value === 0) {
    return (
      form.value.payerFirstName.trim().length > 0 &&
      form.value.payerLastName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.payerEmail)
    )
  }
  if (currentStep.value === 1) {
    // Au moins un tarif sélectionné
    return Object.values(tierQuantities.value).some((qty) => qty > 0)
  }
  if (hasOptions.value && currentStep.value === optionsStepIndex) {
    // Vérifier que toutes les options activées sont remplies
    return selectedItems.value.every((item) => {
      const options = getOptionsForTier(item.tierId) || []
      return options.every((option) => {
        // Ignorer les options non activées
        if (!isOptionEnabled(item, option.id)) return true

        // Pour les CheckBox (type question oui/non), pas besoin de validation
        if (option.type === 'CheckBox') return true

        // Pour les autres types, vérifier qu'il y a une réponse
        const answer = getOptionAnswer(item, option.name)
        return answer && answer.trim().length > 0
      })
    })
  }
  if (currentStep.value === summaryStepIndex.value) {
    // Vérifier que tous les montants personnalisés sont valides
    return selectedItems.value.every((item) => {
      // Vérifier les montants pour les tarifs à prix libre
      if (item.minAmount != null || item.maxAmount != null) {
        if (getItemAmountError(item)) return false
      }
      // Vérifier les infos participant si différent de l'acheteur
      if (item.isDifferentParticipant) {
        const validParticipant =
          item.firstName.trim().length > 0 &&
          item.lastName.trim().length > 0 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)
        if (!validParticipant) return false
      }

      // Vérifier que tous les custom fields obligatoires sont remplis
      const tierCustomFields = getTierCustomFields(item.tierId)
      const requiredCustomFieldsFilled = tierCustomFields.every((customField) => {
        if (!customField.isRequired) return true

        // Pour les champs YesNo, ne pas cocher est valide (équivaut à "No")
        if (customField.type === 'YesNo') return true

        const answer = getTierCustomFieldAnswer(item, customField.id)
        return answer && answer.trim().length > 0
      })
      if (!requiredCustomFieldsFilled) return false

      return true
    })
  }
  return true
})

// La validation est faite dans canGoNext pour l'étape 2
const canSubmit = computed(() => true)

const totalAmount = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    // Prix du billet
    let itemTotal = item.price

    // Ajouter le prix des options
    if (item.customFields) {
      item.customFields.forEach((field) => {
        const optionPrice = getOptionPrice(field.optionId)
        if (optionPrice) {
          itemTotal += optionPrice
        }
      })
    }

    return sum + itemTotal
  }, 0)
})

const formatPrice = (priceInCents: number) => {
  return (priceInCents / 100).toFixed(2) + ' €'
}

// Récupérer le prix d'une option par son ID
const getOptionPrice = (optionId?: number): number => {
  if (!optionId) return 0
  const option = editionOptions.value.find((opt) => opt.id === optionId)
  return option?.price || 0
}

const getItemAmountError = (item: SelectedItem) => {
  if (item.price == null || item.price < 0) {
    return 'Veuillez saisir un montant valide'
  }
  const minAmount = item.minAmount ?? 0
  if (item.price < minAmount) {
    return `Le montant minimum est ${formatPrice(minAmount)}`
  }
  if (item.maxAmount != null && item.price > item.maxAmount) {
    return `Le montant maximum est ${formatPrice(item.maxAmount)}`
  }
  return ''
}

// Récupérer les options disponibles pour un tarif donné
// Les options sans association de tarif sont affichées pour tous les tarifs
// Les options avec des associations ne sont affichées que pour les tarifs concernés
const getOptionsForTier = (tierId: number): TicketingOption[] => {
  return editionOptions.value.filter((option) => {
    // Si l'option n'a pas d'associations de tarifs, elle est disponible pour tous
    if (!option.tiers || option.tiers.length === 0) {
      return true
    }
    // Sinon, vérifier si le tarif est dans la liste des tarifs associés
    return option.tiers.some((t) => t.tierId === tierId)
  })
}

// Récupérer les custom fields d'un tarif
const getTierCustomFields = (tierId: number): TierCustomField[] => {
  const tier = availableTiers.value.find((t) => t.id === tierId)
  return tier?.customFields || []
}

// Récupérer la réponse d'un custom field pour un item
const getTierCustomFieldAnswer = (item: SelectedItem, customFieldId: number): string => {
  if (!item.customFields) return ''
  const field = item.customFields.find((f) => f.customFieldId === customFieldId)
  return field?.answer || ''
}

// Définir la réponse d'un custom field pour un item
const setTierCustomFieldAnswer = (
  item: SelectedItem,
  customFieldId: number,
  label: string,
  answer: string
) => {
  if (!item.customFields) {
    item.customFields = []
  }

  const existingIndex = item.customFields.findIndex((f) => f.customFieldId === customFieldId)
  if (existingIndex >= 0) {
    item.customFields[existingIndex].answer = answer
  } else {
    item.customFields.push({
      customFieldId,
      name: label,
      answer,
    })
  }
}

// Vérifier si une option est activée pour un item
const isOptionEnabled = (item: SelectedItem, optionId: number): boolean => {
  if (!item.enabledOptions) return false
  return item.enabledOptions.includes(optionId)
}

// Activer/désactiver une option pour un item
const toggleOption = (
  item: SelectedItem,
  optionId: number,
  optionName: string,
  enabled: boolean
) => {
  if (!item.enabledOptions) {
    item.enabledOptions = []
  }

  if (enabled) {
    // Activer l'option
    if (!item.enabledOptions.includes(optionId)) {
      item.enabledOptions.push(optionId)
    }
  } else {
    // Désactiver l'option et supprimer sa réponse
    item.enabledOptions = item.enabledOptions.filter((id) => id !== optionId)
    if (item.customFields) {
      item.customFields = item.customFields.filter((f) => f.optionId !== optionId)
    }
  }
}

// Récupérer la réponse d'une option pour un item donné
const getOptionAnswer = (item: SelectedItem, optionName: string): string => {
  if (!item.customFields) return ''
  const field = item.customFields.find((f) => f.name === optionName)
  return field?.answer || ''
}

// Définir la réponse d'une option pour un item donné
const setOptionAnswer = (
  item: SelectedItem,
  optionId: number,
  optionName: string,
  answer: string
) => {
  if (!item.customFields) {
    item.customFields = []
  }

  const existingFieldIndex = item.customFields.findIndex((f) => f.optionId === optionId)
  if (existingFieldIndex !== -1) {
    item.customFields[existingFieldIndex].answer = answer
  } else {
    item.customFields.push({ optionId, name: optionName, answer })
  }
}

const handleFileUpload = (event: Event, item: SelectedItem, option: TicketingOption) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    // Pour l'instant, on stocke juste le nom du fichier
    // Dans une future version, on pourrait implémenter l'upload vers un serveur
    setOptionAnswer(item, option.id, option.name, file.name)
  }
}

const fetchOptions = async () => {
  try {
    const response = await $fetch<TicketingOption[]>(
      `/api/editions/${props.editionId}/ticketing/options`
    )
    // L'API retourne directement un tableau
    editionOptions.value = response
  } catch (err: any) {
    console.error('Error fetching options:', err)
    // Ne pas afficher d'erreur si pas d'options
    editionOptions.value = []
  }
}

const fetchTiers = async () => {
  loadingTiers.value = true
  try {
    const response = await $fetch<{ tiers: TicketingTier[] }>(
      `/api/editions/${props.editionId}/ticketing/tiers/available`,
      {
        query: {
          showAll: showAllTiers.value ? 'true' : 'false',
        },
      }
    )
    availableTiers.value = response.tiers
    // Initialiser les quantités à 0
    tierQuantities.value = response.tiers.reduce(
      (acc, tier) => {
        acc[tier.id] = 0
        return acc
      },
      {} as Record<number, number>
    )
  } catch (err: any) {
    console.error('Error fetching tiers:', err)
    error.value = t('edition.ticketing.error_loading_tiers')
  } finally {
    loadingTiers.value = false
  }
}

const nextStep = () => {
  if (!canGoNext.value) return

  if (currentStep.value === 1) {
    // Générer la liste des items sélectionnés
    selectedItems.value = []
    for (const tier of availableTiers.value) {
      const quantity = tierQuantities.value[tier.id] || 0
      // Déterminer le prix initial : minimum pour les prix libres, sinon prix du tarif
      let itemPrice = tier.price
      if (tier.minAmount != null || tier.maxAmount != null) {
        // Pour les prix libres, initialiser au minimum (ou 0 si pas de minimum)
        itemPrice = tier.minAmount ?? 0
      }

      for (let i = 0; i < quantity; i++) {
        // Pré-activer les options requises du tarif (sauf YesNo car ne pas cocher = "No")
        const tierOptions = getOptionsForTier(tier.id)
        const requiredOptions = tierOptions
          .filter((opt) => opt.isRequired && opt.type !== 'YesNo')
          .map((opt) => opt.id)

        selectedItems.value.push({
          tierId: tier.id,
          tierName: tier.name,
          price: itemPrice,
          minAmount: tier.minAmount,
          maxAmount: tier.maxAmount,
          isDifferentParticipant: false,
          firstName: form.value.payerFirstName,
          lastName: form.value.payerLastName,
          email: form.value.payerEmail,
          customFields: [],
          enabledOptions: requiredOptions,
        })
      }
    }
  }

  // Si on est à l'étape 1 (sélection des tarifs) et qu'il n'y a pas d'options pour les tarifs sélectionnés
  // Passer directement à l'étape récapitulatif (sauter l'étape Options)
  if (currentStep.value === 1 && !hasOptionsForSelectedTiers.value) {
    currentStep.value = summaryStepIndex.value
  } else {
    currentStep.value++
  }
}

const previousStep = () => {
  if (currentStep.value > 0) {
    // Si on est à l'étape récapitulatif et qu'il n'y a pas d'options pour les tarifs sélectionnés
    // Revenir directement à l'étape sélection des tarifs (sauter l'étape Options)
    if (currentStep.value === summaryStepIndex.value && !hasOptionsForSelectedTiers.value) {
      currentStep.value = 1
    } else {
      currentStep.value--
    }
  } else if (currentStep.value === 0) {
    // Retour à l'étape de choix du type de participant
    currentStep.value = -1
    participantType.value = 'identified'
    // Réinitialiser le formulaire
    form.value.payerEmail = ''
    form.value.payerFirstName = ''
    form.value.payerLastName = ''
    showNameFields.value = false
    userFound.value = false
  }
}

const submitOrder = async () => {
  if (!canSubmit.value) return

  loading.value = true
  error.value = ''

  try {
    // Grouper les items par tarif et montant personnalisé
    const itemsByTierAndPrice: Record<
      string,
      { tierId: number; quantity: number; customAmount?: number; customParticipants: any[] }
    > = {}

    for (const item of selectedItems.value) {
      // Créer une clé unique basée sur le tarif et le prix
      const key = `${item.tierId}-${item.price}`

      if (!itemsByTierAndPrice[key]) {
        itemsByTierAndPrice[key] = {
          tierId: item.tierId,
          quantity: 0,
          customAmount: item.price, // Le prix est déjà en centimes
          customParticipants: [],
        }
      }
      itemsByTierAndPrice[key].quantity++
      if (item.isDifferentParticipant) {
        itemsByTierAndPrice[key].customParticipants.push({
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          customFields:
            item.customFields && item.customFields.length > 0 ? item.customFields : undefined,
        })
      } else {
        // Même si le participant n'est pas différent, on doit envoyer les customFields
        itemsByTierAndPrice[key].customParticipants.push({
          firstName: form.value.payerFirstName,
          lastName: form.value.payerLastName,
          email: form.value.payerEmail,
          customFields:
            item.customFields && item.customFields.length > 0 ? item.customFields : undefined,
        })
      }
    }

    const response = await $fetch<{ success: boolean; qrCode: string }>(
      `/api/editions/${props.editionId}/ticketing/add-participant-manually`,
      {
        method: 'POST',
        body: {
          payerFirstName: form.value.payerFirstName,
          payerLastName: form.value.payerLastName,
          payerEmail: form.value.payerEmail,
          items: Object.values(itemsByTierAndPrice),
          isPaid: paymentConfirmed.value,
        },
      }
    )

    // Émettre l'événement avec le QR code pour redirection
    emit('order-created', response.qrCode)
    closeModal()
  } catch (err: any) {
    console.error('Error creating order:', err)
    error.value = err.data?.message || t('edition.ticketing.add_error')
  } finally {
    loading.value = false
  }
}

const searchUserByEmail = async () => {
  const email = form.value.payerEmail.trim()

  // Réinitialiser l'état
  userFound.value = false
  showNameFields.value = false

  // Vérifier que l'email est valide
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    // Si l'email n'est pas valide, afficher quand même les champs nom/prénom
    showNameFields.value = true
    return
  }

  searchingUser.value = true

  try {
    const response = await $fetch<{ users: Array<{ prenom: string; nom: string; email: string }> }>(
      '/api/users/search',
      {
        query: {
          email,
        },
      }
    )

    // Chercher une correspondance exacte avec l'email
    const matchingUser = response.users.find((u) => u.email.toLowerCase() === email.toLowerCase())

    if (matchingUser) {
      // Utilisateur trouvé : préremplir les champs
      form.value.payerFirstName = matchingUser.prenom
      form.value.payerLastName = matchingUser.nom
      userFound.value = true
    }

    // Toujours afficher les champs nom/prénom après la recherche
    showNameFields.value = true
  } catch (err) {
    console.error('Error searching user:', err)
    // En cas d'erreur, afficher quand même les champs
    showNameFields.value = true
  } finally {
    searchingUser.value = false
  }
}

const closeModal = () => {
  isOpen.value = false
  currentStep.value = getInitialStep() // Retour à l'étape de choix du type ou directement à l'étape 0
  participantType.value = 'identified' // Réinitialiser au type par défaut
  paymentConfirmed.value = true
  form.value = {
    payerFirstName: '',
    payerLastName: '',
    payerEmail: '',
  }
  errors.value = {
    payerFirstName: '',
    payerLastName: '',
    payerEmail: '',
  }
  tierQuantities.value = {}
  selectedItems.value = []
  error.value = ''
  searchingUser.value = false
  userFound.value = false
  showNameFields.value = false
}

// Charger les tarifs et options quand le modal s'ouvre
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      fetchTiers()
      fetchOptions()
    }
  }
)

// Recharger les tarifs quand on change le filtre de validité
watch(showAllTiers, () => {
  fetchTiers()
})
</script>
