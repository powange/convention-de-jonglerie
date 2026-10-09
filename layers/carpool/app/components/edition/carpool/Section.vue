<template>
  <div class="space-y-6">
    <!-- Boutons d'actions (uniquement pour les utilisateurs connectés) -->
    <ClientOnly>
      <div
        v-if="authStore.isAuthenticated"
        class="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
      >
        <!-- Bouton pour proposer un covoiturage -->
        <UButton
          :label="$t('components.carpool.propose_carpool')"
          icon="i-heroicons-plus"
          color="primary"
          size="lg"
          class="w-full sm:w-auto"
          @click="showOfferModal = true"
        />

        <!-- Bouton pour demander un covoiturage -->
        <UButton
          :label="$t('components.carpool.request_carpool')"
          icon="i-heroicons-magnifying-glass"
          color="primary"
          variant="soft"
          size="lg"
          class="w-full sm:w-auto"
          @click="showRequestModal = true"
        />
      </div>
    </ClientOnly>

    <!-- Bouton toggle pour afficher/masquer les archives -->
    <div class="flex justify-center">
      <UButton
        :label="
          includeArchived
            ? $t('components.carpool.show_active_only')
            : $t('components.carpool.show_all')
        "
        :icon="includeArchived ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
        color="neutral"
        variant="outline"
        size="sm"
        @click="toggleArchived"
      />
    </div>

    <!-- Affiner la liste, côté navigateur — voir le commentaire des filtres dans le script. -->
    <div class="flex flex-col sm:flex-row sm:items-end gap-3">
      <UFormField :label="$t('components.carpool.direction')" class="sm:w-48">
        <USelect v-model="filtres.direction" :items="optionsDeDirection" class="w-full" />
      </UFormField>

      <UFormField :label="$t('components.carpool.filters.city')" class="flex-1">
        <UInput
          v-model="filtres.ville"
          :placeholder="$t('components.carpool.filters.city_placeholder')"
          icon="i-heroicons-magnifying-glass"
          class="w-full"
        />
      </UFormField>

      <!--
        L'intitulé porte le mot « Offres », et ce n'est pas une facilité de rédaction : une DEMANDE
        ne transporte personne, elle n'a donc aucune place à offrir. Cette case ne resserre que
        l'onglet des offres et la carte, et le dire dans le libellé évite la seule chose qu'on ne
        pardonnerait pas à un filtre — paraître ne rien faire.
      -->
      <UCheckbox
        v-model="filtres.placesSeulement"
        :label="$t('components.carpool.filters.with_seats')"
        class="sm:pb-2"
      />

      <UButton
        v-if="filtresActifs"
        :label="$t('components.carpool.filters.reset')"
        icon="i-heroicons-x-mark"
        color="neutral"
        variant="ghost"
        size="sm"
        class="sm:pb-2 self-start sm:self-auto"
        @click="reinitialiserLesFiltres"
      />
    </div>

    <!-- Modal pour proposer un covoiturage -->
    <UModal
      v-model:open="showOfferModal"
      :title="$t('carpool.offer.create')"
      :description="$t('carpool.offer.create_description')"
    >
      <template #body>
        <EditionCarpoolOfferForm
          :edition-id="String(editionId)"
          @success="onOfferCreated"
          @cancel="showOfferModal = false"
        />
      </template>
    </UModal>

    <!-- Modal pour demander un covoiturage -->
    <UModal
      v-model:open="showRequestModal"
      :title="$t('carpool.request.create')"
      :description="$t('carpool.request.create_description')"
    >
      <template #body>
        <EditionCarpoolRequestForm
          :edition-id="String(editionId)"
          @success="onRequestCreated"
          @cancel="showRequestModal = false"
        />
      </template>
    </UModal>

    <!-- Modal pour éditer une offre de covoiturage -->
    <UModal
      v-model:open="showEditOfferModal"
      :title="$t('components.carpool.edit_offer')"
      :description="$t('carpool.offer.edit_description')"
    >
      <template #body>
        <EditionCarpoolOfferForm
          v-if="editingOffer"
          :edition-id="String(editionId)"
          :initial-data="editingOffer"
          :is-editing="true"
          @success="onOfferUpdated"
          @cancel="showEditOfferModal = false"
        />
      </template>
    </UModal>

    <!-- Modal pour éditer une demande de covoiturage -->
    <UModal
      v-model:open="showEditRequestModal"
      :title="$t('components.carpool.edit_request')"
      :description="$t('carpool.request.edit_description')"
    >
      <template #body>
        <EditionCarpoolRequestForm
          v-if="editingRequest"
          :edition-id="String(editionId)"
          :initial-data="editingRequest"
          :is-editing="true"
          @success="onRequestUpdated"
          @cancel="showEditRequestModal = false"
        />
      </template>
    </UModal>

    <!-- Onglets pour afficher les listes -->
    <UTabs :items="tabs" default-value="offers" variant="link">
      <!--
        ⚠️ L'INTITULÉ COURT EST UNE AFFAIRE DE CSS, PAS DE JAVASCRIPT.

        Ce composant mesurait `window.innerWidth` dans un `ref`, au montage et à chaque
        redimensionnement, pour choisir entre l'intitulé court et le long. Deux défauts, dont un
        invisible : le `ref` part à `false` côté serveur, donc le rendu initial porte TOUJOURS
        l'intitulé long — et l'hydratation ne corrige pas une classe déjà posée, c'est un défaut
        déjà payé ailleurs dans ce dépôt. Sur un téléphone, le premier affichage débordait.

        Les deux variantes sont donc rendues, et c'est `sm:` qui en montre une. Le navigateur
        tranche au pixel près, avant la première peinture, et sans écouteur à retirer.
      -->
      <template #default="{ item }">
        <span class="sm:hidden">{{ item.labelCourt }}</span>
        <span class="hidden sm:inline">{{ item.label }}</span>
        <span v-if="item.compteur !== undefined">&nbsp;({{ item.compteur }})</span>
      </template>

      <template #offers>
        <div class="space-y-4">
          <!-- Liste des offres -->
          <div v-if="offers.length > 0" class="space-y-4">
            <EditionCarpoolOfferCard
              v-for="offer in offers"
              :key="offer.id"
              :offer="offer"
              :edition-id="props.editionId"
              @edit="editOffer(offer)"
              @deleted="refreshOffers"
            />
          </div>
          <!--
            ⚠️ DEUX ÉTATS VIDES, ET LE DISCRIMINANT N'EST PAS « DES FILTRES SONT ACTIFS ».

            « Soyez le premier à proposer un trajet » devant une liste que les filtres viennent de
            vider est un mensonge : il y a des annonces, elles sont simplement ailleurs. Mais
            l'inverse se tient aussi — des filtres actifs sur une édition qui n'a AUCUNE annonce ne
            justifient pas d'inviter à les réinitialiser, cela ne ferait rien apparaître.

            Le discriminant est donc « la liste complète n'est pas vide », pas « un filtre est
            posé » : c'est le seul qui distingue « rien à montrer » de « rien ici ».
          -->
          <div v-else class="text-center py-8 text-gray-500">
            <UIcon
              :name="offresMasqueesParLesFiltres ? 'i-heroicons-funnel' : 'i-heroicons-truck'"
              class="mx-auto h-12 w-12 text-gray-300 mb-4"
            />
            <template v-if="offresMasqueesParLesFiltres">
              <p class="text-lg font-medium">
                {{ $t('components.carpool.filters.none_matching') }}
              </p>
              <p class="text-sm">{{ $t('components.carpool.filters.none_matching_help') }}</p>
              <UButton
                :label="$t('components.carpool.filters.reset')"
                icon="i-heroicons-x-mark"
                color="primary"
                variant="soft"
                size="sm"
                class="mt-4"
                @click="reinitialiserLesFiltres"
              />
            </template>
            <template v-else>
              <p class="text-lg font-medium">{{ $t('components.carpool.no_offers') }}</p>
              <p class="text-sm">{{ $t('components.carpool.be_first_to_offer') }}</p>
            </template>
          </div>
        </div>
      </template>

      <template #requests>
        <div class="space-y-4">
          <!-- Liste des demandes -->
          <div v-if="requests.length > 0" class="space-y-4">
            <EditionCarpoolRequestCard
              v-for="request in requests"
              :key="request.id"
              :request="request"
              :edition-id="props.editionId"
              @edit="editRequest(request)"
              @deleted="refreshRequests"
            />
          </div>
          <!--
            ⚠️ DEUX ÉTATS VIDES, ET LE DISCRIMINANT N'EST PAS « DES FILTRES SONT ACTIFS ».

            « Soyez le premier à proposer un trajet » devant une liste que les filtres viennent de
            vider est un mensonge : il y a des annonces, elles sont simplement ailleurs. Mais
            l'inverse se tient aussi — des filtres actifs sur une édition qui n'a AUCUNE annonce ne
            justifient pas d'inviter à les réinitialiser, cela ne ferait rien apparaître.

            Le discriminant est donc « la liste complète n'est pas vide », pas « un filtre est
            posé » : c'est le seul qui distingue « rien à montrer » de « rien ici ».
          -->
          <div v-else class="text-center py-8 text-gray-500">
            <UIcon
              :name="
                demandesMasqueesParLesFiltres
                  ? 'i-heroicons-funnel'
                  : 'i-heroicons-magnifying-glass'
              "
              class="mx-auto h-12 w-12 text-gray-300 mb-4"
            />
            <template v-if="demandesMasqueesParLesFiltres">
              <p class="text-lg font-medium">
                {{ $t('components.carpool.filters.none_matching') }}
              </p>
              <p class="text-sm">{{ $t('components.carpool.filters.none_matching_help') }}</p>
              <UButton
                :label="$t('components.carpool.filters.reset')"
                icon="i-heroicons-x-mark"
                color="primary"
                variant="soft"
                size="sm"
                class="mt-4"
                @click="reinitialiserLesFiltres"
              />
            </template>
            <template v-else>
              <p class="text-lg font-medium">{{ $t('components.carpool.no_requests') }}</p>
              <p class="text-sm">{{ $t('components.carpool.no_requests_published') }}</p>
            </template>
          </div>
        </div>
      </template>

      <!--
        La carte. `UTabs` démonte les panneaux inactifs (`unmountOnHide` vaut `true` par défaut) :
        Leaflet n'est donc chargé qu'à l'ouverture de cet onglet, et pas pour tout visiteur.

        Elle reçoit les MÊMES listes que les deux onglets voisins, donc elle respecte
        l'interrupteur « archives » sans rien savoir de lui. C'est ce qui évite une carte qui
        paraîtrait vide là où les listes montrent des annonces.
      -->
      <template #carte>
        <EditionCarpoolMapView
          :edition-id="props.editionId"
          :offres="offers"
          :demandes="requests"
          :convention="props.convention"
        />
      </template>
    </UTabs>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '#imports'

// Auto-imported: EditionCarpoolOfferCard, EditionCarpoolOfferForm, EditionCarpoolRequestCard, EditionCarpoolRequestForm

interface Props {
  editionId: number
  /**
   * Le lieu de la convention : l'autre extrémité de tous les trajets, et le centre de la carte.
   *
   * Passé en PROP plutôt que relu depuis le store : la page le tient déjà, et un second appel pour
   * une donnée qu'on a sous la main est une occasion de divergence.
   */
  convention?: { nom?: string | null; latitude?: number | null; longitude?: number | null } | null
}

const props = defineProps<Props>()
const authStore = useAuthStore()

// États des modals
const showOfferModal = ref(false)
const showRequestModal = ref(false)
const showEditOfferModal = ref(false)
const showEditRequestModal = ref(false)

// États pour l'édition
const editingOffer = ref(null)
const editingRequest = ref(null)

// État pour le toggle archives (par défaut false = actifs seulement)
const includeArchived = ref(false)

const { t } = useI18n()

const tabs = computed(() => [
  {
    value: 'offers',
    label: t('components.carpool.offers_long'),
    labelCourt: t('components.carpool.offers_short'),
    // Le compteur suit les filtres, et c'est le propos : un onglet qui annoncerait 12 offres pour
    // en montrer 3 ferait chercher les 9 autres.
    compteur: offers.value.length,
    icon: 'i-heroicons-truck',
    slot: 'offers',
  },
  {
    value: 'requests',
    label: t('components.carpool.requests_long'),
    labelCourt: t('components.carpool.requests_short'),
    compteur: requests.value.length,
    icon: 'i-heroicons-magnifying-glass',
    slot: 'requests',
  },
  {
    value: 'carte',
    // Sans compteur : le nombre d'ÉPINGLES n'est pas le nombre d'annonces — plusieurs partent de la
    // même ville —, et afficher le second à côté d'une carte qui en montre moins ferait croire à
    // des points manquants.
    label: t('components.carpool.map_tab'),
    labelCourt: t('components.carpool.map_tab_short'),
    icon: 'i-heroicons-map',
    slot: 'carte',
  },
])

// Charger les offres de covoiturage avec paramètre includeArchived
const { data: carpoolOffers, refresh: refreshOffers } = await useFetch(
  `/api/editions/${props.editionId}/carpool-offers`,
  {
    query: computed(() => ({ includeArchived: includeArchived.value })),
  }
)

// Charger les demandes de covoiturage avec paramètre includeArchived
const { data: carpoolRequests, refresh: refreshRequests } = await useFetch(
  `/api/editions/${props.editionId}/carpool-requests`,
  {
    query: computed(() => ({ includeArchived: includeArchived.value })),
  }
)

// Computed pour s'assurer que les données sont des tableaux
const toutesLesOffres = computed(() =>
  Array.isArray(carpoolOffers.value) ? carpoolOffers.value : []
)
const toutesLesDemandes = computed(() =>
  Array.isArray(carpoolRequests.value) ? carpoolRequests.value : []
)

/*
 * Les filtres, et pourquoi ils agissent ici plutôt que dans la requête.
 *
 * Les deux listes sont déjà entièrement chargées — l'interrupteur « archives » est le seul
 * paramètre que le serveur connaisse —, et une édition compte des dizaines d'annonces, pas des
 * milliers. Un aller-retour réseau par frappe n'apporterait rien, et ferait clignoter une liste
 * qu'on a sous les yeux.
 *
 * La RÈGLE, elle, vit dans `utils/filtres-du-covoiturage.ts` : `USelect` est un composant à gabarit
 * libre, le piloter dans jsdom reviendrait à tester Reka UI plutôt que ce filtre. Séparée, elle
 * s'éprouve directement, croisements compris.
 */
const filtres = ref({ ...FILTRES_AU_REPOS })

const optionsDeDirection = computed(() => [
  { value: 'TOUTES', label: t('components.carpool.filters.direction_any') },
  { value: 'TO_EVENT', label: t('carpool.direction.to_event') },
  { value: 'FROM_EVENT', label: t('carpool.direction.from_event') },
])

const filtresActifs = computed(() => desFiltresSontPoses(filtres.value))

const reinitialiserLesFiltres = () => {
  filtres.value = { ...FILTRES_AU_REPOS }
}

/*
 * Les listes filtrées sont celles que TOUT lit : les deux onglets, leurs compteurs, et la carte.
 *
 * La carte reçoit déjà les mêmes listes que les onglets voisins pour respecter l'interrupteur
 * « archives » sans rien savoir de lui ; les filtres suivent le même chemin. Une carte qui
 * montrerait des épingles absentes de la liste juste à côté ferait douter de la liste.
 */
const offers = computed(() => offresFiltrees(toutesLesOffres.value, filtres.value))
const requests = computed(() => demandesFiltrees(toutesLesDemandes.value, filtres.value))

// Voir le commentaire des états vides : le discriminant est « la liste complète n'est pas vide ».
const offresMasqueesParLesFiltres = computed(
  () => offers.value.length === 0 && toutesLesOffres.value.length > 0
)
const demandesMasqueesParLesFiltres = computed(
  () => requests.value.length === 0 && toutesLesDemandes.value.length > 0
)

const onOfferCreated = () => {
  refreshOffers()
  showOfferModal.value = false
}

const onRequestCreated = () => {
  refreshRequests()
  showRequestModal.value = false
}

// Fonctions pour l'édition
const editOffer = (offer) => {
  editingOffer.value = offer
  showEditOfferModal.value = true
}

const editRequest = (request) => {
  editingRequest.value = request
  showEditRequestModal.value = true
}

const onOfferUpdated = () => {
  refreshOffers()
  showEditOfferModal.value = false
  editingOffer.value = null
}

const onRequestUpdated = () => {
  refreshRequests()
  showEditRequestModal.value = false
  editingRequest.value = null
}

// Fonction pour toggle l'affichage des archives
const toggleArchived = () => {
  includeArchived.value = !includeArchived.value
  // Les useFetch vont automatiquement se rafraîchir grâce au computed dans query
}
</script>
