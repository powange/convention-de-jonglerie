<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('edition.ticketing.participant_modal_title')"
    :description="$t('edition.ticketing.participant_modal_description')"
    :ui="{ width: 'sm:max-w-2xl' }"
  >
    <template #body>
      <!-- Affichage pour un billet -->
      <div v-if="isTicket && participant && 'ticket' in participant" class="space-y-6">
        <!-- Alerte pour les commandes annulées -->
        <UAlert
          v-if="isRefunded"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          title="Commande annulée"
          description="Cette commande a été annulée. Les billets ne peuvent pas être validés."
        />

        <!-- Type d'accès -->
        <div
          :class="`flex items-center justify-between p-4 rounded-lg ${ticketConfig.bgClass} ${ticketConfig.darkBgClass}`"
        >
          <div class="flex items-center gap-3">
            <UIcon :name="ticketConfig.icon" :class="ticketConfig.iconColorClass" size="32" />
            <div>
              <p :class="`text-sm ${ticketConfig.textClass} ${ticketConfig.darkTextClass}`">
                {{ $t('edition.ticketing.access_type') }}
              </p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('ticketing.stats.participants') }}
              </p>
            </div>
          </div>
          <UBadge :color="ticketConfig.color" variant="soft" size="lg">
            {{ $t('edition.ticketing.participant') }}
          </UBadge>
        </div>

        <!-- Informations de la commande -->
        <div class="space-y-4">
          <div
            class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-shopping-cart"
                class="text-purple-600 dark:text-purple-400"
              />
              <h4 class="font-semibold text-gray-900 dark:text-white">
                {{ $t('edition.ticketing.order') }}
              </h4>
            </div>
            <!-- Logo HelloAsso si c'est une commande HelloAsso -->
            <img
              v-if="participant.ticket.order.id"
              src="~/assets/img/helloasso/logo.svg"
              :alt="$t('ticketing.participant.logo_alt')"
              class="h-5"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('edition.ticketing.buyer') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.ticket.order.payer.firstName }}
                {{ participant.ticket.order.payer.lastName }}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('edition.ticketing.buyer_email') }}
              </p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ participant.ticket.order.payer.email }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-if="participant.ticket.order.id">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {{ $t('edition.ticketing.order_id') }}
              </p>
              <p class="text-sm font-mono font-medium text-gray-900 dark:text-white">
                #{{ participant.ticket.order.id }}
              </p>
            </div>
            <div v-if="participant.ticket.order.status">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Statut de la commande</p>
              <UBadge
                :color="
                  participant.ticket.order.status === 'Processed'
                    ? 'success'
                    : participant.ticket.order.status === 'Pending'
                      ? 'warning'
                      : participant.ticket.order.status === 'Onsite'
                        ? 'info'
                        : participant.ticket.order.status === 'Refunded' ||
                            participant.ticket.order.status === 'Canceled'
                          ? 'error'
                          : 'neutral'
                "
                :size="participant.ticket.order.status === 'Canceled' ? 'lg' : undefined"
                variant="soft"
              >
                {{
                  participant.ticket.order.status === 'Processed'
                    ? 'Payée'
                    : participant.ticket.order.status === 'Pending'
                      ? 'En attente de paiement'
                      : participant.ticket.order.status === 'Onsite'
                        ? 'Sur place'
                        : participant.ticket.order.status === 'Refunded'
                          ? 'Annulée'
                          : participant.ticket.order.status === 'Canceled'
                            ? 'Annulée'
                            : participant.ticket.order.status
                }}
              </UBadge>
            </div>
          </div>
        </div>

        <!-- Informations des participants -->
        <div v-if="participantItems && participantItems.length > 0" class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-user" class="text-primary-600 dark:text-primary-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{
                participantItems.length > 1 ? 'Participants' : $t('edition.ticketing.participant')
              }}
            </h4>
          </div>

          <div class="space-y-3">
            <div
              v-for="item in participantItems"
              :key="item.id"
              class="p-3 rounded-lg relative"
              :class="
                item.entryValidated
                  ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 opacity-75'
                  : 'bg-gray-50 dark:bg-gray-900'
              "
            >
              <!-- Badge "Déjà validé" en haut à droite -->
              <div
                v-if="item.entryValidated"
                class="absolute top-2 right-2 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
              >
                <UIcon name="i-heroicons-check-circle-solid" class="h-4 w-4" />
                Déjà validé
              </div>

              <div class="flex items-start gap-3">
                <input
                  v-if="!item.entryValidated && !isRefunded"
                  :id="`participant-${item.id}`"
                  v-model="selectedParticipants"
                  type="checkbox"
                  :value="item.id"
                  class="mt-1.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div
                  v-else
                  class="mt-1.5 h-4 w-4 rounded flex items-center justify-center"
                  :class="
                    item.entryValidated
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  "
                >
                  <UIcon
                    v-if="item.entryValidated"
                    name="i-heroicons-check"
                    class="h-3 w-3 text-green-600 dark:text-green-400"
                  />
                  <UIcon
                    v-else-if="isRefunded"
                    name="i-heroicons-x-mark"
                    class="h-3 w-3 text-red-600 dark:text-red-400"
                  />
                </div>

                <div class="flex-1">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('edition.ticketing.full_name') }}
                      </p>
                      <p
                        class="text-sm font-medium"
                        :class="
                          item.entryValidated
                            ? 'text-gray-600 dark:text-gray-400'
                            : 'text-gray-900 dark:text-white'
                        "
                      >
                        {{ item.firstName || '-' }} {{ item.lastName || '-' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('edition.ticketing.email') }}
                      </p>
                      <p
                        class="text-sm font-medium"
                        :class="
                          item.entryValidated
                            ? 'text-gray-600 dark:text-gray-400'
                            : 'text-gray-900 dark:text-white'
                        "
                      >
                        {{ item.email || '-' }}
                      </p>
                    </div>
                  </div>
                  <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {{ $t('ticketing.participant.ticket_type') }}
                        </p>
                        <p
                          class="text-sm font-medium"
                          :class="
                            item.entryValidated
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-gray-900 dark:text-white'
                          "
                        >
                          {{ item.name }}
                        </p>
                      </div>
                      <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {{ $t('edition.ticketing.amount') }}
                        </p>
                        <p
                          class="text-sm font-medium"
                          :class="
                            item.entryValidated
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-primary-600 dark:text-primary-400'
                          "
                        >
                          {{ (getItemTotalAmount(item) / 100).toFixed(2) }} €
                          <span
                            v-if="item.selectedOptions && item.selectedOptions.length > 0"
                            class="text-xs opacity-75"
                          >
                            ({{ (item.amount / 100).toFixed(2) }} € + options)
                          </span>
                        </p>
                      </div>
                      <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Statut du billet
                        </p>
                        <UBadge
                          :color="
                            item.state === 'Processed'
                              ? 'success'
                              : item.state === 'Pending'
                                ? 'warning'
                                : item.state === 'Refunded' || item.state === 'Canceled'
                                  ? 'error'
                                  : 'neutral'
                          "
                          variant="soft"
                          size="lg"
                        >
                          {{
                            item.state === 'Processed'
                              ? 'Valide'
                              : item.state === 'Pending'
                                ? 'En attente'
                                : item.state === 'Refunded'
                                  ? 'Remboursé'
                                  : item.state === 'Canceled'
                                    ? 'Annulé'
                                    : item.state
                          }}
                        </UBadge>
                      </div>
                    </div>
                  </div>

                  <!-- Champs personnalisés du tarif -->
                  <div
                    v-if="item.customFields && item.customFields.length > 0"
                    class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                  >
                    <p
                      class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide"
                    >
                      Informations complémentaires
                    </p>
                    <div class="space-y-2">
                      <div
                        v-for="(field, idx) in item.customFields"
                        :key="idx"
                        class="p-2 rounded bg-gray-50 dark:bg-gray-800/50"
                      >
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                          {{ field.name }}
                        </p>
                        <p
                          class="text-sm font-medium"
                          :class="
                            item.entryValidated
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-gray-900 dark:text-white'
                          "
                        >
                          {{ field.answer }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Options sélectionnées -->
                  <div
                    v-if="item.selectedOptions && item.selectedOptions.length > 0"
                    class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                  >
                    <p
                      class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide"
                    >
                      Options
                    </p>
                    <div class="flex flex-wrap gap-2">
                      <UBadge
                        v-for="selectedOption in item.selectedOptions"
                        :key="selectedOption.id"
                        color="primary"
                        variant="soft"
                        size="sm"
                      >
                        {{ selectedOption.option.name }}
                        <span v-if="selectedOption.option.price" class="ml-1 opacity-75">
                          (+{{ (selectedOption.option.price / 100).toFixed(2) }} €)
                        </span>
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bouton dévalider en bas de la carte -->
              <div
                v-if="item.entryValidated"
                class="mt-3 pt-3 border-t border-green-200 dark:border-green-800 flex justify-end"
              >
                <UButton
                  color="error"
                  variant="soft"
                  size="xs"
                  icon="i-heroicons-x-circle"
                  @click="invalidateTicket(item.id)"
                >
                  Dévalider l'entrée
                </UButton>
              </div>
            </div>
          </div>

          <!-- Bouton pour tout sélectionner/désélectionner -->
          <div class="flex justify-end">
            <UButton
              v-if="
                selectedParticipants.length <
                participantItems.filter((item) => !item.entryValidated).length
              "
              variant="ghost"
              size="sm"
              @click="selectAllParticipants"
            >
              Tout sélectionner
            </UButton>
            <UButton v-else variant="ghost" size="sm" @click="selectedParticipants = []">
              Tout désélectionner
            </UButton>
          </div>
        </div>

        <!-- Section Donations -->
        <div v-if="donationItems && donationItems.length > 0" class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-heart" class="text-pink-600 dark:text-pink-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ donationItems.length > 1 ? 'Donations' : 'Donation' }}
            </h4>
          </div>

          <div class="space-y-3">
            <div
              v-for="item in donationItems"
              :key="item.id"
              class="p-3 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800"
            >
              <div class="flex-1">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ $t('edition.ticketing.full_name') }}
                    </p>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.firstName || '-' }} {{ item.lastName || '-' }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ $t('edition.ticketing.email') }}
                    </p>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.email || '-' }}
                    </p>
                  </div>
                </div>
                <div class="mt-2 pt-2 border-t border-pink-200 dark:border-pink-700">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('ticketing.participant.type') }}
                      </p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ item.name || item.type }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('edition.ticketing.amount') }}
                      </p>
                      <p class="text-sm font-medium text-pink-600 dark:text-pink-400">
                        {{ (item.amount / 100).toFixed(2) }} €
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Adhésions -->
        <div v-if="membershipItems && membershipItems.length > 0" class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-identification" class="text-blue-600 dark:text-blue-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ membershipItems.length > 1 ? 'Adhésions' : 'Adhésion' }}
            </h4>
          </div>

          <div class="space-y-3">
            <div
              v-for="item in membershipItems"
              :key="item.id"
              class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            >
              <div class="flex-1">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ $t('edition.ticketing.full_name') }}
                    </p>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.firstName || '-' }} {{ item.lastName || '-' }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ $t('edition.ticketing.email') }}
                    </p>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.email || '-' }}
                    </p>
                  </div>
                </div>
                <div class="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('ticketing.participant.type') }}
                      </p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ item.name || item.type }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('edition.ticketing.amount') }}
                      </p>
                      <p class="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {{ (item.amount / 100).toFixed(2) }} €
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Paiements -->
        <div v-if="paymentItems && paymentItems.length > 0" class="space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon name="i-heroicons-credit-card" class="text-purple-600 dark:text-purple-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ paymentItems.length > 1 ? 'Paiements' : 'Paiement' }}
            </h4>
          </div>

          <div class="space-y-3">
            <div
              v-for="item in paymentItems"
              :key="item.id"
              class="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
            >
              <div class="flex-1">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ $t('edition.ticketing.full_name') }}
                    </p>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.firstName || '-' }} {{ item.lastName || '-' }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ $t('edition.ticketing.email') }}
                    </p>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.email || '-' }}
                    </p>
                  </div>
                </div>
                <div class="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('ticketing.participant.type') }}
                      </p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ item.name || item.type }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {{ $t('edition.ticketing.amount') }}
                      </p>
                      <p class="text-sm font-medium text-purple-600 dark:text-purple-400">
                        {{ (item.amount / 100).toFixed(2) }} €
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Affichage pour un bénévole -->
      <VolunteerDetailsCard
        v-else-if="isVolunteer && participant && 'volunteer' in participant"
        :volunteer="participant.volunteer"
        :editable-first-name="editableFirstName"
        :editable-last-name="editableLastName"
        :editable-email="editableEmail"
        :editable-phone="editablePhone"
        :validating="validating"
        @update:first-name="editableFirstName = $event"
        @update:last-name="editableLastName = $event"
        @update:email="editableEmail = $event"
        @update:phone="editablePhone = $event"
        @validate="showValidateConfirm"
        @invalidate="showInvalidateConfirm"
      />

      <!-- Affichage pour un artiste -->
      <ArtistDetailsCard
        v-else-if="isArtist && participant && 'artist' in participant"
        :artist="participant.artist"
        :editable-first-name="editableFirstName"
        :editable-last-name="editableLastName"
        :editable-email="editableEmail"
        :editable-phone="editablePhone"
        :validating="validating"
        @update:first-name="editableFirstName = $event"
        @update:last-name="editableLastName = $event"
        @update:email="editableEmail = $event"
        @update:phone="editablePhone = $event"
        @validate="showValidateConfirm"
        @invalidate="showInvalidateConfirm"
      />

      <!-- Affichage pour un organisateur -->
      <OrganizerDetailsCard
        v-else-if="isOrganizer && participant && 'organizer' in participant"
        :organizer="participant.organizer"
        :editable-first-name="editableFirstName"
        :editable-last-name="editableLastName"
        :editable-email="editableEmail"
        :editable-phone="editablePhone"
        :validating="validating"
        @update:first-name="editableFirstName = $event"
        @update:last-name="editableLastName = $event"
        @update:email="editableEmail = $event"
        @update:phone="editablePhone = $event"
        @validate="showValidateConfirm"
        @invalidate="showInvalidateConfirm"
      />

      <!-- Message si aucun participant -->
      <div v-else class="py-8 text-center">
        <UIcon name="i-heroicons-user-circle" class="mx-auto h-16 w-16 text-gray-400 mb-3" />
        <p class="text-gray-500">{{ $t('edition.ticketing.no_info_available') }}</p>
      </div>
    </template>

    <template v-if="isTicket && selectedParticipants.length > 0" #footer>
      <div class="flex justify-end items-center gap-2 w-full">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ selectedParticipants.length }} participant{{
            selectedParticipants.length > 1 ? 's' : ''
          }}
          sélectionné{{ selectedParticipants.length > 1 ? 's' : '' }}
        </div>
        <UButton
          v-if="!isRefunded"
          color="success"
          icon="i-heroicons-check-circle"
          :loading="validating"
          @click="showValidateTicketsConfirm"
        >
          Valider l'entrée ({{ selectedParticipants.length }})
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Modal de confirmation de validation -->
  <UiConfirmModal
    v-model="showValidateModal"
    :title="
      isTicket && selectedParticipants.length > 1 ? 'Valider les entrées' : 'Valider l\'entrée'
    "
    :description="
      isTicket && selectedParticipants.length > 1
        ? `Êtes-vous sûr de vouloir valider l'entrée de ces ${selectedParticipants.length} participants ?`
        : 'Êtes-vous sûr de vouloir valider l\'entrée de ce participant ?'
    "
    confirm-label="Valider"
    confirm-color="success"
    confirm-icon="i-heroicons-check-circle"
    icon-name="i-heroicons-information-circle"
    icon-color="text-blue-500"
    :loading="validating"
    :checklist-items="returnableItemsToDistribute"
    checklist-title="Articles à remettre au participant"
    checklist-icon="i-heroicons-gift"
    checklist-icon-color="text-orange-600 dark:text-orange-400"
    checklist-warning="Vous devez cocher tous les articles avant de pouvoir valider l'entrée"
    @confirm="confirmValidateEntry"
    @cancel="showValidateModal = false"
  />

  <!-- Modal de confirmation de dévalidation -->
  <UiConfirmModal
    v-model="showInvalidateModal"
    title="Dévalider l'entrée"
    description="Êtes-vous sûr de vouloir dévalider l'entrée de ce participant ? Cette action annulera la validation."
    confirm-label="Dévalider"
    confirm-color="error"
    confirm-icon="i-heroicons-x-circle"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="validating"
    @confirm="invalidateEntry"
    @cancel="showInvalidateModal = false"
  />

  <!-- Modal de confirmation de paiement -->
  <UModal v-model:open="showPaymentConfirmModal" title="Confirmer le paiement">
    <template #body>
      <div class="space-y-4">
        <UAlert
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="soft"
          title="Paiement en attente"
          description="Cette commande n'a pas encore été marquée comme payée. Sélectionnez le mode de paiement avant de valider l'entrée."
        />

        <!-- Montant à payer -->
        <div
          class="p-4 rounded-lg bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-800"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-banknotes"
                class="text-primary-600 dark:text-primary-400 h-5 w-5"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Montant à payer
              </span>
            </div>
            <span class="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {{ (amountToPay / 100).toFixed(2) }} €
            </span>
          </div>
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-400 text-center">
          Sélectionnez le mode de paiement
        </p>

        <div class="grid grid-cols-2 gap-3">
          <!-- Paiement liquide -->
          <div
            class="p-4 rounded-lg border-2 cursor-pointer transition-all"
            :class="
              paymentMethod === 'cash'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
            "
            @click="
              paymentMethod = 'cash'
              checkNumber = ''
            "
          >
            <div class="flex items-center gap-3">
              <UIcon
                :name="paymentMethod === 'cash' ? 'i-heroicons-check-circle' : 'i-heroicons-circle'"
                :class="
                  paymentMethod === 'cash'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-600'
                "
                class="h-6 w-6"
              />
              <div class="flex-1">
                <p class="font-medium text-gray-900 dark:text-white">Liquide</p>
                <p class="text-xs text-gray-600 dark:text-gray-400">
                  {{ (amountToPay / 100).toFixed(2) }} €
                </p>
              </div>
            </div>
          </div>

          <!-- Paiement carte bancaire -->
          <div
            class="p-4 rounded-lg border-2 cursor-pointer transition-all"
            :class="
              paymentMethod === 'card'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
            "
            @click="
              paymentMethod = 'card'
              checkNumber = ''
            "
          >
            <div class="flex items-center gap-3">
              <UIcon
                :name="paymentMethod === 'card' ? 'i-heroicons-check-circle' : 'i-heroicons-circle'"
                :class="
                  paymentMethod === 'card'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-600'
                "
                class="h-6 w-6"
              />
              <div class="flex-1">
                <p class="font-medium text-gray-900 dark:text-white">Carte bancaire</p>
                <p class="text-xs text-gray-600 dark:text-gray-400">
                  {{ (amountToPay / 100).toFixed(2) }} €
                </p>
              </div>
            </div>
          </div>

          <!-- Paiement chèque -->
          <div
            class="p-4 rounded-lg border-2 cursor-pointer transition-all"
            :class="
              paymentMethod === 'check'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
            "
            @click="paymentMethod = 'check'"
          >
            <div class="flex items-center gap-3">
              <UIcon
                :name="
                  paymentMethod === 'check' ? 'i-heroicons-check-circle' : 'i-heroicons-circle'
                "
                :class="
                  paymentMethod === 'check'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-400 dark:text-gray-600'
                "
                class="h-6 w-6"
              />
              <div class="flex-1">
                <p class="font-medium text-gray-900 dark:text-white">Chèque</p>
                <p class="text-xs text-gray-600 dark:text-gray-400">
                  {{ (amountToPay / 100).toFixed(2) }} €
                </p>
              </div>
            </div>
          </div>

          <!-- Paiement non reçu -->
          <div
            class="p-4 rounded-lg border-2 cursor-pointer transition-all"
            :class="
              paymentMethod === null
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
            "
            @click="
              paymentMethod = null
              checkNumber = ''
            "
          >
            <div class="flex items-center gap-3">
              <UIcon
                :name="paymentMethod === null ? 'i-heroicons-check-circle' : 'i-heroicons-circle'"
                :class="
                  paymentMethod === null
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-400 dark:text-gray-600'
                "
                class="h-6 w-6"
              />
              <div class="flex-1">
                <p class="font-medium text-gray-900 dark:text-white">Non payé</p>
                <p class="text-xs text-gray-600 dark:text-gray-400">En attente</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Champ pour le numéro de chèque -->
        <div v-if="paymentMethod === 'check'" class="mt-4">
          <UFormField label="Numéro du chèque" required>
            <UInput v-model="checkNumber" placeholder="Ex: 1234567" class="w-full" />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton color="neutral" variant="soft" @click="showPaymentConfirmModal = false">
          Annuler
        </UButton>
        <UButton
          color="primary"
          icon="i-heroicons-check"
          :disabled="paymentMethod === 'check' && !checkNumber.trim()"
          @click="confirmPaymentAndContinue"
        >
          Continuer
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ArtistDetailsCard from './ArtistDetailsCard.vue'
import OrganizerDetailsCard from './OrganizerDetailsCard.vue'
import VolunteerDetailsCard from './VolunteerDetailsCard.vue'

const { getParticipantTypeConfig } = useParticipantTypes()
const ticketConfig = getParticipantTypeConfig('ticket')

interface TicketData {
  ticket: {
    id: number
    name: string
    amount: number
    state: string
    qrCode?: string
    user: {
      firstName: string
      lastName: string
      email: string
    }
    order: {
      id: number
      status?: string
      payer: {
        firstName: string
        lastName: string
        email: string
      }
      items?: Array<{
        id: number
        name: string
        type?: string
        amount: number
        state: string
        qrCode?: string
        firstName?: string
        lastName?: string
        email?: string
        entryValidated?: boolean
        entryValidatedAt?: string | Date
        customFields?: Array<{
          name: string
          answer: string
        }>
        tier?: {
          id: number
          name: string
          returnableItems?: Array<{
            returnableItem: {
              id: number
              name: string
            }
            source?: 'tier' | 'customField'
            customFieldName?: string
          }>
        }
        selectedOptions?: Array<{
          id: number
          amount: number
          option: {
            id: number
            name: string
            type: string
            price: number | null
            returnableItems?: Array<{
              id: number
              name: string
            }>
          }
        }>
      }>
    }
    customFields?: Array<{
      name: string
      answer: string
    }>
  }
}

interface VolunteerData {
  volunteer: {
    id: number
    user: {
      firstName: string
      lastName: string
      email: string
      phone?: string | null
    }
    teams: Array<{
      id: number
      name: string
      isLeader: boolean
    }>
    timeSlots?: Array<{
      id: number
      title: string
      team?: string
      startDateTime: Date | string
      endDateTime: Date | string
    }>
    returnableItems?: Array<{
      id: number
      name: string
    }>
    meals?: Array<{
      id: number
      date: Date | string
      mealType: string
      phase: string
    }>
    entryValidated?: boolean
    entryValidatedAt?: Date | string
    entryValidatedBy?: {
      firstName: string
      lastName: string
    }
  }
}

interface ArtistData {
  artist: {
    id: number
    user: {
      firstName: string
      lastName: string
      email: string
      phone?: string | null
    }
    shows: Array<{
      id: number
      title: string
      startDateTime: Date | string
      location?: string
    }>
    returnableItems?: Array<{
      id: number
      name: string
    }>
    meals?: Array<{
      id: number
      date: Date | string
      mealType: string
      phase: string
    }>
    entryValidated?: boolean
    entryValidatedAt?: Date | string
    entryValidatedBy?: {
      firstName: string
      lastName: string
    }
  }
}

interface OrganizerData {
  organizer: {
    id: number
    user: {
      firstName: string
      lastName: string
      email: string
      phone?: string | null
    }
    title?: string | null
    entryValidated?: boolean
    entryValidatedAt?: Date | string
    entryValidatedBy?: {
      firstName: string
      lastName: string
    }
  }
}

type ParticipantData = TicketData | VolunteerData | ArtistData | OrganizerData

const props = defineProps<{
  open: boolean
  participant?: ParticipantData
  type?: 'ticket' | 'volunteer' | 'artist' | 'organizer'
  isRefunded?: boolean // Indique si la commande est annulée
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  validate: [
    participantIds: number[],
    paymentInfo?: {
      paymentMethod?: 'cash' | 'card' | 'check' | null
      checkNumber?: string
    },
    userInfo?: {
      firstName?: string | null
      lastName?: string | null
      email?: string | null
      phone?: string | null
    },
  ]
  invalidate: [participantId: number]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const isVolunteer = computed(() => props.type === 'volunteer')
const isArtist = computed(() => props.type === 'artist')
const isOrganizer = computed(() => props.type === 'organizer')
const isTicket = computed(
  () =>
    props.type === 'ticket' ||
    (!props.type && !isVolunteer.value && !isArtist.value && !isOrganizer.value)
)

// Gestion de la sélection des participants
const selectedParticipants = ref<number[]>([])
const validating = ref(false)
const showValidateModal = ref(false)
const showInvalidateModal = ref(false)
const showPaymentConfirmModal = ref(false)
const paymentMethod = ref<'cash' | 'card' | 'check' | null>(null)
const checkNumber = ref('')
const ticketToInvalidate = ref<number | null>(null)

// Gestion des informations éditables pour artistes et bénévoles
const editableFirstName = ref<string | null>(null)
const editableLastName = ref<string | null>(null)
const editableEmail = ref<string | null>(null)
const editablePhone = ref<string | null>(null)

// Gestion des articles à restituer
const returnableItemsToDistribute = computed(() => {
  const itemsList: Array<{ id: string; name: string; participantName?: string }> = []
  let globalIndex = 0 // Compteur global pour garantir l'unicité

  // Articles pour les billets
  if (props.participant && 'ticket' in props.participant) {
    const itemsToCheck =
      props.participant.ticket.order.items?.filter((item) =>
        selectedParticipants.value.includes(item.id)
      ) || []

    for (const item of itemsToCheck) {
      const participantName =
        `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Participant'

      // Articles du tarif
      if (item.tier?.returnableItems) {
        for (const tierItem of item.tier.returnableItems) {
          // Construire le nom avec origine si disponible
          let itemName = tierItem.returnableItem.name
          if (tierItem.source === 'customField' && tierItem.customFieldName) {
            itemName = `${tierItem.returnableItem.name} (${tierItem.customFieldName})`
          }

          // Créer un ID unique en utilisant un index global pour éviter les collisions
          // même si plusieurs billets ont le même tarif et la même réponse au champ personnalisé
          itemsList.push({
            id: `${item.id}-tier-${tierItem.returnableItem.id}-${globalIndex++}`,
            name: `${itemName} - ${participantName}`,
            participantName,
          })
        }
      }

      // Articles des options sélectionnées
      if (item.selectedOptions) {
        for (const selectedOption of item.selectedOptions) {
          if (selectedOption.option.returnableItems) {
            for (const optionItem of selectedOption.option.returnableItems) {
              itemsList.push({
                id: `${item.id}-option-${selectedOption.id}-${optionItem.id}-${globalIndex++}`,
                name: `${optionItem.name} - ${participantName}`,
                participantName,
              })
            }
          }
        }
      }
    }
  }

  // Articles pour les bénévoles
  if (props.participant && 'volunteer' in props.participant) {
    const volunteerName =
      `${props.participant.volunteer.user.firstName} ${props.participant.volunteer.user.lastName}`.trim() ||
      'Bénévole'

    if (props.participant.volunteer.returnableItems) {
      for (const item of props.participant.volunteer.returnableItems) {
        itemsList.push({
          id: `volunteer-${item.id}-${globalIndex++}`,
          name: `${item.name} - ${volunteerName}`,
          participantName: volunteerName,
        })
      }
    }
  }

  // Articles pour les artistes
  if (props.participant && 'artist' in props.participant) {
    const artistName =
      `${props.participant.artist.user.firstName} ${props.participant.artist.user.lastName}`.trim() ||
      'Artiste'

    if (props.participant.artist.returnableItems) {
      for (const item of props.participant.artist.returnableItems) {
        itemsList.push({
          id: `artist-${item.id}-${globalIndex++}`,
          name: `${item.name} - ${artistName}`,
          participantName: artistName,
        })
      }
    }
  }

  return itemsList
})

// Réinitialiser la sélection quand la modal s'ouvre
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      selectedParticipants.value = []
      // Initialiser les champs éditables pour bénévoles, artistes et organisateurs
      if (props.participant && 'volunteer' in props.participant) {
        editableFirstName.value = props.participant.volunteer.user.firstName || null
        editableLastName.value = props.participant.volunteer.user.lastName || null
        editableEmail.value = props.participant.volunteer.user.email || null
        editablePhone.value = props.participant.volunteer.user.phone || null
      } else if (props.participant && 'artist' in props.participant) {
        editableFirstName.value = props.participant.artist.user.firstName || null
        editableLastName.value = props.participant.artist.user.lastName || null
        editableEmail.value = props.participant.artist.user.email || null
        editablePhone.value = props.participant.artist.user.phone || null
      } else if (props.participant && 'organizer' in props.participant) {
        editableFirstName.value = props.participant.organizer.user.firstName || null
        editableLastName.value = props.participant.organizer.user.lastName || null
        editableEmail.value = props.participant.organizer.user.email || null
        editablePhone.value = props.participant.organizer.user.phone || null
      } else {
        editableFirstName.value = null
        editableLastName.value = null
        editableEmail.value = null
        editablePhone.value = null
      }
    }
  }
)

// Computed pour séparer les items entre participants et types spéciaux
const participantItems = computed(() => {
  if (!props.participant || !('ticket' in props.participant)) return []
  return (
    props.participant.ticket.order.items?.filter(
      (item) => item.type !== 'Donation' && item.type !== 'Membership' && item.type !== 'Payment'
    ) || []
  )
})

const donationItems = computed(() => {
  if (!props.participant || !('ticket' in props.participant)) return []
  return props.participant.ticket.order.items?.filter((item) => item.type === 'Donation') || []
})

const membershipItems = computed(() => {
  if (!props.participant || !('ticket' in props.participant)) return []
  return props.participant.ticket.order.items?.filter((item) => item.type === 'Membership') || []
})

const paymentItems = computed(() => {
  if (!props.participant || !('ticket' in props.participant)) return []
  return props.participant.ticket.order.items?.filter((item) => item.type === 'Payment') || []
})

// Calcule le montant total d'un item (billet + options)
const getItemTotalAmount = (item: {
  amount: number
  selectedOptions?: Array<{ option: { price: number | null } }>
}) => {
  const optionsTotal =
    item.selectedOptions?.reduce((sum, so) => sum + (so.option.price || 0), 0) || 0
  return item.amount + optionsTotal
}

const selectAllParticipants = () => {
  if (props.participant && 'ticket' in props.participant) {
    // Ne sélectionner que les participants non-validés et non-donations
    selectedParticipants.value =
      participantItems.value.filter((item) => !item.entryValidated).map((item) => item.id) || []
  }
}

// Computed pour calculer le montant total à payer (billet + options)
const amountToPay = computed(() => {
  if (!props.participant || !('ticket' in props.participant)) return 0

  // Si des participants sont sélectionnés, calculer uniquement leur total
  if (selectedParticipants.value.length > 0) {
    return participantItems.value
      .filter((item) => selectedParticipants.value.includes(item.id))
      .reduce((total, item) => total + getItemTotalAmount(item), 0)
  }

  // Sinon, calculer le total de la commande (seulement les items non validés)
  return participantItems.value
    .filter((item) => !item.entryValidated)
    .reduce((total, item) => total + getItemTotalAmount(item), 0)
})

const showValidateTicketsConfirm = () => {
  if (selectedParticipants.value.length === 0) return

  // Vérifier si la commande est en attente de paiement
  if (props.participant && 'ticket' in props.participant) {
    if (props.participant.ticket.state === 'Pending') {
      showPaymentConfirmModal.value = true
      return
    }
  }

  showValidateModal.value = true
}

const showValidateConfirm = () => {
  // Vérifier si la commande est en attente de paiement
  if (props.participant && 'ticket' in props.participant) {
    if (props.participant.ticket.state === 'Pending') {
      showPaymentConfirmModal.value = true
      return
    }
  }

  showValidateModal.value = true
}

const confirmValidateEntry = async () => {
  validating.value = true
  try {
    // Si c'est un bénévole
    if (props.participant && 'volunteer' in props.participant) {
      emit(
        'validate',
        [props.participant.volunteer.id],
        {
          paymentMethod: paymentMethod.value,
          checkNumber: checkNumber.value,
        },
        {
          firstName: editableFirstName.value,
          lastName: editableLastName.value,
          email: editableEmail.value,
          phone: editablePhone.value,
        }
      )
    }
    // Si c'est un artiste
    else if (props.participant && 'artist' in props.participant) {
      emit(
        'validate',
        [props.participant.artist.id],
        {
          paymentMethod: paymentMethod.value,
          checkNumber: checkNumber.value,
        },
        {
          firstName: editableFirstName.value,
          lastName: editableLastName.value,
          email: editableEmail.value,
          phone: editablePhone.value,
        }
      )
    }
    // Si c'est un organisateur
    else if (props.participant && 'organizer' in props.participant) {
      emit(
        'validate',
        [props.participant.organizer.id],
        {
          paymentMethod: paymentMethod.value,
          checkNumber: checkNumber.value,
        },
        {
          firstName: editableFirstName.value,
          lastName: editableLastName.value,
          email: editableEmail.value,
          phone: editablePhone.value,
        }
      )
    }
    // Si ce sont des tickets sélectionnés
    else if (selectedParticipants.value.length > 0) {
      emit(
        'validate',
        selectedParticipants.value,
        {
          paymentMethod: paymentMethod.value,
          checkNumber: checkNumber.value,
        },
        undefined
      )
      // Réinitialiser la sélection après validation
      selectedParticipants.value = []
    }
    showValidateModal.value = false
    // Réinitialiser le choix de paiement pour la prochaine validation
    paymentMethod.value = null
    checkNumber.value = ''
  } finally {
    validating.value = false
  }
}

const confirmPaymentAndContinue = () => {
  // Fermer la modal de paiement et ouvrir la modal de validation
  showPaymentConfirmModal.value = false
  showValidateModal.value = true
}

const showInvalidateConfirm = () => {
  showInvalidateModal.value = true
}

const invalidateTicket = (ticketId: number) => {
  ticketToInvalidate.value = ticketId
  showInvalidateModal.value = true
}

const invalidateEntry = async () => {
  validating.value = true
  try {
    // Si c'est un bénévole
    if (props.participant && 'volunteer' in props.participant) {
      emit('invalidate', props.participant.volunteer.id)
    }
    // Si c'est un artiste
    else if (props.participant && 'artist' in props.participant) {
      emit('invalidate', props.participant.artist.id)
    }
    // Si c'est un organisateur
    else if (props.participant && 'organizer' in props.participant) {
      emit('invalidate', props.participant.organizer.id)
    }
    // Si c'est un ticket
    else if (ticketToInvalidate.value) {
      emit('invalidate', ticketToInvalidate.value)
    }
    showInvalidateModal.value = false
    ticketToInvalidate.value = null
  } finally {
    validating.value = false
  }
}
</script>
