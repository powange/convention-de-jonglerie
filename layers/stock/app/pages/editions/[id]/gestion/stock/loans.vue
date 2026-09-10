<!--
  Le tableau de bord des emprunts.

  Le matériel prêté par des tiers est ce qui coûte le plus cher quand on l'oublie, et c'était
  jusqu'ici l'information la plus dispersée du module : il fallait ouvrir le bon groupe pour
  s'apercevoir qu'un emprunt était en retard. Cette page traverse les groupes et ne montre que les
  emprunts en cours, du plus pressant au moins pressant.

  Ce qu'elle ne fait pas : modifier. Chaque ligne renvoie à la fiche de l'objet, où les gestes
  existent déjà. Les dédoubler ici en ferait deux endroits à tenir à jour.
-->
<template>
  <UContainer class="py-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div class="flex items-center gap-3">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :to="`/editions/${editionId}/gestion/stock`"
        />
        <UIcon name="i-heroicons-hand-raised" class="text-amber-600 size-6" />
        <h1 class="text-2xl font-semibold">{{ t('gestion.stock.loans_title') }}</h1>
      </div>
    </div>

    <div v-if="chargement" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <!-- Rien à signaler est une bonne nouvelle, et mérite d'être dit comme telle plutôt que
         laissé à une page vide qu'on prendrait pour un chargement raté. -->
    <div v-else-if="emprunts.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-check-circle" class="size-12 text-green-500 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400">
        {{ t('gestion.stock.loans_none') }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <!-- Deux moments, deux onglets : aller chercher, puis rapporter. Le compte figure sur
           chacun pour qu'on sache ce qui attend sans changer d'onglet. -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <UTabs v-model="ongletActif" :items="onglets" color="primary" :ui="{ list: 'w-auto' }" />

          <!-- Une liste fermée, pas une recherche : les lieux sont écrits à la main, et l'on ne
               retrouve pas « chez Marie » en tapant « marie ». Elle ne propose que des lieux qui
               existent, et se vide d'elle-même quand l'onglet n'en a aucun. -->
          <!-- Deux listes fermées, pas des recherches : lieux et personnes sont écrits à la
               main, et l'on ne retrouve pas « chez Marie » en tapant « marie ». Chacune ne
               propose que ce qui existe dans l'onglet ouvert, et disparaît s'il n'y a rien. -->
          <div v-if="lieux.length > 0" class="flex items-center gap-1">
            <USelect
              v-model="lieuChoisi"
              :items="lieux"
              :placeholder="t('gestion.stock.loan_place_all')"
              class="w-52"
            />
            <!-- Revenir à « tous » par un bouton : une option de valeur vide serait plus directe,
                 mais `USelect` la refuse — elle réserve la chaîne vide à l'effacement de la
                 sélection. Même parade qu'ailleurs dans le projet. -->
            <UButton
              v-if="lieuChoisi"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-x-mark"
              :title="t('gestion.stock.loan_place_all')"
              @click="lieuChoisi = undefined"
            />
          </div>

          <div v-if="personnes.length > 0" class="flex items-center gap-1">
            <!-- Le visage quand la personne est inscrite, l'icône générique sinon : on
                 reconnaît une tête plus vite qu'un pseudo, et l'icône dit sans ambiguïté que
                 cette personne-là n'a pas de compte.

                 `UiUserAvatar` et non une simple URL : lui seul retombe sur les initiales sur
                 fond coloré quand la personne n'a pas de photo, exactement comme la colonne
                 « qui s'en occupe ». Deux façons d'afficher le même visage finiraient par
                 diverger. -->
            <USelect
              v-model="personneChoisie"
              :items="optionsPersonnes"
              :placeholder="t('gestion.stock.loan_responsible_all')"
              class="w-52"
            >
              <template #leading>
                <UiUserAvatar v-if="compteChoisi" :user="compteChoisi" size="xs" class="shrink-0" />
                <UIcon
                  v-else-if="personneChoisie"
                  name="i-heroicons-user"
                  class="size-4 shrink-0 text-gray-400"
                />
              </template>

              <template #item-leading="{ item }">
                <UiUserAvatar
                  v-if="(item as any).compte"
                  :user="(item as any).compte"
                  size="xs"
                  class="shrink-0"
                />
                <UIcon v-else name="i-heroicons-user" class="size-4 shrink-0 text-gray-400" />
              </template>
            </USelect>
            <UButton
              v-if="personneChoisie"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-x-mark"
              :title="t('gestion.stock.loan_responsible_all')"
              @click="personneChoisie = undefined"
            />
          </div>
        </div>

        <!-- Un seul geste, celui de l'onglet ouvert : « à récupérer » ne peut mener qu'à marquer
             récupéré, « à rendre » qu'à marquer rendu. Proposer les deux partout obligerait à
             lire le bouton avant de cliquer. -->
        <div v-if="nbSelection > 0" class="flex flex-wrap items-center gap-2">
          <UButton
            v-for="action in actionsOnglet(ongletActif)"
            :key="action.cle"
            :color="action.principale ? 'primary' : 'neutral'"
            :variant="action.principale ? 'solid' : 'outline'"
            :icon="action.pose ? 'i-heroicons-check' : 'i-heroicons-arrow-uturn-left'"
            :loading="enregistrement === action.cle"
            :disabled="enregistrement !== null"
            @click="appliquer(action)"
          >
            {{ t(action.cle, { count: nbSelection }, nbSelection) }}
          </UButton>
        </div>
      </div>

      <UTable
        v-model:sorting="tri"
        v-model:row-selection="selection"
        :get-row-id="(ligne: any) => String(ligne.id)"
        :data="lignes"
        :columns="colonnes"
        class="w-full"
      >
        <template #select-header="{ table }">
          <UCheckbox
            :model-value="etatCaseGlobale(table)"
            :ui="{ base: 'cursor-pointer' }"
            @update:model-value="
              (coche: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(coche === true)
            "
          />
        </template>

        <template #select-cell="{ row }">
          <UCheckbox
            :model-value="row.getIsSelected()"
            :ui="{ base: 'cursor-pointer' }"
            @update:model-value="
              (coche: boolean | 'indeterminate') => row.toggleSelected(coche === true)
            "
          />
        </template>

        <template #etatTableau-cell="{ row }">
          <UBadge :color="couleurEtat(row.original.etatTableau)" variant="soft">
            {{ t(LIBELLES[row.original.etatTableau as EtatTableau]) }}
          </UBadge>
        </template>

        <template #name-cell="{ row }">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-medium truncate">{{ row.original.name }}</span>
            <UBadge v-if="row.original.quantity > 1" color="neutral" variant="subtle" size="sm">
              ×{{ row.original.quantity }}
            </UBadge>
          </div>
        </template>

        <template #groupe-cell="{ row }">
          <span class="text-sm text-gray-600 dark:text-gray-400 truncate">
            {{ row.original.group.name }}
          </span>
        </template>

        <template #returnDueAt-cell="{ row }">
          <span
            v-if="row.original.returnDueAt"
            :class="row.original.etatTableau === 'en_retard' ? 'text-error font-medium' : ''"
          >
            {{ formatDate(row.original.returnDueAt) }}
          </span>
          <span v-else class="text-gray-400">—</span>
        </template>

        <template #lieu-cell="{ row }">
          <span v-if="etape(row.original)?.lieu" class="text-sm">
            {{ etape(row.original)!.lieu }}
          </span>
          <span v-else class="text-gray-400">—</span>
        </template>

        <template #qui-cell="{ row }">
          <div v-if="etape(row.original)?.qui" class="flex items-center gap-1.5">
            <!-- Le visage devant le nom quand la personne est inscrite, comme dans la liste d'un
               groupe : rien devant un nom écrit à la main. -->
            <UiUserAvatar
              v-if="etape(row.original)!.compte"
              :user="etape(row.original)!.compte!"
              size="sm"
              class="shrink-0"
            />
            <span class="text-sm truncate">{{ etape(row.original)!.qui }}</span>
          </div>
          <span v-else class="text-gray-400">—</span>
        </template>

        <template #actions-cell="{ row }">
          <!-- La ligne entière servait de lien, et l'on atterrissait sur la fiche en voulant
               simplement cocher une case. Le même bouton que sur la liste d'un groupe. -->
          <div class="flex items-center justify-end">
            <UButton
              icon="i-heroicons-eye"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('common.view')"
              @click="ouvrirFiche(row.original.id)"
            />
          </div>
        </template>

        <template #ownerContact-cell="{ row }">
          <span v-if="row.original.ownerContact" class="text-sm text-gray-500 truncate">
            {{ row.original.ownerContact }}
          </span>
          <span v-else class="text-gray-400">—</span>
        </template>
      </UTable>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import { prochaineEtapeEmprunt } from '../../../../../utils/etat-emprunt'
import {
  actionsOnglet,
  filtrerParEtape,
  lignesOnglet,
  ongletDepuisUrl,
  ongletParDefaut,
  ONGLETS_EMPRUNTS,
  type ActionEmprunt,
  type EtatTableau,
  personnesDEtape,
  type OngletEmprunts,
  valeursDEtape,
} from '../../../../../utils/tableau-emprunts'

import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)

interface EmpruntTableau {
  id: number
  name: string
  quantity: number
  isExternalLoan: boolean
  ownerContact: string | null
  returnDueAt: string | null
  pickedUpAt: string | null
  returnedAt: string | null
  pickupLocation: string | null
  pickupContact: string | null
  returnLocation: string | null
  returnContact: string | null
  pickupResponsible: { id: number; pseudo: string; profilePicture?: string | null } | null
  returnResponsible: { id: number; pseudo: string; profilePicture?: string | null } | null
  group: { id: number; name: string }
}

const emprunts = ref<EmpruntTableau[]>([])
let premierChargement = true
const chargement = ref(true)

useHead({ title: () => t('gestion.stock.loans_title') })

/**
 * L'ordre initial dit la priorité — retard, à récupérer, à rendre —, et le tri par colonne prend
 * le relais dès qu'on cherche autre chose. Les deux ne se contredisent pas : le premier répond à
 * « qu'est-ce qui me tombe dessus ? », le second à « où en est cet objet-là ? ».
 */
const ongletActif = ref<OngletEmprunts>('a_recuperer')

const lieuChoisi = ref<string | undefined>(undefined)
const personneChoisie = ref<string | undefined>(undefined)

/** Les lignes de l'onglet ouvert, avant filtrage : c'est sur elles que les listes se construisent. */
const lignesOngletOuvert = computed(() => lignesOnglet(emprunts.value, ongletActif.value))

/** Lieux et personnes tels qu'ils sont réellement saisis sur les objets de cet onglet. */
const lieux = computed(() => valeursDEtape(lignesOngletOuvert.value, 'lieu'))
const personnes = computed(() => personnesDEtape(lignesOngletOuvert.value))

/**
 * Les personnes telles que le sélecteur les rend.
 *
 * Le compte voyage avec l'option pour que le slot puisse rendre `UiUserAvatar`. Passer une simple
 * URL d'avatar ne suffirait pas : sans photo de profil, elle pointe vers une image absente, là où
 * le composant compose des initiales sur fond coloré.
 */
const optionsPersonnes = computed(() =>
  personnes.value.map((personne) => ({
    label: personne.valeur,
    value: personne.valeur,
    compte: personne.compte,
  }))
)

/** Le compte de la personne choisie, pour montrer son visage dans le champ fermé. */
const compteChoisi = computed(
  () => personnes.value.find((p) => p.valeur === personneChoisie.value)?.compte ?? null
)

/** Les lignes affichées. Le tri par colonne prend ensuite le relais. */
const lignes = computed(() => {
  const parLieu = filtrerParEtape(lignesOngletOuvert.value, 'lieu', lieuChoisi.value)
  return filtrerParEtape(parLieu, 'qui', personneChoisie.value)
})

/**
 * `value` et non `key` : c'est la propriété que `UTabs` lie à son `v-model`. Le compte accompagne
 * le libellé pour qu'on sache ce qui attend dans l'autre onglet sans y aller.
 */
const onglets = computed(() =>
  ONGLETS_EMPRUNTS.map((onglet) => ({
    value: onglet,
    label: `${t(LIBELLES[onglet])} (${lignesOnglet(emprunts.value, onglet).length})`,
  }))
)

const tri = ref([])
const selection = ref<Record<string, boolean>>({})
/** La clé de l'action en cours, pour n'animer que son bouton. */
const enregistrement = ref<string | null>(null)

const nbSelection = computed(() => Object.values(selection.value).filter(Boolean).length)

const idsSelectionnes = computed(() =>
  Object.entries(selection.value)
    .filter(([, coche]) => coche)
    .map(([id]) => Number(id))
)

/**
 * L'état de la case d'en-tête : cochée, vide, ou entre les deux.
 *
 * `UCheckbox` connaît trois états, et le troisième compte ici : une sélection partielle qui
 * s'afficherait « tout coché » ferait croire qu'un clic va tout décocher.
 */
function etatCaseGlobale(table: any): boolean | 'indeterminate' {
  if (table.getIsAllPageRowsSelected()) return true
  return table.getIsSomePageRowsSelected() ? 'indeterminate' : false
}

// Changer d'onglet vide la sélection : les lignes ne sont plus les mêmes, et le geste proposé non
// plus. Garder les cases cochées ferait marquer « rendu » ce qu'on avait coché pour « récupéré ».
watch(ongletActif, () => {
  selection.value = {}
  // Le lieu aussi : les lieux d'un onglet ne sont pas ceux de l'autre, et garder un choix devenu
  // introuvable afficherait un tableau vide sans qu'on comprenne pourquoi.
  lieuChoisi.value = undefined
  personneChoisie.value = undefined
})

/**
 * L'onglet et le lieu vivent dans l'URL.
 *
 * Ce qu'on regarde se partage et se retrouve : un lien envoyé à quelqu'un ouvre ce qu'on avait
 * sous les yeux, et le retour arrière ramène là où l'on était. `replace` et non `push` pour que
 * l'historique ne se remplisse pas d'un cran par onglet ouvert.
 */
watch([ongletActif, lieuChoisi, personneChoisie], ([onglet, lieu, personne]) => {
  router.replace({
    query: {
      ...route.query,
      onglet,
      lieu: lieu || undefined,
      qui: personne || undefined,
    },
  })
})

async function appliquer(action: ActionEmprunt) {
  if (idsSelectionnes.value.length === 0) return

  // Poser le jalon le date de maintenant ; l'annuler l'efface. Le serveur refuse l'ordre
  // impossible — rendre ce qu'on n'a pas récupéré —, objet par objet.
  const corps = { [action.champ]: action.pose ? new Date().toISOString() : null }

  enregistrement.value = action.cle
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/bulk`, {
      method: 'PATCH',
      body: { itemIds: idsSelectionnes.value, ...corps },
    })
    useToast().add({
      title: t('common.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    selection.value = {}
    await charger()
    // La pastille du menu compte les retards : elle vient de changer. Le menu ne recalcule qu'au
    // montage — c'est à qui modifie les données de le signaler, sans quoi le compteur reste sur
    // sa valeur d'arrivée jusqu'au prochain chargement de page.
    await rafraichirCompteursNavigation({ editionId }, ['stock-emprunts'])
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    enregistrement.value = null
  }
}

const colonnes = computed((): TableColumn<any>[] => [
  { id: 'select', enableSorting: false },
  { id: 'etatTableau', accessorKey: 'etatTableau', header: t('gestion.stock.loan_state') },
  // Le groupe avant le nom : c'est lui qui situe l'objet quand on prépare une tournée, et il se
  // trie — on rassemble alors tout ce qui vient du même rangement.
  {
    id: 'groupe',
    accessorFn: (ligne: any) => ligne.group?.name ?? '',
    header: t('gestion.stock.item_group'),
  },
  { id: 'name', accessorKey: 'name', header: t('gestion.stock.item_name') },
  // L'échéance de retour ne concerne que ce qu'on a déjà récupéré : sur du matériel qu'on n'est
  // pas encore allé chercher, elle donnerait une date à tenir pour un objet qu'on n'a pas.
  ...(ongletActif.value === 'a_rendre'
    ? [
        {
          id: 'returnDueAt',
          accessorKey: 'returnDueAt',
          header: t('gestion.stock.return_due_at'),
        },
      ]
    : []),
  {
    id: 'lieu',
    accessorFn: (ligne: any) => prochaineEtapeEmprunt(ligne)?.lieu ?? '',
    header: t('gestion.stock.loan_place'),
  },
  {
    id: 'qui',
    accessorFn: (ligne: any) => prochaineEtapeEmprunt(ligne)?.qui ?? '',
    header: t('gestion.stock.loan_responsible'),
  },
  {
    id: 'ownerContact',
    accessorKey: 'ownerContact',
    header: t('gestion.stock.owner_contact'),
  },
  { id: 'actions', enableSorting: false },
])

/** L'étape en cours, calculée une fois par lecture — la règle vit dans `etat-emprunt`. */
function etape(emprunt: EmpruntTableau) {
  return prochaineEtapeEmprunt(emprunt)
}

/** Les mêmes libellés que partout ailleurs : c'est le même état, il doit porter le même nom. */
const LIBELLES: Record<EtatTableau, string> = {
  en_retard: 'gestion.stock.loan_overdue',
  a_recuperer: 'gestion.stock.loan_to_pick_up',
  a_rendre: 'gestion.stock.loan_to_return',
  rendu: 'gestion.stock.loan_returned',
}

function couleurEtat(etat: EtatTableau): 'error' | 'warning' | 'neutral' {
  if (etat === 'en_retard') return 'error'
  if (etat === 'a_rendre') return 'warning'
  return 'neutral'
}

function ouvrirFiche(itemId: number) {
  router.push(`/editions/${editionId}/gestion/stock/items/${itemId}`)
}

async function charger() {
  chargement.value = true
  try {
    const reponse = await $fetch<{ data: { loans: EmpruntTableau[] } }>(
      `/api/editions/${editionId}/stock-loans`
    )
    emprunts.value = reponse.data.loans || []
    // Au premier chargement seulement : après une action, rebasculer d'onglet ferait perdre de
    // vue ce qu'on vient de traiter. L'URL prime — elle dit explicitement ce qu'on veut voir —,
    // et le retard décide à défaut, puisque c'est ce qui justifie d'ouvrir cette page en urgence.
    if (premierChargement) {
      ongletActif.value = ongletDepuisUrl(route.query.onglet) ?? ongletParDefaut(emprunts.value)
      lieuChoisi.value = typeof route.query.lieu === 'string' ? route.query.lieu : undefined
      personneChoisie.value = typeof route.query.qui === 'string' ? route.query.qui : undefined
      premierChargement = false
    }
  } catch {
    emprunts.value = []
  } finally {
    chargement.value = false
  }
}

onMounted(charger)
</script>
