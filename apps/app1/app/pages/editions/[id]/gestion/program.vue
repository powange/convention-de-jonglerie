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
      <UiAccesRefuse />
    </div>

    <div v-else class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ManagementPageHeader
            :titre="$t('edition.program')"
            :description="$t('gestion.program.description')"
          />
        </div>
        <UButton icon="i-heroicons-plus" color="primary" @click="ouvrirCreation">
          {{ $t('gestion.program.add') }}
        </UButton>
      </div>

      <!-- Visibilité publique de la frise. Elle vit ici, sur la page où l'on compose le
           programme, plutôt que dans Fonctionnalités : c'est en le relisant qu'on décide qu'il
           est prêt à être montré. L'activation du module, elle, reste dans Fonctionnalités. -->
      <UCard v-if="canEdit">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon
                :name="pagePubliqueLocale ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'"
                :class="pagePubliqueLocale ? 'text-success-500' : 'text-gray-400'"
              />
              {{ $t('gestion.program.page_public') }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ $t('gestion.program.page_public_help') }}
            </p>
          </div>
          <USwitch
            v-model="pagePubliqueLocale"
            color="primary"
            :loading="enregistrementVisibilite"
            :disabled="enregistrementVisibilite"
            @update:model-value="basculerVisibilitePublique"
          />
        </div>
      </UCard>

      <!-- Workshops et spectacles apparaissent ici mais se modifient dans leur propre module :
           dupliquer leur formulaire ferait diverger deux sources de vérité. -->
      <UAlert
        icon="i-heroicons-information-circle"
        color="info"
        variant="soft"
        :description="$t('gestion.program.sources_hint')"
      />

      <!-- Seulement au premier chargement, quand il n'y a encore rien à montrer. Chaque écriture
           recharge la frise, et ce spinner escamotait alors toute la liste pour la remettre aussitôt :
           la page sautait sous le curseur au moment même où l'on visait un interrupteur. Une frise
           déjà affichée reste donc en place, chaque ligne signalant elle-même son travail en cours. -->
      <div
        v-if="chargementFrise && journees.length === 0"
        class="flex items-center justify-center py-12"
      >
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

      <!-- Choisir ses colonnes, puis les emporter. Un seul menu pour toutes les journées : elles
           partagent le même jeu de colonnes, et en régler une à la fois serait absurde. -->
      <div v-if="journees.length" class="flex flex-wrap items-center justify-end gap-2">
        <UiColumnsMenu
          size="xs"
          variant="ghost"
          :table-api="tableaux[0]?.tableApi"
          :libelle="libelleDeColonne"
        />
        <UiExportMenu size="xs" :on-csv="exporterCsv" :on-pdf="exporterPdf" />
      </div>

      <div v-for="(journee, index) in journees" :key="journee.date" class="space-y-2">
        <h2 class="font-semibold capitalize">{{ formaterJour(journee.date) }}</h2>

        <UTable
          :ref="(el: any) => el && (tableaux[index] = el)"
          v-model:column-visibility="colonnesVisibles"
          :data="journee.entrees"
          :columns="colonnes"
          class="w-full"
        >
          <template #heure-cell="{ row }">
            <span class="font-mono text-sm whitespace-nowrap">{{
              plageHoraire(row.original)
            }}</span>
          </template>

          <template #titre-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ row.original.titre }}</span>
              <!-- Un avertissement et non une erreur : deux moments au même endroit sont parfois
                   voulus. L'infobulle nomme les entrées en cause, sans quoi la pastille dirait
                   qu'il y a un problème sans dire lequel. -->
              <UTooltip
                v-if="chevauchements.has(row.original.cle)"
                :text="titresEnConflit(row.original)"
              >
                <UBadge
                  color="warning"
                  variant="subtle"
                  size="sm"
                  icon="i-heroicons-exclamation-triangle"
                >
                  {{ $t('gestion.program.overlap') }}
                </UBadge>
              </UTooltip>
            </div>
          </template>

          <template #source-cell="{ row }">
            <UBadge :color="couleurSource(row.original.source)" variant="subtle" size="sm">
              {{ $t(`gestion.program.source.${row.original.source}`) }}
            </UBadge>
          </template>

          <!-- Modifiable sur place : changer une salle est le geste le plus courant de la
               composition d'un programme, et passer par la modale complète pour cela rouvrait
               titre, description et horaires. -->
          <template #lieu-cell="{ row }">
            <ProgramLieuCell
              :entree="row.original"
              :edition-id="editionId"
              :site-map-enabled="edition?.siteMapEnabled"
              @enregistre="rechargerFrise"
            />
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
              <!-- Convertir : un créneau se saisit vite, puis mérite parfois sa fiche complète
                   — artistes pour un spectacle, places pour un workshop. -->
              <UButton
                v-if="conversionsPossibles.length > 0"
                icon="i-lucide-shuffle"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="$t('gestion.program.convert')"
                :title="$t('gestion.program.convert')"
                @click="ouvrirConversion(row.original)"
              />
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

    <UModal v-model:open="conversionOuverte" :title="$t('gestion.program.convert')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('gestion.program.convert_intro', { title: elementAConvertir?.titre ?? '' }) }}
          </p>

          <UFormField :label="$t('gestion.program.convert_target')">
            <URadioGroup v-model="cibleConversion" :items="conversionsPossibles" />
          </UFormField>

          <!-- Un workshop accepte de n'avoir pas d'heure de fin, comme l'élément dont il est
               issu : le champ est proposé pour qui veut en poser une, jamais exigé. -->
          <UFormField
            v-if="finConversionProposee"
            :label="$t('gestion.program.field.end_optional')"
          >
            <UiDateTimePicker
              v-model="finConversion"
              :date-label="$t('gestion.program.field.end_optional')"
              :time-label="$t('gestion.program.field.end_time')"
              :min-date="premierJour"
              :max-date="dernierJour"
            />
          </UFormField>

          <UAlert
            v-if="cibleConversion === 'workshop' && elementAConvertir && !elementAConvertir.publie"
            icon="i-lucide-alert-triangle"
            color="warning"
            variant="soft"
            :title="$t('gestion.program.convert_public_warning')"
          />

          <UAlert
            v-if="erreurConversion"
            icon="i-lucide-alert-triangle"
            color="error"
            variant="soft"
            :title="erreurConversion"
          />

          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="conversionOuverte = false">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton color="primary" :loading="conversionEnCours" @click="convertir">
              {{ $t('gestion.program.convert') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

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
            <!-- Effaçable : la fin est facultative, et une heure saisie par erreur doit pouvoir
                 être retirée plutôt que de rester annoncée au public. -->
            <UiDateTimePicker
              v-model="formulaire.endDateTime"
              :date-label="$t('gestion.program.field.end_optional')"
              :time-label="$t('gestion.program.field.end_time')"
              :min-date="premierJour"
              :max-date="dernierJour"
              clearable
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

    <!-- Une seule modale pour les confirmations de l'écran. `confirm()` bloquait la page, ne
         suivait pas la langue choisie et ne disait jamais sur quoi portait l'action. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
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
import {
  detecterChevauchements,
  grouperParJournee,
  type EntreeProgramme,
} from '~~/shared/utils/program-timeline'

const { succes } = useNotificateur()

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
 * Copie locale de la visibilité publique.
 *
 * L'interrupteur doit répondre au doigt, sans attendre le serveur ; en cas d'échec on le remet
 * comme il était, plutôt que de laisser l'écran affirmer une publication qui n'a pas eu lieu.
 */
const pagePubliqueLocale = ref(false)

watch(
  () => edition.value?.programPagePublic,
  (valeur) => {
    pagePubliqueLocale.value = valeur === true
  },
  { immediate: true }
)

const { execute: executerBasculeVisibilite, loading: enregistrementVisibilite } = useApiAction(
  () => `/api/editions/${editionId.value}`,
  {
    method: 'PUT',
    body: () => ({ programPagePublic: pagePubliqueLocale.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      // Le store porte l'édition consultée par l'en-tête : sans cette mise à jour, l'onglet
      // public resterait dans son état précédent jusqu'au prochain chargement.
      if (edition.value) {
        editionStore.setEdition({ ...edition.value, programPagePublic: pagePubliqueLocale.value })
      }
    },
    // L'interrupteur est déjà basculé à l'écran : un échec doit le remettre.
    onError: () => {
      pagePubliqueLocale.value = !pagePubliqueLocale.value
    },
  }
)

const basculerVisibilitePublique = () => executerBasculeVisibilite()

/**
 * Fuseau de la convention. Il gouverne aussi bien l'affichage que la saisie : un organisateur qui
 * tape « 21:00 » annonce 21 h sur place, y compris s'il prépare son programme depuis un autre
 * fuseau — ce qui est le cas courant d'une équipe dispersée.
 *
 * Il vient de la frise plutôt que de l'édition du store, qui n'est chargée qu'après le montage :
 * le rendu serveur aurait sinon formaté les heures en UTC.
 */
const fuseau = computed(() => donneesFrise.value?.data?.fuseau ?? null)

/*
 * ⚠️ PAS DE TRI SUR CET ÉCRAN, ET C'EST UN REFUS RAISONNÉ — pas un oubli.
 *
 * Le programme est une FRISE : son ordre chronologique est l'information. L'ordonner par titre ou
 * par lieu détruirait la seule lecture qui serve — « qu'est-ce qui se passe après ? » — et les
 * tableaux étant déjà découpés par journée, il n'y aurait même pas de tri global à offrir.
 *
 * Les deux autres fonctions, en revanche, ont leur sens ici : masquer une colonne pour lire une
 * frise dense, et emporter le programme entier dans un fichier.
 */
const tableaux = ref<{ tableApi?: unknown }[]>([])

const COLONNES_MASQUABLES = ['heure', 'titre', 'source', 'lieu', 'visibilite']
const { visibilite: colonnesVisibles } = useColonnesDansUrl(COLONNES_MASQUABLES)

const libelleDeColonne = (id: string) =>
  ({
    heure: t('gestion.program.column.time'),
    titre: t('gestion.program.column.title'),
    source: t('gestion.program.column.source'),
    lieu: t('gestion.program.column.place'),
    visibilite: t('gestion.program.column.visibility'),
  })[id] ?? id

/**
 * Ce que l'export emporte.
 *
 * ⚠️ Une colonne de plus que le tableau : la DATE. À l'écran, elle est portée par le titre de
 * chaque journée ; dans un fichier à plat, une heure sans son jour ne désigne rien.
 */
function colonnesExportables(): ColonneExportable<EntreeProgramme>[] {
  return [
    { id: 'heure', entete: t('gestion.program.column.time'), valeur: (e) => plageHoraire(e) },
    { id: 'titre', entete: t('gestion.program.column.title'), valeur: (e) => e.titre },
    {
      id: 'source',
      entete: t('gestion.program.column.source'),
      valeur: (e) => t(`gestion.program.source.${e.source}`),
    },
    {
      id: 'lieu',
      entete: t('gestion.program.column.place'),
      valeur: (e) => e.zone?.nom ?? e.repere?.nom ?? e.lieuTexte ?? '',
    },
    {
      id: 'visibilite',
      entete: t('gestion.program.column.visibility'),
      valeur: (e) => (e.publie ? t('common.visible') : t('common.hidden')),
    },
  ]
}

/** Toutes les journées à la suite, chacune précédée de sa date. */
function lignesDuProgramme() {
  const { entetes, lignes } = tableauAExporter(
    colonnesExportables(),
    colonnesVisibles.value,
    journees.value.flatMap((j) => j.entrees)
  )
  const dates = journees.value.flatMap((j) => j.entrees.map(() => formaterJour(j.date)))
  return {
    entetes: [t('gestion.program.column.day'), ...entetes],
    lignes: lignes.map((ligne, i) => [dates[i] ?? '', ...ligne]),
  }
}

const nomDuFichier = computed(() => `programme-edition-${editionId.value}`)

function exporterCsv() {
  const { entetes, lignes } = lignesDuProgramme()
  telechargerFichier(
    `${nomDuFichier.value}.csv`,
    versCsv(entetes, lignes),
    'text/csv;charset=utf-8'
  )
  succes(t('common.export_success'))
}

async function exporterPdf() {
  const { entetes, lignes } = lignesDuProgramme()
  await exporterTableauEnPdf({
    nomFichier: nomDuFichier.value,
    // `edition.program` : le MÊME libellé que la barre latérale, plutôt qu'une clé neuve.
    titre: t('edition.program'),
    entetes,
    lignes,
  })
  succes(t('common.export_success'))
}

const journees = computed(() =>
  grouperParJournee(donneesFrise.value?.data?.entrees ?? [], fuseau.value)
)

/**
 * Les entrées qui se disputent le même lieu de la carte au même moment.
 *
 * ⚠️ CALCULÉ SUR LA FRISE ENTIÈRE, et non journée par journée : un moment peut déborder sur le
 * lendemain — une scène ouverte annoncée à 23 h, par exemple —, et un calcul par journée ne verrait
 * pas le chevauchement avec ce qui suit minuit.
 *
 * 📍 C'est un SIGNAL, pas une règle : rien n'est bloqué à l'enregistrement. Deux moments au même
 * endroit sont parfois voulus — un atelier d'initiation pendant qu'une scène ouverte continue à
 * côté dans la même grande zone. Refuser la saisie obligerait à contourner l'outil.
 */
const chevauchements = computed(() =>
  detecterChevauchements(donneesFrise.value?.data?.entrees ?? [])
)

/** Les titres des entrées en conflit avec celle-ci, pour l'infobulle de la pastille. */
function titresEnConflit(entree: EntreeProgramme): string {
  const cles = chevauchements.value.get(entree.cle)
  if (!cles?.length) return ''
  const parCle = new Map((donneesFrise.value?.data?.entrees ?? []).map((e) => [e.cle, e]))
  return cles
    .map((cle) => {
      const autre = parCle.get(cle)
      if (!autre) return cle
      // L'heure autant que le titre : « Cabaret » seul ne dit pas en quoi il gêne, alors que
      // « Cabaret (20:00) » se recoupe visiblement avec la ligne qu'on regarde.
      return `${autre.titre} (${plageHoraire(autre)})`
    })
    .join(' · ')
}

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

/**
 * Conversion d'un élément vers un module qui en dit davantage.
 *
 * Le serveur crée et supprime dans une même transaction : ou les deux aboutissent, ou rien ne
 * change. L'écran n'a donc qu'à rassembler ce que l'élément ne porte pas — l'heure de fin qu'un
 * workshop exige — et à prévenir de ce qu'il ne pourra pas défaire.
 */
const conversionOuverte = ref(false)
const elementAConvertir = ref<EntreeProgramme | null>(null)
const cibleConversion = ref<'spectacle' | 'workshop'>('spectacle')
const finConversion = ref('')
const erreurConversion = ref('')

/** On ne propose que les modules activés : convertir ailleurs créerait une fiche inatteignable. */
const conversionsPossibles = computed(() => {
  const options: { label: string; value: 'spectacle' | 'workshop' }[] = []
  if (edition.value?.artistsEnabled)
    options.push({ label: t('gestion.program.source.spectacle'), value: 'spectacle' })
  if (edition.value?.workshopsEnabled)
    options.push({ label: t('gestion.program.source.workshop'), value: 'workshop' })
  return options
})

/** Proposée, non exigée : l'occasion de poser une fin au passage, si on en connaît une. */
const finConversionProposee = computed(
  () => cibleConversion.value === 'workshop' && !elementAConvertir.value?.fin
)

const ouvrirConversion = (entree: EntreeProgramme) => {
  elementAConvertir.value = entree
  cibleConversion.value = conversionsPossibles.value[0]?.value ?? 'spectacle'
  finConversion.value = entree.fin ? versChampLocal(entree.fin, fuseau.value) : ''
  erreurConversion.value = ''
  conversionOuverte.value = true
}

const { execute: executerConversion, isLoading: chargeConversion } = useApiActionById(
  (cle) => `/api/editions/${editionId.value}/program-items/${String(cle).split('-')[1]}/convert`,
  {
    method: 'POST',
    body: () => ({
      cible: cibleConversion.value,
      // Ancrée au fuseau de l'édition, comme le formulaire principal : « 23:00 » désigne
      // 23 h sur place. `parseDateTimeLocal` la lisait dans le fuseau du NAVIGATEUR, si bien
      // qu'une conversion faite en déplacement décalait l'heure de fin.
      endDateTime: versInstant(finConversion.value, fuseau.value) || null,
    }),
    successMessage: { title: t('gestion.program.converted') },
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      conversionOuverte.value = false
      await rechargerFrise()
    },
    onError: (e: any) => {
      erreurConversion.value = e?.data?.message || e?.message || t('common.error')
    },
  }
)

const conversionEnCours = computed(() =>
  elementAConvertir.value ? chargeConversion(elementAConvertir.value.cle) : false
)

const convertir = async () => {
  erreurConversion.value = ''
  if (elementAConvertir.value) await executerConversion(elementAConvertir.value.cle)
}

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
    locationName: entree.lieuTexte,
    zoneId: entree.zone?.id ?? null,
    markerId: entree.repere?.id ?? null,
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
  useApiActionById(
    // La clé porte l'identifiant de la représentation : elle seule est publiée ou non.
    (cle) => `/api/editions/${editionId.value}/shows/performances/${String(cle).split('-')[1]}`,
    {
      method: 'PATCH',
      body: () => ({ isPublic: visibiliteDemandee.value }),
      silentSuccess: true,
      errorMessages: { default: t('common.error') },
      onSuccess: () => rechargerFrise(),
      onError: () => rechargerFrise(),
    }
  )

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

const confirmation = useConfirmation()

const supprimer = (entree: EntreeProgramme) => {
  confirmation.demanderConfirmation({
    titre: t('common.delete'),
    description: t('gestion.program.confirm_delete', { title: entree.titre }),
    libelleConfirmer: t('common.delete'),
    agir: () => executerSuppression(entree.cle),
  })
}

onMounted(async () => {
  if (!edition.value) await editionStore.fetchEditionById(editionId.value)
  initialLoading.value = false
})
</script>
