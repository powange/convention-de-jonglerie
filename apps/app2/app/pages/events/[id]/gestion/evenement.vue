<template>
  <div class="mx-auto max-w-3xl space-y-6">
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
      <UCard>
        <UForm :state="etat" class="space-y-5" @submit="enregistrer">
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

          <UFormField label="Description" name="description">
            <UTextarea
              v-model="etat.description"
              :rows="5"
              autoresize
              class="w-full"
              :disabled="!droits?.modifier"
            />
          </UFormField>

          <USeparator label="Lieu" />

          <UFormField label="Nom du lieu" name="location">
            <UInput
              v-model="etat.location"
              class="w-full"
              placeholder="Salle des fêtes, gymnase, parc…"
              :disabled="!droits?.modifier"
            />
          </UFormField>
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
          <div class="grid gap-4 sm:grid-cols-[10rem_1fr]">
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
          </div>
          <UFormField label="Pays" name="country">
            <UInput
              v-model="etat.country"
              class="w-full"
              placeholder="France"
              autocomplete="country-name"
              :disabled="!droits?.modifier"
            />
          </UFormField>

          <USeparator label="Page publique" />

          <!-- La page de l'événement, partageable sans compte : fermée par défaut. -->
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <p class="font-medium">Rendre la page de l'événement publique</p>
              <p class="text-sm text-muted">
                Toute personne qui a le lien voit l'affiche, les dates, le lieu, la description, les
                liens, et ce à quoi elle peut participer (bénévolat, appels à spectacles).
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
            label="Affiche"
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
              @uploaded="(r: { imageUrl?: string }) => r.imageUrl && (etat.imageUrl = r.imageUrl)"
              @deleted="etat.imageUrl = ''"
            />
            <img
              v-else-if="etat.imageUrl"
              :src="etat.imageUrl"
              alt="Affiche de l'événement"
              class="max-h-64 rounded-lg"
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <!-- La boucle sur un <template> : posée sur UFormField, la variable n'existe pas dans
                 son slot pour le typage de la CI (TS2304). -->
            <template v-for="l in CHAMPS_LIENS" :key="l.cle">
              <UFormField :label="l.libelle" :name="l.cle" :error="erreursLiens[l.cle]">
                <UInput
                  v-model="etat[l.cle]"
                  type="url"
                  class="w-full"
                  :icon="l.icone"
                  placeholder="https://…"
                  :disabled="!droits?.modifier"
                />
              </UFormField>
            </template>
          </div>

          <div v-if="droits?.modifier" class="flex justify-end">
            <UButton
              type="submit"
              icon="i-heroicons-check"
              label="Enregistrer"
              :loading="enregistrement"
              :disabled="!modifie || !!erreurFin || Object.keys(erreursLiens).length > 0"
            />
          </div>
          <UAlert
            v-else
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
      </UCard>

      <!-- Archiver : lecture seule complète, et une place libérée dans la formule du propriétaire.
           Permis même quand la gestion est en lecture seule : c'est le moyen d'en sortir. -->
      <UCard v-if="droits?.supprimer">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold">
              {{ evenement?.archivedAt ? 'Événement archivé' : "Archiver l'événement" }}
            </p>
            <p class="text-sm text-muted">
              {{
                evenement?.archivedAt
                  ? `Archivé le ${new Date(evenement.archivedAt).toLocaleDateString('fr-FR')} : tout reste consultable, rien n'est modifiable. Le désarchiver reprend une place de votre formule.`
                  : "Pour un événement passé : tout reste consultable, plus rien n'est modifiable, et il libère une place parmi les événements en cours de votre formule."
              }}
            </p>
          </div>
          <UButton
            color="neutral"
            variant="outline"
            :icon="
              evenement?.archivedAt ? 'i-heroicons-arrow-uturn-left' : 'i-heroicons-archive-box'
            "
            :label="evenement?.archivedAt ? 'Désarchiver' : 'Archiver'"
            :loading="archivage"
            class="shrink-0"
            @click="basculerArchive"
          />
        </div>
      </UCard>

      <!-- Le propriétaire seul supprime (décision de l'utilisateur). -->
      <UCard v-if="droits?.supprimer" :ui="{ root: 'ring-error/40' }">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold text-error">Supprimer l'événement</p>
            <p class="text-sm text-muted">
              Définitif : toutes ses données partent avec lui (candidatures, équipes, créneaux,
              planning, organisateurs).
            </p>
          </div>
          <UButton
            color="error"
            variant="soft"
            icon="i-heroicons-trash"
            label="Supprimer…"
            @click="fenetreSuppression = true"
          />
        </div>
      </UCard>
    </template>

    <UModal
      v-model:open="fenetreSuppression"
      title="Supprimer l'événement ?"
      :description="`« ${evenement?.name} » et toutes ses données seront effacés. Cette action est irréversible.`"
    >
      <template #body>
        <UFormField
          :label="`Pour confirmer, retapez le nom : ${evenement?.name}`"
          name="confirmation"
        >
          <UInput v-model="confirmation" class="w-full" autocomplete="off" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Annuler"
            @click="fenetreSuppression = false"
          />
          <UButton
            color="error"
            icon="i-heroicons-trash"
            label="Supprimer définitivement"
            :loading="suppression"
            :disabled="confirmation.trim() !== evenement?.name.trim()"
            @click="supprimer"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
/**
 * Gestion de l'événement lui-même : ses informations, et sa suppression.
 *
 * Les dates sont montrées et saisies en HORLOGE MURALE du fuseau de l'événement
 * (`versChampLocal`) ; le serveur les ancre dans ce fuseau (PUT /api/events/:id). Changer le fuseau
 * réinterprète donc les heures affichées : 10 h reste 10 h, mais dans le nouveau fuseau.
 */
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
  }
}

/** Les liens publics de l'événement. */
const CHAMPS_LIENS = [
  { cle: 'officialWebsiteUrl', libelle: 'Site officiel', icone: 'i-heroicons-globe-alt' },
  { cle: 'ticketingUrl', libelle: 'Billetterie en ligne', icone: 'i-heroicons-ticket' },
  { cle: 'facebookUrl', libelle: 'Facebook', icone: 'i-simple-icons-facebook' },
  { cle: 'instagramUrl', libelle: 'Instagram', icone: 'i-simple-icons-instagram' },
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
const erreurFin = computed(() =>
  etat.debut && etat.fin && etat.fin < etat.debut ? 'La fin doit suivre le début' : undefined
)

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

const { execute: basculerArchive, loading: archivage } = useApiAction(
  `/api/events/${refEvenement}/archive`,
  {
    method: 'POST',
    body: () => ({ archive: !evenement.value?.archivedAt }),
    // Lu au moment du message, AVANT le rafraîchissement : l'état d'avant dit ce qui vient d'être fait.
    successMessage: {
      get title() {
        return evenement.value?.archivedAt ? 'Événement désarchivé' : 'Événement archivé'
      },
    },
    errorMessages: { default: "L'archivage n'a pas abouti" },
    // Le bandeau de lecture seule de la gestion lit l'accès : on le relit avec l'événement.
    onSuccess: async () => {
      await Promise.all([refresh(), refreshNuxtData(`acces-gestion-${refEvenement}`)])
    },
  }
)

const fenetreSuppression = ref(false)
const confirmation = ref('')
watch(fenetreSuppression, (ouverte) => {
  if (ouverte) confirmation.value = ''
})

const { execute: supprimer, loading: suppression } = useApiAction(`/api/events/${refEvenement}`, {
  method: 'DELETE',
  body: () => ({ confirmation: confirmation.value }),
  successMessage: { title: 'Événement supprimé' },
  errorMessages: { default: "L'événement n'a pas pu être supprimé" },
  onSuccess: () => navigateTo('/dashboard'),
})
</script>
