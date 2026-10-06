<!--
  UN titre d'une personne, affiché en entier.

  ⚠️ POURQUOI CE COMPOSANT EXISTE. Ce bloc vivait dans `ParticipantDetailsModal`, qui ne savait
  montrer qu'UN titre : un aiguillage à quatre branches sur un participant unique. Or une même
  personne en porte plusieurs — un billet ET une place d'organisateur —, et le guichet doit les
  voir les uns à la suite des autres plutôt que de fermer et rouvrir la fiche.

  📍 CE COMPOSANT NE VALIDE RIEN. Il affiche, il laisse corriger les champs, il dit ce qu'on
  demande — la confirmation, elle, est globale et reste dans la modale : avec plusieurs titres, il
  n'y a qu'une liste d'articles à remettre et qu'un seul geste de validation.
-->
<template>
  <div class="space-y-6">
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

      <!--
        La somme qu'on doit à la personne qui présente ce billet.

        Symétrique du bloc « Montant à payer » de la modale de paiement, et au même endroit du
        parcours : c'est à la porte qu'on rencontre la personne, donc là qu'on lui rend son
        argent. L'entrée reste refusée — ce bouton solde une dette, il ne rouvre pas le droit
        d'entrer.
      -->
      <div
        v-if="sommeDue !== null"
        class="p-4 rounded-lg bg-gradient-to-r from-warning-50 to-warning-100 dark:from-warning-900/20 dark:to-warning-800/20 border border-warning-200 dark:border-warning-800 space-y-3"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-heroicons-banknotes"
              class="text-warning-600 dark:text-warning-400 h-5 w-5"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{
                detteEstUneRemise
                  ? $t('edition.ticketing.discount_amount_label')
                  : $t('edition.ticketing.refund_amount_label')
              }}
            </span>
          </div>
          <span class="text-2xl font-bold text-warning-600 dark:text-warning-400">
            {{ money(sommeDue) }}
          </span>
        </div>

        <!--
          Le détail de ce qu'on rend, dès qu'il y a plus d'une ligne.

          ⚠️ Un seul chiffre ne se vérifie pas. L'écran annonçait 34 € là où la commande en devait
          58 : quatre repas annulés manquaient à l'appel, et rien ne permettait de s'en rendre
          compte au guichet. Le détail est ce qui rend le total contrôlable par la personne qui
          tient la caisse.
        -->
        <ul
          v-if="!detteEstUneRemise && soldeToutLaCommande && lignesDues.length > 1"
          class="text-xs text-gray-600 dark:text-gray-400 space-y-1 border-t border-warning-200 dark:border-warning-800 pt-2"
        >
          <li v-for="ligne in lignesDues" :key="ligne.id" class="flex justify-between gap-3">
            <span class="truncate">{{ ligne.name }}</span>
            <span class="font-medium tabular-nums shrink-0">{{ money(ligne.amount) }}</span>
          </li>
        </ul>

        <!--
          Plusieurs titulaires : on ne solde PAS d'un geste, et on dit pourquoi.

          Rendre le total de la commande à qui présente un billet donnerait à une personne
          l'argent des autres. L'écran retombe donc sur la ligne scannée.
        -->
        <p
          v-else-if="detteDeLaCommande?.nomsMultiples"
          class="text-xs text-gray-600 dark:text-gray-400 border-t border-warning-200 dark:border-warning-800 pt-2"
        >
          {{ $t('edition.ticketing.refund_several_holders') }}
        </p>
        <!--
          ⚠️ Sur une remise, on dit que le billet RESTE VALIDE. Ce bloc annonce une somme à rendre
          dans un encadré d'alerte, au même endroit que celui d'une annulation : sans cette
          phrase, on lit « argent à rendre » et l'on croit l'entrée refusée.
        -->
        <p
          v-if="detteEstUneRemise"
          class="text-xs text-gray-600 dark:text-gray-400 border-t border-warning-200 dark:border-warning-800 pt-2"
        >
          {{ $t('edition.ticketing.discount_still_valid') }}
        </p>
        <UButton
          block
          color="warning"
          icon="i-heroicons-check-circle"
          :label="
            detteEstUneRemise
              ? $t('edition.ticketing.discount_mark_done')
              : $t('edition.ticketing.refund_mark_done')
          "
          @click="demanderLeRemboursement"
        />
      </div>

      <!--
        Dette déjà soldée : on le dit, pour qu'on ne rende pas l'argent deux fois.

        Et on peut revenir dessus, sur place. Sans ce bouton, un bénévole qui s'est trompé devait
        faire corriger l'erreur dans la gestion, depuis la liste des commandes — c'est-à-dire
        demander à quelqu'un d'autre, la personne encore devant lui.

        Pas de confirmation ici, à la différence du remboursement : celui-ci efface une dette,
        celui-là la rétablit. On ne met pas de friction sur le geste qui répare.
      -->
      <!--
        Remise déjà rendue. Jumeau de l'encart ci-dessous, et pour la même raison : sans lui, on
        rendrait l'argent une seconde fois. Le bouton de retour en arrière évite d'aller faire
        corriger l'erreur en gestion, la personne encore devant soi.
      -->
      <UAlert
        v-else-if="remiseDejaRendue"
        icon="i-heroicons-receipt-percent"
        color="info"
        variant="soft"
        :title="$t('edition.ticketing.discount_already_done')"
        :description="dateDeLaRemiseRendue"
      >
        <template #actions>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-uturn-left"
            :label="$t('edition.ticketing.discount_undo')"
            @click="annulerLaRemiseRendue"
          />
        </template>
      </UAlert>

      <UAlert
        v-else-if="dejaRembourse"
        icon="i-heroicons-check-circle"
        color="success"
        variant="soft"
        :title="$t('edition.ticketing.refund_already_done')"
        :description="dateDuRemboursement"
      >
        <template #actions>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-uturn-left"
            :label="$t('edition.ticketing.refund_undo')"
            @click="annulerLeRemboursement"
          />
        </template>
      </UAlert>

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
            <UIcon name="i-heroicons-shopping-cart" class="text-purple-600 dark:text-purple-400" />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('edition.ticketing.order') }}
            </h4>
          </div>
          <!-- La provenance de la commande, par l'utilitaire partagé.

               La condition portait auparavant sur l'identifiant de la commande, qui vaut en
               réalité celui d'HelloAsso : elle marchait par accident pour ce fournisseur, et
               laissait une commande Infomaniak sans aucune origine. Le logo du site couvre
               désormais les commandes saisies sur place, comme dans les listes.

               (Le nom pointé de cette propriété est écrit en toutes lettres à dessein : dans un
               commentaire de gabarit, le détecteur i18n le prendrait pour une clé manquante.) -->
          <img
            v-if="participant.ticket.order"
            :src="logoDuFournisseur(participant.ticket.order.provider)"
            :alt="
              nomDuFournisseur(participant.ticket.order.provider) ??
              $t('gestion.ticketing.origin_site')
            "
            :title="
              nomDuFournisseur(participant.ticket.order.provider) ??
              $t('gestion.ticketing.origin_site')
            "
            class="h-5 w-5 object-contain"
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
            <!--
              `Canceled` ne figure plus ici : c'est un état de LIGNE, jamais un statut de
              commande. Les deux branches qui le testaient ne se sont donc jamais exécutées —
              une commande s'annule par `Refunded`, un billet par `Canceled`, et les deux
              vocabulaires ne se recouvrent pas (cf. `billets-qui-comptent.ts`).
            -->
            <UBadge :color="couleurDuStatut" :label="libelleDuStatut" variant="soft" />
          </div>
        </div>
      </div>

      <!-- Informations des participants -->
      <div v-if="participantItems && participantItems.length > 0" class="space-y-4">
        <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <UIcon name="i-heroicons-user" class="text-primary-600 dark:text-primary-400" />
          <h4 class="font-semibold text-gray-900 dark:text-white">
            {{ participantItems.length > 1 ? 'Participants' : $t('edition.ticketing.participant') }}
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
              {{ $t('ticketing.participant.entry_validated') }}
            </div>

            <div class="flex items-start gap-3">
              <input
                v-if="estValidable(item)"
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
                <!--
                  ⚠️ LE CAS LE PLUS COURANT EST CELUI OÙ IL N'Y A RIEN À DIRE : quelqu'un achète
                  un billet pour lui-même, et son nom et son adresse sont recopiés à l'identique
                  depuis la commande, deux lignes plus haut. Les répéter occupe la moitié de la
                  fiche sans rien apprendre, et noie le seul renseignement qui compte quand ils
                  DIFFÈRENT — un billet acheté pour quelqu'un d'autre.
                -->
                <p
                  v-if="estIdentiqueALAcheteur(item, participant.ticket.order.payer)"
                  class="text-sm italic"
                  :class="
                    item.entryValidated
                      ? 'text-gray-500 dark:text-gray-500'
                      : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{ $t('edition.ticketing.same_as_buyer') }}
                </p>
                <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        {{ money(getItemTotalAmount(item)) }}
                        <span
                          v-if="item.selectedOptions && item.selectedOptions.length > 0"
                          class="text-xs opacity-75"
                        >
                          ({{ money(item.amount) }} + options)
                        </span>
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Statut du billet</p>
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
                        (+{{ money(selectedOption.option.price) }})
                      </span>
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bouton dévalider en bas de la carte -->
            <div
              v-if="item.entryValidated"
              class="mt-3 pt-3 border-t border-green-200 dark:border-green-800 flex flex-wrap items-center justify-between gap-2"
            >
              <p class="text-xs text-green-700 dark:text-green-300">
                <span v-if="nomDuValidateur(item)">
                  {{ $t('ticketing.participant.validated_by', { name: nomDuValidateur(item) }) }}
                </span>
                {{
                  dateDeValidation(item)
                    ? $t('ticketing.participant.validated_on', { date: dateDeValidation(item) })
                    : ''
                }}
              </p>
              <UButton
                color="error"
                variant="soft"
                size="xs"
                icon="i-heroicons-x-circle"
                @click="demanderLaDevalidation(item.id)"
              >
                Dévalider l'entrée
              </UButton>
            </div>
          </div>
        </div>

        <!-- Bouton pour tout sélectionner/désélectionner.

             Absent quand aucun billet ne peut plus être validé — tous entrés, ou annulés : le
             « Tout désélectionner » qui s'y affichait alors ne portait sur rien. -->
        <div v-if="participantsValidables.length > 0" class="flex justify-end">
          <UButton
            v-if="selectedParticipants.length < participantsValidables.length"
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
                      {{ money(item.amount) }}
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
                      {{ money(item.amount) }}
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
                      {{ money(item.amount) }}
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
      :fuseau="fuseau"
      :editable-first-name="editableFirstName"
      :editable-last-name="editableLastName"
      :editable-email="editableEmail"
      :editable-phone="editablePhone"
      :validating="validating"
      @update:email-valid="emit('update:email-valid', $event)"
      @update:first-name="editableFirstName = $event"
      @update:last-name="editableLastName = $event"
      @update:email="editableEmail = $event"
      @update:phone="editablePhone = $event"
      @validate="demanderLaValidation"
      @invalidate="demanderLaDevalidation()"
    />

    <!-- Affichage pour un artiste -->
    <ArtistDetailsCard
      v-else-if="isArtist && participant && 'artist' in participant"
      :artist="participant.artist"
      :fuseau="fuseau"
      :editable-first-name="editableFirstName"
      :editable-last-name="editableLastName"
      :editable-email="editableEmail"
      :editable-phone="editablePhone"
      :validating="validating"
      @update:email-valid="emit('update:email-valid', $event)"
      @update:first-name="editableFirstName = $event"
      @update:last-name="editableLastName = $event"
      @update:email="editableEmail = $event"
      @update:phone="editablePhone = $event"
      @validate="demanderLaValidation"
      @invalidate="demanderLaDevalidation()"
    />

    <!-- Affichage pour un organisateur -->
    <OrganizerDetailsCard
      v-else-if="isOrganizer && participant && 'organizer' in participant"
      :organizer="participant.organizer"
      :fuseau="fuseau"
      :editable-first-name="editableFirstName"
      :editable-last-name="editableLastName"
      :editable-email="editableEmail"
      :editable-phone="editablePhone"
      :validating="validating"
      @update:email-valid="emit('update:email-valid', $event)"
      @update:first-name="editableFirstName = $event"
      @update:last-name="editableLastName = $event"
      @update:email="editableEmail = $event"
      @update:phone="editablePhone = $event"
      @validate="demanderLaValidation"
      @invalidate="demanderLaDevalidation()"
    />

    <!-- Message si aucun participant -->
    <div v-else class="py-8 text-center">
      <UIcon name="i-heroicons-user-circle" class="mx-auto h-16 w-16 text-gray-400 mb-3" />
      <p class="text-gray-500">{{ $t('edition.ticketing.no_info_available') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { estIdentiqueALAcheteur } from '../../utils/identite-du-titulaire'
import { logoDuFournisseur, nomDuFournisseur } from '../../utils/ticketing/fournisseur'

import ArtistDetailsCard from './ArtistDetailsCard.vue'
import OrganizerDetailsCard from './OrganizerDetailsCard.vue'
import VolunteerDetailsCard from './VolunteerDetailsCard.vue'

import { formaterDateHeure } from '~~/shared/utils/fuseau-edition'
import { sommeDueAuGuichet } from '~~/shared/utils/somme-due-au-guichet'

const { money } = useEditionCurrency()

const { getParticipantTypeConfig } = useParticipantTypes()
const ticketConfig = getParticipantTypeConfig('ticket')

interface TicketData {
  ticket: {
    id: number
    name: string
    amount: number
    state: string
    qrCode?: string
    /** La somme due pour CE billet. Calculée par le serveur (`remboursement-du.ts`). */
    refundDue?: number | null
    refunded?: boolean
    refundedAt?: string | Date | null
    /** La remise accordée, et si son argent est déjà sorti de la caisse. */
    discountAmount?: number | null
    discountPaidBack?: boolean | null
    discountPaidBackAt?: string | Date | null
    /**
     * Ce que doit la COMMANDE entière, et à combien de personnes.
     *
     * ⚠️ C'est elle qu'on annonce au guichet : on rend l'argent une fois. N'afficher que
     * `refundDue` faisait réclamer 34 € sur une commande qui en devait 58.
     */
    detteDeLaCommande?: {
      total: number
      lignes: Array<{ id: number; name: string | null; amount: number }>
      /** Plusieurs titulaires : chaque ligne se rembourse alors séparément. */
      nomsMultiples: boolean
    } | null
    user: {
      firstName: string
      lastName: string
      email: string
    }
    order: {
      id: number
      status?: string
      /** D'où vient la commande ; `null` si elle a été saisie sur place. */
      provider?: string | null
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
        entryValidatedBy?: {
          firstName: string
          lastName: string
        } | null
        customFields?: Array<{
          name: string
          answer: string
        }>
        tier?: {
          id: number
          name: string
        }
        /**
         * Les articles à remettre pour CE billet, tarif, options et champs personnalisés déjà
         * réunis et agrégés par le serveur. Portés par le billet et non par son tarif, puisque
         * leurs sources le débordent.
         */
        handoutItems?: Array<{
          handoutItem: {
            id: number
            name: string
          }
          source?: 'tier' | 'option' | 'customField'
          customFieldName?: string
          optionName?: string
          /** Nombre d'exemplaires à remettre (articles cumulables) */
          quantity?: number
        }>
        selectedOptions?: Array<{
          id: number
          amount: number
          option: {
            id: number
            name: string
            type: string
            price: number | null
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
    handoutItems?: Array<{
      id: number
      name: string
      /** Nombre d'exemplaires à remettre (articles cumulables) */
      quantity?: number
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
    handoutItems?: Array<{
      id: number
      name: string
      /** Nombre d'exemplaires à remettre (articles cumulables) */
      quantity?: number
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
    /** Articles de cet organisateur et de tous les organisateurs, agrégés par le serveur. */
    handoutItems?: Array<{
      id: number
      name: string
      /** Nombre d'exemplaires à remettre (articles cumulables) */
      quantity?: number
    }>
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
  participant?: ParticipantData
  type?: 'ticket' | 'volunteer' | 'artist' | 'organizer'
  isRefunded?: boolean // Indique si la commande est annulée
  /** Fuseau de l'édition : une entrée se date à l'heure du LIEU, pas du navigateur. */
  fuseau?: string | null
  /** Une validation est en cours : le parent la mène, la section se contente de se figer. */
  validating?: boolean
  /**
   * Les lignes de commande à cocher d'avance.
   *
   * ⚠️ UNE SECTION MONTRE UNE COMMANDE, PAS UNE LIGNE. Au guichet groupé, on connaît les lignes
   * qui appartiennent à la personne cherchée ; les autres lignes de la même commande — achetées
   * pour des tiers — restent visibles mais décochées. Sans cela, il faudrait les retrouver à la
   * main dans une liste qui peut en compter cinq ou dix.
   */
  preselection?: number[]
}>()

const emit = defineEmits<{
  /**
   * L'argent de ce billet a-t-il été rendu ?
   *
   * `true` solde la dette, `false` la rétablit — le second sert à défaire une erreur sans quitter
   * le guichet. La page appelle le point d'API et rafraîchit la fiche.
   */
  refund: [itemId: number, refunded: boolean, portee: 'billet' | 'commande']
  /** Ce titre demande à être validé. Le parent confirme, pour tous les titres à la fois. */
  'demander-validation': []
  /** L'argent d'une remise est-il sorti de la caisse ? Jumeau de `refund`, pour l'autre dette. */
  'remise-rendue': [itemId: number, rendue: boolean]
  /** Ce billet demande à solder sa dette : le parent pose la question avant d'émettre `refund`. */
  'demander-remboursement': [
    demande: {
      itemId: number
      /** D'où vient la dette : une annulation, ou une remise accordée et pas encore rendue. */
      nature: 'annulation' | 'remise'
      portee: 'billet' | 'commande'
      montant: number
      porteur: string
    },
  ]
  /** Ce titre demande à être dévalidé ; l'identifiant désigne une LIGNE précise, pour un billet. */
  'demander-devalidation': [itemId?: number]
  /** Les lignes cochées de cette commande, dont le parent tire les articles à remettre. */
  'update:selection': [ids: number[]]
  /**
   * L'adresse de ce titre est-elle valide ?
   *
   * ⚠️ Elle était gardée par le bouton de la carte, qui refusait de valider tant qu'elle ne
   * l'était pas. Ce bouton a cédé la place à celui du pied : sans ce signal, la garde disparaîtrait
   * avec lui et l'on validerait une entrée sur une adresse en erreur.
   */
  'update:email-valid': [valide: boolean]
  /** Les champs corrigés au guichet, que le parent enverra avec la validation de CE titre. */
  'update:infos': [
    infos: {
      firstName?: string | null
      lastName?: string | null
      email?: string | null
      phone?: string | null
    },
  ]
}>()

const { locale } = useI18n()

/**
 * Qui a validé un billet, et quand — à l'heure du lieu.
 *
 * Mêmes règles que dans les trois cartes de détail : un contrôle d'accès se relit sur place, et
 * la langue de l'horodatage est celle du lecteur, pas un `fr-FR` figé dans le gabarit. Le
 * validateur n'était pas du tout rendu ici : l'API ne le renvoyait pas pour les billets.
 */
const nomDuValidateur = (item: {
  entryValidatedBy?: { firstName: string; lastName: string } | null
}) =>
  item.entryValidatedBy
    ? `${item.entryValidatedBy.firstName} ${item.entryValidatedBy.lastName}`
    : ''

const dateDeValidation = (item: { entryValidatedAt?: string | Date }) =>
  item.entryValidatedAt ? formaterDateHeure(item.entryValidatedAt, props.fuseau, locale.value) : ''

/**
 * « Ce billet peut-il encore être validé ? »
 *
 * Trois endroits proposaient de valider une ligne ANNULÉE : la case à cocher, « Tout
 * sélectionner » et le total à encaisser. Le serveur refuse désormais ces billets — la garde de
 * `validate-entry` ne connaissait que `Refunded`, une valeur qu'aucune ligne ne porte, et laissait
 * passer les `Canceled`. Proposer le geste ici n'aboutirait donc qu'à une erreur 400 devant la
 * file : autant ne pas l'offrir.
 *
 * Le vocabulaire est celui relevé sur les données, et non celui qu'on supposait : voir
 * `server/utils/ticketing/billets-qui-comptent.ts`. Il est recopié ici faute d'un module partagé
 * entre le serveur et le client — le gabarit voisin, qui affiche l'état du billet, le recopie
 * déjà lui aussi.
 */
const estValidable = (item: { entryValidated?: boolean; state?: string }) =>
  !item.entryValidated &&
  !props.isRefunded &&
  item.state !== 'Canceled' &&
  item.state !== 'Refunded'

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

// Gestion des informations éditables pour artistes et bénévoles
const editableFirstName = ref<string | null>(null)
const editableLastName = ref<string | null>(null)
const editableEmail = ref<string | null>(null)
const editablePhone = ref<string | null>(null)

// Synchroniser les champs éditables avec les données du participant
const populateEditableFields = () => {
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

// Réinitialiser la sélection quand la modal s'ouvre
/*
 * ⚠️ IL N'Y A PLUS DE PROP `open`. La section est MONTÉE quand elle doit s'afficher, et démontée
 * sinon : c'est la modale qui s'ouvre, pas elle. Les deux observateurs qui guettaient `open`
 * initialisaient les champs à l'ouverture ; `immediate` fait désormais le même travail au montage,
 * et le rechargement d'un participant (après validation) retombe sur le même observateur.
 */
watch(
  () => props.participant,
  () => {
    selectedParticipants.value = [...(props.preselection ?? [])]
    populateEditableFields()
  },
  { immediate: true }
)

/*
 * Ce que la section REMONTE au parent.
 *
 * ⚠️ Elle ne valide pas elle-même : c'est le parent qui mène la validation, et il a besoin des
 * lignes cochées — pour en tirer les articles à remettre — et des champs corrigés au guichet. Les
 * garder pour elle les rendrait invisibles, et la validation enverrait les anciennes valeurs sans
 * que rien ne le signale.
 */
/*
 * ⚠️ `immediate`, ET C'EST UN PIÈGE D'ORDRE D'EXÉCUTION. L'observateur juste au-dessus pose la
 * présélection pendant le `setup`, donc AVANT que celui-ci ne soit déclaré : sans `immediate`, le
 * parent n'entendait jamais la sélection initiale. Les cases apparaissaient cochées et le bouton
 * annonçait « Valider l'entrée (2) » pour trois titres ; il fallait décocher puis recocher un
 * billet pour que le compte tombe juste.
 *
 * 📍 Rien ne le signale : l'écran est cohérent avec lui-même, et c'est le CHIFFRE du bouton qui
 * ment. Déplacer cet observateur plus haut marcherait aussi, mais tiendrait à l'ordre des lignes —
 * `immediate` le dit.
 */
watch(selectedParticipants, (ids) => emit('update:selection', [...ids]), {
  deep: true,
  immediate: true,
})

watch(
  [editableFirstName, editableLastName, editableEmail, editablePhone],
  ([firstName, lastName, email, phone]) =>
    emit('update:infos', { firstName, lastName, email, phone }),
  { immediate: true }
)

/**
 * Le billet scanné, quand c'en est un.
 *
 * Les autres lignes de la commande sont dans `participantItems` ; celle-ci est celle qu'on vient
 * de présenter à la porte, et c'est d'elle qu'on parle quand on rend de l'argent.
 */
const billetScanne = computed(() => {
  if (!props.participant || !('ticket' in props.participant)) return null
  return props.participant.ticket
})

/**
 * La somme due à la personne, ou `null` s'il n'y a rien à rendre.
 *
 * Calculée par le serveur (`montantARembourser`, dans `remboursement-du.ts`) et non ici : la règle
 * tient en trois conditions dont une piégeuse — annuler une commande remplace son statut « payée »
 * par « annulée », et seul le moyen de paiement témoigne encore qu'elle l'était. La recopier à
 * l'écran, c'était s'exposer à ce qu'elle diverge du jour où le serveur la corrigerait.
 */
const montantARembourser = computed(() => billetScanne.value?.refundDue ?? null)

/**
 * Ce que doit la COMMANDE entière, rendu par le serveur.
 *
 * ⚠️ LE DÉFAUT QUE CELA CORRIGE. L'écran n'annonçait que la ligne scannée : sur la commande 937 de
 * la base de développement, il réclamait 34 € pour un billet d'entrée alors que quatre repas
 * annulés, soit 24 € de plus, restaient dus. Le bénévole rendait 34 €, la personne repartait, et
 * la dette restait — sans que rien ne l'ait signalée.
 */
const detteDeLaCommande = computed(() => billetScanne.value?.detteDeLaCommande ?? null)

/**
 * La commande se solde-t-elle d'un seul geste ?
 *
 * Non quand ses lignes dues portent des noms différents : une commande groupée paie pour plusieurs
 * participants, et rendre le total à qui présente un billet donnerait à une personne l'argent des
 * autres. Mesuré : la commande 686 porte trois t-shirts à trois noms, sous un même e-mail de
 * payeur. On retombe alors sur la ligne scannée, et chacune se solde quand elle se présente.
 */
const soldeToutLaCommande = computed(
  () => !!detteDeLaCommande.value && !detteDeLaCommande.value.nomsMultiples
)

/**
 * La somme annoncée au guichet, et celle que le bouton va solder.
 *
 * La précédence vit dans `somme-due-au-guichet`, où elle est éprouvée : elle a déjà échoué en
 * silence, l'encadré ne s'affichant jamais pour une remise alors que le serveur annonçait la dette.
 */
const sommeDue = computed(() =>
  sommeDueAuGuichet({
    estUneRemise: detteEstUneRemise.value,
    dueParLeBillet: montantARembourser.value,
    soldeToutLaCommande: soldeToutLaCommande.value,
    dueParLaCommande: detteDeLaCommande.value?.total ?? 0,
  })
)
const lignesDues = computed(() => detteDeLaCommande.value?.lignes ?? [])

/**
 * La dette affichée vient-elle d'une REMISE plutôt que d'une annulation ?
 *
 * ⚠️ CE N'EST PAS UNE NUANCE D'AFFICHAGE : les deux dettes se soldent par des points d'API
 * DIFFÉRENTS. Le serveur refuse de « rembourser » un billet vivant — garde explicite — donc
 * appeler le mauvais rendrait une erreur 400 au moment précis où l'on a les espèces à la main.
 *
 * 📍 Le billet est vivant par construction : `montantARembourser` ne rend une dette de remise que
 * sur un billet non annulé.
 */
const detteEstUneRemise = computed(() => {
  const billet = billetScanne.value
  if (!billet || billet.state === 'Canceled') return false
  return (billet.discountAmount ?? 0) > 0 && billet.discountPaidBack !== true
})

/** La remise de ce billet a-t-elle déjà été rendue ? */
const remiseDejaRendue = computed(() => {
  const billet = billetScanne.value
  return (billet?.discountAmount ?? 0) > 0 && billet?.discountPaidBack === true
})

const dateDeLaRemiseRendue = computed(() => {
  const quand = billetScanne.value?.discountPaidBackAt
  if (!quand) return undefined
  return formaterDateHeure(quand, props.fuseau, locale.value)
})

const dejaRembourse = computed(
  () => billetScanne.value?.state === 'Canceled' && billetScanne.value?.refunded === true
)

const dateDuRemboursement = computed(() => {
  const quand = billetScanne.value?.refundedAt
  // Les remboursements rattrapés à la reprise n'ont pas de date : on sait QUE l'argent a été
  // rendu, pas quand. Mieux vaut ne rien dater que dater faux.
  if (!quand) return undefined
  return formaterDateHeure(quand, props.fuseau, locale.value)
})

/**
 * Demande au parent d'ouvrir la confirmation.
 *
 * ⚠️ CE DRAPEAU ÉTAIT LOCAL, ET PLUS RIEN NE LE LISAIT. En sortant ce bloc de la modale, le bouton
 * a gardé son `confirmationDuRemboursement = true` tandis que la modale de confirmation restait
 * chez le parent, avec son propre drapeau du même nom. Résultat : le bouton ne faisait RIEN, et
 * rien ne le disait — pas d'erreur, pas de message, un clic sans effet au guichet, devant la
 * personne à qui l'on devait de l'argent.
 *
 * 📍 La section envoie tout ce que la question doit porter — le montant et le nom —, pour que le
 * parent n'ait pas à le recalculer depuis un participant qu'il ne connaît plus en mode groupé.
 */
const demanderLeRemboursement = () => {
  if (!billetScanne.value) return
  emit('demander-remboursement', {
    itemId: billetScanne.value.id,
    // ⚠️ La nature décide du point d'API : rembourser un billet vivant est refusé par le serveur.
    nature: detteEstUneRemise.value ? 'remise' : 'annulation',
    // Une remise ne se solde jamais « sur toute la commande » : elle porte sur ce billet-là.
    portee: detteEstUneRemise.value || !soldeToutLaCommande.value ? 'billet' : 'commande',
    montant: sommeDue.value ?? 0,
    porteur: [billetScanne.value.user?.firstName, billetScanne.value.user?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim(),
  })
}

/** Rétablir la dette d'une remise, sur place — symétrique de `annulerLeRemboursement`. */
const annulerLaRemiseRendue = () => {
  if (billetScanne.value) emit('remise-rendue', billetScanne.value.id, false)
}

const annulerLeRemboursement = () => {
  // Symétrique du geste : ce qu'on a soldé d'un coup se dé-solde d'un coup.
  if (billetScanne.value)
    emit('refund', billetScanne.value.id, false, soldeToutLaCommande.value ? 'commande' : 'billet')
}

/**
 * Le statut de la COMMANDE, rendu lisible.
 *
 * Les quatre valeurs sont celles que la billetterie enregistre réellement — relevées sur les
 * données dans `billets-qui-comptent.ts`, et non supposées. `Canceled` n'en fait pas partie :
 * c'est un état de billet. Une valeur inconnue s'affiche telle quelle plutôt que d'être traduite
 * de travers.
 */
const STATUTS_DE_COMMANDE: Record<string, { couleur: string; libelle: string }> = {
  Processed: { couleur: 'success', libelle: 'Payée' },
  Pending: { couleur: 'warning', libelle: 'En attente de paiement' },
  Onsite: { couleur: 'info', libelle: 'Sur place' },
  Refunded: { couleur: 'error', libelle: 'Annulée' },
}

const statutDeLaCommande = computed(() => {
  if (!props.participant || !('ticket' in props.participant)) return ''
  return props.participant.ticket.order.status || ''
})

const couleurDuStatut = computed(
  () => STATUTS_DE_COMMANDE[statutDeLaCommande.value]?.couleur ?? 'neutral'
)

const libelleDuStatut = computed(
  () => STATUTS_DE_COMMANDE[statutDeLaCommande.value]?.libelle ?? statutDeLaCommande.value
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

/** Les billets de la commande qu'on peut encore cocher : ni entrés, ni annulés. */
const participantsValidables = computed(() =>
  participantItems.value.filter((item) => estValidable(item))
)

const selectAllParticipants = () => {
  if (props.participant && 'ticket' in props.participant) {
    // Ne sélectionner que les participants non-validés et non-donations
    selectedParticipants.value = participantsValidables.value.map((item) => item.id)
  }
}

/*
 * ⚠️ CETTE SECTION NE CONFIRME RIEN, elle le DEMANDE. Les trois fonctions ci-dessous posaient
 * auparavant un drapeau qui ouvrait une modale voisine ; cette modale vit maintenant chez le
 * parent, parce qu'avec plusieurs titres il n'y a qu'UNE confirmation, qu'une liste d'articles à
 * remettre et qu'un seul geste. Un drapeau posé ici n'ouvrirait plus rien — en silence.
 *
 * 📍 Le cas « commande en attente de paiement » est passé au parent avec le reste : c'est lui qui
 * porte l'écran de règlement, et avec plusieurs billets la question se pose une fois.
 */
const demanderLaValidation = () => emit('demander-validation')
const demanderLaDevalidation = (itemId?: number) => emit('demander-devalidation', itemId)
</script>
