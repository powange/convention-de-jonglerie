<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <ManagementPageHeader
      titre="Informations de l'événement"
      description="Le nom, les dates, le lieu, et ce que montre la page publique de l'événement."
      module="general-info"
    />

    <UAlert
      v-if="erreur"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      title="Événement introuvable, ou vous n'y avez pas accès."
    />
    <USkeleton v-else-if="!evenement" class="h-96 w-full" />

    <template v-else>
      <UForm :state="etat" class="space-y-6" @submit="enregistrer">
        <!-- Sur grand écran, deux colonnes : ce qui décrit l'événement à gauche, ce qui le montre
             (affiche, page publique, liens) à droite. Une seule colonne sur mobile. -->
        <div class="grid items-start gap-6 lg:grid-cols-3">
          <div class="space-y-6 lg:col-span-2">
            <UCard>
              <template #header>
                <h2 class="flex items-center gap-2 font-semibold">
                  <UIcon name="i-heroicons-calendar-days" class="text-primary" /> L'événement
                </h2>
              </template>
              <div class="space-y-5">
                <UFormField label="Nom de l'événement" name="name" required>
                  <UInput v-model="etat.name" class="w-full" :disabled="!droits?.modifier" />
                </UFormField>

                <UFormField
                  label="Fuseau horaire"
                  name="timezone"
                  description="Celui du lieu de l'événement : les dates ci-dessous y sont saisies et affichées, quel que soit le pays de la personne qui les lit."
                  required
                >
                  <TimezoneSelectMenu
                    v-model="etat.timezone"
                    placeholder="Choisir un fuseau horaire"
                    :disabled="!droits?.modifier"
                  />
                </UFormField>

                <div class="grid gap-4 sm:grid-cols-2">
                  <UFormField label="Début" name="debut">
                    <UInput
                      v-model="etat.debut"
                      type="datetime-local"
                      class="w-full"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                  <UFormField label="Fin" name="fin" :error="erreurFin">
                    <UInput
                      v-model="etat.fin"
                      type="datetime-local"
                      class="w-full"
                      :min="etat.debut || undefined"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="flex items-center gap-2 font-semibold">
                  <UIcon name="i-heroicons-map-pin" class="text-primary" /> Le lieu
                </h2>
              </template>
              <div class="space-y-5">
                <EvenementRechercheAdresse v-if="droits?.modifier" @choisie="remplirAdresse" />

                <UFormField label="Nom du lieu" name="location">
                  <UInput
                    v-model="etat.location"
                    class="w-full"
                    placeholder="Salle des fêtes, gymnase, parc…"
                    :disabled="!droits?.modifier"
                  />
                </UFormField>
                <div class="grid gap-4 sm:grid-cols-2">
                  <UFormField label="Adresse" name="addressLine1">
                    <UInput
                      v-model="etat.addressLine1"
                      class="w-full"
                      placeholder="12 rue des Lilas"
                      autocomplete="address-line1"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                  <UFormField label="Complément d'adresse" name="addressLine2">
                    <UInput
                      v-model="etat.addressLine2"
                      class="w-full"
                      autocomplete="address-line2"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                </div>
                <div class="grid gap-4 sm:grid-cols-[10rem_1fr_1fr]">
                  <UFormField label="Code postal" name="postalCode">
                    <UInput
                      v-model="etat.postalCode"
                      class="w-full"
                      autocomplete="postal-code"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                  <UFormField label="Ville" name="city">
                    <UInput
                      v-model="etat.city"
                      class="w-full"
                      autocomplete="address-level2"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                  <UFormField label="Pays" name="country">
                    <UInput
                      v-model="etat.country"
                      class="w-full"
                      placeholder="France"
                      autocomplete="country-name"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <UFormField label="Latitude" name="latitude">
                    <UInput
                      v-model="etat.latitude"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      class="w-full"
                      placeholder="45.7640"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                  <UFormField label="Longitude" name="longitude">
                    <UInput
                      v-model="etat.longitude"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      class="w-full"
                      placeholder="4.8357"
                      :disabled="!droits?.modifier"
                    />
                  </UFormField>
                </div>
                <!-- Sous les DEUX champs : portée par la latitude seule, l'aide décalait la longitude. -->
                <p class="-mt-2 text-sm text-muted">
                  Coordonnées remplies par la recherche, ou calculées depuis l'adresse à
                  l'enregistrement ; corrigez-les si le repère tombe à côté.
                </p>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="flex items-center gap-2 font-semibold">
                  <UIcon name="i-heroicons-document-text" class="text-primary" /> Description
                </h2>
              </template>
              <UFormField name="description">
                <UTextarea
                  v-model="etat.description"
                  :rows="8"
                  autoresize
                  class="w-full"
                  placeholder="Ce que le public trouvera sur la page de l'événement."
                  :disabled="!droits?.modifier"
                />
              </UFormField>
            </UCard>
          </div>

          <div class="space-y-6">
            <UCard>
              <template #header>
                <h2 class="flex items-center gap-2 font-semibold">
                  <UIcon name="i-heroicons-photo" class="text-primary" /> Affiche
                </h2>
              </template>
              <UFormField
                name="imageUrl"
                description="Affichée en tête de la page publique. JPEG, PNG ou WebP, 5 Mo au plus."
              >
                <UiImageUpload
                  v-if="droits?.modifier"
                  v-model="etat.imageUrl"
                  :endpoint="{ type: 'edition', id }"
                  :options="{
                    validation: {
                      maxSize: 5 * 1024 * 1024,
                      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
                    },
                    resetAfterUpload: false,
                  }"
                  alt="Affiche de l'événement"
                  placeholder="Choisissez l'affiche de l'événement"
                  :allow-delete="!!etat.imageUrl"
                  @uploaded="
                    (r: { imageUrl?: string }) => r.imageUrl && (etat.imageUrl = r.imageUrl)
                  "
                  @deleted="etat.imageUrl = ''"
                />
                <img
                  v-else-if="etat.imageUrl"
                  :src="etat.imageUrl"
                  alt="Affiche de l'événement"
                  class="max-h-64 rounded-lg"
                />
              </UFormField>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="flex items-center gap-2 font-semibold">
                  <UIcon name="i-heroicons-globe-europe-africa" class="text-primary" /> Page
                  publique
                </h2>
              </template>
              <div class="space-y-5">
                <!-- La page de l'événement, partageable sans compte : fermée par défaut. -->
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <p class="font-medium">Rendre la page publique</p>
                    <p class="text-sm text-muted">
                      Toute personne qui a le lien voit l'affiche, les dates, le lieu, la
                      description, les liens, et ce à quoi elle peut participer (bénévolat, appels à
                      spectacles).
                    </p>
                    <ULink
                      :to="`/events/${refEvenement}`"
                      class="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <UIcon name="i-heroicons-eye" /> Voir la page
                    </ULink>
                  </div>
                  <USwitch
                    v-model="etat.pagePublique"
                    :label="etat.pagePublique ? 'Publique' : 'Fermée'"
                    :disabled="!droits?.modifier"
                  />
                </div>

                <UFormField
                  label="E-mail de contact"
                  name="contactEmail"
                  description="Affiché sur la page publique, pour joindre l'organisation."
                  :error="erreurContact"
                >
                  <UInput
                    v-model="etat.contactEmail"
                    type="email"
                    class="w-full"
                    icon="i-heroicons-envelope"
                    placeholder="contact@mon-festival.fr"
                    :disabled="!droits?.modifier"
                  />
                </UFormField>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="flex items-center gap-2 font-semibold">
                  <UIcon name="i-heroicons-link" class="text-primary" /> Liens externes
                </h2>
              </template>
              <div class="space-y-4">
                <!-- Écrits un par un : une boucle dont la variable sert DANS le slot de UFormField
                     n'était pas vue du typage de la CI (TS2304), ni sur le composant ni sur un template. -->
                <UFormField
                  label="Site officiel"
                  name="officialWebsiteUrl"
                  :error="erreursLiens.officialWebsiteUrl"
                >
                  <UInput
                    v-model="etat.officialWebsiteUrl"
                    type="url"
                    class="w-full"
                    icon="i-heroicons-globe-alt"
                    placeholder="https://…"
                    :disabled="!droits?.modifier"
                  />
                </UFormField>
                <UFormField
                  label="Billetterie en ligne"
                  name="ticketingUrl"
                  :error="erreursLiens.ticketingUrl"
                >
                  <UInput
                    v-model="etat.ticketingUrl"
                    type="url"
                    class="w-full"
                    icon="i-heroicons-ticket"
                    placeholder="https://…"
                    :disabled="!droits?.modifier"
                  />
                </UFormField>
                <UFormField label="Facebook" name="facebookUrl" :error="erreursLiens.facebookUrl">
                  <UInput
                    v-model="etat.facebookUrl"
                    type="url"
                    class="w-full"
                    icon="i-simple-icons-facebook"
                    placeholder="https://…"
                    :disabled="!droits?.modifier"
                  />
                </UFormField>
                <UFormField
                  label="Instagram"
                  name="instagramUrl"
                  :error="erreursLiens.instagramUrl"
                >
                  <UInput
                    v-model="etat.instagramUrl"
                    type="url"
                    class="w-full"
                    icon="i-simple-icons-instagram"
                    placeholder="https://…"
                    :disabled="!droits?.modifier"
                  />
                </UFormField>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Collé au bas de l'écran, et seulement quand il y a quelque chose à enregistrer : le
             formulaire est long, l'enregistrement reste à portée. -->
        <div
          v-if="droits?.modifier && modifie"
          class="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-lg border border-default bg-default/90 px-4 py-3 backdrop-blur"
        >
          <span class="text-sm text-muted">Modifications non enregistrées</span>
          <UButton
            type="submit"
            icon="i-heroicons-check"
            label="Enregistrer"
            :loading="enregistrement"
            :disabled="!!erreurFin || !!erreurContact || Object.keys(erreursLiens).length > 0"
          />
        </div>
        <UAlert
          v-else-if="!droits?.modifier"
          color="neutral"
          variant="soft"
          icon="i-heroicons-lock-closed"
          :title="
            evenement?.archivedAt
              ? 'Lecture seule : cet événement est archivé.'
              : 'Lecture seule : vous ne pouvez pas modifier cet événement pour le moment.'
          "
        />
      </UForm>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Gestion de l'événement lui-même : ses informations. L'archivage et la suppression sont en bas de
 * l'accueil de la gestion (`EvenementZoneSensible`).
 *
 * Les dates sont montrées et saisies en HORLOGE MURALE du fuseau de l'événement
 * (`versChampLocal`) ; le serveur les ancre dans ce fuseau (PUT /api/events/:id). Changer le fuseau
 * réinterprète donc les heures affichées : 10 h reste 10 h, mais dans le nouveau fuseau.
 */
import type { AdresseTrouvee } from '~/components/evenement/RechercheAdresse.vue'
import { useEditionStore } from '~/stores/editions'

import { versChampLocal } from '#core/shared/utils/fuseau-edition'

definePageMeta({ middleware: ['subscription'] })

interface Evenement {
  id: number
  name: string
  description: string | null
  location: string | null
  startDate: string | null
  endDate: string | null
  timezone: string | null
  archivedAt: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  imageUrl: string | null
  officialWebsiteUrl: string | null
  ticketingUrl: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  pagePublique: boolean
  latitude: number | null
  longitude: number | null
  contactEmail: string | null
}
interface Droits {
  voir: boolean
  modifier: boolean
  supprimer: boolean
}

const route = useRoute()
// L'identifiant de l'adresse (public) pour l'API de l'événement, l'id numérique pour le store.
const refEvenement = String(route.params.id)
const id = useEditionId()
const editionStore = useEditionStore()

const {
  data,
  error: erreur,
  refresh,
} = await useFetch<{ event: Evenement; droits: Droits }>(`/api/events/${refEvenement}`)
const evenement = computed(() => data.value?.event)
const droits = computed(() => data.value?.droits)

const FUSEAU_PAR_DEFAUT = 'Europe/Paris'

function etatDepuis(e: Evenement | undefined) {
  const fuseau = e?.timezone || FUSEAU_PAR_DEFAUT
  return {
    name: e?.name ?? '',
    description: e?.description ?? '',
    location: e?.location ?? '',
    timezone: fuseau,
    debut: e?.startDate ? versChampLocal(e.startDate, fuseau) : '',
    fin: e?.endDate ? versChampLocal(e.endDate, fuseau) : '',
    addressLine1: e?.addressLine1 ?? '',
    addressLine2: e?.addressLine2 ?? '',
    postalCode: e?.postalCode ?? '',
    city: e?.city ?? '',
    country: e?.country ?? '',
    imageUrl: e?.imageUrl ?? '',
    officialWebsiteUrl: e?.officialWebsiteUrl ?? '',
    ticketingUrl: e?.ticketingUrl ?? '',
    facebookUrl: e?.facebookUrl ?? '',
    instagramUrl: e?.instagramUrl ?? '',
    pagePublique: !!e?.pagePublique,
    // Chaînes, comme les champs : vide = pas de coordonnée.
    latitude: e?.latitude === null || e?.latitude === undefined ? '' : String(e.latitude),
    longitude: e?.longitude === null || e?.longitude === undefined ? '' : String(e.longitude),
    contactEmail: e?.contactEmail ?? '',
  }
}

/** « 45.76 » → 45.76 ; vide → null. */
function versNombre(valeur: string | number): number | null {
  if (valeur === '' || valeur === null || valeur === undefined) return null
  const n = Number(valeur)
  return Number.isFinite(n) ? n : null
}

/** Les liens publics de l'événement (les champs du formulaire, pour leur validation). */
const CHAMPS_LIENS = [
  { cle: 'officialWebsiteUrl' },
  { cle: 'ticketingUrl' },
  { cle: 'facebookUrl' },
  { cle: 'instagramUrl' },
] as const

const etat = reactive(etatDepuis(evenement.value))
const reference = ref(JSON.stringify(etatDepuis(evenement.value)))
watch(evenement, (e) => {
  Object.assign(etat, etatDepuis(e))
  reference.value = JSON.stringify(etatDepuis(e))
})

const modifie = computed(() => JSON.stringify(etat) !== reference.value)
/** Un lien saisi doit commencer par http(s) — même règle que le serveur. */
const erreursLiens = computed(() =>
  Object.fromEntries(
    CHAMPS_LIENS.filter((l) => etat[l.cle] && !/^https?:\/\/\S+$/i.test(etat[l.cle].trim())).map(
      (l) => [l.cle, 'Le lien doit commencer par http:// ou https://']
    )
  )
)
const erreurContact = computed(() =>
  etat.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(etat.contactEmail.trim())
    ? 'Adresse e-mail invalide'
    : undefined
)
const erreurFin = computed(() =>
  etat.debut && etat.fin && etat.fin < etat.debut ? 'La fin doit suivre le début' : undefined
)

/**
 * Une adresse choisie dans la recherche remplit tous les champs du lieu, coordonnées comprises (le
 * serveur garde des coordonnées saisies plutôt que de regéocoder). Le nom du lieu n'est repris que
 * s'il est vide : il a souvent été saisi à la main, plus parlant que celui d'OpenStreetMap. Le
 * complément d'adresse (bâtiment, étage) n'est pas touché : la recherche ne le connaît pas.
 */
function remplirAdresse(a: AdresseTrouvee) {
  etat.addressLine1 = a.addressLine1
  etat.postalCode = a.postalCode
  etat.city = a.city
  etat.country = a.country
  etat.latitude = String(a.latitude)
  etat.longitude = String(a.longitude)
  if (!etat.location.trim() && a.nomDuLieu) etat.location = a.nomDuLieu
}

const { execute: enregistrer, loading: enregistrement } = useApiAction(
  `/api/events/${refEvenement}`,
  {
    method: 'PUT',
    body: () => ({
      name: etat.name,
      description: etat.description || null,
      location: etat.location || null,
      timezone: etat.timezone,
      debut: etat.debut || null,
      fin: etat.fin || null,
      addressLine1: etat.addressLine1,
      addressLine2: etat.addressLine2,
      postalCode: etat.postalCode,
      city: etat.city,
      country: etat.country,
      imageUrl: etat.imageUrl || null,
      officialWebsiteUrl: etat.officialWebsiteUrl.trim(),
      ticketingUrl: etat.ticketingUrl.trim(),
      facebookUrl: etat.facebookUrl.trim(),
      instagramUrl: etat.instagramUrl.trim(),
      pagePublique: etat.pagePublique,
      contactEmail: etat.contactEmail.trim(),
      latitude: versNombre(etat.latitude),
      longitude: versNombre(etat.longitude),
    }),
    successMessage: { title: 'Événement mis à jour' },
    errorMessages: { default: "L'événement n'a pas pu être enregistré" },
    onSuccess: async () => {
      await refresh()
      // L'en-tête et les pages bénévoles lisent l'événement dans le store : on le rafraîchit.
      await editionStore.fetchEditionById(id, { force: true }).catch(() => null)
    },
  }
)
</script>
