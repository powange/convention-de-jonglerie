<template>
  <div>
    <div v-if="initialLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <div v-else-if="!canEdit">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>

    <div v-else class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold">{{ $t('edition.program') }}</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('gestion.program.description') }}
          </p>
        </div>
        <UButton icon="i-heroicons-plus" color="primary" @click="ouvrirCreation">
          {{ $t('gestion.program.add') }}
        </UButton>
      </div>

      <!-- Workshops et spectacles apparaissent ici mais se modifient dans leur propre module :
           dupliquer leur formulaire ferait diverger deux sources de vérité. -->
      <UAlert
        icon="i-heroicons-information-circle"
        color="info"
        variant="soft"
        :description="$t('gestion.program.sources_hint')"
      />

      <div v-if="chargementFrise" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
      </div>

      <UAlert
        v-else-if="journees.length === 0"
        icon="i-heroicons-calendar-days"
        color="neutral"
        variant="soft"
        :title="$t('gestion.program.empty')"
      />

      <div v-for="journee in journees" v-else :key="journee.date" class="space-y-2">
        <h2 class="font-semibold capitalize">{{ formaterJour(journee.date) }}</h2>

        <UCard v-for="entree in journee.entrees" :key="entree.cle" :ui="{ body: 'p-3 sm:p-4' }">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ entree.titre }}</span>
                <UBadge :color="couleurSource(entree.source)" variant="subtle" size="sm">
                  {{ $t(`gestion.program.source.${entree.source}`) }}
                </UBadge>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ plageHoraire(entree) }}
                <template v-if="entree.lieu"> — {{ entree.lieu }}</template>
              </p>
            </div>

            <!-- Seuls les éléments libres s'éditent ici. -->
            <div v-if="entree.source === 'element'" class="flex shrink-0 gap-1">
              <UButton
                icon="i-heroicons-pencil-square"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="$t('common.edit')"
                @click="ouvrirEdition(entree)"
              />
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="sm"
                :loading="chargeSuppression(entree.cle)"
                :aria-label="$t('common.delete')"
                @click="supprimer(entree)"
              />
            </div>

            <!-- L'interrupteur remplace une étiquette « brouillon » : il dit l'état ET permet d'en
                 changer, sans quitter la frise. Placé après les actions, il ferme la ligne sur ce
                 qu'on montre au public. Les workshops n'ont aucun état de publication en base ;
                 leur interrupteur est donc figé sur « public », et le titre explique pourquoi
                 plutôt que de laisser un trou dans la colonne. -->
            <USwitch
              :model-value="entree.publie"
              :disabled="entree.source === 'workshop' || visibiliteEnCours(entree.cle)"
              :loading="visibiliteEnCours(entree.cle)"
              :title="
                entree.source === 'workshop'
                  ? $t('gestion.program.workshop_always_public')
                  : $t('gestion.program.field.published')
              "
              :aria-label="$t('gestion.program.field.published')"
              color="primary"
              size="sm"
              class="shrink-0"
              @update:model-value="(v: boolean) => basculerVisibilite(entree, v)"
            />
          </div>
        </UCard>
      </div>
    </div>

    <UModal v-model:open="formulaireOuvert" :title="titreFormulaire">
      <template #body>
        <UForm :state="formulaire" class="space-y-4" @submit="enregistrer">
          <UFormField :label="$t('gestion.program.field.title')" required>
            <UInput v-model="formulaire.title" class="w-full" maxlength="200" />
          </UFormField>

          <UFormField :label="$t('gestion.program.field.description')">
            <UTextarea v-model="formulaire.description" class="w-full" :rows="3" />
          </UFormField>

          <!-- Même sélecteur que le formulaire de spectacle, borné aux journées de l'édition :
               un créneau hors de ces dates n'aurait aucun sens dans la frise. -->
          <div class="space-y-4">
            <UiDateTimePicker
              v-model="formulaire.startDateTime"
              :date-label="$t('gestion.program.field.start')"
              :time-label="$t('gestion.program.field.start_time')"
              :min-date="premierJour"
              :max-date="dernierJour"
              required
            />
            <UiDateTimePicker
              v-model="formulaire.endDateTime"
              :date-label="$t('gestion.program.field.end_optional')"
              :time-label="$t('gestion.program.field.end_time')"
              :min-date="premierJour"
              :max-date="dernierJour"
            />
          </div>

          <!-- Repris du formulaire de spectacle : un choix entre la carte du site et du texte
               libre, plutôt que deux champs qu'on pourrait remplir en même temps. -->
          <UFormField :label="$t('gestion.program.field.place')">
            <div class="space-y-2">
              <URadioGroup
                v-if="edition?.siteMapEnabled"
                v-model="typeDeLieu"
                orientation="horizontal"
                :items="optionsTypeDeLieu"
              />

              <USelect
                v-if="edition?.siteMapEnabled && typeDeLieu === 'carte'"
                v-model="lieuChoisi"
                :items="lieuxDisponibles"
                :placeholder="$t('gestion.program.field.select_place')"
                class="w-full"
              />

              <UInput
                v-else
                v-model="formulaire.locationName"
                :placeholder="$t('gestion.program.field.location_placeholder')"
                class="w-full"
                maxlength="150"
              />
            </div>
          </UFormField>

          <USwitch
            v-model="formulaire.isPublic"
            :label="$t('gestion.program.field.published')"
            color="primary"
          />

          <UAlert
            v-if="erreurFormulaire"
            icon="i-lucide-alert-triangle"
            color="error"
            variant="soft"
            :title="erreurFormulaire"
          />

          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="formulaireOuvert = false">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" :loading="enregistrement">
              {{ $t('common.save') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useEditionStore } from '~/stores/editions'
import { parseDateTimeLocal } from '~/utils/date'

import { grouperParJournee, type EntreeProgramme } from '~~/shared/utils/program-timeline'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t, locale } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))
const initialLoading = ref(true)

const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

/**
 * La frise vient du même point d'API que la page publique : un organisateur y voit en plus ses
 * brouillons. Une lecture dédiée à la gestion aurait divergé de l'affichage public à la première
 * évolution — et c'est précisément la divergence qu'on veut éviter sur un programme.
 */
const {
  data: donneesFrise,
  pending: chargementFrise,
  refresh: rechargerFrise,
} = await useFetch<{ data: { entrees: EntreeProgramme[]; inclutBrouillons: boolean } }>(
  () => `/api/editions/${editionId.value}/program`,
  { default: () => ({ data: { entrees: [], inclutBrouillons: false } }) }
)

const journees = computed(() => grouperParJournee(donneesFrise.value?.data?.entrees ?? []))

// Zones et repères, pour rattacher un élément à la carte du site.
const { data: donneesZones } = await useFetch<{ data: { zones: { id: number; name: string }[] } }>(
  () => `/api/editions/${editionId.value}/zones`,
  { default: () => ({ data: { zones: [] } }) }
)
const { data: donneesReperes } = await useFetch<{
  data: { markers: { id: number; name: string }[] }
}>(() => `/api/editions/${editionId.value}/markers`, {
  default: () => ({ data: { markers: [] } }),
})

/**
 * Bornes du sélecteur : les dates de l'édition, telles quelles.
 *
 * Volontairement identiques à celles du formulaire des workshops, y compris dans leur simplicité :
 * un même geste doit donner le même calendrier d'une page à l'autre.
 */
const premierJour = computed(() =>
  edition.value?.startDate ? new Date(edition.value.startDate) : undefined
)
const dernierJour = computed(() =>
  edition.value?.endDate ? new Date(edition.value.endDate) : undefined
)

/** Carte du site ou texte libre : les deux champs ne se remplissent pas en même temps. */
const typeDeLieu = ref<'carte' | 'texte'>('texte')
const optionsTypeDeLieu = computed(() => [
  { label: t('gestion.program.field.place_map'), value: 'carte' },
  { label: t('gestion.program.field.place_free'), value: 'texte' },
])

const lieuxDisponibles = computed(() => [
  ...(donneesZones.value?.data?.zones ?? []).map((z) => ({
    label: z.name,
    value: `zone:${z.id}`,
  })),
  ...(donneesReperes.value?.data?.markers ?? []).map((m) => ({
    label: m.name,
    value: `marker:${m.id}`,
  })),
])

const couleurSource = (source: EntreeProgramme['source']) =>
  source === 'workshop' ? 'info' : source === 'spectacle' ? 'primary' : 'neutral'

const formatHeure = (iso: string) =>
  new Date(iso).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })

const plageHoraire = (entree: EntreeProgramme) =>
  entree.fin
    ? `${formatHeure(entree.debut)} – ${formatHeure(entree.fin)}`
    : formatHeure(entree.debut)

const formaterJour = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

// ---- Formulaire ----

const formulaireOuvert = ref(false)
const elementEnCours = ref<number | null>(null)
const erreurFormulaire = ref('')

const formulaireVide = () => ({
  title: '',
  description: '',
  startDateTime: '',
  endDateTime: '',
  locationName: '',
  isPublic: false,
})
const formulaire = ref(formulaireVide())

/**
 * Zone et repère tiennent dans un seul choix : l'API refuse les deux à la fois, et deux listes
 * séparées laisseraient composer une saisie que le serveur rejette.
 */
const lieuChoisi = ref('')

const titreFormulaire = computed(() =>
  elementEnCours.value ? t('gestion.program.edit_title') : t('gestion.program.add')
)

/** Les champs `datetime-local` attendent l'heure locale, pas l'ISO en temps universel. */
const versChampLocal = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`
}

const ouvrirCreation = () => {
  elementEnCours.value = null
  formulaire.value = formulaireVide()
  lieuChoisi.value = ''
  typeDeLieu.value = 'texte'
  erreurFormulaire.value = ''
  formulaireOuvert.value = true
}

const ouvrirEdition = (entree: EntreeProgramme) => {
  elementEnCours.value = entree.sourceId
  formulaire.value = {
    title: entree.titre,
    description: entree.description ?? '',
    startDateTime: versChampLocal(entree.debut),
    endDateTime: entree.fin ? versChampLocal(entree.fin) : '',
    locationName: entree.lieu ?? '',
    isPublic: entree.publie,
  }
  lieuChoisi.value = entree.zoneId
    ? `zone:${entree.zoneId}`
    : entree.markerId
      ? `marker:${entree.markerId}`
      : ''
  typeDeLieu.value = lieuChoisi.value ? 'carte' : 'texte'
  erreurFormulaire.value = ''
  formulaireOuvert.value = true
}

const corpsElement = () => {
  const surLaCarte = typeDeLieu.value === 'carte' && !!lieuChoisi.value
  const [genre, id] = surLaCarte ? lieuChoisi.value.split(':') : []
  return {
    title: formulaire.value.title,
    description: formulaire.value.description || null,
    // Converti explicitement : `datetime-local` est une heure locale, et laisser le serveur
    // l'interpréter le ferait dépendre de SON fuseau, pas de celui du navigateur.
    startDateTime: parseDateTimeLocal(formulaire.value.startDateTime).toISOString(),
    endDateTime: formulaire.value.endDateTime
      ? parseDateTimeLocal(formulaire.value.endDateTime).toISOString()
      : null,
    locationName: surLaCarte ? null : formulaire.value.locationName || null,
    zoneId: genre === 'zone' ? Number(id) : null,
    markerId: genre === 'marker' ? Number(id) : null,
    isPublic: formulaire.value.isPublic,
  }
}

/**
 * Recharge la frise après écriture. La fermeture de la modale, elle, est décidée dans
 * `enregistrer` d'après la valeur rendue : suspendre le sort de la fenêtre à un rappel l'avait déjà
 * laissée ouverte après une création pourtant réussie.
 */
const apresEnregistrement = async () => {
  await rechargerFrise()
}

const { execute: creer, loading: creation } = useApiAction(
  () => `/api/editions/${editionId.value}/program-items`,
  {
    method: 'POST',
    body: () => corpsElement(),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: apresEnregistrement,
    onError: (e: any) => {
      erreurFormulaire.value = e?.data?.message || e?.message || t('common.error')
    },
  }
)

const { execute: modifier, loading: modification } = useApiActionById(
  (id) => `/api/editions/${editionId.value}/program-items/${id}`,
  {
    method: 'PUT',
    body: () => corpsElement(),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: apresEnregistrement,
    onError: (e: any) => {
      erreurFormulaire.value = e?.data?.message || e?.message || t('common.error')
    },
  }
)

const enregistrement = computed(() => creation.value || modification.value)

const enregistrer = async () => {
  erreurFormulaire.value = ''
  // Contrôle côté client pour éviter un aller-retour évident ; le serveur revérifie de toute façon.
  // Une fin absente est valide : tous les moments d'un programme n'en annoncent pas.
  if (
    formulaire.value.endDateTime &&
    formulaire.value.endDateTime <= formulaire.value.startDateTime
  ) {
    erreurFormulaire.value = t('gestion.program.error_end_before_start')
    return
  }
  const resultat = elementEnCours.value ? await modifier(elementEnCours.value) : await creer()
  // `execute` rend `null` en cas d'échec : on ne referme que sur un vrai succès, pour laisser
  // le message d'erreur sous les yeux.
  if (resultat) formulaireOuvert.value = false
}

/**
 * Bascule de visibilité, depuis la frise.
 *
 * Deux points d'API distincts car les deux sources n'ont ni la même table ni les mêmes règles :
 * le spectacle accepte une mise à jour partielle, l'élément libre passe par un point dédié — son
 * `PUT` attend l'objet complet pour pouvoir vérifier que la fin suit le début.
 *
 * La clé de frise (`spectacle-11`) sert d'identifiant de chargement plutôt que l'identifiant
 * numérique : celui-ci se répète d'une source à l'autre, et deux lignes tourneraient ensemble.
 */
const { execute: executerVisibiliteSpectacle, isLoading: chargeVisibiliteSpectacle } =
  useApiActionById((cle) => `/api/editions/${editionId.value}/shows/${String(cle).split('-')[1]}`, {
    method: 'PUT',
    body: () => ({ isPublic: visibiliteDemandee.value }),
    silentSuccess: true,
    errorMessages: { default: t('common.error') },
    onSuccess: () => rechargerFrise(),
    onError: () => rechargerFrise(),
  })

const { execute: executerVisibiliteElement, isLoading: chargeVisibiliteElement } = useApiActionById(
  (cle) => `/api/editions/${editionId.value}/program-items/${String(cle).split('-')[1]}/visibility`,
  {
    method: 'PATCH',
    body: () => ({ isPublic: visibiliteDemandee.value }),
    silentSuccess: true,
    errorMessages: { default: t('common.error') },
    onSuccess: () => rechargerFrise(),
    // Recharger même en échec : l'interrupteur doit refléter la base, pas le clic.
    onError: () => rechargerFrise(),
  }
)

const visibiliteDemandee = ref(false)

/** Vrai pendant la bascule de cette ligne, d'où que vienne l'entrée. */
const visibiliteEnCours = (cle: string) =>
  chargeVisibiliteSpectacle(cle) || chargeVisibiliteElement(cle)

const basculerVisibilite = async (entree: EntreeProgramme, valeur: boolean) => {
  if (entree.source === 'workshop') return
  visibiliteDemandee.value = valeur
  if (entree.source === 'spectacle') await executerVisibiliteSpectacle(entree.cle)
  else await executerVisibiliteElement(entree.cle)
}

const { execute: executerSuppression, isLoading: chargeSuppression } = useApiActionById(
  (cle) => `/api/editions/${editionId.value}/program-items/${String(cle).split('-')[1]}`,
  {
    method: 'DELETE',
    successMessage: { title: t('common.deleted') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => rechargerFrise(),
  }
)

const supprimer = async (entree: EntreeProgramme) => {
  if (!confirm(t('gestion.program.confirm_delete', { title: entree.titre }))) return
  await executerSuppression(entree.cle)
}

onMounted(async () => {
  if (!edition.value) await editionStore.fetchEditionById(editionId.value)
  initialLoading.value = false
})
</script>
