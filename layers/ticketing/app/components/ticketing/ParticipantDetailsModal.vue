<template>
  <!--
    ⚠️ `content`, PAS `width`. `UModal` n'expose pas d'emplacement `width` — sa liste est
    `overlay | content | header | wrapper | body | footer | title | description | close`. Une
    valeur passée sous un nom inconnu est ignorée EN SILENCE : cette modale est restée à la
    largeur par défaut alors qu'on croyait lui en avoir donné une.

    📍 Huit autres modales du dépôt portent encore ce réglage sans effet. Elles ne sont pas
    corrigées ici : chacune mérite qu'on regarde la largeur qu'elle demandait avant de la lui
    rendre d'un coup.

    📍 La largeur DÉPEND du contenu : une seule section n'a rien à faire d'un écran de 1280 px,
    où ses champs s'étireraient en lignes illisibles. Voir `largeurDeLaFiche`.
  -->
  <UModal
    v-model:open="isOpen"
    :title="$t('edition.ticketing.participant_modal_title')"
    :description="$t('edition.ticketing.participant_modal_description')"
    :ui="{ content: largeurDeLaFiche }"
  >
    <template #body>
      <!--
        ⚠️ UNE SECTION PAR TITRE, les unes à la suite des autres.

        Cette modale ne savait montrer qu'un titre : un aiguillage à quatre branches sur un
        participant unique. Or une même personne porte un billet ET une place d'organisateur, et le
        guichet devait fermer la fiche pour voir l'autre, en perdant de vue ce qu'il venait d'y
        lire. Le corps est sorti dans `ParticipantTitleSection`, qu'on empile.

        📍 LE PARCOURS INDIVIDUEL NE CHANGE PAS : sans `titres`, la modale affiche le seul
        `participant` qu'on lui passe, et c'est une pile d'un élément.
      -->
      <!--
        ⚠️ DEUX COLONNES SEULEMENT À PARTIR DE DEUX SECTIONS, et seulement à partir de `lg`. Une
        seule section dans une grille à deux colonnes laisserait la moitié de la fiche vide ; et
        sous `lg`, deux colonnes rendraient chaque section plus étroite que ses propres
        formulaires, qui passent eux-mêmes en deux colonnes dès `md`.

        📍 `items-start` : sans lui, les sections d'une même rangée s'étirent à la hauteur de la
        plus haute. Une commande de cinq billets à côté d'une fiche de bénévole donnerait un bloc
        de bénévole long de tout l'écran, pour trois champs.
      -->
      <div :class="plusieursSections ? 'grid lg:grid-cols-2 gap-8 items-start' : 'space-y-8'">
        <div v-for="(titre, index) in titresAffiches" :key="`${titre.type}-${index}`">
          <!--
            Le séparateur n'a de sens qu'empilé. En colonnes, il tracerait un trait au-dessus de
            la section de droite, qui ne suit rien.
          -->
          <USeparator v-if="index > 0" class="mb-6" :class="{ 'lg:hidden': plusieursSections }" />
          <ParticipantTitleSection
            :participant="titre.participant"
            :type="titre.type"
            :is-refunded="titre.isRefunded"
            :fuseau="fuseau"
            :validating="validating"
            :preselection="titre.preselection"
            @update:selection="noterLaSelection(index, $event)"
            @update:infos="noterLesInfos(index, $event)"
            @update:email-valid="noterLaValiditeDuCourriel(index, $event)"
            @demander-validation="demanderLaValidationGlobale()"
            @demander-devalidation="demanderLaDevalidation(index, $event)"
            @demander-remboursement="ouvrirLaConfirmationDeRemboursement"
            @remise-rendue="(itemId, rendue) => emit('remise-rendue', itemId, rendue)"
            @refund="(itemId, refunded, portee) => emit('refund', itemId, refunded, portee)"
          />
        </div>

        <div v-if="titresAffiches.length === 0" class="py-8 text-center">
          <UIcon name="i-heroicons-user-circle" class="mx-auto h-16 w-16 text-gray-400 mb-3" />
          <p class="text-gray-500">{{ $t('edition.ticketing.no_info_available') }}</p>
        </div>
      </div>
    </template>

    <!--
      ⚠️ UN SEUL PIED, POUR TOUS LES TITRES. Il n'appartenait qu'au billet : avec plusieurs titres,
      un bouton par section ferait valider la personne en trois gestes, et chacun rouvrirait une
      liste d'articles à remettre partielle. Le compte annoncé est celui de TOUT ce qui part.
    -->
    <template v-if="aQuelqueChoseAValider" #footer>
      <div class="flex justify-end items-center gap-2 w-full">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('edition.ticketing.selected_count', nombreAValider) }}
        </div>
        <UButton
          color="success"
          icon="i-heroicons-check-circle"
          :loading="validating"
          :disabled="!toutesLesAdressesValides"
          @click="demanderLaValidationGlobale"
        >
          {{ $t('edition.ticketing.validate_entry_count', { count: nombreAValider }) }}
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
    :checklist-items="handoutItemsToDistribute"
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

  <!--
    Confirmation du remboursement.

    Un geste d'ARGENT, fait à la porte, sur un écran tactile, par quelqu'un qui enchaîne les
    scans — et le bouton occupe toute la largeur, juste sous le montant dû. Sans cette étape, un
    doigt qui glisse efface une dette, et plus personne ne saura qu'on la doit : le guichet ne
    permet pas de revenir dessus, il faut passer par la liste des commandes en gestion.

    Le montant et le nom figurent dans la QUESTION, pas seulement dans le bouton : c'est ce qui
    arrête un clic de trop. Et cet écran confirmait déjà la dévalidation d'une entrée, qui est le
    geste le moins lourd des deux.
  -->
  <UiConfirmModal
    v-model="confirmationDuRemboursement"
    :title="
      remboursementDemande?.nature === 'remise'
        ? $t('edition.ticketing.discount_confirm_title')
        : $t('edition.ticketing.refund_confirm_title')
    "
    :description="
      remboursementDemande?.nature === 'remise'
        ? $t('edition.ticketing.discount_confirm_description', {
            amount: money(remboursementDemande?.montant ?? 0),
            name: remboursementDemande?.porteur ?? '',
          })
        : $t('edition.ticketing.refund_confirm_description', {
            amount: money(remboursementDemande?.montant ?? 0),
            name: remboursementDemande?.porteur ?? '',
          })
    "
    :confirm-label="$t('edition.ticketing.refund_mark_done')"
    confirm-color="warning"
    confirm-icon="i-heroicons-banknotes"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-amber-500"
    @confirm="confirmerLeRemboursement"
    @cancel="confirmationDuRemboursement = false"
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
              {{ money(amountToPay) }}
            </span>
          </div>
        </div>

        <TicketingPaymentMethodSelector
          v-model="paymentMethod"
          v-model:check-number="checkNumber"
          :amount="amountToPay"
          show-title
        />
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

import {
  listeDesArticlesARemettre,
  type ArticleACocher,
  type ArticleDePersonne,
  type SourceDArticles,
} from '../../utils/articles-a-remettre'

import ParticipantTitleSection from './ParticipantTitleSection.vue'

const { money } = useEditionCurrency()

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

export interface TitreAffiche {
  participant: ParticipantData
  type: 'ticket' | 'volunteer' | 'artist' | 'organizer'
  isRefunded?: boolean
  /** Pour un billet : les lignes de CETTE commande qui appartiennent à la personne cherchée. */
  preselection?: number[]
}

/** Ce qu'on valide, titre par titre : la nature décide de la table, les identifiants des lignes. */
export interface ValidationDUnTitre {
  type: 'ticket' | 'volunteer' | 'artist' | 'organizer'
  ids: number[]
  userInfo?: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
  }
}

const props = defineProps<{
  open: boolean
  participant?: ParticipantData
  type?: 'ticket' | 'volunteer' | 'artist' | 'organizer'
  isRefunded?: boolean // Indique si la commande est annulée
  /**
   * PLUSIEURS titres d'une même personne, à empiler.
   *
   * Absent, la modale retombe sur le `participant` unique : c'est le parcours individuel, que ce
   * prop ne doit pas déranger. Il s'ajoute, il ne remplace pas.
   */
  titres?: TitreAffiche[]
  /** Fuseau de l'édition : une entrée se date à l'heure du LIEU, pas du navigateur. */
  fuseau?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  /**
   * L'argent de ce billet a-t-il été rendu ?
   *
   * `true` solde la dette, `false` la rétablit — le second sert à défaire une erreur sans quitter
   * le guichet. La page appelle le point d'API et rafraîchit la fiche.
   */
  refund: [itemId: number, refunded: boolean, portee: 'billet' | 'commande']
  /**
   * ⚠️ UNE LISTE, ET NON UN SEUL TITRE. L'ancien contrat émettait des identifiants et laissait la
   * page deviner leur nature depuis un état global : avec un billet ET une place d'organisateur,
   * cette nature unique en désignait forcément une des deux, et l'autre partait dans la mauvaise
   * table — sans erreur, puisque les identifiants existent des deux côtés.
   */
  validate: [
    lots: ValidationDUnTitre[],
    paiement?: {
      paymentMethod?: 'cash' | 'card' | 'check' | null
      checkNumber?: string
    },
  ]
  /**
   * L'argent d'une REMISE a-t-il été rendu ?
   *
   * ⚠️ Un signal distinct de `refund`, parce que le serveur a deux points d'API : rembourser un
   * billet vivant est refusé — la remise ne solde pas la même somme que l'annulation.
   */
  'remise-rendue': [itemId: number, rendue: boolean]
  /** La nature accompagne l'identifiant, pour la même raison. */
  invalidate: [type: 'ticket' | 'volunteer' | 'artist' | 'organizer', participantId: number]
}>()

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

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

/**
 * Les titres à empiler.
 *
 * 📍 `titres` quand on le lui donne, sinon le seul `participant` : le parcours individuel passe par
 * la même pile, d'un élément. Une seule façon d'afficher, donc un seul endroit où se tromper.
 */
const titresAffiches = computed<TitreAffiche[]>(() => {
  if (props.titres?.length) return props.titres
  if (!props.participant || !props.type) return []
  return [{ participant: props.participant, type: props.type, isRefunded: props.isRefunded }]
})

/** Les lignes cochées, section par section. */
const selectionParSection = ref<Record<number, number[]>>({})
/** Les champs corrigés au guichet, section par section — chaque titre a SON compte. */
const infosParSection = ref<Record<number, ValidationDUnTitre['userInfo']>>({})

const noterLaSelection = (index: number, ids: number[]) => {
  selectionParSection.value = { ...selectionParSection.value, [index]: ids }
}

const noterLesInfos = (index: number, infos: ValidationDUnTitre['userInfo']) => {
  infosParSection.value = { ...infosParSection.value, [index]: infos }
}

/**
 * L'adresse de chaque section est-elle valide ?
 *
 * ⚠️ CETTE GARDE A FAILLI SE PERDRE. Elle vivait sur le bouton de chaque carte — désactivé tant
 * que l'adresse corrigée au guichet était en erreur. En déplaçant la validation dans le pied, le
 * bouton est parti et la garde avec lui : on aurait validé une entrée sur une adresse invalide,
 * sans rien pour l'empêcher et sans que rien ne le signale.
 *
 * 📍 Absente pour une section, on la suppose VALIDE : seules les trois cartes de personne portent
 * un champ d'adresse ; un billet n'en a pas, et il ne doit pas se retrouver bloqué par un signal
 * que personne ne lui enverra jamais.
 */
const validiteParSection = ref<Record<number, boolean>>({})

const noterLaValiditeDuCourriel = (index: number, valide: boolean) => {
  validiteParSection.value = { ...validiteParSection.value, [index]: valide }
}

const toutesLesAdressesValides = computed(() =>
  titresAffiches.value.every((_, index) => validiteParSection.value[index] !== false)
)

/**
 * L'identifiant d'un titre dans SA table.
 *
 * ⚠️ Pour un billet, ce sont les LIGNES cochées — une commande en porte plusieurs. Pour les trois
 * autres natures il n'y a qu'un titre, qu'on valide en entier : aucune case ne le représente, et
 * attendre une sélection ferait un bouton qui ne part jamais.
 */
const idsDuTitre = (titre: TitreAffiche, index: number): number[] => {
  if (titre.type === 'ticket') return selectionParSection.value[index] ?? []
  const porteur = (titre.participant as Record<string, { id: number } | undefined>)[titre.type]
  return porteur ? [porteur.id] : []
}

/** Déjà validé ? On ne le repropose pas : revalider n'a aucun effet et brouillerait le compte. */
const titreDejaValide = (titre: TitreAffiche): boolean => {
  if (titre.type === 'ticket') return false
  const porteur = (titre.participant as Record<string, { entryValidated?: boolean } | undefined>)[
    titre.type
  ]
  return porteur?.entryValidated === true
}

/** Ce que le bouton du pied enverra : tous les titres, chacun avec ses identifiants. */
const lotsAValider = computed<ValidationDUnTitre[]>(() =>
  titresAffiches.value
    .map((titre, index) => ({
      titre,
      index,
      ids: titreDejaValide(titre) || titre.isRefunded ? [] : idsDuTitre(titre, index),
    }))
    .filter(({ ids }) => ids.length > 0)
    .map(({ titre, index, ids }) => ({
      type: titre.type,
      ids,
      userInfo: infosParSection.value[index],
    }))
)

/** Plusieurs titres à l'écran : la fiche s'élargit et passe en deux colonnes. */
const plusieursSections = computed(() => titresAffiches.value.length > 1)

/**
 * La largeur de la fiche, selon ce qu'elle a à montrer.
 *
 * ⚠️ ELLE N'EST PAS CONSTANTE, et c'est voulu. Une seule section — le parcours individuel, de loin
 * le plus courant — n'a rien à faire d'une fiche de 1280 px : ses champs s'y étireraient en lignes
 * qu'on lit mal, et le regard devrait traverser l'écran pour aller d'une étiquette à sa valeur.
 * Deux sections côte à côte, en revanche, ont besoin de cette place : sous 1280 px, chaque colonne
 * deviendrait plus étroite que les formulaires qu'elle contient, qui passent eux-mêmes en deux
 * colonnes dès `md`.
 *
 * 📍 `sm:` et non `lg:` : c'est le préfixe qu'emploie Nuxt UI pour la largeur de ses modales, et
 * la contrainte est un MAXIMUM — sous cette taille, la fiche occupe simplement l'écran.
 */
const largeurDeLaFiche = computed(() => (plusieursSections.value ? 'sm:max-w-7xl' : 'sm:max-w-4xl'))

const nombreAValider = computed(() =>
  lotsAValider.value.reduce((total, lot) => total + lot.ids.length, 0)
)

const aQuelqueChoseAValider = computed(() => nombreAValider.value > 0)

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

// Gestion des informations éditables pour artistes et bénévoles
const editableFirstName = ref<string | null>(null)
const editableLastName = ref<string | null>(null)
const editableEmail = ref<string | null>(null)
const editablePhone = ref<string | null>(null)

/*
 * Les articles à remettre, pour LE titre que cette modale montre.
 *
 * ⚠️ LE CALCUL N'EST PLUS ICI. Il vit dans `articles-a-remettre`, parce que le contrôle d'accès
 * doit maintenant l'appliquer à PLUSIEURS titres d'un coup — une personne qui a un billet et une
 * place d'organisateur reçoit les articles des deux. Deux copies de cette règle auraient fini par
 * se contredire, et c'est déjà arrivé une fois : un bracelet non cumulable s'affichait en deux
 * lignes pour avoir été compté sous deux clés. Ce qui reste ici est la seule chose propre à cette
 * modale : lire le participant qu'on lui a passé.
 */
/**
 * Les articles à remettre, pour TOUS les titres cochés.
 *
 * ⚠️ C'EST LE DÉFAUT QUI A LANCÉ CE CHANTIER. La liste ne regardait qu'un titre : une personne qui
 * a un billet à tarif particulier ET une place d'organisateur se voyait remettre les articles de
 * l'un des deux, jamais des deux. Rien ne le disait — on validait, et le compte ne tombait qu'au
 * stock, en fin d'événement.
 *
 * 📍 La règle d'agrégation vit dans `articles-a-remettre`, partagée : le même tee-shirt dû à deux
 * titres fait deux tee-shirts, le même dû deux fois par un titre n'en fait qu'un, suivi de « ×2 ».
 */
const handoutItemsToDistribute = computed<ArticleACocher[]>(() => {
  const sources: SourceDArticles[] = []
  const defauts = { volunteer: 'Bénévole', artist: 'Artiste', organizer: 'Organisateur' } as const

  titresAffiches.value.forEach((titre, index) => {
    const ids = idsDuTitre(titre, index)
    if (ids.length === 0) return

    if (titre.type === 'ticket') {
      if (!('ticket' in titre.participant)) return
      const lignes = (titre.participant.ticket.order.items ?? []).filter((item) =>
        ids.includes(item.id)
      )
      for (const ligne of lignes) {
        sources.push({
          nature: 'ticket',
          porteur: `${ligne.firstName || ''} ${ligne.lastName || ''}`.trim() || 'Participant',
          ligne: ligne.id,
          articles: ligne.handoutItems || [],
        })
      }
      return
    }

    const porteur = (
      titre.participant as Record<
        string,
        | {
            user?: { firstName?: string | null; lastName?: string | null }
            handoutItems?: ArticleDePersonne[]
          }
        | undefined
      >
    )[titre.type]
    if (!porteur?.handoutItems?.length) return

    sources.push({
      nature: titre.type,
      porteur:
        `${porteur.user?.firstName ?? ''} ${porteur.user?.lastName ?? ''}`.trim() ||
        defauts[titre.type as keyof typeof defauts],
      articles: porteur.handoutItems,
    })
  })

  return listeDesArticlesARemettre(sources)
})

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
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      selectedParticipants.value = []
      populateEditableFields()
    }
  }
)

// Mettre à jour les champs éditables quand le participant change (ex: reloadParticipant)
watch(
  () => props.participant,
  () => {
    if (props.open) {
      populateEditableFields()
    }
  }
)

const confirmationDuRemboursement = ref(false)

/**
 * Ce que le billet demandeur a transmis : son identifiant, la portée, le montant et le porteur.
 *
 * ⚠️ IL FAUT QUE LA DEMANDE PORTE TOUT CELA. Le parent le calculait depuis son `participant`, qui
 * est `null` en mode groupé — la question aurait annoncé « 0,00 € à » sans nom, et le geste
 * n'aurait visé aucun billet.
 */
const remboursementDemande = ref<{
  itemId: number
  nature: 'annulation' | 'remise'
  portee: 'billet' | 'commande'
  montant: number
  porteur: string
} | null>(null)

const ouvrirLaConfirmationDeRemboursement = (demande: typeof remboursementDemande.value) => {
  remboursementDemande.value = demande
  confirmationDuRemboursement.value = true
}

const confirmerLeRemboursement = () => {
  confirmationDuRemboursement.value = false
  const demande = remboursementDemande.value
  if (demande) {
    /*
     * ⚠️ DEUX DETTES, DEUX POINTS D'API. Le serveur refuse de « rembourser » un billet vivant :
     * appeler le mauvais rendrait une erreur 400 au moment précis où l'on a les espèces en main,
     * devant la personne.
     */
    if (demande.nature === 'remise') emit('remise-rendue', demande.itemId, true)
    else emit('refund', demande.itemId, true, demande.portee)
  }
  remboursementDemande.value = null
}

// Calcule le montant total d'un item (billet + options)
const getItemTotalAmount = (item: {
  amount: number
  selectedOptions?: Array<{ option: { price: number | null } }>
}) => {
  const optionsTotal =
    item.selectedOptions?.reduce((sum, so) => sum + (so.option.price || 0), 0) || 0
  return item.amount + optionsTotal
}

// Computed pour calculer le montant total à payer (billet + options)
/**
 * La somme à encaisser : celle de TOUS les billets cochés, toutes sections confondues.
 *
 * Elle ne regardait qu'une commande. Avec deux billets issus de deux commandes, on annonçait au
 * guichet la moitié de ce qu'on allait encaisser.
 */
const amountToPay = computed(() =>
  titresAffiches.value.reduce((total, titre, index) => {
    if (titre.type !== 'ticket' || !('ticket' in titre.participant)) return total
    const ids = idsDuTitre(titre, index)
    const lignes = (titre.participant.ticket.order.items ?? []).filter((item) =>
      ids.length > 0 ? ids.includes(item.id) : estValidable(item)
    )
    return total + lignes.reduce((somme, item) => somme + getItemTotalAmount(item), 0)
  }, 0)
)

/**
 * Le geste du pied : valider TOUT ce qui est coché, toutes sections confondues.
 *
 * ⚠️ L'ÉCRAN DE RÈGLEMENT SE POSE UNE FOIS. Il s'ouvrait par titre ; avec plusieurs billets, on
 * répondait trois fois à la même question et deux des réponses se perdaient.
 */
const demanderLaValidationGlobale = () => {
  if (!aQuelqueChoseAValider.value) return

  const enAttenteDePaiement = titresAffiches.value.some(
    (titre, index) =>
      titre.type === 'ticket' &&
      idsDuTitre(titre, index).length > 0 &&
      'ticket' in titre.participant &&
      titre.participant.ticket.state === 'Pending'
  )

  if (enAttenteDePaiement) {
    showPaymentConfirmModal.value = true
    return
  }

  showValidateModal.value = true
}

const confirmValidateEntry = async () => {
  validating.value = true
  try {
    /*
     * ⚠️ UN SEUL ÉMIS, PORTANT TOUS LES LOTS. L'ancienne version enchaînait quatre branches `if`
     * sur le participant unique et n'émettait donc jamais qu'une nature. La page, elle, lisait la
     * nature dans un état global : deux endroits qui devaient s'accorder sur une valeur que ni
     * l'un ni l'autre ne pouvait tenir dès qu'il y avait deux titres.
     */
    emit('validate', lotsAValider.value, {
      paymentMethod: paymentMethod.value,
      checkNumber: checkNumber.value,
    })

    showValidateModal.value = false
    paymentMethod.value = null
    checkNumber.value = ''

    /*
     * ⚠️ ON FERME AUSSI LA FICHE. La confirmation des articles à remettre est le dernier geste du
     * guichet : une fois les cases cochées et l'entrée validée, il n'y a plus rien à faire de ces
     * billets. La fiche restait ouverte sur un état déjà périmé — les titres y paraissaient encore
     * « à valider » —, et il fallait la fermer à la main pour revenir à la recherche, la personne
     * suivante attendant devant le comptoir.
     *
     * 📍 C'est la page qui rafraîchit ensuite les listes : le nouvel état se lit là, pas ici.
     */
    isOpen.value = false
  } finally {
    validating.value = false
  }
}

const confirmPaymentAndContinue = () => {
  // Fermer la modal de paiement et ouvrir la modal de validation
  showPaymentConfirmModal.value = false
  showValidateModal.value = true
}

/** Quelle section demande une dévalidation, et quelle ligne s'il s'agit d'un billet. */
const devalidationDemandee = ref<{ index: number; itemId?: number } | null>(null)

const demanderLaDevalidation = (index: number, itemId?: number) => {
  devalidationDemandee.value = { index, itemId }
  showInvalidateModal.value = true
}

const invalidateEntry = async () => {
  const demande = devalidationDemandee.value
  if (!demande) return

  validating.value = true
  try {
    const titre = titresAffiches.value[demande.index]
    if (!titre) return

    /*
     * ⚠️ LA NATURE PART AVEC L'IDENTIFIANT. Elle se déduisait du participant unique de la modale ;
     * avec plusieurs titres, ce raccourci désignait toujours le premier et dévalidait dans la
     * mauvaise table — sans erreur, les identifiants existant des deux côtés.
     */
    const id = demande.itemId ?? idsDuTitre(titre, demande.index)[0]
    if (id !== undefined) emit('invalidate', titre.type, id)

    showInvalidateModal.value = false
    devalidationDemandee.value = null
  } finally {
    validating.value = false
  }
}
</script>
