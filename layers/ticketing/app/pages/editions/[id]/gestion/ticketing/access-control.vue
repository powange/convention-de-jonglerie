<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UiAccesRefuse />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <ManagementPageHeader
            :titre="$t('gestion.ticketing.access_control_title')"
            :description="$t('gestion.ticketing.access_control_description')"
          />
        </div>
        <div class="flex items-center gap-2 sm:flex-shrink-0">
          <UButton
            v-if="hasHelloAssoConfig"
            icon="i-heroicons-arrow-path"
            color="primary"
            variant="soft"
            :loading="syncingHelloAsso"
            @click="syncHelloAsso"
          >
            {{ $t('ticketing.access_control.sync_helloasso') }}
          </UButton>
          <UButton
            v-if="allowOnsiteRegistration && hasTiers"
            icon="i-heroicons-user-plus"
            color="primary"
            @click="showAddParticipantModal = true"
          >
            {{ $t('edition.ticketing.add_participant') }}
          </UButton>
        </div>
      </div>

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <!-- Grille : Recherche/Scan + Statistiques d'entrée -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <!-- Rechercher un billet (ou scanner) -->
          <UCard>
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-magnifying-glass" class="text-purple-500" />
                <h2 class="text-lg font-semibold">
                  {{ $t('ticketing.access_control.search_ticket') }}
                </h2>
              </div>

              <!-- Bouton Scanner QR -->
              <UButton
                icon="i-heroicons-qr-code"
                color="primary"
                size="xl"
                variant="soft"
                class="w-full justify-center h-13"
                @click="startScanner"
              >
                <span class="font-semibold">{{ $t('ticketing.access_control.scan_qr_code') }}</span>
              </UButton>

              <!-- Zone de recherche -->
              <div ref="zoneDeRecherche" class="space-y-4">
                <UFormField :help="$t('ticketing.access_control.search_description')">
                  <UFieldGroup class="w-full">
                    <UInput
                      v-model="searchTerm"
                      :placeholder="$t('ticketing.access_control.search_placeholder')"
                      icon="i-heroicons-magnifying-glass"
                      class="w-full"
                      @keydown.enter="searchTickets"
                    />
                    <UButton
                      icon="i-heroicons-magnifying-glass"
                      color="primary"
                      :title="$t('ticketing.access_control.search_button_aria')"
                      :aria-label="$t('ticketing.access_control.search_button_aria')"
                      :disabled="!searchTerm || searchTerm.length < 2"
                      :loading="searching"
                      @click="searchTickets"
                    />
                  </UFieldGroup>
                </UFormField>

                <!-- Résultats de recherche -->
                <div v-if="searchResults" class="space-y-2">
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ searchResults.total }} résultat{{
                      searchResults.total > 1 ? 's' : ''
                    }}
                    trouvé{{ searchResults.total > 1 ? 's' : '' }}
                  </div>

                  <!--
                    ─── Les PERSONNES à plusieurs titres ─────────────────────────────────────

                    ⚠️ CE BLOC S'AJOUTE, IL NE REMPLACE RIEN. Les quatre listes restent dessous,
                    intactes : c'est là qu'on lit le détail d'un billet, ses options, ses créneaux,
                    ses articles à remettre. Ici on ne propose qu'un geste — valider tout ce que
                    cette personne porte.

                    📍 N'apparaît que s'il reste au moins DEUX titres à valider. Un seul titre
                    restant est déjà servi par les listes, et le proposer en double n'ajouterait
                    qu'une façon de se tromper — voir `meriteUnGesteGroupe`.
                  -->
                  <div v-if="personnesAValiderEnBloc.length > 0" class="space-y-2">
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon name="i-heroicons-user-group" class="text-primary-500" />
                      {{ $t('ticketing.access_control.group_title') }}
                    </div>
                    <div
                      v-for="personne in personnesAValiderEnBloc"
                      :key="personne.cle"
                      class="p-3 rounded-lg border-2 border-primary-200 dark:border-primary-900 bg-primary-50/50 dark:bg-primary-900/10 space-y-2"
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium text-gray-900 dark:text-white">
                          {{ personne.libelle }}
                        </span>
                        <!--
                          La COULEUR dit la nature, la COCHE dit la validation. La couleur portait
                          les deux auparavant — vert si validé, gris sinon —, et les quatre natures
                          se ressemblaient donc toutes.
                        -->
                        <UBadge
                          v-for="titre in personne.titres"
                          :key="`${titre.nature}-${titre.id}`"
                          size="sm"
                          variant="soft"
                          color="neutral"
                          :class="pastilleDeNature(titre.nature).classes"
                          :icon="titre.entryValidated ? 'i-heroicons-check' : undefined"
                          :label="pastilleDeNature(titre.nature).libelle"
                        />
                      </div>

                      <!--
                        ⚠️ LE MOTIF EST DIT, et ce n'est pas décoratif. Un rapprochement par
                        courriel et nom N'EST PAS CERTAIN : mesuré sur la base de développement,
                        163 courriels sur 609 portent des billets à plusieurs noms. L'annoncer
                        laisse l'opérateur vérifier avant de valider quelqu'un qui n'est pas là.
                      -->
                      <p
                        v-if="personne.motif === 'courriel-et-nom'"
                        class="text-xs text-amber-700 dark:text-amber-400"
                      >
                        {{ $t('ticketing.access_control.group_motif_email') }}
                      </p>

                      <UButton
                        size="sm"
                        icon="i-heroicons-check-badge"
                        :loading="validationEnBloc === personne.cle"
                        :disabled="validationEnBloc !== null"
                        :label="
                          $t('ticketing.access_control.group_validate', {
                            count: personne.aValider,
                          })
                        "
                        @click="ouvrirValidationGroupee(personne)"
                      />
                    </div>
                  </div>

                  <!-- Liste des billets -->
                  <div v-if="searchResults.tickets.length > 0" class="space-y-2">
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon :name="ticketConfig.icon" :class="ticketConfig.iconColorClass" />
                      Billets ({{ searchResults.tickets.length }})
                    </div>
                    <div class="space-y-1 max-h-60 overflow-y-auto">
                      <button
                        v-for="result in searchResults.tickets"
                        :key="result.participant.ticket.id"
                        class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-2 border-transparent hover:border-primary-500 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                        @click="selectSearchResult(result)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-white">
                              {{ result.participant.ticket.user.firstName }}
                              {{ result.participant.ticket.user.lastName }}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              {{ result.participant.ticket.user.email }}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-500">
                              {{ result.participant.ticket.name }}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <UBadge color="neutral" :class="pastilleDeNature('ticket').classes">{{
                              $t('ticketing.stats.participants')
                            }}</UBadge>
                            <UIcon
                              v-if="result.participant.ticket.entryValidated"
                              name="i-heroicons-check-circle"
                              class="text-green-500"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Liste des artistes -->
                  <div
                    v-if="searchResults.artists && searchResults.artists.length > 0"
                    class="space-y-2"
                  >
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon :name="artistConfig.icon" :class="artistConfig.iconColorClass" />
                      Artistes ({{ searchResults.artists.length }})
                    </div>
                    <div class="space-y-1 max-h-60 overflow-y-auto">
                      <button
                        v-for="result in searchResults.artists"
                        :key="result.participant.artist.id"
                        class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-2 border-transparent hover:border-primary-500 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                        @click="selectSearchResult(result)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-white">
                              {{ result.participant.artist.user.firstName }}
                              {{ result.participant.artist.user.lastName }}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              {{ result.participant.artist.user.email }}
                            </div>
                            <div
                              v-if="result.participant.artist.shows.length > 0"
                              class="text-xs text-gray-500 dark:text-gray-500"
                            >
                              Spectacle{{ result.participant.artist.shows.length > 1 ? 's' : '' }}:
                              {{ result.participant.artist.shows.map((s) => s.title).join(', ') }}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <UBadge color="neutral" :class="pastilleDeNature('artist').classes">{{
                              $t('ticketing.stats.artists')
                            }}</UBadge>
                            <UIcon
                              v-if="result.participant.artist.entryValidated"
                              name="i-heroicons-check-circle"
                              class="text-green-500"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Liste des bénévoles -->
                  <div v-if="searchResults.volunteers.length > 0" class="space-y-2">
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon :name="volunteerConfig.icon" :class="volunteerConfig.iconColorClass" />
                      {{ $t('ticketing.stats.volunteers') }} ({{ searchResults.volunteers.length }})
                    </div>
                    <div class="space-y-1 max-h-60 overflow-y-auto">
                      <button
                        v-for="result in searchResults.volunteers"
                        :key="result.participant.volunteer.id"
                        class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-2 border-transparent hover:border-primary-500 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                        @click="selectSearchResult(result)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-white">
                              {{ result.participant.volunteer.user.firstName }}
                              {{ result.participant.volunteer.user.lastName }}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              {{ result.participant.volunteer.user.email }}
                            </div>
                            <div
                              v-if="result.participant.volunteer.teams.length > 0"
                              class="text-xs text-gray-500 dark:text-gray-500"
                            >
                              Équipe{{ result.participant.volunteer.teams.length > 1 ? 's' : '' }}:
                              {{ result.participant.volunteer.teams.map((t) => t.name).join(', ') }}
                            </div>
                          </div>
                          <div class="flex flex-wrap items-center justify-end gap-2">
                            <UBadge color="primary">{{ $t('ticketing.stats.volunteers') }}</UBadge>
                            <!-- ⚠️ Celui qui n'est PAS attendu pendant l'événement le dit. Il
                                 apparaît désormais au contrôle d'accès — il est sur place au
                                 montage ou au démontage, il faut bien le faire entrer —, mais sans
                                 ce repère le guichet le prendrait pour un bénévole ordinaire. -->
                            <UBadge
                              v-if="phaseHorsEvenement(result.participant.volunteer)"
                              color="warning"
                              variant="soft"
                            >
                              <UIcon
                                name="i-heroicons-wrench-screwdriver"
                                class="w-3.5 h-3.5 mr-1"
                              />
                              {{
                                $t(
                                  `ticketing.access_control.phase.${phaseHorsEvenement(result.participant.volunteer)}`
                                )
                              }}
                            </UBadge>
                            <UIcon
                              v-if="result.participant.volunteer.entryValidated"
                              name="i-heroicons-check-circle"
                              class="text-green-500"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Liste des organisateurs -->
                  <div
                    v-if="searchResults.organizers && searchResults.organizers.length > 0"
                    class="space-y-2"
                  >
                    <div
                      class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <UIcon :name="organizerConfig.icon" :class="organizerConfig.iconColorClass" />
                      {{ $t('ticketing.stats.organizers') }} ({{ searchResults.organizers.length }})
                    </div>
                    <div class="space-y-1 max-h-60 overflow-y-auto">
                      <button
                        v-for="result in searchResults.organizers"
                        :key="result.participant.organizer.id"
                        class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-2 border-transparent hover:border-primary-500 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                        @click="selectSearchResult(result)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-white">
                              {{ result.participant.organizer.user.firstName }}
                              {{ result.participant.organizer.user.lastName }}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              {{ result.participant.organizer.user.email }}
                            </div>
                            <div
                              v-if="result.participant.organizer.title"
                              class="text-xs text-gray-500 dark:text-gray-500"
                            >
                              {{ result.participant.organizer.title }}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <UBadge
                              color="neutral"
                              :class="pastilleDeNature('organizer').classes"
                              >{{ $t('common.organizer') }}</UBadge
                            >
                            <UIcon
                              v-if="result.participant.organizer.entryValidated"
                              name="i-heroicons-check-circle"
                              class="text-green-500"
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Aucun résultat -->
                  <div
                    v-if="searchResults.total === 0"
                    class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <UIcon
                      name="i-heroicons-magnifying-glass"
                      class="mx-auto h-12 w-12 text-gray-400 mb-2"
                    />
                    <p class="text-sm text-gray-500">
                      {{ $t('ticketing.access_control.no_ticket_found') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Statistiques d'entrée -->
          <TicketingStatsEntryStatsCard
            :stats="stats"
            @show-volunteers-not-validated="showVolunteersNotValidatedModal"
            @show-artists-not-validated="showArtistsNotValidatedModal"
            @show-organizers-not-validated="showOrganizersNotValidatedModal"
          />
        </div>

        <!-- Statistiques des quotas.

             Sans garde sur les tarifs : un quota peut ne viser que des bénévoles, des artistes
             ou des organisateurs, et une édition sans billetterie payante avait donc des jauges
             qu'elle ne voyait jamais. La carte se masque déjà d'elle-même quand il n'y a aucune
             statistique à montrer, ce qui est la seule condition juste. -->
        <TicketingStatsQuotaStatsCard :edition-id="editionId" />

        <!-- Dernières validations -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <UIcon name="i-heroicons-clock" class="text-orange-500 flex-shrink-0" />
                <h2 class="text-lg font-semibold truncate">
                  {{ $t('edition.ticketing.recent_validations') }}
                </h2>
              </div>
              <!-- Le fil ne montre que dix lignes, sans filtre : c'est voulu, il se lit debout.
                   Tout le reste vit dans la modale d'historique. -->
              <UButton
                variant="ghost"
                size="sm"
                icon="i-heroicons-list-bullet"
                class="flex-shrink-0"
                @click="historiqueOuvert = true"
              >
                {{ $t('ticketing.entry_log.open') }}
              </UButton>
            </div>

            <div v-if="loadingValidations" class="text-center py-8">
              <p class="text-sm text-gray-500">{{ $t('ticketing.access_control.loading') }}</p>
            </div>

            <UiEtatVide
              v-else-if="recentValidations.length === 0"
              compact
              icone="i-heroicons-ticket"
              :titre="$t('edition.ticketing.no_validation_yet')"
              class="bg-gray-50 dark:bg-gray-800 rounded-lg"
            />

            <div v-else class="space-y-2">
              <div
                v-for="validation in recentValidations"
                :key="validation.id"
                :class="['p-3 rounded-lg', fondDuMouvement(validation)]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3 flex-1 min-w-0">
                    <!-- Icône du type -->
                    <UIcon
                      :name="
                        validation.type === 'ticket'
                          ? ticketConfig.icon
                          : validation.type === 'volunteer'
                            ? volunteerConfig.icon
                            : validation.type === 'artist'
                              ? artistConfig.icon
                              : organizerConfig.icon
                      "
                      :class="[
                        'flex-shrink-0 mt-0.5',
                        validation.type === 'ticket'
                          ? ticketConfig.iconColorClass
                          : validation.type === 'volunteer'
                            ? volunteerConfig.iconColorClass
                            : validation.type === 'artist'
                              ? artistConfig.iconColorClass
                              : organizerConfig.iconColorClass,
                      ]"
                      size="20"
                    />

                    <!-- Participant validé -->
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-900 dark:text-white">
                        {{
                          [validation.firstName, validation.lastName].filter(Boolean).join(' ') ||
                          $t('ticketing.access_control.unknown')
                        }}
                      </div>
                      <div class="text-sm text-gray-600 dark:text-gray-400">
                        {{ libelleDuMouvement(validation) }}
                      </div>
                      <UBadge
                        v-if="validation.movement === 'INVALIDATED'"
                        color="error"
                        variant="soft"
                        size="sm"
                        class="mt-1"
                      >
                        {{ $t('ticketing.access_control.entry_cancelled') }}
                      </UBadge>
                    </div>
                  </div>

                  <div class="text-right flex-shrink-0 space-y-2">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatValidationTime(validation.entryValidatedAt) }}
                    </div>
                    <!-- Validé par -->
                    <div v-if="validation.validator" class="flex justify-end">
                      <UiUserDisplayForAdmin
                        :user="validation.validator"
                        size="sm"
                        :show-email="false"
                        :border="false"
                        avatar-class=""
                      />
                    </div>
                    <div v-else class="flex items-center justify-end gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 italic">{{
                        $t('ticketing.access_control.unknown')
                      }}</span>
                      <div
                        class="h-5 w-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0"
                      >
                        <UIcon name="i-heroicons-user" class="h-3 w-3 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Scanner QR Code -->
      <TicketingQrCodeScanner v-model:open="scannerOpen" @scan="handleScan" />

      <!-- Historique complet des mouvements d'entrée -->
      <TicketingEntryLogModal
        v-model:open="historiqueOuvert"
        :edition-id="editionId"
        :fuseau="edition?.timezone"
      />

      <!-- Modal détails du participant -->
      <!--
        `titres` ne sert qu'au geste groupé : la fiche y empile alors toutes les parties de la
        personne. Vide, elle retombe sur `participant` — le parcours individuel, inchangé.
      -->
      <TicketingParticipantDetailsModal
        v-model:open="participantModalOpen"
        :participant="selectedParticipant"
        :type="participantType"
        :is-refunded="isRefundedOrder"
        :titres="titresDuGroupe"
        :fuseau="edition?.timezone"
        @validate="handleValidateParticipants"
        @invalidate="handleInvalidateEntry"
        @refund="handleRefund"
        @remise-rendue="handleRemiseRendue"
      />

      <!-- Modal ajout de participant -->
      <TicketingAddParticipantModal
        v-model:open="showAddParticipantModal"
        :edition-id="editionId"
        :allow-anonymous-orders="allowAnonymousOrders"
        :enabled-payment-methods="enabledPaymentMethods"
        :sumup-enabled="sumupEnabled"
        :sumup-affiliate-key="sumupAffiliateKey"
        :sumup-app-id="sumupAppId"
        :edition-name="edition?.name"
        @order-created="handleOrderCreated"
        @open-existing-ticket="ouvrirBilletExistant"
      />

      <!-- Modal liste des bénévoles non validés -->
      <UModal
        v-model:open="volunteersNotValidatedModalOpen"
        :title="$t('ticketing.access_control.volunteers_not_validated_title')"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert icon="i-heroicons-information-circle" color="info" variant="soft">
              <template #description>
                {{ $t('ticketing.access_control.volunteers_not_validated_description') }}
              </template>
            </UAlert>

            <div v-if="loadingVolunteersNotValidated" class="text-center py-8">
              <p class="text-sm text-gray-500">{{ $t('ticketing.access_control.loading') }}</p>
            </div>

            <!--
              La teinte verte porte l'information : ce vide-ci est un ABOUTISSEMENT — tout le monde
              est passé —, pas un simple « il n'y a rien ». Le neutre par défaut de `UiEtatVide`
              dirait la mauvaise chose.
            -->
            <UiEtatVide
              v-else-if="volunteersNotValidated.length === 0"
              compact
              icone="i-heroicons-check-circle"
              classe-icone="text-green-400"
              :titre="$t('ticketing.access_control.all_volunteers_validated')"
              class="bg-gray-50 dark:bg-gray-800 rounded-lg"
            />

            <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto">
              <button
                v-for="volunteer in volunteersNotValidated"
                :key="volunteer.id"
                type="button"
                class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors enabled:cursor-pointer enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700"
                :disabled="!volunteer.user?.email"
                :title="
                  volunteer.user?.email
                    ? $t('ticketing.access_control.search_this_person')
                    : undefined
                "
                @click="rechercherDepuisLaListe(volunteer.user?.email)"
              >
                <UiUserDisplayForAdmin :user="volunteer.user" size="md" :show-email="true" />
                <div
                  v-if="volunteer.teams.length > 0"
                  class="text-xs text-gray-500 dark:text-gray-500 mt-2 ml-14"
                >
                  {{ $t('ticketing.access_control.teams_label', volunteer.teams.length) }}
                  {{ volunteer.teams.map((t) => t.name).join(', ') }}
                </div>
              </button>
            </div>
          </div>
        </template>

        <template #footer>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{
              $t('ticketing.access_control.volunteers_count', {
                count: volunteersNotValidated.length,
              })
            }}
          </p>
        </template>
      </UModal>

      <!-- Modal liste des artistes non validés -->
      <UModal
        v-model:open="artistsNotValidatedModalOpen"
        :title="$t('ticketing.access_control.artists_not_validated_title')"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert icon="i-heroicons-information-circle" color="info" variant="soft">
              <template #description>
                {{ $t('ticketing.access_control.artists_not_validated_description') }}
              </template>
            </UAlert>

            <div v-if="loadingArtistsNotValidated" class="text-center py-8">
              <p class="text-sm text-gray-500">{{ $t('ticketing.access_control.loading') }}</p>
            </div>

            <!--
              La teinte verte porte l'information : ce vide-ci est un ABOUTISSEMENT — tout le monde
              est passé —, pas un simple « il n'y a rien ». Le neutre par défaut de `UiEtatVide`
              dirait la mauvaise chose.
            -->
            <UiEtatVide
              v-else-if="artistsNotValidated.length === 0"
              compact
              icone="i-heroicons-check-circle"
              classe-icone="text-green-400"
              :titre="$t('ticketing.access_control.all_artists_validated')"
              class="bg-gray-50 dark:bg-gray-800 rounded-lg"
            />

            <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto">
              <button
                v-for="artist in artistsNotValidated"
                :key="artist.id"
                type="button"
                class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors enabled:cursor-pointer enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700"
                :disabled="!artist.user?.email"
                :title="
                  artist.user?.email ? $t('ticketing.access_control.search_this_person') : undefined
                "
                @click="rechercherDepuisLaListe(artist.user?.email)"
              >
                <UiUserDisplayForAdmin :user="artist.user" size="md" :show-email="true" />
                <div
                  v-if="artist.shows.length > 0"
                  class="text-xs text-gray-500 dark:text-gray-500 mt-2 ml-14"
                >
                  {{ $t('ticketing.access_control.shows_label', artist.shows.length) }}
                  {{ artist.shows.map((s) => s.title).join(', ') }}
                </div>
              </button>
            </div>
          </div>
        </template>

        <template #footer>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{
              $t('ticketing.access_control.artists_count', { count: artistsNotValidated.length })
            }}
          </p>
        </template>
      </UModal>

      <!-- Modal liste des organisateurs non validés -->
      <UModal
        v-model:open="organizersNotValidatedModalOpen"
        :title="$t('ticketing.access_control.organizers_not_validated_title')"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert icon="i-heroicons-information-circle" color="info" variant="soft">
              <template #description>
                {{ $t('ticketing.access_control.organizers_not_validated_description') }}
              </template>
            </UAlert>

            <div v-if="loadingOrganizersNotValidated" class="text-center py-8">
              <p class="text-sm text-gray-500">{{ $t('ticketing.access_control.loading') }}</p>
            </div>

            <!--
              La teinte verte porte l'information : ce vide-ci est un ABOUTISSEMENT — tout le monde
              est passé —, pas un simple « il n'y a rien ». Le neutre par défaut de `UiEtatVide`
              dirait la mauvaise chose.
            -->
            <UiEtatVide
              v-else-if="organizersNotValidated.length === 0"
              compact
              icone="i-heroicons-check-circle"
              classe-icone="text-green-400"
              :titre="$t('ticketing.access_control.all_organizers_validated')"
              class="bg-gray-50 dark:bg-gray-800 rounded-lg"
            />

            <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto">
              <button
                v-for="organizer in organizersNotValidated"
                :key="organizer.id"
                type="button"
                class="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors enabled:cursor-pointer enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700"
                :disabled="!organizer.user?.email"
                :title="
                  organizer.user?.email
                    ? $t('ticketing.access_control.search_this_person')
                    : undefined
                "
                @click="rechercherDepuisLaListe(organizer.user?.email)"
              >
                <UiUserDisplayForAdmin :user="organizer.user" size="md" :show-email="true">
                  <template v-if="organizer.title" #badge>
                    <UBadge color="neutral" variant="subtle" size="xs">
                      {{ organizer.title }}
                    </UBadge>
                  </template>
                </UiUserDisplayForAdmin>
              </button>
            </div>
          </div>
        </template>

        <template #footer>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{
              $t('ticketing.access_control.organizers_count', {
                count: organizersNotValidated.length,
              })
            }}
          </p>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

import { regrouperLesSectionsParCommande } from '../../../../../utils/sections-de-la-fiche'

import type { TitreAffiche } from '../../../../../components/ticketing/ParticipantDetailsModal.vue'

import { formaterDateHeure } from '~~/shared/utils/fuseau-edition'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { avertir, erreur, notifier, succes } = useNotificateur()
const { t, locale } = useI18n()
const { getParticipantTypeConfig } = useParticipantTypes()

// Titre de l'onglet : « Contrôle d'accès - Billetterie », cohérent avec la section Billetterie.
useSeoMeta({
  title: () => `${t('gestion.ticketing.access_control_title')} - ${t('gestion.ticketing.title')}`,
})

// Récupérer les configurations de couleurs
const ticketConfig = getParticipantTypeConfig('ticket')
const volunteerConfig = getParticipantTypeConfig('volunteer')
const artistConfig = getParticipantTypeConfig('artist')
const organizerConfig = getParticipantTypeConfig('organizer')

/**
 * La pastille d'une nature de titre : son libellé et ses couleurs, celles de `useParticipantTypes`.
 *
 * ⚠️ PAS `:color="config.color"`, ET C'EST TOUT L'OBJET DE CE HELPER. `UBadge` n'accepte que les
 * sept couleurs SÉMANTIQUES de Nuxt UI — `primary`, `success`, `warning`… —, jamais un nom de
 * palette Tailwind. Or `config.color` vaut `blue`, `yellow`, `purple` : la pastille retombe alors
 * sur `primary` **sans erreur ni avertissement**, et quatre natures sortent de la même couleur.
 * C'est précisément le défaut qu'on vient corriger ; trois pastilles de la page en souffraient
 * déjà. Les classes `bgClass`/`textClass` du même objet, elles, sont du Tailwind véritable : ce
 * sont elles qui colorent déjà les icônes des en-têtes de listes — et c'est aussi la forme que
 * `meals/list.vue` a retenue, après y avoir trouvé trois natures sur quatre coloriées à la main
 * et en contradiction avec le reste du site.
 *
 * 📍 `color="neutral"` reste posé sur la pastille comme fond de teinte : les classes passées en
 * `class` l'emportent (tailwind-merge), et la pastille garde une apparence correcte si la
 * configuration d'une nature venait à manquer une classe.
 */
const pastilleDeNature = (nature: NatureDeTitre) => {
  const config = getParticipantTypeConfig(nature)
  return {
    libelle: t(config.labelKey),
    classes: [config.bgClass, config.textClass, config.darkBgClass, config.darkTextClass],
  }
}

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Vérifier les permissions de contrôle d'accès pour les bénévoles en créneau
const { canAccessAccessControl } = useAccessControlPermissions(editionId)

// Paramètres de billetterie
const { settings: ticketingSettings, fetchSettings: fetchTicketingSettings } =
  useTicketingSettings(editionId)
const { config: sumupConfig, fetchConfig: fetchSumupConfig } = useSumupConfig(editionId)

const allowOnsiteRegistration = computed(
  () => ticketingSettings.value?.allowOnsiteRegistration ?? true
)
const allowAnonymousOrders = computed(() => ticketingSettings.value?.allowAnonymousOrders ?? false)
const enabledPaymentMethods = computed(() => {
  const methods: ('cash' | 'card' | 'check')[] = []
  if (ticketingSettings.value?.paymentCash ?? true) methods.push('cash')
  if (ticketingSettings.value?.paymentCard ?? true) methods.push('card')
  if (ticketingSettings.value?.paymentCheck ?? true) methods.push('check')
  return methods
})
const sumupEnabled = computed(() => ticketingSettings.value?.sumupEnabled ?? false)
const sumupAffiliateKey = computed(() => sumupConfig.value?.affiliateKey || '')
const sumupAppId = computed(() => sumupConfig.value?.appId || '')

const scannerOpen = ref(false)
const participantModalOpen = ref(false)
const showAddParticipantModal = ref(false)
const selectedParticipant = ref<any>(null)
const participantType = ref<'ticket' | 'volunteer'>('ticket')
const isRefundedOrder = ref(false)
const historiqueOuvert = ref(false)
const searchTerm = ref('')
const searchResults = ref<any>(null)

/*
 * ─── Les PERSONNES, et leurs titres ──────────────────────────────────────────────────────────
 *
 * Une même personne peut porter un billet, une candidature de bénévole, une fiche d'artiste et une
 * place d'organisateur : quatre tables, quatre drapeaux, et jusqu'ici quatre recherches. Le point
 * d'API les rapproche ; cet écran ne fait que proposer de les valider d'un geste.
 *
 * ⚠️ LES QUATRE LISTES RESTENT, INTACTES. Ce bloc s'ajoute au-dessus d'elles et ne remplace rien :
 * c'est là qu'on lit le détail d'un billet, ses options, ses créneaux, ses articles à remettre.
 */
const personnes = ref<
  {
    cle: string
    motif: 'compte' | 'courriel-et-nom'
    libelle: string
    aValider: number
    titres: {
      nature: 'ticket' | 'volunteer' | 'artist' | 'organizer'
      id: number
      entryValidated?: boolean
    }[]
  }[]
>([])

/**
 * Celles qui valent d'être proposées : PLUSIEURS titres, et au moins un à valider.
 *
 * Une personne à titre unique est déjà parfaitement servie par les listes du dessous — la
 * proposer en double n'ajouterait qu'une façon de se tromper. Et une personne entièrement validée
 * n'a rien à valider : la montrer ferait cliquer pour rien.
 */
/**
 * Les personnes à qui proposer un geste groupé.
 *
 * La règle vit dans `regroupement-controle-acces`, où elle est éprouvée : il faut au moins DEUX
 * titres restant à valider, et non deux titres tout court.
 */
const personnesAValiderEnBloc = computed(() => personnes.value.filter(meriteUnGesteGroupe))

/** En cours de validation groupée, par clé de personne. */
const validationEnBloc = ref<string | null>(null)
const recentValidations = ref<any[]>([])
const loadingValidations = ref(false)
const stats = ref({
  validatedToday: 0,
  totalValidated: 0,
  ticketsValidated: 0,
  volunteersValidated: 0,
  artistsValidated: 0,
  // Les organisateurs manquaient à cet objet alors que la carte les attend : le point d'API les
  // renvoie, mais le premier rendu — avant la réponse — les laissait à `undefined`.
  organizersValidated: 0,
  organizersValidatedToday: 0,
  totalOrganizers: 0,
  ticketsValidatedToday: 0,
  volunteersValidatedToday: 0,
  artistsValidatedToday: 0,
  totalTickets: 0,
  // Les mêmes participants comptés par personne : la tuile bascule de l'un à l'autre au clic.
  personnesValidated: 0,
  personnesValidatedToday: 0,
  totalPersonnes: 0,
  totalVolunteers: 0,
  totalArtists: 0,
})
const hasTiers = ref(false)
const hasHelloAssoConfig = ref(false)
const volunteersNotValidatedModalOpen = ref(false)
const volunteersNotValidated = ref<any[]>([])
const artistsNotValidatedModalOpen = ref(false)
const artistsNotValidated = ref<any[]>([])
const organizersNotValidatedModalOpen = ref(false)
const organizersNotValidated = ref<any[]>([])

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch {
      // Erreur silencieuse
    }
  }

  // Charger les paramètres de billetterie
  await fetchTicketingSettings()

  // Charger la config SumUp (clé d'affiliation + app ID) si l'intégration est activée
  if (ticketingSettings.value?.sumupEnabled) {
    await fetchSumupConfig()
  }

  // Charger les statistiques et les dernières validations.
  //
  // La configuration HelloAsso n'est demandée qu'à qui gère la billetterie : elle ne sert qu'à
  // décider d'afficher le bouton de synchronisation, lui-même réservé aux gestionnaires. Un
  // bénévole en créneau la demandait pour rien et récoltait un 403 à chaque ouverture de la
  // page — invisible à l'écran, mais consigné dans les journaux d'erreur de production.
  await Promise.all([
    loadStats(),
    loadRecentValidations(),
    ...(canManageTicketing.value ? [checkHelloAssoConfig()] : []),
    checkHasTiers(),
  ])
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const canManageTicketing = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageTicketing(edition.value, authStore.user.id)
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) return true

  // Bénévoles avec créneau actif de contrôle d'accès (±15 minutes)
  if (canAccessAccessControl.value) return true

  // Tous les organisateurs de la convention (même sans droits)
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// SSE pour rafraîchissement automatique, ouvert seulement si la page est accessible.
//
// Déclaré ici, et non plus au début : le flux dépend de `canAccess`, qui n'est connu qu'une fois
// l'édition chargée et les droits résolus. Un bénévole hors de son créneau voyait autrement le
// client réessayer cinq fois un refus d'autorisation — six 403 dans les journaux par visite, pour
// une porte qu'on savait fermée.
const { lastUpdate } = useRealtimeStats(editionId, canAccess)

const startScanner = () => {
  scannerOpen.value = true
}

/**
 * Ce que dit le bandeau après un scan — écrit ICI, et non par l'API.
 *
 * Le serveur composait ses phrases en français, pluralisation comprise, et la page les affichait
 * telles quelles : traduire cet écran était donc impossible sans toucher au serveur. Il renvoie
 * désormais un type ou un motif, et les trois tables ci-dessous les nomment. Les clés y sont
 * écrites en toutes lettres : une clé construite par concaténation est invisible à l'outillage
 * i18n, qui la croirait inutilisée et finirait par la supprimer.
 */
const TITRES_DE_DECOUVERTE: Record<string, string> = {
  volunteer: 'ticketing.access_control.volunteer_found',
  artist: 'ticketing.access_control.artist_found',
  organizer: 'ticketing.access_control.organizer_found',
  ticket: 'ticketing.access_control.ticket_found',
}

const MOTIFS_DE_REFUS: Record<string, string> = {
  volunteer: 'ticketing.access_control.not_found_volunteer',
  artist: 'ticketing.access_control.not_found_artist',
  organizer: 'ticketing.access_control.not_found_organizer',
  ticket: 'ticketing.access_control.not_found_ticket',
  qr_invalide: 'ticketing.access_control.qr_invalide',
  qr_format_obsolete: 'ticketing.access_control.qr_format_obsolete',
}

const titreDeDecouverte = (type?: string) =>
  t(TITRES_DE_DECOUVERTE[type ?? 'ticket'] ?? 'ticketing.access_control.ticket_found')

const motifDeRefus = (raison?: string) =>
  raison && MOTIFS_DE_REFUS[raison]
    ? t(MOTIFS_DE_REFUS[raison] as string)
    : t('ticketing.access_control.no_ticket_found')

/** Le nom de la personne trouvée, quelle que soit la population : c'est ce qu'on lit à l'entrée. */
const nomDeLaPersonne = (participant: any): string => {
  const personne =
    participant?.volunteer?.user ??
    participant?.artist?.user ??
    participant?.organizer?.user ??
    participant?.ticket
  if (!personne) return ''
  return [personne.firstName, personne.lastName].filter(Boolean).join(' ')
}

const lotAValider = ref<{ lot: any; paymentInfo: any } | null>(null)

const { execute: executerValidationDEntree, error: erreurValidation } = useApiAction<unknown, any>(
  `/api/editions/${editionId}/ticketing/validate-entry`,
  {
    method: 'POST',
    body: () => {
      const { lot, paymentInfo } = lotAValider.value!
      return {
        participantIds: lot.ids,
        type: lot.type,
        paymentMethod: paymentInfo?.paymentMethod,
        checkNumber: paymentInfo?.checkNumber,
        userInfo: lot.userInfo,
      }
    },
    silent: true,
  }
)

const codeScanne = ref('')

/*
 * ⚠️ `silentSuccess` et deux toasts à la main, et ce n'est PAS un contournement par paresse : un
 * appel réussi peut dire « trouvé » ou « pas trouvé », et les deux cas diffèrent par l'icône et
 * la COULEUR — `success` contre `warning`. `successMessage` ne porte que titre et description ;
 * l'icône et la couleur sont fixées dans le composable. La forme fonction ne suffirait donc pas.
 *
 * Ce que la migration apporte quand même, et c'est l'essentiel du constat : le chemin d'ERREUR,
 * qui décidait seul d'afficher le message du serveur ou un texte générique.
 */
const { execute: executerVerification } = useApiAction<unknown, any>(
  `/api/editions/${editionId}/ticketing/verify`,
  {
    method: 'POST',
    body: () => ({ qrCode: codeScanne.value }),
    silentSuccess: true,
    errorMessages: { default: t('ticketing.access_control.verify_error') },
    onSuccess: (resultat) => {
      if (resultat?.found && resultat.participant) {
        // Afficher la modal avec les détails du participant
        selectedParticipant.value = resultat.participant
        participantType.value = resultat.type || 'ticket'
        isRefundedOrder.value = resultat.isRefunded || false
        participantModalOpen.value = true

        succes(titreDeDecouverte(resultat.type), {
          description: nomDeLaPersonne(resultat.participant),
        })
      } else {
        avertir(t('ticketing.access_control.no_ticket_found'), {
          description: motifDeRefus(resultat?.raison),
        })
      }
    },
  }
)

const handleScan = async (code: string) => {
  codeScanne.value = code
  await executerVerification()
}

/**
 * Ce que l'agent lit après avoir validé — et la distinction qui manquait.
 *
 * La mise à jour est atomique : deux scanners simultanés ne valident pas deux fois. Mais le
 * second recevait un succès annonçant « 0 entrée validée », sans rien pour comprendre qu'un
 * collègue l'avait devancé. Aux deux portes d'une même convention, les deux croyaient avoir
 * laissé entrer la personne. Le serveur renvoie désormais QUI a validé et QUAND ; il reste à le
 * dire autrement qu'un succès.
 */
const compteRenduDeValidation = (donnees: any, demandes: number) => {
  const validees = donnees?.validated ?? demandes
  const deja = (donnees?.alreadyValidated ?? []) as Array<{
    at?: string | null
    by?: { firstName?: string | null; lastName?: string | null } | null
  }>

  if (validees === 0 && deja.length > 0) {
    return {
      type: 'avertissement' as const,
      titre: t('ticketing.access_control.entry_already_validated_title'),
      description: deja.length === 1 ? circonstanceDe(deja[0]!) : nombreDejaValidees(deja.length),
    }
  }

  return {
    type: 'succes' as const,
    titre: t('ticketing.access_control.entry_validated_title'),
    // Le compte rendu porte ce que le SERVEUR a réellement validé, et non ce qu'on lui avait
    // demandé : une ligne déjà validée entre-temps ne l'est pas deux fois.
    description:
      t('ticketing.access_control.entry_validated_count', { count: validees }) +
      (deja.length > 0 ? ' · ' + nombreDejaValidees(deja.length) : ''),
  }
}

/** Affiche un compte rendu, en laissant `useNotificateur` décider de la couleur et de l'icône. */
const annoncerLeCompteRendu = (rendu: {
  type: 'succes' | 'avertissement'
  titre: string
  description?: string
}) => notifier(rendu.type, rendu.titre, { description: rendu.description })

const nombreDejaValidees = (nombre: number) =>
  t('ticketing.access_control.entry_already_validated_count', { count: nombre })

/** Qui a validé, et quand — à l'heure du LIEU, comme partout ailleurs sur cet écran. */
const circonstanceDe = (entree: {
  at?: string | null
  by?: { firstName?: string | null; lastName?: string | null } | null
}) => {
  const nom = [entree.by?.firstName, entree.by?.lastName].filter(Boolean).join(' ')
  const quand = entree.at ? formaterDateHeure(entree.at, edition.value?.timezone, locale.value) : ''

  if (nom && quand) {
    return t('ticketing.access_control.entry_already_validated_by', { name: nom, date: quand })
  }
  if (quand) return t('ticketing.access_control.entry_already_validated_when', { date: quand })
  return t('ticketing.access_control.entry_already_validated_unknown')
}

/**
 * Valide TOUS les titres d'une personne, d'un geste.
 *
 * ⚠️ UN APPEL PAR NATURE, et c'est délibéré pour cette première version : le point d'API n'accepte
 * qu'un `type` par requête, et l'élargir serait un lot à lui seul. Les appels sont séquentiels pour
 * que les erreurs se lisent une par une.
 *
 * 📍 EN CAS D'ÉCHEC PARTIEL, ON GARDE CE QUI EST PASSÉ. C'est le choix prudent au guichet : une
 * personne à moitié validée entre quand même, et le compte rendu dit ce qui reste. Tout annuler
 * ferait ressortir quelqu'un déjà à l'intérieur.
 *
 * ⚠️ Les articles à remettre ne demandent aucun traitement ici : valider l'entrée VAUT remise dans
 * ce dépôt, aucune trace séparée n'est tenue. Les fusionner serait donc un pur affichage, et les
 * listes du dessous les montrent déjà par titre.
 */
type TitreDuGroupe = {
  nature: 'ticket' | 'volunteer' | 'artist' | 'organizer'
  id: number
  entryValidated?: boolean
}
type GroupeAValider = { cle: string; libelle: string; titres: TitreDuGroupe[] }

/** Les titres cochés, par `nature-id` : le même identifiant peut servir à deux natures. */

/**
 * Les titres empilés dans la fiche, pour le geste groupé.
 *
 * Vide en temps normal : la fiche retombe alors sur le participant unique, et le parcours
 * individuel ne change pas d'un iota.
 */
const titresDuGroupe = ref<TitreAffiche[]>([])

/**
 * Retrouve, dans les résultats de recherche, l'entrée complète d'un titre.
 *
 * 📍 Les listes rendues par la recherche portent DÉJÀ la forme qu'attend la fiche — `{ type,
 * isRefunded, participant }`. On les réutilise telles quelles plutôt que d'en rebâtir une : une
 * seconde construction divergerait au premier champ ajouté côté serveur.
 */
/**
 * Retrouve, dans les résultats de recherche, l'entrée complète d'un titre.
 *
 * 📍 Les listes rendues par la recherche portent DÉJÀ la forme qu'attend la fiche — `{ type,
 * isRefunded, participant }`. On les réutilise telles quelles plutôt que d'en rebâtir une : une
 * seconde construction divergerait au premier champ ajouté côté serveur.
 */
function entreeDuTitre(titre: TitreDuGroupe): (TitreAffiche & { commande?: number }) | null {
  const listes: Record<string, any[]> = {
    ticket: searchResults.value?.tickets ?? [],
    volunteer: searchResults.value?.volunteers ?? [],
    artist: searchResults.value?.artists ?? [],
    organizer: searchResults.value?.organizers ?? [],
  }

  const entree = (listes[titre.nature] ?? []).find(
    (r: any) => r.participant?.[titre.nature]?.id === titre.id
  )
  if (!entree) return null

  return {
    participant: entree.participant,
    type: titre.nature,
    isRefunded: entree.isRefunded ?? false,
    preselection: titre.nature === 'ticket' ? [titre.id] : undefined,
    /*
     * ⚠️ `orderId`, SURTOUT PAS `order.id`. Ce dernier porte le numéro HelloAsso, `null` pour une
     * commande saisie sur place : le regroupement marchait alors pour les commandes en ligne et
     * jamais pour les ventes au guichet, où la commande s'affichait autant de fois qu'elle avait
     * de billets. Relevé sur l'édition 22 : une commande de cinq billets, `helloAssoOrderId` nul.
     */
    commande: titre.nature === 'ticket' ? entree.participant?.ticket?.order?.orderId : undefined,
  }
}

/**
 * Ouvre la fiche sur TOUS les titres de la personne, les uns à la suite des autres.
 *
 * ⚠️ C'EST LA FICHE COMPLÈTE, pas un résumé. Le bouton validait auparavant d'un trait, sans jamais
 * annoncer les articles à remettre ni laisser choisir — alors qu'un billet à tarif particulier et
 * une place d'organisateur donnent droit chacun aux siens.
 */
/**
 * Ouvre la fiche sur TOUS les titres de la personne, les uns à la suite des autres.
 *
 * ⚠️ UNE SECTION PAR COMMANDE, PAS PAR BILLET, et c'est la subtilité du lot. Un titre de billet
 * désigne une LIGNE de commande, alors que la section affiche la commande ENTIÈRE. Cinq billets
 * d'une même commande donnaient donc cinq sections montrant chacune les cinq — la commande répétée
 * cinq fois dans la fiche. On réunit les lignes d'une même commande en une section, dont elles
 * forment la présélection.
 *
 * 📍 Les autres natures ne se regroupent pas : une candidature de bénévole, une fiche d'artiste et
 * une place d'organisateur sont trois objets distincts, chacun sa section.
 */
/**
 * Ouvre la fiche sur TOUS les titres de la personne, les uns à la suite des autres.
 *
 * ⚠️ UNE SECTION PAR COMMANDE, PAS PAR BILLET. Un titre de billet désigne une LIGNE, alors que la
 * section affiche la commande ENTIÈRE : cinq billets d'une même commande donnaient cinq sections
 * montrant chacune les cinq. La règle vit dans `sections-de-la-fiche`, où elle est éprouvée.
 */
function ouvrirValidationGroupee(personne: GroupeAValider) {
  /*
   * ⚠️ SEULEMENT CE QUI RESTE À VALIDER. Le bouton a déjà compté — « Valider les 2 titres
   * restants » — et la fiche doit montrer ces deux-là. Un billet validé la veille qui s'y
   * ajouterait ferait douter de ce qu'on s'apprête à valider. Les titres déjà validés restent
   * visibles dans les quatre listes, juste en dessous.
   */
  const sections = regrouperLesSectionsParCommande(
    titresAValider(personne)
      .map(entreeDuTitre)
      .filter((e): e is TitreAffiche & { commande?: number } => e !== null)
  ) as TitreAffiche[]

  // Un titre introuvable dans les résultats ne doit pas ouvrir une fiche vide.
  if (sections.length === 0) return

  titresDuGroupe.value = sections
  selectedParticipant.value = null
  participantModalOpen.value = true
}

/**
 * Les articles dus au titre des titres COCHÉS.
 *
 * ⚠️ RECALCULÉS À CHAQUE DÉCOCHAGE, et c'est le point : décocher un titre doit retirer SES
 * articles de la liste. Une liste figée à l'ouverture ferait remettre les articles d'un titre
 * qu'on vient justement de ne pas valider.
 *
 * 📍 Les articles viennent des résultats de recherche, déjà en main — le serveur les a calculés
 * tarif, options et champs personnalisés compris. Rien n'est demandé à nouveau.
 */

/** Valide les seuls titres cochés, puis referme. */

/**
 * Relance la recherche en cours, pour que les listes affichées disent la vérité.
 *
 * ⚠️ POURQUOI C'EST NÉCESSAIRE. Valider ou dévalider rechargeait les statistiques et la fiche
 * OUVERTE, jamais les listes derrière elle. On fermait la modale et le billet qu'on venait de
 * valider s'y affichait encore « à valider » — ou l'inverse après une dévalidation. Un guichet qui
 * montre un état périmé fait revalider ce qui l'est déjà, ou chercher une panne qui n'existe pas.
 *
 * 📍 LA LISTE N'EST PAS VIDÉE AVANT, contrairement à `searchTickets` : on remplace l'ancienne par
 * la nouvelle quand elle arrive. La vider ferait clignoter l'écran à chaque validation, et
 * l'opérateur perdrait des yeux la ligne qu'il était en train de traiter.
 */
function rafraichirLaRecherche() {
  // Rien à rafraîchir sans recherche affichée ; et sous deux caractères, le serveur refuse — on
  // ferait une requête pour rien, dont l'échec s'afficherait en message d'erreur.
  if (!searchResults.value || !searchTerm.value || searchTerm.value.length < 2) return
  executeSearchTickets()
}

const handleValidateParticipants = async (
  lots: { type: string; ids: number[]; userInfo?: Record<string, string | null | undefined> }[],
  paymentInfo?: {
    paymentMethod?: 'cash' | 'card' | 'check' | null
    checkNumber?: string
  }
) => {
  if (lots.length === 0) return

  /*
   * ⚠️ UN APPEL PAR NATURE, et la nature vient du LOT. Elle se lisait auparavant dans
   * `participantType`, un état global : une personne qui porte un billet et une place
   * d'organisateur n'en a qu'une seule de validée, l'autre partant dans la mauvaise table — sans
   * erreur, puisque les identifiants existent des deux côtés.
   *
   * 📍 En SÉQUENCE, pas en parallèle : un échec partiel doit laisser intact ce qui est déjà passé,
   * et le compte rendu dire lequel a échoué. Les lots sont au plus quatre.
   */
  let valides = 0
  const echecs: string[] = []

  for (const lot of lots) {
    /*
     * ⚠️ `silent: true` est indispensable ici : un toast par lot en afficherait jusqu'à quatre
     * pour un seul geste, alors que le compte rendu part une fois en bas de boucle.
     *
     * Et `execute` rend `null` sur un échec SANS LEVER — c'est ce qui permet de poursuivre la
     * boucle, comme le faisait le `try/catch` par lot : « un échec partiel doit laisser intact ce
     * qui est déjà passé ».
     */
    lotAValider.value = { lot, paymentInfo }
    const resultat = await executerValidationDEntree()
    if (resultat === null) {
      echecs.push(
        `${lot.type} : ${erreurValidation.value?.data?.message ?? t('ticketing.access_control.validate_error')}`
      )
      continue
    }
    valides += lot.ids.length
    // Le compte rendu détaillé du serveur ne vaut que pour un lot unique ; au-delà, on résume.
    if (lots.length === 1) annoncerLeCompteRendu(compteRenduDeValidation(resultat, lot.ids.length))
  }

  if (lots.length > 1 || echecs.length) {
    if (echecs.length) {
      avertir(t('ticketing.access_control.group_partial'), { description: echecs.join(' · ') })
    } else {
      succes(t('ticketing.access_control.group_validated', { count: valides }))
    }
  }

  await Promise.all([loadStats(), loadRecentValidations()])
  rafraichirLaRecherche()

  /*
   * ⚠️ PAS DE RECHARGEMENT DE LA FICHE ICI, contrairement à la dévalidation juste en dessous.
   * Depuis que la validation referme la fiche — c'est son dernier geste —, recharger le
   * participant mettrait à jour un état que plus personne n'affiche. C'était une requête de plus
   * à chaque validation, au moment précis où le guichet a du monde devant lui.
   *
   * 📍 Et elle se serait trompée de cible dans le cas groupé : elle lit `participantType`, l'état
   * global qui ne désigne qu'un titre.
   */
}

const corpsDeRelecture = ref<Record<string, unknown>>({})

/*
 * ⚠️ `silent: true` reproduit DÉLIBÉRÉMENT le `catch {}` d'origine, annoté « Erreur silencieuse
 * lors du rechargement du participant ». C'est un rafraîchissement d'affichage : échouer ne doit
 * pas couvrir d'un toast le geste qui vient de réussir.
 */
const { execute: executerRelectureParticipant } = useApiAction<unknown, any>(
  `/api/editions/${editionId}/ticketing/verify`,
  { method: 'POST', body: () => corpsDeRelecture.value, silent: true }
)

const reloadParticipant = async (identifier: string | number, type: string) => {
  /*
   * ⚠️ Un bénévole est relu par SON IDENTIFIANT et non par un QR code reconstruit : la forme
   * `volunteer-{id}` permettait de fabriquer un faux QR code sans jeton — c'est cette contrefaçon
   * qui obligeait le scan à l'accepter, et donc à laisser entrer qui la tapait à la main.
   */
  corpsDeRelecture.value =
    type === 'ticket' ? { qrCode: identifier as string } : { type, id: identifier as number }

  const resultat = await executerRelectureParticipant()
  if (resultat?.found) selectedParticipant.value = resultat.participant
}

/**
 * L'argent d'une REMISE a-t-il été rendu ?
 *
 * ⚠️ UN POINT D'API DISTINCT DU REMBOURSEMENT, et ce n'est pas une préférence : le serveur refuse
 * de « rembourser » un billet vivant. Une remise porte sur un billet qui donne toujours droit
 * d'entrée, et elle ne solde pas la même somme que l'annulation — d'où deux colonnes et deux
 * routes. Les confondre rendrait deux fois le même argent, en espèces, sans rattrapage.
 */
const remiseRendue = ref(false)

const { execute: executerRemiseRendue } = useApiActionById(
  (itemId) => `/api/editions/${editionId}/ticketing/order-items/${itemId}/discount-paid-back`,
  {
    method: 'PATCH',
    body: () => ({ paidBack: remiseRendue.value }),
    // Le titre dit le SENS du geste : forme fonction, résolue à l'appel.
    successMessage: () => ({
      title: remiseRendue.value
        ? t('edition.ticketing.discount_mark_done')
        : t('edition.ticketing.discount_already_done'),
    }),
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      await Promise.all([loadStats(), loadRecentValidations()])
      // Comme les quatre autres parcours : la liste derrière porte la dette, elle se périme ici.
      rafraichirLaRecherche()
      if (selectedParticipant.value?.ticket?.qrCode) {
        await reloadParticipant(selectedParticipant.value.ticket.qrCode, 'ticket')
      }
    },
  }
)

const handleRemiseRendue = async (itemId: number, rendue: boolean) => {
  remiseRendue.value = rendue
  await executerRemiseRendue(itemId)
}

const natureAInvalider = ref<string>('')

const { execute: executerInvalidation } = useApiActionById(
  () => `/api/editions/${editionId}/ticketing/invalidate-entry`,
  {
    method: 'POST',
    body: (participantId) => ({ participantId, type: natureAInvalider.value }),
    successMessage: {
      title: t('ticketing.access_control.entry_invalidated_title'),
      description: t('ticketing.access_control.entry_invalidated_description'),
    },
    // Le message du domaine, et non « Erreur » : à la porte d'une convention, « Impossible de
    // dévalider l'entrée » dit ce qui n'a pas marché sans qu'on ait à deviner.
    errorMessages: { default: t('ticketing.access_control.invalidate_error') },
    onSuccess: async () => {
      // Recharger les statistiques et les dernières validations
      await Promise.all([loadStats(), loadRecentValidations()])

      // Et les listes de résultats, qui restaient figées sur l'état d'avant.
      rafraichirLaRecherche()

      // Recharger le participant pour afficher le nouveau statut
      if (participantType.value === 'volunteer' && selectedParticipant.value?.volunteer?.id) {
        await reloadParticipant(selectedParticipant.value.volunteer.id, 'volunteer')
      } else if (participantType.value === 'artist' && selectedParticipant.value?.artist?.id) {
        await reloadParticipant(selectedParticipant.value.artist.id, 'artist')
      } else if (
        participantType.value === 'organizer' &&
        selectedParticipant.value?.organizer?.id
      ) {
        await reloadParticipant(selectedParticipant.value.organizer.id, 'organizer')
      } else if (participantType.value === 'ticket' && selectedParticipant.value?.ticket?.qrCode) {
        await reloadParticipant(selectedParticipant.value.ticket.qrCode, 'ticket')
      }
    },
  }
)

const handleInvalidateEntry = async (type: string, participantId: number) => {
  /*
   * ⚠️ LA NATURE VIENT DE LA MODALE, plus de `participantType`. Cet état global désignait le
   * titre par lequel on était entré ; avec plusieurs titres empilés, dévalider le second
   * s'adressait à la table du premier.
   */
  natureAInvalider.value = type
  await executerInvalidation(participantId)
}

/**
 * « J'ai rendu l'argent de ce billet. »
 *
 * Le geste se fait à la porte, face à la personne : c'est pour cela que le point d'API accepte
 * aussi les bénévoles du contrôle d'accès, et non les seuls gestionnaires de la billetterie.
 *
 * L'entrée reste refusée : on solde une dette, on ne rouvre pas un droit.
 */
const remboursementDemande = ref<{ refunded: boolean; portee: 'billet' | 'commande' }>({
  refunded: false,
  portee: 'billet',
})

const { execute: executerRemboursement } = useApiActionById(
  (itemId) => `/api/editions/${editionId}/ticketing/order-items/${itemId}/refund`,
  {
    method: 'PATCH',
    body: () => remboursementDemande.value,
    // Le titre dit le SENS du geste : forme fonction, résolue à l'appel.
    successMessage: () => ({
      title: remboursementDemande.value.refunded
        ? t('ticketing.access_control.refund_recorded')
        : t('ticketing.access_control.refund_undone'),
    }),
    // « Impossible d'enregistrer le remboursement » : il s'agit d'argent rendu en espèces, et un
    // « Erreur » générique laisserait douter de ce qui a été soldé.
    errorMessages: { default: t('ticketing.access_control.refund_error') },
    onSuccess: async () => {
      // Recharger le billet pour que la fiche montre la dette soldée plutôt que la somme due.
      if (selectedParticipant.value?.ticket?.qrCode) {
        await reloadParticipant(selectedParticipant.value.ticket.qrCode, 'ticket')
      }
      // Et la liste derrière, qui porte elle aussi l'état « remboursé ».
      rafraichirLaRecherche()
    },
  }
)

const handleRefund = async (
  itemId: number,
  refunded: boolean,
  /*
   * ⚠️ La portée vaut « commande » quand toute la dette revient à la même personne : on rend
   * l'argent une fois, pas ligne par ligne. Elle retombe sur « billet » dès que les lignes dues
   * portent des noms différents — voir `nomsMultiples` dans `remboursement-du.ts`.
   */
  portee: 'billet' | 'commande' = 'billet'
) => {
  remboursementDemande.value = { refunded, portee }
  await executerRemboursement(itemId)
}

/**
 * Ouvre la fiche d'un billet par son QR code.
 *
 * Extrait de `handleOrderCreated` parce qu'un second appelant la demande : l'encart qui signale,
 * dans la modale d'ajout, qu'un billet existe déjà pour cette adresse. Recopier la séquence
 * aurait fait diverger les deux au premier champ ajouté à la fiche.
 */
/*
 * ⚠️ RESTE UN `$fetch` NU, DÉLIBÉRÉMENT. Cette fonction n'a ni `try/catch`, ni toast, ni booléen
 * de chargement : le constat d'audit — « chaque copie décide seule si elle affiche l'erreur du
 * serveur ou un texte générique » — ne la concerne pas. Son contrat est de LEVER, parce que c'est
 * son appelant (`handleOrderCreated`) qui tient le `try/catch` et le message. La passer à
 * `useApiAction`, qui ne lève pas, ferait disparaître ce message sans que rien ne le signale.
 */
const ouvrirFicheDuBillet = async (qrCode: string): Promise<boolean> => {
  const result: any = await $fetch(`/api/editions/${editionId}/ticketing/verify`, {
    method: 'POST',
    body: { qrCode },
  })

  if (!result.data.found || !result.data.participant) return false

  selectedParticipant.value = result.data.participant
  participantType.value = 'ticket'
  participantModalOpen.value = true
  return true
}

const handleOrderCreated = async (qrCode: string) => {
  try {
    if (await ouvrirFicheDuBillet(qrCode)) {
      succes(t('ticketing.access_control.order_created_title'), {
        description: t('ticketing.access_control.order_created_description'),
      })

      // Recharger les statistiques et les dernières validations
      await Promise.all([loadStats(), loadRecentValidations()])
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    erreur(t('ticketing.access_control.error_title'), {
      description: err.data?.message || t('ticketing.access_control.load_order_error'),
    })
  }
}

/**
 * Ouvrir la fiche d'un billet DÉJÀ EXISTANT, signalé depuis la modale d'ajout.
 *
 * ⚠️ Volontairement distinct de `handleOrderCreated` : celui-ci annonce « commande créée » et
 * recharge les statistiques. Ici rien n'a été créé — réutiliser le même gestionnaire afficherait
 * une confirmation de création pour un billet qui existait déjà, et le caissier croirait avoir
 * fait un doublon.
 */
const ouvrirBilletExistant = async (qrCode: string) => {
  try {
    await ouvrirFicheDuBillet(qrCode)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    erreur(t('ticketing.access_control.error_title'), {
      description: err.data?.message || t('ticketing.access_control.load_order_error'),
    })
  }
}

const { execute: executeSearchTickets, loading: searching } = useApiAction(
  `/api/editions/${editionId}/ticketing/search`,
  {
    method: 'POST',
    body: () => ({ searchTerm: searchTerm.value }),
    errorMessages: { default: t('ticketing.access_control.search_error') },
    onSuccess: (response: any) => {
      searchResults.value = response?.results || null
      // Rendu EN PLUS des quatre listes, jamais à leur place.
      personnes.value = response?.personnes || []
    },
  }
)

const searchTickets = () => {
  if (!searchTerm.value || searchTerm.value.length < 2 || searching.value) return
  searchResults.value = null
  executeSearchTickets()
}

/**
 * Depuis une liste de « non validés », aller droit à la fiche de la personne.
 *
 * ⚠️ POURQUOI PAR L'ADRESSE E-MAIL. C'est la seule donnée que ces trois listes partagent avec la
 * recherche du guichet, et la seule qui identifie quelqu'un sans ambiguïté : deux bénévoles peuvent
 * porter le même nom, et le pseudo n'est pas cherché par ce point d'API.
 *
 * 📍 On ferme les trois modales, pas seulement celle d'où l'on vient : une seule est ouverte à la
 * fois, mais les fermer toutes évite qu'un ajout de liste demain laisse un panneau derrière lui.
 *
 * Sans adresse, le bouton est désactivé — plutôt qu'un clic qui lance une recherche vide et rend
 * un écran sans résultat, qu'on prendrait pour une panne.
 */
const zoneDeRecherche = ref<HTMLElement | null>(null)

const rechercherDepuisLaListe = (email: string | null | undefined) => {
  if (!email) return

  volunteersNotValidatedModalOpen.value = false
  artistsNotValidatedModalOpen.value = false
  organizersNotValidatedModalOpen.value = false

  searchTerm.value = email
  searchTickets()

  /*
   * ⚠️ RAMENER LE LECTEUR À LA RECHERCHE. Elle se tient tout en HAUT de la page, alors que les
   * cartes de statistiques — d'où l'on vient — sont plus bas : fermer la modale laisserait les
   * résultats hors de l'écran, et le clic passerait pour sans effet.
   *
   * `nextTick` parce que le panneau doit être refermé avant qu'on mesure où défiler.
   */
  nextTick(() => {
    zoneDeRecherche.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

const selectSearchResult = (result: any) => {
  // ⚠️ VIDER LA PILE D'ABORD : sans cela, cliquer un résultat après un geste groupé rouvrirait la
  // fiche sur le groupe précédent, puisque `titres` l'emporte sur `participant`.
  titresDuGroupe.value = []

  // Afficher la modal avec les détails du participant
  selectedParticipant.value = result.participant
  participantType.value = result.type || 'ticket'
  isRefundedOrder.value = result.isRefunded || false
  participantModalOpen.value = true

  // Ne plus réinitialiser la recherche pour conserver le terme et les résultats
  // L'utilisateur peut ainsi revenir aux résultats après avoir fermé la modal
}

const loadStats = async () => {
  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/stats`)
    stats.value = result.data.stats
  } catch {
    // Erreur silencieuse lors du chargement des stats
  }
}

const loadRecentValidations = async () => {
  loadingValidations.value = true

  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/recent-validations`)
    recentValidations.value = result.data.validations
  } catch {
    // Erreur silencieuse lors du chargement des validations récentes
  } finally {
    loadingValidations.value = false
  }
}

/**
 * Le fil des derniers mouvements, désormais lu dans le journal.
 *
 * Il affichait l'ÉTAT courant des quatre tables : une entrée validée puis annulée en disparaissait
 * complètement, et une annulation n'y figurait jamais. Ce sont ces deux cas que ces deux fonctions
 * rendent visibles — le reste du bloc n'a pas changé.
 */
const LIBELLES_DE_POPULATION: Record<string, string> = {
  ticket: 'common.participant',
  volunteer: 'common.volunteer',
  artist: 'common.artist',
  organizer: 'common.organizer',
}

/**
 * Ce qui est écrit sous le nom : le libellé propre à la ligne quand il en existe un — le nom du
 * billet, le titre de l'organisateur — sinon la population, nommée ICI.
 *
 * Le serveur composait « Bénévole », « Artiste » et « Organisateur » en français. Il rend
 * désormais `null`, et la langue redevient celle du lecteur (constat B4).
 */
const libelleDuMouvement = (mouvement: { name?: string | null; type?: string }) =>
  mouvement.name || t(LIBELLES_DE_POPULATION[mouvement.type ?? 'ticket'] ?? 'common.participant')

/**
 * Une annulation ne doit pas se lire comme une validation.
 *
 * Elle perd la couleur de sa population pour un fond neutre : à la porte, le fil se parcourt du
 * coin de l'œil, et une ligne rouge parmi des vertes se repère avant d'être lue.
 */
const fondDuMouvement = (mouvement: { movement?: string; type?: string }) => {
  if (mouvement.movement === 'INVALIDATED') return 'bg-gray-100 dark:bg-gray-800'

  const config =
    mouvement.type === 'volunteer'
      ? volunteerConfig
      : mouvement.type === 'artist'
        ? artistConfig
        : mouvement.type === 'organizer'
          ? organizerConfig
          : ticketConfig
  return `${config.bgClass} ${config.darkBgClass}`
}

const formatValidationTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Il y a ${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `Il y a ${diffDays}j`
}

// Vérifier si HelloAsso est configuré
const checkHelloAssoConfig = async () => {
  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/external`)
    hasHelloAssoConfig.value =
      result?.data?.hasConfig && result?.data?.config?.provider?.toUpperCase() === 'HELLOASSO'
  } catch {
    // Pas de configuration HelloAsso
    hasHelloAssoConfig.value = false
  }
}

// Vérifier s'il y a des tarifs configurés
const checkHasTiers = async () => {
  try {
    const result: any = await $fetch(`/api/editions/${editionId}/ticketing/tiers`)
    const tiers = result?.data?.tiers || result?.data || result || []
    hasTiers.value = Array.isArray(tiers) && tiers.length > 0
  } catch {
    hasTiers.value = false
  }
}

// Synchroniser les participants depuis HelloAsso
const { execute: syncHelloAsso, loading: syncingHelloAsso } = useApiAction<
  undefined,
  { success: boolean; stats?: { totalItems?: number } }
>(`/api/editions/${editionId}/ticketing/helloasso/orders`, {
  method: 'GET',
  silentSuccess: true,
  errorMessages: {
    default: t('ticketing.access_control.sync_helloasso_error'),
  },
  onSuccess: async (result) => {
    if (result.success) {
      const totalParticipants = result.stats?.totalItems || 0
      succes(t('ticketing.access_control.sync_helloasso_success_title'), {
        description: t('ticketing.access_control.sync_helloasso_success_count', {
          count: totalParticipants,
        }),
      })
      await Promise.all([loadStats(), loadRecentValidations()])
    }
  },
})

// Charger les bénévoles non validés
const { execute: loadVolunteersNotValidated, loading: loadingVolunteersNotValidated } =
  useApiAction(`/api/editions/${editionId}/ticketing/volunteers-not-validated`, {
    method: 'GET',
    errorMessages: { default: t('ticketing.access_control.load_volunteers_error') },
    onSuccess: (response: any) => {
      volunteersNotValidated.value = response?.volunteers || []
    },
  })

// Afficher la modal des bénévoles non validés
const showVolunteersNotValidatedModal = async () => {
  volunteersNotValidatedModalOpen.value = true
  // Charger les données à chaque fois que la modal s'ouvre
  await loadVolunteersNotValidated()
}

// Charger les artistes non validés
const { execute: loadArtistsNotValidated, loading: loadingArtistsNotValidated } = useApiAction(
  `/api/editions/${editionId}/ticketing/artists-not-validated`,
  {
    method: 'GET',
    errorMessages: { default: t('ticketing.access_control.load_artists_error') },
    onSuccess: (response: any) => {
      artistsNotValidated.value = response?.artists || []
    },
  }
)

// Afficher la modal des artistes non validés
const showArtistsNotValidatedModal = async () => {
  artistsNotValidatedModalOpen.value = true
  // Charger les données à chaque fois que la modal s'ouvre
  await loadArtistsNotValidated()
}

// Charger les organisateurs non validés
const { execute: loadOrganizersNotValidated, loading: loadingOrganizersNotValidated } =
  useApiAction(`/api/editions/${editionId}/ticketing/organizers-not-validated`, {
    method: 'GET',
    errorMessages: { default: t('ticketing.access_control.load_organizers_error') },
    onSuccess: (response: any) => {
      organizersNotValidated.value = response?.organizers || []
    },
  })

// Afficher la modal des organisateurs non validés
const showOrganizersNotValidatedModal = async () => {
  organizersNotValidatedModalOpen.value = true
  // Charger les données à chaque fois que la modal s'ouvre
  await loadOrganizersNotValidated()
}

// Rafraîchir automatiquement quand une mise à jour SSE arrive
watch(lastUpdate, () => {
  if (lastUpdate.value) {
    // Rafraîchir les stats et les validations récentes
    Promise.all([loadStats(), loadRecentValidations()])

    // Recharger la liste des bénévoles non validés si la modal est ouverte
    if (volunteersNotValidatedModalOpen.value) {
      loadVolunteersNotValidated()
    }

    // Recharger la liste des artistes non validés si la modal est ouverte
    if (artistsNotValidatedModalOpen.value) {
      loadArtistsNotValidated()
    }

    // Recharger la liste des organisateurs non validés si la modal est ouverte
    if (organizersNotValidatedModalOpen.value) {
      loadOrganizersNotValidated()
    }
  }
})
</script>
