<template>
  <div v-if="edition">
    <EditionHeader :edition="edition" current-page="artist-space" />

    <!-- Chargement -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <!-- Pas artiste -->
    <UAlert
      v-else-if="!artist"
      icon="i-heroicons-exclamation-triangle"
      color="warning"
      variant="soft"
      :title="$t('common.not_found')"
    />

    <!-- Contenu -->
    <div v-else class="space-y-6">
      <!-- En-tête artiste -->
      <UCard>
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div
              class="flex items-center justify-center w-14 h-14 rounded-xl bg-yellow-100 dark:bg-yellow-900/30"
            >
              <UIcon name="i-heroicons-star" class="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">
                {{ artist.firstName }} {{ artist.lastName }}
              </h1>
              <p class="text-sm text-gray-500">{{ artist.email }}</p>
              <p class="text-sm text-gray-400 mt-1">
                {{ $t('artists.artist_space_subtitle') }}
              </p>
            </div>
          </div>
          <UButton
            icon="i-heroicons-qr-code"
            color="primary"
            variant="soft"
            @click="qrModalOpen = true"
          >
            {{ $t('artists.view_qr_code') }}
          </UButton>
        </div>
      </UCard>

      <!--
        Les informations de l'organisation et la présence de l'artiste, côte à côte au large.

        ⚠️ `items-start` : le bloc d'informations est du texte libre, de longueur imprévisible.
        Sans lui, la grille étire la carte de présence à la hauteur de sa voisine et lui ajoute
        un grand vide sous ses deux dates.

        📍 LA LARGEUR SUIT LA PRÉSENCE DE LA VOISINE. Le bloc d'informations est facultatif —
        l'organisation ne le remplit pas toujours. Sans le `col-span-3` de repli, la présence
        resterait dans son tiers avec deux tiers d'écran vides à sa gauche.
      -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <!-- Informations artistes -->
        <UCard v-if="edition.artistInfo" class="lg:col-span-2">
          <template #header>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-information-circle" class="text-blue-500" />
              {{ $t('artists.artist_info_title') }}
            </h2>
          </template>

          <div class="prose prose-sm dark:prose-invert max-w-none">
            <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div :class="{ 'line-clamp-4': !artistInfoExpanded }" v-html="artistInfoHtml" />
            <UButton
              v-if="!artistInfoExpanded"
              variant="ghost"
              color="primary"
              size="xs"
              class="mt-2"
              @click="artistInfoExpanded = true"
            >
              {{ $t('common.see_more') }}...
            </UButton>
            <UButton
              v-else
              variant="ghost"
              color="primary"
              size="xs"
              class="mt-2"
              @click="artistInfoExpanded = false"
            >
              {{ $t('common.see_less') }}
            </UButton>
          </div>
        </UCard>

        <!-- Présence : l'artiste déclare lui-même quand il arrive sur place et quand il repart.
             C'était jusqu'ici à l'organisateur de le lui demander puis de le ressaisir. -->
        <UCard data-carte="presence" :class="edition?.artistInfo ? undefined : 'lg:col-span-3'">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <UIcon name="i-heroicons-calendar-days" class="text-green-500" />
                {{ $t('artists.presence_section') }}
              </h2>
              <UButton
                v-if="!editingPresence"
                icon="i-heroicons-pencil-square"
                variant="ghost"
                size="xs"
                color="neutral"
                :aria-label="$t('common.edit')"
                @click="ouvrirEditionPresence"
              />
            </div>
          </template>

          <div class="space-y-3">
            <div v-if="!editingPresence" class="flex flex-wrap gap-4">
              <div v-if="artist.arrivalDateTime" class="flex items-center gap-2 text-sm">
                <UIcon name="i-heroicons-arrow-down-tray" class="text-green-500" />
                <span class="text-gray-600 dark:text-gray-400">
                  {{ $t('artists.arrival') }} :
                  {{ formaterDateHeure(artist.arrivalDateTime, fuseauEdition, locale) }}
                </span>
              </div>
              <div v-if="artist.departureDateTime" class="flex items-center gap-2 text-sm">
                <UIcon name="i-heroicons-arrow-up-tray" class="text-red-500" />
                <span class="text-gray-600 dark:text-gray-400">
                  {{ $t('artists.departure') }} :
                  {{ formaterDateHeure(artist.departureDateTime, fuseauEdition, locale) }}
                </span>
              </div>
              <p
                v-if="!artist.arrivalDateTime && !artist.departureDateTime"
                class="text-sm text-gray-500 italic"
              >
                {{ $t('artists.presence_not_declared') }}
              </p>
            </div>

            <!--
              La récupération : la demande de l'artiste ET la réponse de l'organisation.

              ⚠️ UNE SEULE CARTE, PLUS DEUX. « Transport » rendait les deux mêmes lignes, au mot
              près et sous la même condition, en y ajoutant seulement le responsable et son
              téléphone. Deux cartes pour une information faisaient lire deux fois la même chose et
              obligeaient à faire défiler entre la demande et sa réponse. Le responsable est donc
              remonté ici, et « Transport » a disparu.

              📍 En colonne et non en ligne : cette carte occupe un tiers de la largeur sur grand
              écran. Un `flex` horizontal y aurait coupé « récupération à la gare » au milieu.
            -->
            <div
              v-if="!editingPresence && (artist.pickupRequired || artist.dropoffRequired)"
              class="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3"
            >
              <div v-if="artist.pickupRequired" class="flex items-start gap-2 text-sm">
                <UIcon name="i-heroicons-arrow-down-tray" class="text-green-500 mt-0.5 shrink-0" />
                <div class="min-w-0">
                  <p class="text-gray-700 dark:text-gray-300">
                    {{
                      artist.pickupLocation
                        ? $t('artists.pickup_at', { location: artist.pickupLocation })
                        : $t('artists.pickup_required')
                    }}
                  </p>
                  <p
                    v-if="artist.pickupResponsible"
                    class="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{ $t('artists.pickup_responsible') }} :
                    <span class="font-medium">{{ responsibleName(artist.pickupResponsible) }}</span>
                    <template v-if="artist.pickupResponsible.phone">
                      —
                      <a
                        :href="`tel:${artist.pickupResponsible.phone}`"
                        class="text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {{ artist.pickupResponsible.phone }}
                      </a>
                    </template>
                  </p>
                </div>
              </div>

              <div v-if="artist.dropoffRequired" class="flex items-start gap-2 text-sm">
                <UIcon name="i-heroicons-arrow-up-tray" class="text-red-500 mt-0.5 shrink-0" />
                <div class="min-w-0">
                  <p class="text-gray-700 dark:text-gray-300">
                    {{
                      artist.dropoffLocation
                        ? $t('artists.dropoff_at', { location: artist.dropoffLocation })
                        : $t('artists.dropoff_required')
                    }}
                  </p>
                  <p
                    v-if="artist.dropoffResponsible"
                    class="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{ $t('artists.dropoff_responsible') }} :
                    <span class="font-medium">{{
                      responsibleName(artist.dropoffResponsible)
                    }}</span>
                    <template v-if="artist.dropoffResponsible.phone">
                      —
                      <a
                        :href="`tel:${artist.dropoffResponsible.phone}`"
                        class="text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {{ artist.dropoffResponsible.phone }}
                      </a>
                    </template>
                  </p>
                </div>
              </div>
            </div>

            <!--
              ⚠️ `v-if="editingPresence"` ET NON `v-else`. Le `v-else` s'accrochait au `v-if`
              précédent — celui du rappel de récupération, qui porte DEUX conditions :
              `!editingPresence && (pickupRequired || dropoffRequired)`. Pour un artiste qui n'a
              demandé ni aller ni retour, cette condition était fausse hors édition, et le
              formulaire s'affichait donc SOUS le résumé : les dates en lecture, puis les mêmes
              champs en saisie juste dessous.

              📍 Le défaut ne se voyait que dans ce cas précis. Avec une demande de récupération,
              le `v-else` tombait juste par accident. C'est ce qui l'a laissé passer.
            -->
            <div v-if="editingPresence" class="space-y-3">
              <UiDateTimePicker
                v-model="presenceForm.arrivalDateTime"
                :date-label="$t('artists.arrival_date')"
                :time-label="$t('artists.arrival_time')"
                :placeholder="$t('artists.arrival')"
              />
              <UiDateTimePicker
                v-model="presenceForm.departureDateTime"
                :date-label="$t('artists.departure_date')"
                :time-label="$t('artists.departure_time')"
                :placeholder="$t('artists.departure')"
              />

              <!-- La demande de récupération. Le lieu n'apparaît qu'une fois la demande posée :
                   seul, il ne voudrait rien dire. -->
              <div class="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                <UFormField :label="$t('artists.pickup_required')">
                  <USwitch v-model="presenceForm.pickupRequired" />
                </UFormField>
                <UFormField
                  v-if="presenceForm.pickupRequired"
                  :label="$t('artists.pickup_location')"
                >
                  <UInput
                    v-model="presenceForm.pickupLocation"
                    :placeholder="$t('artists.pickup_location_placeholder')"
                    class="w-full"
                  />
                </UFormField>

                <UFormField :label="$t('artists.dropoff_required')">
                  <USwitch v-model="presenceForm.dropoffRequired" />
                </UFormField>
                <UFormField
                  v-if="presenceForm.dropoffRequired"
                  :label="$t('artists.dropoff_location')"
                >
                  <UInput
                    v-model="presenceForm.dropoffLocation"
                    :placeholder="$t('artists.dropoff_location_placeholder')"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <div class="flex justify-end gap-2">
                <UButton variant="ghost" color="neutral" size="sm" @click="editingPresence = false">
                  {{ $t('common.cancel') }}
                </UButton>
                <UButton size="sm" :loading="savingPresence" @click="savePresence()">
                  {{ $t('common.save') }}
                </UButton>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Spectacles -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-sparkles" class="text-purple-500" />
            {{ $t('artists.my_shows') }}
          </h2>
        </template>

        <div v-if="artist.shows.length > 0" class="space-y-3">
          <div
            v-for="show in artist.shows"
            :key="show.id"
            class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-3"
          >
            <div class="space-y-1">
              <p class="font-medium text-gray-900 dark:text-white">{{ show.title }}</p>
              <div class="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span v-if="show.duration" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                  {{ $t('artists.show_duration_minutes', { duration: show.duration }) }}
                </span>
              </div>
              <!-- Un spectacle peut être joué plusieurs fois, à des endroits différents -->
              <div
                v-for="performance in show.performances"
                :key="performance.id"
                class="flex flex-wrap items-center gap-3 text-sm text-gray-500"
              >
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                  {{ formatDateTime(performance.startDateTime) }}
                </span>
                <span v-if="performance.location" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                  {{ performance.location }}
                </span>
              </div>
            </div>

            <!-- Spectacle standard : l'artiste édite les besoins techniques du spectacle -->
            <ArtistsMyShowTechnicalNeeds
              v-if="show.type === 'STANDARD'"
              :edition-id="editionId"
              :show-id="show.id"
              :technical-needs="show.technicalNeeds"
              :stage-setup="null"
            />
            <!-- Cabaret : un bloc éditable par numéro où l'artiste joue -->
            <div v-else-if="show.acts && show.acts.length" class="space-y-3">
              <div
                v-for="act in show.acts"
                :key="act.id"
                class="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2"
              >
                <p class="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {{ act.title }}
                </p>
                <ArtistsMyShowTechnicalNeeds
                  :edition-id="editionId"
                  :act-id="act.id"
                  :has-stage-setup="true"
                  :technical-needs="act.technicalNeeds"
                  :stage-setup="act.stageSetup"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-6 text-gray-500">
          <UIcon name="i-heroicons-sparkles" class="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>{{ $t('artists.no_shows') }}</p>
        </div>
      </UCard>

      <!--
        Les repas et l'hébergement, côte à côte au large : deux cartes courtes qui laissaient
        chacune une pleine largeur presque vide.

        📍 Les repas sont facultatifs — l'édition peut ne pas les servir, ou l'artiste n'en avoir
        accepté aucun. D'où le `col-span-2` de repli sur l'hébergement, sans quoi il resterait
        dans sa moitié d'écran.
      -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <!-- Repas -->
        <UCard v-if="repasAffiches">
          <template #header>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-cake" class="text-orange-500" />
              {{ $t('artists.my_meals') }}
            </h2>
          </template>

          <div class="space-y-4">
            <!-- Régime alimentaire et allergies -->
            <div
              class="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 space-y-2"
            >
              <!-- Mode lecture -->
              <template v-if="!editingDiet">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ $t('artists.dietary_preference') }}
                  </span>
                  <UButton
                    icon="i-heroicons-pencil-square"
                    variant="ghost"
                    size="xs"
                    color="neutral"
                    @click="editingDiet = true"
                  />
                </div>
                <div
                  v-if="artist.dietaryPreference !== 'NONE'"
                  class="flex items-center gap-2 text-sm"
                >
                  <UIcon name="i-heroicons-heart" class="text-orange-500 shrink-0" />
                  <span class="text-gray-700 dark:text-gray-300">
                    <strong>{{ $t(`diet.${artist.dietaryPreference.toLowerCase()}`) }}</strong>
                  </span>
                </div>
                <div v-else class="text-sm text-gray-400">
                  {{ $t('diet.none') }}
                </div>
                <div v-if="artist.allergies" class="flex items-start gap-2 text-sm">
                  <UIcon
                    name="i-heroicons-exclamation-triangle"
                    class="text-orange-500 shrink-0 mt-0.5"
                  />
                  <span class="text-gray-700 dark:text-gray-300">
                    {{ $t('artists.allergies') }} :
                    <strong>{{ artist.allergies }}</strong>
                    <UBadge
                      v-if="artist.allergySeverity"
                      :color="
                        getAllergySeverityBadgeColor(artist.allergySeverity as AllergySeverityLevel)
                      "
                      variant="soft"
                      size="md"
                      class="ml-2"
                    >
                      {{
                        $t(
                          getAllergySeverityInfo(artist.allergySeverity as AllergySeverityLevel)
                            .label
                        )
                      }}
                    </UBadge>
                  </span>
                </div>
              </template>

              <!-- Mode édition -->
              <template v-else>
                <div class="space-y-3">
                  <UFormField :label="$t('artists.dietary_preference')">
                    <USelect
                      v-model="dietForm.dietaryPreference"
                      :items="dietaryOptions"
                      value-key="value"
                      class="w-full"
                      :ui="{ content: 'min-w-fit' }"
                    />
                  </UFormField>

                  <UFormField :label="$t('artists.allergies')">
                    <UTextarea
                      v-model="dietForm.allergies"
                      :placeholder="$t('artists.allergies')"
                      :rows="2"
                      autoresize
                    />
                  </UFormField>

                  <UFormField v-if="dietForm.allergies" :label="$t('artists.allergy_severity')">
                    <USelect
                      v-model="modeleGraviteAllergie"
                      :items="allergySeverityOptions"
                      value-key="value"
                      class="w-full"
                      :ui="{ content: 'min-w-fit' }"
                    />
                  </UFormField>

                  <div class="flex justify-end gap-2">
                    <UButton variant="ghost" color="neutral" size="sm" @click="cancelDietEdit">
                      {{ $t('common.cancel') }}
                    </UButton>
                    <UButton
                      :loading="savingDiet"
                      :disabled="!dietFormDirty"
                      icon="i-heroicons-check"
                      size="sm"
                      @click="saveDiet"
                    >
                      {{ $t('common.save') }}
                    </UButton>
                  </div>
                </div>
              </template>
            </div>

            <div v-for="(meals, date) in groupedMeals" :key="date">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                {{ formatDateFull(date) }}
              </p>
              <div class="flex flex-wrap gap-3">
                <div
                  v-for="meal in meals"
                  :key="meal.id"
                  class="flex flex-col items-center gap-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <span class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ getMealTypeLabel(meal.meal.mealType) }}
                  </span>
                  <USwitch
                    :model-value="editableMeals[meal.id] ?? meal.afterShow"
                    :loading="savingMealId === meal.id"
                    :disabled="savingMealId !== null"
                    size="xs"
                    :label="$t('artists.meal_after_show')"
                    @update:model-value="toggleAfterShow(meal, $event)"
                  />
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Hébergement -->
        <UCard :class="repasAffiches ? undefined : 'lg:col-span-2'">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <UIcon name="i-heroicons-home-modern" class="text-blue-500" />
                {{ $t('artists.my_accommodation') }}
              </h2>
              <UButton
                v-if="!editingAccommodation"
                icon="i-heroicons-pencil-square"
                variant="ghost"
                size="xs"
                color="neutral"
                @click="editingAccommodation = true"
              />
            </div>
          </template>

          <div class="space-y-3">
            <!-- Mode lecture -->
            <template v-if="!editingAccommodation">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="
                    artist.accommodationAutonomous
                      ? 'i-heroicons-check-circle'
                      : 'i-heroicons-x-circle'
                  "
                  :class="artist.accommodationAutonomous ? 'text-green-500' : 'text-gray-400'"
                />
                <span class="text-gray-700 dark:text-gray-300">
                  {{
                    artist.accommodationAutonomous
                      ? $t('artists.accommodation_autonomous_info')
                      : $t('artists.accommodation_not_autonomous_info')
                  }}
                </span>
              </div>

              <div
                v-if="artist.accommodationType"
                class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              >
                <div class="flex items-center gap-2 text-sm">
                  <UIcon name="i-heroicons-home" class="text-blue-500 shrink-0" />
                  <span class="text-gray-700 dark:text-gray-300">
                    <strong>{{ accommodationTypeLabel(artist.accommodationType) }}</strong>
                    <span
                      v-if="artist.accommodationType === 'OTHER' && artist.accommodationTypeOther"
                    >
                      — {{ artist.accommodationTypeOther }}
                    </span>
                  </span>
                </div>
              </div>

              <div v-if="artist.accommodationProposal" class="space-y-1">
                <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {{ $t('artists.accommodation_proposal_info') }}
                </p>
                <p
                  class="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3"
                >
                  {{ artist.accommodationProposal }}
                </p>
              </div>
            </template>

            <!-- Mode édition -->
            <template v-else>
              <div class="space-y-3">
                <USwitch
                  v-model="accommodationForm.accommodationAutonomous"
                  :label="$t('artists.accommodation_autonomous_info')"
                />

                <template v-if="accommodationForm.accommodationAutonomous">
                  <UFormField :label="$t('artists.accommodation_type')">
                    <USelect
                      v-model="modeleTypeHebergement"
                      :items="accommodationTypeOptions"
                      value-key="value"
                      :placeholder="$t('artists.accommodation_not_specified')"
                      :ui="{ content: 'min-w-fit' }"
                    />
                  </UFormField>

                  <UFormField
                    v-if="accommodationForm.accommodationType === 'OTHER'"
                    :label="$t('artists.accommodation_type_other')"
                  >
                    <UInput
                      v-model="accommodationForm.accommodationTypeOther"
                      :placeholder="$t('artists.accommodation_type_other_placeholder')"
                    />
                  </UFormField>
                </template>

                <div class="flex justify-end gap-2">
                  <UButton
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    @click="cancelAccommodationEdit"
                  >
                    {{ $t('common.cancel') }}
                  </UButton>
                  <UButton
                    :loading="savingAccommodation"
                    :disabled="!accommodationFormDirty"
                    icon="i-heroicons-check"
                    size="sm"
                    @click="saveAccommodation"
                  >
                    {{ $t('common.save') }}
                  </UButton>
                </div>
              </div>
            </template>
          </div>
        </UCard>
      </div>

      <!-- Paiement et remboursements -->
      <UCard v-if="unMontantEstAnnonce">
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-banknotes" class="text-emerald-500" />
            {{ $t('artists.my_payment') }}
          </h2>
        </template>

        <div class="space-y-4">
          <!-- Paiement -->
          <div v-if="artist.payment !== null" class="flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('artists.payment_amount') }}
              </p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('artists.payment_amount_value', { amount: artist.payment }) }}
              </p>
            </div>
            <UBadge :color="artist.paymentPaid ? 'success' : 'warning'" variant="soft">
              {{ artist.paymentPaid ? $t('artists.payment_paid') : $t('artists.payment_pending') }}
            </UBadge>
          </div>

          <!-- Défraiement -->
          <div v-if="artist.reimbursementMax !== null" class="flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('artists.reimbursement_max') }}
              </p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('artists.payment_amount_value', { amount: artist.reimbursementMax }) }}
                <span
                  v-if="artist.reimbursementActual !== null"
                  class="text-sm font-normal text-gray-500"
                >
                  ({{ $t('artists.reimbursement_actual') }} :
                  {{ $t('artists.payment_amount_value', { amount: artist.reimbursementActual }) }})
                </span>
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <!--
                Le justificatif tient à côté de son montant, et non dans un téléverseur en pleine
                page : un plein champ pour un geste qu'on fait une fois poussait le montant qu'il
                accompagne hors de vue. Il n'apparaît QUE si un plafond est annoncé — déposer un
                billet de train sur un défraiement que personne n'a promis n'a pas de sens.
              -->
              <ArtistsReceiptField
                data-justificatif="reimbursement"
                :edition-id="editionId"
                :url="artist.reimbursementReceiptUrl"
                :aide="$t('artists.reimbursement_receipt_help')"
                :en-cours="savingJustificatif"
                @change="enregistrerJustificatif('reimbursementReceiptUrl', $event)"
              />
              <UBadge
                :color="artist.reimbursementActualPaid ? 'success' : 'warning'"
                variant="soft"
              >
                {{
                  artist.reimbursementActualPaid
                    ? $t('artists.reimbursement_paid')
                    : $t('artists.reimbursement_pending')
                }}
              </UBadge>
            </div>
          </div>

          <!-- Remboursement des consommables -->
          <div v-if="artist.consumablesMax !== null" class="flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('artists.consumables_max') }}
              </p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('artists.payment_amount_value', { amount: artist.consumablesMax }) }}
                <span
                  v-if="artist.consumablesActual !== null"
                  class="text-sm font-normal text-gray-500"
                >
                  ({{ $t('artists.consumables_actual') }} :
                  {{ $t('artists.payment_amount_value', { amount: artist.consumablesActual }) }})
                </span>
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <ArtistsReceiptField
                data-justificatif="consumables"
                :edition-id="editionId"
                :url="artist.consumablesReceiptUrl"
                :aide="$t('artists.consumables_receipt_help')"
                :en-cours="savingJustificatif"
                @change="enregistrerJustificatif('consumablesReceiptUrl', $event)"
              />
              <UBadge :color="artist.consumablesActualPaid ? 'success' : 'warning'" variant="soft">
                {{
                  artist.consumablesActualPaid
                    ? $t('artists.consumables_paid')
                    : $t('artists.consumables_pending')
                }}
              </UBadge>
            </div>
          </div>
          <!--
            L'IBAN et le BIC, dans la carte des montants et non dans une carte à eux.

            ⚠️ C'EST LE MÊME SUJET : à quoi l'artiste a droit, et par quel compte le lui verser.
            Les séparer obligeait à faire défiler entre le montant et le moyen de le recevoir, et
            faisait croire à deux formulaires indépendants.

            📍 L'AVERTISSEMENT NE BLOQUE PAS. Une faute de frappe dans un IBAN ne se voit pas, et la
            clé de contrôle la voit — mais refuser l'enregistrement priverait de recours un compte
            hors zone IBAN, ou une forme que notre code ignore. La décision reste à l'artiste, qui a
            le relevé sous les yeux.
          -->
          <USeparator />

          <div class="space-y-4">
            <div>
              <h3 class="text-sm font-medium text-gray-900 dark:text-white">
                {{ $t('artists.bank_section') }}
              </h3>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {{ $t('artists.bank_section_self_help') }}
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField :label="$t('artists.iban')">
                <UInput
                  v-model="coordonneesForm.iban"
                  :placeholder="$t('artists.iban_placeholder')"
                  class="w-full font-mono"
                  autocomplete="off"
                  @update:model-value="coordonneesTouchees = true"
                />
                <template v-if="ibanDouteux" #help>
                  <span class="text-amber-600 dark:text-amber-400">
                    {{ $t('artists.iban_suspect') }}
                  </span>
                </template>
              </UFormField>

              <UFormField :label="$t('artists.bic')">
                <UInput
                  v-model="coordonneesForm.bic"
                  :placeholder="$t('artists.bic_placeholder')"
                  class="w-full font-mono"
                  autocomplete="off"
                  @update:model-value="coordonneesTouchees = true"
                />
                <template v-if="bicDouteux" #help>
                  <span class="text-amber-600 dark:text-amber-400">
                    {{ $t('artists.bic_suspect') }}
                  </span>
                </template>
              </UFormField>
            </div>

            <div class="flex justify-end">
              <UButton
                color="primary"
                size="sm"
                :loading="savingCoordonnees"
                :disabled="!coordonneesFormDirty"
                @click="saveCoordonnees()"
              >
                {{ $t('common.save') }}
              </UButton>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Facture et cachet -->
      <UCard v-if="artist.invoiceRequested || artist.feeRequested">
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="text-indigo-500" />
            {{ $t('artists.invoice_fee_section') }}
          </h2>
        </template>

        <div class="space-y-3">
          <div v-if="artist.invoiceRequested" class="flex items-center justify-between">
            <span class="text-gray-700 dark:text-gray-300">
              {{ $t('artists.invoice_short') }}
            </span>
            <UBadge :color="artist.invoiceProvided ? 'success' : 'warning'" variant="soft">
              {{
                artist.invoiceProvided
                  ? $t('artists.invoice_provided')
                  : $t('artists.invoice_requested')
              }}
            </UBadge>
          </div>
          <div v-if="artist.feeRequested" class="flex items-center justify-between">
            <span class="text-gray-700 dark:text-gray-300">
              {{ $t('artists.fee_short') }}
            </span>
            <UBadge :color="artist.feeProvided ? 'success' : 'warning'" variant="soft">
              {{ artist.feeProvided ? $t('artists.fee_provided') : $t('artists.fee_requested') }}
            </UBadge>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Modal QR Code -->
    <UModal v-model:open="qrModalOpen" :title="$t('artists.artist_qr_code')">
      <template #body>
        <div v-if="artist" class="space-y-4">
          <div
            class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
          >
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-information-circle"
                class="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5"
              />
              <div class="text-sm text-yellow-700 dark:text-yellow-300">
                <p class="font-medium mb-1">
                  {{ $t('artists.qr_code_instructions_title') }}
                </p>
                <p>{{ $t('artists.qr_code_instructions') }}</p>
              </div>
            </div>
          </div>

          <div class="flex flex-col items-center justify-center p-6">
            <Qrcode :value="artist.qrCode" variant="default" />
            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
              {{ artist.qrCode }}
            </p>
          </div>

          <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <UIcon name="i-heroicons-user" class="w-4 h-4" />
                <span>{{ artist.firstName }} {{ artist.lastName }}</span>
              </div>
              <div
                v-if="artist.shows.length > 0"
                class="flex items-start gap-2 text-gray-600 dark:text-gray-400"
              >
                <UIcon name="i-heroicons-sparkles" class="w-4 h-4 mt-0.5" />
                <div class="flex flex-wrap gap-1">
                  <span v-for="(show, index) in artist.shows" :key="show.id">
                    {{ show.title }}<span v-if="index < artist.shows.length - 1">,&nbsp;</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Edition } from '~/types'

import type { AllergySeverityLevel } from '#imports'
import {
  useEditionStore,
  getAccommodationTypeLabel,
  getAccommodationTypeSelectOptions,
  getEditionDisplayName,
  markdownToHtml,
} from '#imports'

import {
  bicEstPlausible,
  formaterIbanParGroupes,
  ibanEstPlausible,
  normaliserCoordonneeBancaire,
} from '~~/shared/utils/coordonnees-bancaires'
import { formaterDateHeure, versChampLocal, versInstant } from '~~/shared/utils/fuseau-edition'

interface ArtistShowAct {
  id: number
  title: string
  technicalNeeds: string | null
  stageSetup: string | null
}

interface ArtistShow {
  id: number
  title: string
  description: string | null
  duration: number | null
  /** Les passages du spectacle : chacun a sa date et son lieu. */
  performances: { id: number; startDateTime: string; location: string | null }[]
  type: string
  // Besoins techniques éditables par l'artiste (spectacle STANDARD uniquement).
  technicalNeeds: string | null
  // Numéros du cabaret où l'artiste joue (chacun éditable : besoins techniques + mise en place).
  acts: ArtistShowAct[]
}

interface MealSelection {
  id: number
  afterShow: boolean
  meal: {
    id: number
    date: string
    mealType: string
  }
}

/** Organisateur chargé d'aller chercher l'artiste ou de le ramener. */
interface TransportResponsible {
  prenom: string | null
  nom: string | null
  pseudo: string
  phone: string | null
}

interface ArtistInfo {
  id: number
  firstName: string
  lastName: string
  email: string
  qrCode: string
  arrivalDateTime: string | null
  departureDateTime: string | null
  dietaryPreference: string
  allergies: string | null
  allergySeverity: string | null
  payment: number | null
  paymentPaid: boolean
  reimbursementMax: number | null
  reimbursementActual: number | null
  reimbursementActualPaid: boolean
  consumablesMax: number | null
  consumablesActual: number | null
  consumablesActualPaid: boolean
  /**
   * Ce que l'artiste confie lui-même : ses coordonnées bancaires et ses justificatifs.
   *
   * Stockés NORMALISÉS par le serveur — majuscules, sans espaces. L'écran les remet en groupes de
   * quatre pour la relecture, mais la valeur comparable est celle-ci.
   */
  iban: string | null
  bic: string | null
  reimbursementReceiptUrl: string | null
  consumablesReceiptUrl: string | null
  accommodationAutonomous: boolean
  accommodationType: string | null
  accommodationTypeOther: string | null
  accommodationProposal: string | null
  pickupRequired: boolean
  pickupLocation: string | null
  pickupResponsible: TransportResponsible | null
  dropoffRequired: boolean
  dropoffLocation: string | null
  dropoffResponsible: TransportResponsible | null
  invoiceRequested: boolean
  invoiceProvided: boolean
  feeRequested: boolean
  feeProvided: boolean
  shows: ArtistShow[]
  mealSelections: MealSelection[]
}

const route = useRoute()
const editionStore = useEditionStore()
const { t, locale } = useI18n()
const { formatDateTime, formatDateFull } = useDateFormat()
const { getMealTypeLabel } = useMealTypeLabel()

const editionId = parseInt(route.params.id as string)

// Charger l'édition
const {
  data: edition,
  pending: _editionLoading,
  error: _editionError,
} = await useFetch<Edition>(`/api/editions/${editionId}`)

// Informations artistes en HTML (rendu Markdown)
const { data: artistInfoHtml } = await useAsyncData(`artist-info-${editionId}`, async () => {
  if (!edition.value?.artistInfo) {
    return ''
  }
  return await markdownToHtml(edition.value.artistInfo)
})

// Synchroniser avec le store
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      editionStore.setEdition(newEdition)
    }
  },
  { immediate: true }
)

// Charger les données artiste
const {
  data: artistResponse,
  pending: loading,
  error: artistError,
  refresh: refreshArtist,
} = await useFetch<{ artist: ArtistInfo | null }>(`/api/editions/${editionId}/my-artist-info`)

const artist = computed(() => artistResponse.value?.artist ?? null)

/** Le fuseau de l'édition : ce que l'artiste saisit et lit est l'heure du LIEU. */
const fuseauEdition = computed(
  () =>
    (editionStore.getEditionById(editionId) as { timezone?: string | null } | undefined)
      ?.timezone ?? null
)

/** Nom affichable du responsable : son identité civile si connue, sinon son pseudo. */
const responsibleName = (person: TransportResponsible) => {
  const fullName = [person.prenom, person.nom].filter(Boolean).join(' ').trim()
  return fullName || person.pseudo
}

/**
 * Où envoyer quelqu'un qui n'a rien à faire ici — et la distinction que cette page ne faisait
 * pas.
 *
 * L'appel répond 401 à un visiteur anonyme. Le code lisait alors `artist === null` et concluait
 * « cette personne n'est pas artiste », donc la renvoyait vers l'édition. Comme tout cela se
 * joue pendant le rendu serveur, le lien partagé se soldait par une 302 : la personne n'avait
 * jamais l'occasion de se connecter, et sa destination était perdue.
 *
 * Un 401 veut dire « je ne sais pas qui vous êtes », pas « vous n'êtes pas artiste ».
 */
const { buildLoginUrl } = useReturnTo()

watch(
  [artist, artistError],
  ([value, erreur]) => {
    if (loading.value) return

    const code = (erreur as { statusCode?: number } | null)?.statusCode
    if (code === 401) {
      navigateTo(buildLoginUrl(route.fullPath))
      return
    }

    // Réellement connecté, mais pas artiste sur cette édition.
    if (value === null) navigateTo(`/editions/${editionId}`)
  },
  { immediate: true }
)

// QR Code modal
const qrModalOpen = ref(false)

// Informations artistes : affichage tronqué
const artistInfoExpanded = ref(false)

// Helper pour le label du type d'hébergement
const accommodationTypeLabel = (type: string) => getAccommodationTypeLabel(type, t)

// Formulaire hébergement
/**
 * La présence, déclarée par l'artiste lui-même.
 *
 * Le formulaire manipule des heures LOCALES au lieu (ce que rend un champ `datetime-local`), et
 * l'ancrage au fuseau de l'édition se fait à l'aller comme au retour. Sans lui, un artiste qui
 * saisit son arrivée depuis un autre fuseau enregistrerait un autre instant que celui qu'il lit.
 */
const editingPresence = ref(false)
const presenceForm = ref({
  arrivalDateTime: '',
  departureDateTime: '',
  pickupRequired: false,
  pickupLocation: '',
  dropoffRequired: false,
  dropoffLocation: '',
})

const ouvrirEditionPresence = () => {
  presenceForm.value = {
    arrivalDateTime: artist.value?.arrivalDateTime
      ? versChampLocal(artist.value.arrivalDateTime, fuseauEdition.value)
      : '',
    departureDateTime: artist.value?.departureDateTime
      ? versChampLocal(artist.value.departureDateTime, fuseauEdition.value)
      : '',
    pickupRequired: artist.value?.pickupRequired ?? false,
    pickupLocation: artist.value?.pickupLocation ?? '',
    dropoffRequired: artist.value?.dropoffRequired ?? false,
    dropoffLocation: artist.value?.dropoffLocation ?? '',
  }
  editingPresence.value = true
}

const { execute: savePresence, loading: savingPresence } = useApiAction(
  () => `/api/editions/${editionId}/my-presence`,
  {
    method: 'PUT',
    body: () => ({
      arrivalDateTime: versInstant(presenceForm.value.arrivalDateTime, fuseauEdition.value) || null,
      departureDateTime:
        versInstant(presenceForm.value.departureDateTime, fuseauEdition.value) || null,
      pickupRequired: presenceForm.value.pickupRequired,
      pickupLocation: presenceForm.value.pickupLocation || null,
      dropoffRequired: presenceForm.value.dropoffRequired,
      dropoffLocation: presenceForm.value.dropoffLocation || null,
    }),
    successMessage: { title: t('artists.presence_saved') },
    errorMessages: { default: t('artists.presence_save_error') },
    onSuccess: async () => {
      editingPresence.value = false
      await refreshArtist()
    },
  }
)

const editingAccommodation = ref(false)

const accommodationForm = reactive({
  accommodationAutonomous: artist.value?.accommodationAutonomous ?? false,
  accommodationType: artist.value?.accommodationType ?? (null as string | null),
  accommodationTypeOther: artist.value?.accommodationTypeOther ?? '',
})

const accommodationTypeOptions = computed(() => getAccommodationTypeSelectOptions(t))

/**
 * `USelect` veut `undefined` quand rien n'est choisi, l'API veut `null` pour effacer : ce
 * relais tient les deux, sans changer ce qui part sur le réseau.
 */
const modeleTypeHebergement = computed({
  get: () => accommodationForm.accommodationType ?? undefined,
  set: (valeur: string | undefined) => {
    accommodationForm.accommodationType = valeur ?? null
  },
})

/**
 * ⚠️ MÊME DÉFAUT QUE CI-DESSUS, PRÉEXISTANT : sans `immediate`, ce `watch` ne partait pas au
 * chargement, et le formulaire d'hébergement gardait ses valeurs par défaut. Un artiste autonome
 * ouvrait « Modifier » et lisait « non autonome » — puis l'enregistrait.
 *
 * Il se voyait moins que celui de l'IBAN parce qu'un faux « non » ressemble à un champ qu'on n'a
 * pas encore rempli, là qu'un IBAN manquant se remarque.
 */
watch(
  artist,
  (newArtist) => {
    if (newArtist && !editingAccommodation.value) {
      accommodationForm.accommodationAutonomous = newArtist.accommodationAutonomous
      accommodationForm.accommodationType = newArtist.accommodationType ?? null
      accommodationForm.accommodationTypeOther = newArtist.accommodationTypeOther ?? ''
    }
  },
  { immediate: true }
)

/**
 * Les repas sont-ils à afficher.
 *
 * ⚠️ EN FACTEUR COMMUN parce que DEUX endroits en dépendent : le `v-if` de la carte des repas, et
 * la largeur de la carte d'hébergement qui partage sa ligne. Le test recopié aurait fini par
 * diverger, et l'hébergement serait resté dans sa moitié d'écran avec l'autre moitié vide.
 */
const repasAffiches = computed(
  () => !!edition.value?.mealsEnabled && (artist.value?.mealSelections.length ?? 0) > 0
)

/**
 * L'organisation a-t-elle annoncé un montant — cachet, défraiement maximum ou consommables ?
 *
 * ⚠️ EN FACTEUR COMMUN, parce que DEUX cartes en dépendent : celle qui affiche les montants et
 * celle où l'artiste saisit ses coordonnées bancaires. Le test recopié aurait fini par diverger,
 * et l'on se serait retrouvé avec un champ de saisie sans les montants qu'il sert à encaisser, ou
 * l'inverse.
 *
 * 📍 `!== null` et non une coercition : un cachet de 0 — une prestation offerte, mais annoncée —
 * est une information, pas une absence.
 */
const unMontantEstAnnonce = computed(
  () =>
    !!artist.value &&
    (artist.value.payment !== null ||
      artist.value.reimbursementMax !== null ||
      artist.value.consumablesMax !== null)
)

/**
 * Seulement l'IBAN et le BIC.
 *
 * ⚠️ LES JUSTIFICATIFS N'Y SONT PAS, volontairement : ils s'enregistrent dès qu'on valide leur
 * modale, sans bouton « Enregistrer » à aller chercher plus bas. Les faire passer par ce
 * formulaire aurait produit le pire des deux mondes — une modale qu'on valide et qui ne change
 * rien tant qu'on n'a pas enregistré ailleurs.
 */
const coordonneesForm = reactive({
  iban: '',
  bic: '',
})

/**
 * Douteux, et non invalide : l'enregistrement n'est pas bloqué.
 *
 * Une faute de frappe dans un IBAN ne se voit pas — vingt-sept caractères sans signification
 * apparente — et la clé de contrôle, elle, la voit. Mais refuser la saisie priverait de recours un
 * compte hors zone IBAN, ou une forme que notre code ignore : la décision reste à l'artiste, qui a
 * le relevé sous les yeux.
 */
const ibanDouteux = computed(() => !ibanEstPlausible(coordonneesForm.iban))
const bicDouteux = computed(() => !bicEstPlausible(coordonneesForm.bic))

/**
 * L'artiste a-t-il TOUCHÉ au formulaire depuis le dernier chargement.
 *
 * ⚠️ CE DRAPEAU EXISTE PARCE QUE `coordonneesFormDirty` NE POUVAIT PAS JOUER CE RÔLE, et c'est le
 * défaut qui a fait croire que l'IBAN ne s'enregistrait pas.
 *
 * Le rappel d'initialisation commençait par renoncer si le formulaire était « modifié ». Or
 * « modifié » se mesurait en comparant le champ à la base — et au chargement, le champ est vide
 * tandis que la base porte un IBAN : la comparaison rendait donc VRAI, et le rappel renonçait
 * exactement quand il fallait remplir. La garde se déclenchait sur l'état qu'elle devait corriger.
 *
 * Une comparaison de valeurs ne sait pas distinguer « la personne a saisi quelque chose » de « le
 * formulaire n'a jamais été rempli ». Seul un drapeau posé par la SAISIE le sait.
 */
const coordonneesTouchees = ref(false)

const coordonneesFormDirty = computed(() => {
  if (!artist.value) return false
  // Comparaison sur la valeur NORMALISÉE : la saisie porte ses espaces de recopie, la base non.
  // Sans cela, le bouton resterait actif juste après un enregistrement réussi.
  return (
    normaliserCoordonneeBancaire(coordonneesForm.iban) !== (artist.value.iban ?? '') ||
    normaliserCoordonneeBancaire(coordonneesForm.bic) !== (artist.value.bic ?? '')
  )
})

/**
 * ⚠️ `immediate: true` EST INDISPENSABLE, ET SON ABSENCE A COÛTÉ UN DÉFAUT GRAVE.
 *
 * `artist` vient d'un `await useFetch` : sa valeur est DÉJÀ posée quand ce `watch` s'enregistre,
 * en navigation comme en hydratation. Sans `immediate`, il ne part donc jamais au chargement, et
 * le champ IBAN reste vide alors que la base en a un.
 *
 * Et le pire n'était pas l'affichage. Le formulaire vide face à une valeur enregistrée rend
 * `coordonneesFormDirty` VRAI : le bouton « Enregistrer » était actif dès l'arrivée sur la page, et
 * un clic envoyait `iban: null` — il EFFAÇAIT les coordonnées qu'on venait seulement de regarder.
 *
 * 📍 Les formulaires voisins n'ont pas ce défaut parce qu'ils se remplissent À L'OUVERTURE de leur
 * mode édition (`ouvrirEditionPresence`). Celui-ci est toujours visible : il n'a pas d'ouverture
 * où se remplir.
 *
 * 📍 LA GARDE RESTE, mais sur `coordonneesTouchees` : la fiche est relue après chaque
 * enregistrement, et sans garde une saisie en cours serait écrasée par la valeur du serveur. Voir
 * le commentaire de ce drapeau pour la raison du changement.
 */
watch(
  artist,
  (nouvel) => {
    if (!nouvel || coordonneesTouchees.value) return
    // Par groupes de quatre, comme sur un relevé : c'est la seule forme sous laquelle on relit un
    // IBAN caractère par caractère pour le comparer au papier.
    coordonneesForm.iban = formaterIbanParGroupes(nouvel.iban)
    coordonneesForm.bic = nouvel.bic ?? ''
  },
  { immediate: true }
)

type ChampDeJustificatif = 'reimbursementReceiptUrl' | 'consumablesReceiptUrl'

/**
 * Le justificatif en instance d'enregistrement.
 *
 * `useApiAction` construit son corps au moment de l'appel : cette référence est le seul moyen de
 * lui passer lequel des deux champs change, sans écrire deux actions identiques.
 */
const justificatifEnAttente = ref<{ champ: ChampDeJustificatif; url: string | null } | null>(null)

const { execute: envoyerJustificatif, loading: savingJustificatif } = useApiAction<
  unknown,
  { reimbursementReceiptUrl: string | null; consumablesReceiptUrl: string | null }
>(() => `/api/editions/${editionId}/my-payment-info`, {
  method: 'PUT',
  /*
   * ⚠️ UN SEUL CHAMP DANS LE CORPS, et c'est essentiel. Le point d'API n'écrit que les clés
   * présentes : envoyer les deux justificatifs effacerait l'autre, et envoyer l'IBAN à `null`
   * effacerait les coordonnées. C'est précisément le contrat pour lequel il a été écrit ainsi.
   */
  body: () => ({ [justificatifEnAttente.value!.champ]: justificatifEnAttente.value!.url }),
  successMessage: { title: t('artists.receipt_saved') },
  errorMessages: { default: t('artists.receipt_save_error') },
  onSuccess: (reponse) => {
    if (!reponse || !artistResponse.value?.artist) return
    artistResponse.value = {
      ...artistResponse.value,
      artist: { ...artistResponse.value.artist, ...reponse },
    }
  },
})

/**
 * Enregistrer un justificatif dès la validation de sa modale.
 *
 * 📍 Pas de bouton « Enregistrer » à aller chercher plus bas : valider la modale DOIT suffire.
 * Une modale qu'on valide et qui ne change rien tant qu'on n'a pas enregistré ailleurs est le
 * genre de piège dont on ne se rend compte qu'en perdant son téléversement.
 */
async function enregistrerJustificatif(champ: ChampDeJustificatif, url: string | null) {
  justificatifEnAttente.value = { champ, url }
  await envoyerJustificatif()
}

const { execute: saveCoordonnees, loading: savingCoordonnees } = useApiAction<
  unknown,
  {
    iban: string | null
    bic: string | null
    reimbursementReceiptUrl: string | null
    consumablesReceiptUrl: string | null
  }
>(() => `/api/editions/${editionId}/my-payment-info`, {
  method: 'PUT',
  body: () => ({
    // Les espaces de saisie partent tels quels : c'est le serveur qui normalise, et lui seul.
    //
    // ⚠️ LES JUSTIFICATIFS NE SONT PAS DANS CE CORPS, et c'est ce qui les préserve : le point d'API
    // ne touche que les clés présentes. Les y ajouter à `null` les effacerait à chaque
    // enregistrement de l'IBAN.
    iban: coordonneesForm.iban || null,
    bic: coordonneesForm.bic || null,
  }),
  successMessage: { title: t('artists.payment_info_saved') },
  errorMessages: { default: t('artists.payment_info_save_error') },
  onSuccess: (reponse) => {
    // La saisie est enregistrée : le formulaire redevient un reflet du serveur, et se laisse donc
    // remplir par la valeur NORMALISÉE qui revient — mise en groupes de quatre pour la relecture.
    coordonneesTouchees.value = false
    if (!reponse || !artistResponse.value?.artist) return
    // La fiche locale reçoit ce que le serveur a RETENU — normalisé, et les justificatifs à leur
    // URL définitive, plus celle du dossier temporaire. Sans cela, le formulaire resterait
    // « modifié » juste après un enregistrement réussi.
    artistResponse.value = {
      ...artistResponse.value,
      artist: { ...artistResponse.value.artist, ...reponse },
    }
  },
})

const accommodationFormDirty = computed(() => {
  if (!artist.value) return false
  return (
    accommodationForm.accommodationAutonomous !== artist.value.accommodationAutonomous ||
    accommodationForm.accommodationType !== (artist.value.accommodationType ?? null) ||
    (accommodationForm.accommodationType === 'OTHER' &&
      (accommodationForm.accommodationTypeOther || '') !==
        (artist.value.accommodationTypeOther || ''))
  )
})

const { execute: saveAccommodation, loading: savingAccommodation } = useApiAction<
  unknown,
  {
    accommodationAutonomous: boolean
    accommodationType: string | null
    accommodationTypeOther: string | null
  }
>(() => `/api/editions/${editionId}/my-accommodation`, {
  method: 'PUT',
  body: () => ({
    accommodationAutonomous: accommodationForm.accommodationAutonomous,
    accommodationType: accommodationForm.accommodationAutonomous
      ? accommodationForm.accommodationType || null
      : null,
    accommodationTypeOther:
      accommodationForm.accommodationAutonomous && accommodationForm.accommodationType === 'OTHER'
        ? accommodationForm.accommodationTypeOther || null
        : null,
  }),
  successMessage: { title: t('artists.accommodation_saved') },
  errorMessages: { default: t('artists.accommodation_save_error') },
  onSuccess: (response) => {
    if (response && artistResponse.value?.artist) {
      artistResponse.value = {
        ...artistResponse.value,
        artist: {
          ...artistResponse.value.artist,
          accommodationAutonomous: response.accommodationAutonomous,
          accommodationType: response.accommodationType,
          accommodationTypeOther: response.accommodationTypeOther,
        },
      }
    }
    editingAccommodation.value = false
  },
})

const cancelAccommodationEdit = () => {
  if (artist.value) {
    accommodationForm.accommodationAutonomous = artist.value.accommodationAutonomous
    accommodationForm.accommodationType = artist.value.accommodationType ?? null
    accommodationForm.accommodationTypeOther = artist.value.accommodationTypeOther ?? ''
  }
  editingAccommodation.value = false
}

// Formulaire régime alimentaire / allergies
const editingDiet = ref(false)

const dietForm = reactive({
  dietaryPreference: artist.value?.dietaryPreference ?? 'NONE',
  allergies: artist.value?.allergies ?? '',
  allergySeverity: (artist.value?.allergySeverity ?? null) as AllergySeverityLevel | null,
})

/** Même relais que pour l'hébergement : voir plus haut. */
const modeleGraviteAllergie = computed({
  get: () => dietForm.allergySeverity ?? undefined,
  set: (valeur: AllergySeverityLevel | undefined) => {
    dietForm.allergySeverity = valeur ?? null
  },
})

// Synchroniser le formulaire quand les données artiste changent (chargement initial)
watch(artist, (newArtist) => {
  if (newArtist && !editingDiet.value) {
    dietForm.dietaryPreference = newArtist.dietaryPreference
    dietForm.allergies = newArtist.allergies ?? ''
    // La colonne est une énumération Prisma (`AllergySeverity?`) : la réponse d'API la
    // dégrade en `string | null` au passage par JSON, mais ses valeurs sont contraintes.
    dietForm.allergySeverity = newArtist.allergySeverity as AllergySeverityLevel | null
  }
})

const dietFormDirty = computed(() => {
  if (!artist.value) return false
  return (
    dietForm.dietaryPreference !== artist.value.dietaryPreference ||
    (dietForm.allergies || '') !== (artist.value.allergies || '') ||
    dietForm.allergySeverity !== artist.value.allergySeverity
  )
})

const dietaryOptions = computed(() => [
  { label: t('diet.none'), value: 'NONE' },
  { label: t('diet.vegetarian'), value: 'VEGETARIAN' },
  { label: t('diet.vegan'), value: 'VEGAN' },
])

const allergySeverityOptions = computed(() =>
  getAllergySeveritySelectOptions().map((option) => ({
    value: option.value,
    label: t(option.label),
  }))
)

const { execute: saveDiet, loading: savingDiet } = useApiAction<
  unknown,
  {
    dietaryPreference: string
    allergies: string | null
    allergySeverity: string | null
  }
>(() => `/api/editions/${editionId}/my-diet`, {
  method: 'PUT',
  body: () => ({
    dietaryPreference: dietForm.dietaryPreference,
    allergies: dietForm.allergies || null,
    allergySeverity: dietForm.allergies ? dietForm.allergySeverity : null,
  }),
  successMessage: { title: t('artists.diet_saved') },
  errorMessages: { default: t('artists.diet_save_error') },
  onSuccess: (response) => {
    if (response && artistResponse.value?.artist) {
      artistResponse.value = {
        ...artistResponse.value,
        artist: {
          ...artistResponse.value.artist,
          dietaryPreference: response.dietaryPreference,
          allergies: response.allergies,
          allergySeverity: response.allergySeverity,
        },
      }
    }
    editingDiet.value = false
  },
})

const cancelDietEdit = () => {
  if (artist.value) {
    dietForm.dietaryPreference = artist.value.dietaryPreference
    dietForm.allergies = artist.value.allergies ?? ''
    dietForm.allergySeverity = artist.value.allergySeverity as AllergySeverityLevel | null
  }
  editingDiet.value = false
}

// État local pour les modifications de repas
const editableMeals = ref<Record<number, boolean>>({})
const savingMealId = ref<number | null>(null)
const toggleMealData = ref<{ mealId: number; newValue: boolean } | null>(null)

const { execute: executeToggleAfterShow } = useApiAction(
  () => `/api/editions/${editionId}/my-meals`,
  {
    method: 'PUT',
    body: () => ({
      selections: [
        { selectionId: toggleMealData.value!.mealId, afterShow: toggleMealData.value!.newValue },
      ],
    }),
    errorMessages: { default: t('artists.meals.error_saving') },
    onSuccess: (response: any) => {
      if (response?.mealSelections && artistResponse.value?.artist) {
        artistResponse.value = {
          ...artistResponse.value,
          artist: {
            ...artistResponse.value.artist,
            mealSelections: response.mealSelections,
          },
        }
        editableMeals.value = {}
      }
      savingMealId.value = null
    },
    onError: () => {
      if (toggleMealData.value) {
        const { [toggleMealData.value.mealId]: _, ...rest } = editableMeals.value
        editableMeals.value = rest
      }
      savingMealId.value = null
    },
  }
)

const toggleAfterShow = (meal: MealSelection, newValue: boolean) => {
  editableMeals.value[meal.id] = newValue
  savingMealId.value = meal.id
  toggleMealData.value = { mealId: meal.id, newValue }
  executeToggleAfterShow()
}

// Grouper les repas par date
const groupedMeals = computed(() => {
  if (!artist.value?.mealSelections) return {}
  const groups: Record<string, MealSelection[]> = {}
  for (const ms of artist.value.mealSelections) {
    const date = ms.meal.date
    if (!groups[date]) groups[date] = []
    groups[date].push(ms)
  }
  return groups
})

// SEO
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))
useSeoMeta({
  title: computed(() => `${t('artists.artist_space_title')} - ${editionName.value}`),
})
</script>
