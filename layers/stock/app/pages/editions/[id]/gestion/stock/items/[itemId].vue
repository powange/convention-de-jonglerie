<template>
  <UContainer class="py-6">
    <!-- Breadcrumb -->
    <div class="mb-4 flex items-center gap-2 text-sm">
      <UButton
        :to="`/editions/${editionId}/gestion/stock`"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-heroicons-arrow-left"
      >
        {{ $t('gestion.stock.title') }}
      </UButton>
      <span v-if="item" class="text-gray-400">/</span>
      <UButton
        v-if="item"
        :to="`/editions/${editionId}/gestion/stock/${item.group.id}`"
        variant="ghost"
        color="neutral"
        size="sm"
      >
        {{ item.group.name }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!item"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon name="i-heroicons-question-mark-circle" class="size-12 text-gray-400 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400">{{ $t('gestion.stock.item_not_found') }}</p>
    </div>

    <div v-else class="space-y-4">
      <UCard>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <UIcon name="i-heroicons-cube" class="text-amber-600 size-6 mt-1 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <!-- 20 px et non 24, délibérément : ce titre nomme un ENREGISTREMENT — ce
                     groupe, cet objet — et non un écran du module. Le cran en dessous dit
                     qu'on est sur une fiche. Ne pas l'aligner sur les titres de page. -->
                <h1 class="text-xl font-semibold">{{ item.name }}</h1>
                <UBadge color="neutral" variant="soft" size="lg">×{{ item.quantity }}</UBadge>
                <!-- Deux constats distincts, donc deux étiquettes : ce qui a été recompté, et
                     ce qui manque. Les fondre en une seule faisait lire « 3 au rangement — 2
                     manquants » comme une phrase, là où ce sont deux chiffres à lire séparément. -->
                <UBadge
                  v-if="item.finalQuantity !== null && item.finalQuantity !== undefined"
                  :color="ecartQuantite > 0 ? 'neutral' : 'success'"
                  variant="soft"
                  size="lg"
                >
                  {{ $t('gestion.stock.final_quantity_short', { count: item.finalQuantity }) }}
                </UBadge>
                <UBadge v-if="ecartQuantite > 0" color="warning" variant="soft" size="lg">
                  {{ $t('gestion.stock.missing_count', { count: ecartQuantite }) }}
                </UBadge>
                <UBadge :color="availabilityColor" variant="soft" size="lg">
                  {{ availabilityLabel }}
                </UBadge>
              </div>
              <!-- Même geste que dans la liste : les tags se posent ici, sans passer par la
                   modale d'édition. -->
              <div class="mt-2">
                <StockItemTagsPicker
                  :edition-id="editionId"
                  :item="item"
                  :tags="tags"
                  :can-manage="canManage"
                  @updated="(tags: any) => item && (item.tags = tags)"
                />
              </div>
              <p v-if="item.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ item.description }}
              </p>
              <p v-if="item.notes" class="text-xs text-gray-500 mt-2 italic whitespace-pre-wrap">
                {{ item.notes }}
              </p>
              <!-- Emplacement de rangement par défaut. Un lieu posé sur la carte porte la
                   couleur et l'icône de son type, comme sur la carte elle-même ; un emplacement
                   écrit à la main garde une épingle grise. -->
              <div
                v-if="emplacement"
                class="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center flex-wrap gap-x-2 gap-y-1"
              >
                <span class="font-medium">{{ $t('gestion.stock.item_storage_location') }} :</span>
                <span v-if="emplacement.carte" class="flex items-center gap-1">
                  <UIcon
                    :name="emplacement.carte.icone"
                    class="size-3.5 shrink-0"
                    :style="{ color: emplacement.carte.couleur }"
                  />
                  {{ emplacement.carte.nom }}
                </span>
                <span v-if="emplacement.texte" class="flex items-center gap-1">
                  <UIcon
                    v-if="!emplacement.carte"
                    name="i-heroicons-map-pin"
                    class="size-3.5 shrink-0 text-gray-400"
                  />
                  {{ emplacement.texte }}
                </span>
              </div>
              <div v-if="item.isExternalLoan" class="mt-2 flex items-center gap-2 flex-wrap">
                <UBadge :color="loanBadgeColor" variant="soft" size="xs">
                  <UIcon name="i-heroicons-hand-raised" class="size-3 mr-1" />
                  {{ loanBadgeLabel }}
                </UBadge>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              v-if="reservationsOuvertes"
              icon="i-heroicons-plus"
              size="sm"
              color="primary"
              @click="openReservationModal(null)"
            >
              {{ $t('gestion.stock.new_reservation') }}
            </UButton>
            <UDropdownMenu v-if="canManage" :items="itemActions">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="sm"
                variant="ghost"
                color="neutral"
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>

      <!-- Emprunt externe -->
      <UCard v-if="item.isExternalLoan">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-hand-raised" class="size-5 text-gray-500" />
            <h2 class="font-semibold">{{ $t('gestion.stock.external_loan') }}</h2>
          </div>
        </template>
        <!-- Trois colonnes, une par moment du prêt : ce qu'on emprunte et à qui, comment on
             va le chercher, comment on le rapporte. Une colonne sans rien à dire disparaît
             plutôt que de laisser un vide.
             Le passage se fait en deux temps — une colonne, puis deux, puis trois — parce que
             sauter de une à trois d'un coup les rendait étroites bien avant qu'elles ne soient
             lisibles, notamment sur une fenêtre à demi réduite. -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <dl v-if="item.ownerContact || item.returnDueAt || item.returnedAt" class="space-y-3">
            <div v-if="item.ownerContact">
              <dt class="text-gray-500">{{ $t('gestion.stock.owner_contact') }}</dt>
              <dd class="whitespace-pre-wrap wrap-break-word">{{ item.ownerContact }}</dd>
            </div>
            <div v-if="item.returnDueAt">
              <dt class="text-gray-500">{{ $t('gestion.stock.return_due_at') }}</dt>
              <dd :class="loanIsOverdue ? 'text-error-600 font-medium' : ''">
                {{ formatDate(item.returnDueAt) }}
                <span v-if="loanIsOverdue" class="text-xs ml-1">
                  ({{ $t('gestion.stock.overdue') }})
                </span>
              </dd>
            </div>
            <div v-if="item.returnedAt">
              <dt class="text-gray-500">{{ $t('gestion.stock.returned_at') }}</dt>
              <dd class="text-success-600 dark:text-success-400">
                {{ formatDate(item.returnedAt) }}
              </dd>
            </div>
          </dl>

          <dl
            v-if="item.pickupLocation || responsableRecuperation || item.pickedUpAt"
            class="space-y-3"
          >
            <div v-if="item.pickedUpAt">
              <dt class="text-gray-500">{{ $t('gestion.stock.picked_up_at') }}</dt>
              <dd class="text-success-600 dark:text-success-400">
                {{ formatDate(item.pickedUpAt) }}
              </dd>
            </div>
            <div v-if="item.pickupLocation">
              <dt class="text-gray-500">{{ $t('gestion.stock.pickup_location') }}</dt>
              <dd class="whitespace-pre-wrap wrap-break-word">{{ item.pickupLocation }}</dd>
            </div>
            <div v-if="responsableRecuperation">
              <dt class="text-gray-500">{{ $t('gestion.stock.pickup_responsible') }}</dt>
              <dd class="flex items-center gap-2 flex-wrap">
                <template v-if="item.pickupResponsible">
                  <UiUserAvatar :user="item.pickupResponsible" size="xs" />
                  {{ item.pickupResponsible.pseudo }}
                </template>
                <span v-if="item.pickupContact" class="text-gray-600 dark:text-gray-400">
                  {{ item.pickupContact }}
                </span>
              </dd>
            </div>
          </dl>

          <dl v-if="item.returnLocation || responsableRetour" class="space-y-3">
            <div v-if="item.returnLocation">
              <dt class="text-gray-500">{{ $t('gestion.stock.return_location') }}</dt>
              <dd class="whitespace-pre-wrap wrap-break-word">{{ item.returnLocation }}</dd>
            </div>
            <div v-if="responsableRetour">
              <dt class="text-gray-500">{{ $t('gestion.stock.return_responsible') }}</dt>
              <dd class="flex items-center gap-2 flex-wrap">
                <template v-if="item.returnResponsible">
                  <UiUserAvatar :user="item.returnResponsible" size="xs" />
                  {{ item.returnResponsible.pseudo }}
                </template>
                <span v-if="item.returnContact" class="text-gray-600 dark:text-gray-400">
                  {{ item.returnContact }}
                </span>
              </dd>
            </div>
          </dl>
        </div>
        <template v-if="canManage" #footer>
          <!-- Les deux jalons dans l'ordre : on ne peut rendre que ce qu'on est allé chercher.
               Le bouton du retour n'apparaît donc qu'une fois la récupération marquée. -->
          <UButton
            v-if="!item.pickedUpAt"
            icon="i-heroicons-arrow-down-tray"
            color="primary"
            size="sm"
            :loading="loanActionLoading"
            @click="marquerRecupere(true)"
          >
            {{ $t('gestion.stock.mark_loan_picked_up') }}
          </UButton>
          <UButton
            v-else-if="!item.returnedAt"
            icon="i-heroicons-arrow-uturn-left"
            color="neutral"
            variant="soft"
            size="sm"
            class="mr-2"
            :loading="loanActionLoading"
            @click="marquerRecupere(false)"
          >
            {{ $t('gestion.stock.mark_loan_not_picked_up') }}
          </UButton>
          <UButton
            v-if="item.pickedUpAt && !item.returnedAt"
            icon="i-heroicons-check-circle"
            color="success"
            size="sm"
            :loading="loanActionLoading"
            @click="markLoanReturned"
          >
            {{ $t('gestion.stock.mark_loan_returned') }}
          </UButton>
          <!-- `v-else-if` et non `v-else` : sans récupération marquée, il n'y a pas de retour à
               annuler, et le bouton se serait affiché à tort. -->
          <UButton
            v-else-if="item.returnedAt"
            icon="i-heroicons-arrow-uturn-left"
            color="neutral"
            variant="soft"
            size="sm"
            :loading="loanActionLoading"
            @click="markLoanNotReturned"
          >
            {{ $t('gestion.stock.mark_loan_not_returned') }}
          </UButton>
        </template>
      </UCard>

      <!-- Réservations. Absentes quand le groupe ne les gère pas : la carte n'aurait rien à dire,
           et son titre laisserait croire qu'on a oublié d'en poser. -->
      <UCard v-if="reservationsOuvertes">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-calendar-days" class="size-5 text-gray-500" />
            <h2 class="font-semibold">{{ $t('gestion.stock.reservations_title') }}</h2>
          </div>
        </template>

        <div v-if="!item.reservations.length" class="text-sm text-gray-500 italic text-center py-4">
          {{ $t('gestion.stock.no_reservations') }}
        </div>
        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li
            v-for="r in item.reservations"
            :key="r.id"
            class="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3"
          >
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <UiUserAvatar :user="r.user" size="sm" class="shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap text-sm">
                  <span class="font-medium">{{ r.user.pseudo }}</span>
                  <UBadge :color="statusColor(r.status)" variant="soft" size="xs">
                    {{ $t(`gestion.stock.status.${r.status}`) }}
                  </UBadge>
                  <UBadge color="neutral" variant="soft" size="xs">
                    ×{{ r.quantityReserved }}
                  </UBadge>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  {{ formatRange(r.startsAt, r.endsAt) }}
                </div>
                <div
                  v-if="r.location || r.zone || r.marker"
                  class="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center flex-wrap gap-x-2 gap-y-1"
                >
                  <UIcon name="i-heroicons-map-pin" class="size-3.5" />
                  <span v-if="r.location">{{ r.location }}</span>
                  <span v-if="r.zone" class="flex items-center gap-1">
                    <span
                      class="size-2.5 rounded-full border border-gray-300"
                      :style="{ backgroundColor: r.zone.color }"
                    />
                    {{ r.zone.name }}
                  </span>
                  <span v-if="r.marker" class="flex items-center gap-1">
                    <UIcon name="i-heroicons-flag" class="size-3.5" />
                    {{ r.marker.name }}
                  </span>
                </div>
                <div class="text-sm mt-1 whitespace-pre-wrap wrap-break-word">{{ r.usage }}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 sm:shrink-0 self-end sm:self-start">
              <StockReservationStatusButton
                :edition-id="editionId"
                :reservation-id="r.id"
                :status="r.status"
                :can-edit="canModifyReservation(r)"
                @updated="fetchItem"
              />
              <UDropdownMenu v-if="canModifyReservation(r)" :items="reservationActions(r)">
                <UButton
                  icon="i-heroicons-ellipsis-vertical"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                />
              </UDropdownMenu>
            </div>
          </li>
        </ul>
      </UCard>
    </div>

    <StockItemModal
      v-if="item"
      v-model:open="itemModalOpen"
      :edition-id="editionId"
      :group-id="item.group.id"
      :item="item"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      @saved="fetchItem"
    />
    <StockReservationModal
      v-if="item && reservationsOuvertes"
      v-model:open="reservationModalOpen"
      :edition-id="editionId"
      :item-id="item.id"
      :item-quantity="item.quantity"
      :reservation="editingReservation"
      :can-moderate="canManage"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      :edition-start-date="edition?.startDate ?? null"
      :edition-setup-start-date="(edition as any)?.volunteersSetupStartDate ?? null"
      @saved="fetchItem"
    />

    <!-- Une seule modale pour les confirmations de l'écran. `confirm()` bloquait la page, ne
         suivait pas la langue choisie et ne disait jamais sur quoi portait l'action. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
  </UContainer>
</template>

<script setup lang="ts">
import { useAuthStore, useEditionStore } from '#imports'

import { apparenceEmplacement } from '../../../../../../utils/apparence-emplacement'
import { peutGererLeStock } from '../../../../../../utils/droits-stock'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const editionId = parseInt(route.params.id as string)
const itemId = computed(() => parseInt(route.params.itemId as string))

/** Sans l'adresse e-mail : l'API ne la rend plus, et l'écran n'en affichait que le pseudo. */
interface ReservationUser {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  emailHash: string | null
  profilePicture: string | null
}
type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'
interface StockReservation {
  id: number
  stockItemId: number
  userId: number
  startsAt: string
  endsAt: string
  usage: string
  quantityReserved: number
  status: StockReservationStatus
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  user: ReservationUser
}
interface StockItemFull {
  id: number
  name: string
  description: string | null
  quantity: number
  notes: string | null
  finalQuantity: number | null
  tags: Array<{ tag: { id: number; name: string; color: string } }>
  isExternalLoan: boolean
  ownerContact: string | null
  returnDueAt: string | null
  pickedUpAt: string | null
  returnedAt: string | null
  pickupLocation: string | null
  pickupResponsible: { id: number; pseudo: string; profilePicture?: string | null } | null
  pickupContact: string | null
  returnLocation: string | null
  returnResponsible: { id: number; pseudo: string; profilePicture?: string | null } | null
  returnContact: string | null
  group: { id: number; name: string; reservationsEnabled?: boolean | null }
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  reservations: StockReservation[]
}

const item = ref<StockItemFull | null>(null)

/**
 * Le groupe de cet objet gère-t-il les réservations&nbsp;?
 *
 * ⚠️ Ne PROTÈGE rien : les endpoints refusent déjà. Sert à ne pas proposer un bouton qui rendrait
 * un 403 — pire qu'aucun bouton, parce qu'on cherche ce qu'on a mal fait.
 */
const reservationsOuvertes = computed(() => item.value?.group?.reservationsEnabled === true)

// Titre de l'onglet : « {nom de l'article} – Stock matériel », cohérent avec la section /stock.
// Tant que l'article n'est pas chargé, on retombe sur le titre générique de la section.
useSeoMeta({
  title: () =>
    item.value?.name
      ? `${item.value.name} – ${t('gestion.stock.title')}`
      : t('gestion.stock.title'),
})

const availability = ref<{ available: number; quantity: number } | null>(null)
const zones = ref<{ id: number; name: string; color: string; types: string[] }[]>([])
const markers = ref<{ id: number; name: string; color: string | null; types: string[] }[]>([])
const loading = ref(true)

const edition = computed(() => editionStore.getEditionById(editionId))

const canManage = computed(() =>
  peutGererLeStock(edition.value as any, authStore.user?.id, authStore.isAdminModeActive)
)

const availabilityColor = computed<'success' | 'warning' | 'error' | 'neutral'>(() => {
  if (!availability.value) return 'neutral'
  if (availability.value.available === 0) return 'error'
  if (availability.value.available < availability.value.quantity) return 'warning'
  return 'success'
})

/**
 * Ce qui manque au rangement.
 *
 * `null` veut dire « pas encore compté », et n'est pas un écart : afficher « 10 manquants » sur
 * un matériel qu'on n'a pas encore recompté serait un mensonge.
 */
const ecartQuantite = computed(() => {
  const it = item.value
  if (!it || it.finalQuantity === null || it.finalQuantity === undefined) return 0
  return Math.max(0, it.quantity - it.finalQuantity)
})

/** Un responsable est désigné dès qu'on a un compte ou un contact écrit. */
const responsableRecuperation = computed(
  () => !!(item.value?.pickupResponsible || item.value?.pickupContact)
)
const responsableRetour = computed(
  () => !!(item.value?.returnResponsible || item.value?.returnContact)
)

/** L'emplacement de rangement, avec sa couleur et son icône. */
const emplacement = computed(() =>
  item.value ? apparenceEmplacement(item.value.zone, item.value.marker, item.value.location) : null
)

// Les tags de l'édition, pour que la modale d'édition puisse les proposer.
const tags = ref<{ id: number; name: string; color: string }[]>([])

async function fetchTags() {
  try {
    const res = await $fetch<{ data: { tags: typeof tags.value } }>(
      `/api/editions/${editionId}/stock-tags`
    )
    tags.value = res?.data?.tags ?? []
  } catch {
    tags.value = []
  }
}

// --- Emprunt externe ---
const loanIsOverdue = computed(() => {
  const it = item.value
  if (!it?.isExternalLoan || it.returnedAt || !it.pickedUpAt || !it.returnDueAt) return false
  return new Date(it.returnDueAt).getTime() < Date.now()
})
// Trois temps : convenu mais pas encore récupéré, récupéré, rendu. Le retard ne concerne que
// la période où le matériel est chez nous — un emprunt qu'on n'est pas allé chercher n'est pas
// « en retard de retour ».
const loanBadgeColor = computed<'success' | 'error' | 'warning' | 'info' | 'neutral'>(() => {
  const it = item.value
  if (!it?.isExternalLoan) return 'info'
  if (it.returnedAt) return 'success'
  if (!it.pickedUpAt) return 'neutral'
  if (loanIsOverdue.value) return 'error'
  return 'warning'
})
const loanBadgeLabel = computed(() => {
  const it = item.value
  if (!it?.isExternalLoan) return ''
  if (it.returnedAt) return t('gestion.stock.loan_returned')
  if (!it.pickedUpAt) return t('gestion.stock.loan_to_pick_up')
  if (loanIsOverdue.value) return t('gestion.stock.loan_overdue')
  return t('gestion.stock.loan_to_return')
})
const loanActionLoading = ref(false)

/** Pose ou retire la date de récupération. */
async function marquerRecupere(recupere: boolean) {
  if (!item.value) return
  loanActionLoading.value = true
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/${item.value.id}`, {
      method: 'PUT',
      body: { pickedUpAt: recupere ? new Date().toISOString() : null },
    })
    useToast().add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    await fetchItem()
    // La pastille du menu compte les retards : marquer un emprunt récupéré ou rendu la change.
    // Le menu ne recalcule qu'au montage, c'est donc ici qu'il faut le lui dire.
    await rafraichirCompteursNavigation({ editionId }, ['stock-emprunts'])
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loanActionLoading.value = false
  }
}

async function markLoanReturned() {
  if (!item.value) return
  loanActionLoading.value = true
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/${item.value.id}`, {
      method: 'PUT',
      body: { returnedAt: new Date().toISOString() },
    })
    useToast().add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    await fetchItem()
    // La pastille du menu compte les retards : marquer un emprunt récupéré ou rendu la change.
    // Le menu ne recalcule qu'au montage, c'est donc ici qu'il faut le lui dire.
    await rafraichirCompteursNavigation({ editionId }, ['stock-emprunts'])
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loanActionLoading.value = false
  }
}

async function markLoanNotReturned() {
  if (!item.value) return
  loanActionLoading.value = true
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/${item.value.id}`, {
      method: 'PUT',
      body: { returnedAt: null },
    })
    useToast().add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    await fetchItem()
    // La pastille du menu compte les retards : marquer un emprunt récupéré ou rendu la change.
    // Le menu ne recalcule qu'au montage, c'est donc ici qu'il faut le lui dire.
    await rafraichirCompteursNavigation({ editionId }, ['stock-emprunts'])
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loanActionLoading.value = false
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const availabilityLabel = computed(() => {
  if (!availability.value) return ''
  return t('gestion.stock.available_now', {
    available: availability.value.available,
    total: availability.value.quantity,
  })
})

async function fetchItem() {
  try {
    loading.value = true
    const res = await $fetch<{ success: boolean; data: { item: StockItemFull } }>(
      `/api/editions/${editionId}/stock-items/${itemId.value}`
    )
    item.value = res?.data?.item || null
    if (item.value) {
      const avRes = await $fetch<{
        success: boolean
        data: { available: number; quantity: number }
      }>(`/api/editions/${editionId}/stock-items/${itemId.value}/availability`)
      availability.value = avRes?.data || null
    }
  } finally {
    loading.value = false
  }
}

async function fetchMapData() {
  const [zonesRes, markersRes] = await Promise.all([
    $fetch<any>(`/api/editions/${editionId}/zones`).catch(() => null),
    $fetch<any>(`/api/editions/${editionId}/markers`).catch(() => null),
  ])
  const zonesData = Array.isArray(zonesRes)
    ? zonesRes
    : (zonesRes?.data?.zones ?? zonesRes?.data ?? [])
  zones.value = (zonesData || []).map((z: any) => ({
    id: z.id,
    name: z.name,
    color: z.color,
    types: Array.isArray(z.zoneTypes) ? z.zoneTypes : [],
  }))
  const markersData = Array.isArray(markersRes)
    ? markersRes
    : (markersRes?.data?.markers ?? markersRes?.data ?? [])
  markers.value = (markersData || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    color: m.color ?? null,
    types: Array.isArray(m.markerTypes) ? m.markerTypes : [],
  }))
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId, { force: true })
  }
})

await Promise.all([fetchItem(), fetchMapData(), fetchTags()])

const itemModalOpen = ref(false)
const reservationModalOpen = ref(false)
const editingReservation = ref<StockReservation | null>(null)

function openReservationModal(r: StockReservation | null) {
  editingReservation.value = r
  reservationModalOpen.value = true
}

const itemActions = computed(() => [
  [
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => {
        itemModalOpen.value = true
      },
    },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteItem(),
    },
  ],
])

const confirmation = useConfirmation()

function deleteItem() {
  const objet = item.value
  if (!objet) return
  confirmation.demanderConfirmation({
    titre: t('common.delete'),
    description: t('gestion.stock.confirm_delete_item', { name: objet.name }),
    libelleConfirmer: t('common.delete'),
    agir: async () => {
      const groupId = objet.group.id
      await $fetch(`/api/editions/${editionId}/stock-items/${objet.id}`, { method: 'DELETE' })
      router.push(`/editions/${editionId}/gestion/stock/${groupId}`)
    },
  })
}

function canModifyReservation(r: StockReservation): boolean {
  return r.userId === authStore.user?.id || canManage.value
}

function reservationActions(r: StockReservation) {
  const actions: Array<
    Array<{
      label: string
      icon: string
      color?: 'error'
      onSelect: () => void
    }>
  > = [
    [
      {
        label: t('common.edit'),
        icon: 'i-heroicons-pencil-square',
        onSelect: () => openReservationModal(r),
      },
    ],
  ]
  // Annuler (uniquement si la résa est encore active)
  if (r.status === 'RESERVED' || r.status === 'PICKED_UP') {
    actions[0].push({
      label: t('gestion.stock.cancel_reservation'),
      icon: 'i-heroicons-x-circle',
      onSelect: () => cancelReservation(r),
    })
  }
  actions.push([
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error',
      onSelect: () => deleteReservation(r),
    },
  ])
  return actions
}

function deleteReservation(r: StockReservation) {
  confirmation.demanderConfirmation({
    titre: t('common.delete'),
    description: t('gestion.stock.confirm_delete_reservation'),
    libelleConfirmer: t('common.delete'),
    agir: async () => {
      await $fetch(`/api/editions/${editionId}/stock-reservations/${r.id}`, { method: 'DELETE' })
      await fetchItem()
    },
  })
}

function cancelReservation(r: StockReservation) {
  confirmation.demanderConfirmation({
    titre: t('gestion.stock.cancel_reservation'),
    description: t('gestion.stock.confirm_cancel_reservation'),
    // « Annuler la réservation » et non « Annuler » : à côté du bouton qui referme la modale,
    // le second se lirait comme « ne rien faire ».
    libelleConfirmer: t('gestion.stock.cancel_reservation'),
    agir: () => performCancelReservation(r),
  })
}

async function performCancelReservation(r: StockReservation) {
  try {
    await $fetch(`/api/editions/${editionId}/stock-reservations/${r.id}`, {
      method: 'PUT',
      body: { status: 'CANCELLED' },
    })
    useToast().add({
      title: t('common.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    // Pas de rafraîchissement du compteur ici : annuler une réservation ne touche pas à l'état
    // d'un emprunt, et donc pas au nombre de retards.
    await fetchItem()
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

function statusColor(s: StockReservationStatus): 'neutral' | 'info' | 'success' | 'error' {
  switch (s) {
    case 'RESERVED':
      return 'info'
    case 'PICKED_UP':
      return 'neutral'
    case 'RETURNED':
      return 'success'
    case 'CANCELLED':
      return 'error'
  }
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start)
    const e = new Date(end)
    const dateFmt = new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const timeFmt = new Intl.DateTimeFormat(locale.value, {
      hour: '2-digit',
      minute: '2-digit',
    })
    // Si même jour, format compact « 10 juin 2026, 10:00 → 18:00 »
    const sameDay =
      s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      s.getDate() === e.getDate()
    if (sameDay) {
      return `${dateFmt.format(s)}, ${timeFmt.format(s)} → ${timeFmt.format(e)}`
    }
    return `${dateFmt.format(s)} ${timeFmt.format(s)} → ${dateFmt.format(e)} ${timeFmt.format(e)}`
  } catch {
    return `${start} → ${end}`
  }
}
</script>
