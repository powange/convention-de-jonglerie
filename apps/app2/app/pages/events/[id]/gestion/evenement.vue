<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <ManagementPageHeader
      titre="Informations de l'événement"
      description="Le nom, le lieu et les dates que voient les bénévoles."
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

          <UFormField label="Lieu" name="location">
            <UInput
              v-model="etat.location"
              class="w-full"
              placeholder="Ville, salle, adresse…"
              :disabled="!droits?.modifier"
            />
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

          <div v-if="droits?.modifier" class="flex justify-end">
            <UButton
              type="submit"
              icon="i-heroicons-check"
              label="Enregistrer"
              :loading="enregistrement"
              :disabled="!modifie || !!erreurFin"
            />
          </div>
          <UAlert
            v-else
            color="neutral"
            variant="soft"
            icon="i-heroicons-lock-closed"
            title="Lecture seule : vous n'avez pas le droit de modifier cet événement."
          />
        </UForm>
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
  }
}

const etat = reactive(etatDepuis(evenement.value))
const reference = ref(JSON.stringify(etatDepuis(evenement.value)))
watch(evenement, (e) => {
  Object.assign(etat, etatDepuis(e))
  reference.value = JSON.stringify(etatDepuis(e))
})

const modifie = computed(() => JSON.stringify(etat) !== reference.value)
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
