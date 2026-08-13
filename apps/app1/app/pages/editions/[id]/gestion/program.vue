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

      <!-- Les horaires, affichés comme saisis, sont ceux de la convention : un organisateur qui
           prépare le programme depuis un autre fuseau doit le savoir avant de taper une heure.
           Sous `ClientOnly`, car la comparaison porte sur le fuseau du lecteur, que le serveur ne
           connaît pas : rendue des deux côtés, elle aurait divergé du HTML envoyé. -->
      <ClientOnly>
        <UAlert
          v-if="fuseauADire"
          icon="i-lucide-clock"
          color="neutral"
          variant="subtle"
          :title="$t('gestion.program.local_times', { fuseau: nomFuseau })"
        />
      </ClientOnly>

      <div v-for="journee in journees" :key="journee.date" class="space-y-2">
        <h2 class="font-semibold capitalize">{{ formaterJour(journee.date) }}</h2>

        <UTable :data="journee.entrees" :columns="colonnes" class="w-full">
          <template #heure-cell="{ row }">
            <span class="font-mono text-sm whitespace-nowrap">{{
              plageHoraire(row.original)
            }}</span>
          </template>

          <template #titre-cell="{ row }">
            <span class="font-medium">{{ row.original.titre }}</span>
          </template>

          <template #source-cell="{ row }">
            <UBadge :color="couleurSource(row.original.source)" variant="subtle" size="sm">
              {{ $t(`gestion.program.source.${row.original.source}`) }}
            </UBadge>
          </template>

          <template #lieu-cell="{ row }">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ row.original.lieu || '—' }}
            </span>
          </template>

          <template #visibilite-cell="{ row }">
            <!-- Les workshops n'ont aucun état de publication en base : leur interrupteur est figé
                 sur « public », et le titre explique pourquoi plutôt que de laisser une case vide. -->
            <USwitch
              :model-value="row.original.publie"
              :disabled="row.original.source === 'workshop' || visibiliteEnCours(row.original.cle)"
              :loading="visibiliteEnCours(row.original.cle)"
              :title="
                row.original.source === 'workshop'
                  ? $t('gestion.program.workshop_always_public')
                  : $t('gestion.program.field.published')
              "
              :aria-label="$t('gestion.program.field.published')"
              color="primary"
              size="sm"
              @update:model-value="(v: boolean) => basculerVisibilite(row.original, v)"
            />
          </template>

          <!-- Seuls les éléments libres s'éditent ici : workshops et spectacles gardent leur
               propre formulaire, qu'il ne s'agit pas de dupliquer. -->
          <template #actions-cell="{ row }">
            <div v-if="row.original.source === 'element'" class="flex justify-end gap-1">
              <UButton
                icon="i-heroicons-pencil-square"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="$t('common.edit')"
                @click="ouvrirEdition(row.original)"
              />
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="sm"
                :loading="chargeSuppression(row.original.cle)"
                :aria-label="$t('common.delete')"
                @click="supprimer(row.original)"
              />
            </div>
          </template>
        </UTable>
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

          <EditionLocationPicker
            v-model:location-name="formulaire.locationName"
            v-model:zone-id="formulaire.zoneId"
            v-model:marker-id="formulaire.markerId"
            :edition-id="editionId"
            :site-map-enabled="edition?.siteMapEnabled"
            :label="$t('gestion.program.field.place')"
          />

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

import {
  abreviationFuseau,
  differeDuFuseauLecteur,
  formaterHeure,
  formaterJournee,
  versChampLocal,
  versInstant,
} from '~~/shared/utils/fuseau-edition'
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
} = await useFetch<{
  data: { entrees: EntreeProgramme[]; inclutBrouillons: boolean; fuseau: string | null }
}>(() => `/api/editions/${editionId.value}/program`, {
  default: () => ({ data: { entrees: [], inclutBrouillons: false, fuseau: null } }),
})

/**
 * Fuseau de la convention. Il gouverne aussi bien l'affichage que la saisie : un organisateur qui
 * tape « 21:00 » annonce 21 h sur place, y compris s'il prépare son programme depuis un autre
 * fuseau — ce qui est le cas courant d'une équipe dispersée.
 *
 * Il vient de la frise plutôt que de l'édition du store, qui n'est chargée qu'après le montage :
 * le rendu serveur aurait sinon formaté les heures en UTC.
 */
const fuseau = computed(() => donneesFrise.value?.data?.fuseau ?? null)

const journees = computed(() =>
  grouperParJournee(donneesFrise.value?.data?.entrees ?? [], fuseau.value)
)

/** Signalé seulement si la pendule de l'organisateur dira autre chose que la frise. */
const fuseauADire = computed(
  () =>
    journees.value.length > 0 &&
    differeDuFuseauLecteur(journees.value[0]!.entrees[0]!.debut, fuseau.value)
)

const nomFuseau = computed(() =>
  journees.value.length > 0
    ? abreviationFuseau(journees.value[0]!.entrees[0]!.debut, fuseau.value, locale.value)
    : ''
)

/**
 * Réduit une colonne à la largeur de son contenu.
 *
 * `w-px` sur une table à disposition automatique : le navigateur ne peut pas descendre sous la
 * largeur du contenu, et une largeur demandée d'un pixel revient donc à demander « le minimum ».
 * `whitespace-nowrap` empêche que ce minimum soit obtenu en cassant le texte sur deux lignes.
 */
const auContenu = { class: { th: 'w-px whitespace-nowrap', td: 'w-px whitespace-nowrap' } }

/**
 * Colonnes de la frise. Les identifiants servent aussi de noms de créneaux (`#heure-cell`), d'où
 * des clés propres plutôt que les champs bruts de l'entrée.
 */
const colonnes = computed(() => [
  { accessorKey: 'debut', id: 'heure', header: t('gestion.program.column.time'), meta: auContenu },
  // Seule colonne sans contrainte : elle absorbe la largeur que les autres ne prennent pas.
  { accessorKey: 'titre', id: 'titre', header: t('gestion.program.column.title') },
  {
    accessorKey: 'source',
    id: 'source',
    header: t('gestion.program.column.source'),
    meta: auContenu,
  },
  { accessorKey: 'lieu', id: 'lieu', header: t('gestion.program.column.place'), meta: auContenu },
  {
    accessorKey: 'publie',
    id: 'visibilite',
    header: t('gestion.program.column.visibility'),
    meta: auContenu,
  },
  { id: 'actions', header: '', meta: auContenu },
])

const couleurSource = (source: EntreeProgramme['source']) =>
  source === 'workshop' ? 'info' : source === 'spectacle' ? 'primary' : 'neutral'

const formatHeure = (iso: string) => formaterHeure(iso, fuseau.value, locale.value)

const plageHoraire = (entree: EntreeProgramme) =>
  entree.fin
    ? `${formatHeure(entree.debut)} – ${formatHeure(entree.fin)}`
    : formatHeure(entree.debut)

// Sans l'année : toutes les journées d'une frise appartiennent à la même édition.
const formaterJour = (date: string) =>
  formaterJournee(date, fuseau.value, locale.value, {
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
  locationName: null as string | null,
  zoneId: null as number | null,
  markerId: null as number | null,
  isPublic: false,
})
const formulaire = ref(formulaireVide())

const titreFormulaire = computed(() =>
  elementEnCours.value ? t('gestion.program.edit_title') : t('gestion.program.add')
)

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

const ouvrirCreation = () => {
  elementEnCours.value = null
  formulaire.value = formulaireVide()
  erreurFormulaire.value = ''
  formulaireOuvert.value = true
}

const ouvrirEdition = (entree: EntreeProgramme) => {
  elementEnCours.value = entree.sourceId
  formulaire.value = {
    title: entree.titre,
    description: entree.description ?? '',
    startDateTime: versChampLocal(entree.debut, fuseau.value),
    endDateTime: entree.fin ? versChampLocal(entree.fin, fuseau.value) : '',
    // `lieu` porte le nom de la zone quand l'élément y est rattaché : on ne le recopie donc en
    // texte libre que s'il n'y a pas de rattachement, sinon on dupliquerait un nom déjà porté
    // par la carte.
    locationName: entree.zoneId || entree.markerId ? null : (entree.lieu ?? null),
    zoneId: entree.zoneId,
    markerId: entree.markerId,
    isPublic: entree.publie,
  }
  erreurFormulaire.value = ''
  formulaireOuvert.value = true
}

const corpsElement = () => {
  return {
    title: formulaire.value.title,
    description: formulaire.value.description || null,
    // Converti explicitement dans le fuseau de la convention : `datetime-local` ne porte aucun
    // fuseau, et le laisser interpréter donnerait celui du serveur — UTC — ou celui du navigateur,
    // dont aucun ne dit à quelle heure le public se présentera.
    startDateTime: versInstant(formulaire.value.startDateTime, fuseau.value),
    endDateTime: formulaire.value.endDateTime
      ? versInstant(formulaire.value.endDateTime, fuseau.value)
      : null,
    locationName: formulaire.value.locationName || null,
    zoneId: formulaire.value.zoneId,
    markerId: formulaire.value.markerId,
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
