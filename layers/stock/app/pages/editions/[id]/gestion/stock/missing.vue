<!--
  Ce qui manque, et ce qu'on rachète.

  Le recomptage de fin d'édition se fait groupe par groupe — on ouvre les caisses là où elles sont
  rangées. Mais « qu'est-ce qu'on rachète ? » ne se pose jamais groupe par groupe : elle se pose
  une fois, pour toute l'édition. Y répondre obligeait jusqu'ici à ouvrir chaque groupe et à faire
  la somme de tête.

  Trois onglets pour trois moments : ce qui manque (on décide), ce qui reste à compter (le travail
  qui rendrait la décision fiable), et les listes de courses (on achète).

  ⚠️ Le deuxième onglet n'est pas un détail d'ergonomie. Un objet jamais compté n'est pas un objet
  complet, et tant qu'il en reste, la liste des manquants est incomplète sans le dire. C'est
  pourquoi le compte des non-comptés figure aussi dans le résumé du premier onglet.

  Les règles ne vivent pas ici : `manquants-stock` classe, `liste-de-courses` lit les listes, et
  `comptage-stock` — partagé avec la page d'un groupe — dit ce qu'une saisie vaut. L'écran ne fait
  que les afficher.
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
        <UIcon name="i-heroicons-shopping-cart" class="text-primary-600 size-6" />
        <h1 class="text-2xl font-semibold">{{ t('gestion.stock.missing_title') }}</h1>
      </div>
    </div>

    <div v-if="chargement" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div v-else class="space-y-4">
      <!-- Les trois chiffres qui se lisent ensemble : ce qui manque, combien ça fait d'unités, et
           surtout ce qui reste à compter — sans quoi les deux premiers ne veulent rien dire. -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('gestion.stock.missing_items') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums">{{ resume.objetsManquants }}</p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('gestion.stock.missing_units') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
            {{ resume.exemplairesARacheter }}
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('gestion.stock.missing_uncounted') }}
          </p>
          <p
            class="text-2xl font-semibold tabular-nums"
            :class="resume.nonComptes > 0 ? 'text-amber-600 dark:text-amber-400' : ''"
          >
            {{ resume.nonComptes }}
            <span class="text-base font-normal text-gray-400">/ {{ resume.total }}</span>
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('gestion.stock.missing_open_lists') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums">
            {{ listesEnCours }}
            <span class="text-base font-normal text-gray-400">/ {{ listes.length }}</span>
          </p>
        </UCard>
      </div>

      <!-- Tant qu'il reste des objets à compter, la liste de rachat est incomplète. Le dire une
           fois, en clair, plutôt que de laisser déduire d'un compteur. -->
      <UAlert
        v-if="resume.nonComptes > 0"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="t('gestion.stock.missing_incomplete_title')"
        :description="t('gestion.stock.missing_incomplete_hint', { count: resume.nonComptes })"
      />

      <UTabs v-model="ongletActif" :items="onglets" color="primary" :ui="{ list: 'w-auto' }" />

      <!-- ONGLET 1 : ce qui manque -->
      <div v-if="ongletActif === 'racheter'" class="space-y-3">
        <div v-if="manquants.length === 0" class="text-center py-12">
          <UIcon name="i-heroicons-check-circle" class="size-12 text-green-500 mx-auto mb-3" />
          <p class="text-gray-600 dark:text-gray-400">{{ t('gestion.stock.missing_none') }}</p>
        </div>

        <template v-else>
          <div v-if="canManage" class="flex flex-wrap items-center gap-2">
            <UButton
              size="sm"
              icon="i-heroicons-shopping-cart"
              :disabled="identifiantsSelectionnes.length === 0"
              @click="ouvrirAjout"
            >
              {{
                t('gestion.stock.shopping_add_selection', {
                  count: identifiantsSelectionnes.length,
                })
              }}
            </UButton>
          </div>

          <!-- `get-row-id` fait porter les clés de sélection par l'identifiant de l'objet et non
               par son rang : le tableau se réordonne dès qu'on saisit un comptage — une ligne
               corrigée quitte la liste des manquants —, et une sélection indexée sur les positions
               désignerait alors d'autres objets que ceux cochés. Même raison que sur la page d'un
               groupe. -->
          <UTable
            v-model:row-selection="selectionLignes"
            :get-row-id="(objet: any) => String(objet.id)"
            :data="manquants"
            :columns="colonnesManquants"
          >
            <!-- La coche d'en-tête plutôt qu'un bouton : elle est là où l'on regarde déjà, en tête
                 de la colonne qu'elle commande, et son état indéterminé dit d'un coup d'œil qu'une
                 partie seulement est sélectionnée — ce qu'un bouton ne sait pas exprimer. -->
            <template #choix-header="{ table }">
              <UCheckbox
                :model-value="
                  table.getIsSomePageRowsSelected()
                    ? 'indeterminate'
                    : table.getIsAllPageRowsSelected()
                "
                :aria-label="t('common.select_all')"
                :ui="{ base: 'cursor-pointer' }"
                @update:model-value="
                  (coche: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!coche)
                "
              />
            </template>
            <template #choix-cell="{ row }">
              <UCheckbox
                :model-value="row.getIsSelected()"
                :aria-label="t('common.select')"
                :ui="{ base: 'cursor-pointer' }"
                @update:model-value="
                  (coche: boolean | 'indeterminate') => row.toggleSelected(!!coche)
                "
              />
            </template>
            <template #name-cell="{ row }">
              <div class="flex items-center gap-1.5">
                <span class="font-medium">{{ row.original.name }}</span>
                <!-- La description tient rarement sur une ligne de tableau : elle passe dans une
                   infobulle, signalée par une icône, plutôt que d’écraser la colonne. Compter du
                   matériel demande souvent de savoir de quoi il s’agit exactement — « les câbles
                   XLR, pas les jack ». Même forme que la liste d’un groupe. -->
                <UPopover
                  v-if="row.original.description?.trim()"
                  mode="hover"
                  :content="{ side: 'top' }"
                >
                  <UIcon
                    name="i-heroicons-information-circle"
                    class="size-4 text-gray-400 shrink-0"
                  />
                  <template #content>
                    <p class="p-3 text-sm max-w-xs whitespace-pre-wrap">
                      {{ row.original.description }}
                    </p>
                  </template>
                </UPopover>
              </div>
            </template>
            <template #group-cell="{ row }">
              <span class="text-sm text-gray-500">{{ row.original.group.name }}</span>
            </template>
            <template #compte-cell="{ row }">
              <UInput
                v-if="canManage"
                :model-value="saisieAffichee(row.original.id)"
                type="number"
                min="0"
                class="w-24"
                :placeholder="t('gestion.stock.count_not_counted')"
                @update:model-value="(valeur: string | number) => saisir(row.original.id, valeur)"
              />
              <span v-else class="tabular-nums">
                {{ saisieAffichee(row.original.id) || t('gestion.stock.count_not_counted') }}
              </span>
            </template>
            <template #racheter-cell="{ row }">
              <UBadge color="error" variant="subtle">
                {{ quantiteARacheter(row.original) }}
              </UBadge>
            </template>
          </UTable>
        </template>
      </div>

      <!-- ONGLET 2 : ce qui reste à compter -->
      <div v-else-if="ongletActif === 'compter'" class="space-y-3">
        <div v-if="nonComptes.length === 0" class="text-center py-12">
          <UIcon name="i-heroicons-check-circle" class="size-12 text-green-500 mx-auto mb-3" />
          <p class="text-gray-600 dark:text-gray-400">
            {{ t('gestion.stock.missing_all_counted') }}
          </p>
        </div>

        <UTable v-else :data="nonComptes" :columns="colonnesACompter">
          <template #name-cell="{ row }">
            <div class="flex items-center gap-1.5">
              <span class="font-medium">{{ row.original.name }}</span>
              <UPopover
                v-if="row.original.description?.trim()"
                mode="hover"
                :content="{ side: 'top' }"
              >
                <UIcon
                  name="i-heroicons-information-circle"
                  class="size-4 text-gray-400 shrink-0"
                />
                <template #content>
                  <p class="p-3 text-sm max-w-xs whitespace-pre-wrap">
                    {{ row.original.description }}
                  </p>
                </template>
              </UPopover>
            </div>
          </template>
          <template #group-cell="{ row }">
            <span class="text-sm text-gray-500">{{ row.original.group.name }}</span>
          </template>
          <template #compte-cell="{ row }">
            <UInput
              v-if="canManage"
              :model-value="saisieAffichee(row.original.id)"
              type="number"
              min="0"
              class="w-24"
              :placeholder="t('gestion.stock.count_not_counted')"
              @update:model-value="(valeur: string | number) => saisir(row.original.id, valeur)"
            />
            <span v-else class="tabular-nums">
              {{ saisieAffichee(row.original.id) || t('gestion.stock.count_not_counted') }}
            </span>
          </template>
        </UTable>
      </div>

      <!-- ONGLET 3 : les listes de courses -->
      <div v-else class="space-y-4">
        <div v-if="canManage" class="flex justify-end">
          <UButton size="sm" icon="i-heroicons-plus" @click="ouvrirCreationVide">
            {{ t('gestion.stock.shopping_new_list') }}
          </UButton>
        </div>

        <div v-if="listes.length === 0" class="text-center py-12">
          <UIcon name="i-heroicons-shopping-cart" class="size-12 text-gray-300 mx-auto mb-3" />
          <p class="text-gray-600 dark:text-gray-400">{{ t('gestion.stock.shopping_no_list') }}</p>
        </div>

        <UCard v-for="liste in listes" :key="liste.id">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="font-semibold">{{ liste.name }}</h2>
                <p class="text-sm text-gray-500">
                  {{
                    t('gestion.stock.shopping_progress', {
                      achetes: resumeDe(liste).achetes,
                      total: resumeDe(liste).total,
                      unites: resumeDe(liste).exemplairesRestants,
                    })
                  }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <!-- Les gestes d’écriture disparaissent pour qui ne peut que consulter. -->
                <UBadge v-if="listeTerminee(liste.items)" color="success" variant="subtle">
                  {{ t('gestion.stock.shopping_done') }}
                </UBadge>
                <UTooltip v-if="canManage" :text="t('gestion.stock.shopping_rename')">
                  <UButton
                    icon="i-heroicons-pencil-square"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    @click="ouvrirRenommage(liste)"
                  />
                </UTooltip>
                <UTooltip v-if="canManage" :text="t('common.delete')">
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :loading="suppressionListe.isLoading(liste.id)"
                    @click="demanderSuppression(liste)"
                  />
                </UTooltip>
              </div>
            </div>
          </template>

          <p v-if="liste.items.length === 0" class="text-sm text-gray-500 py-2">
            {{ t('gestion.stock.shopping_list_empty') }}
          </p>

          <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
            <li
              v-for="article in liste.items"
              :key="article.id"
              class="flex items-center gap-3 py-2"
            >
              <UCheckbox
                v-if="canManage"
                :model-value="article.purchased"
                :disabled="bascule.isLoading(cleArticle(liste.id, article.id, !article.purchased))"
                @update:model-value="basculerAchat(liste.id, article)"
              />
              <!-- Sans droit d’écriture, la case disparaît : l’état de l’achat, lui, doit rester
                   visible — c’est l’information, la case n’était que le moyen de la changer. -->
              <UIcon
                v-else
                :name="article.purchased ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'"
                :class="article.purchased ? 'text-green-500' : 'text-gray-300'"
                class="size-5 shrink-0"
              />
              <div class="flex-1 min-w-0">
                <p class="truncate" :class="article.purchased ? 'line-through text-gray-400' : ''">
                  {{ article.item?.name ?? t('gestion.stock.shopping_item_gone') }}
                </p>
                <p class="text-xs text-gray-500 truncate">
                  {{ article.item?.group?.name }}
                </p>
              </div>

              <!-- Le manque a disparu depuis l'ajout : quelqu'un a recompté et retrouvé le
                   matériel. C'est du travail en moins, à condition de le voir. -->
              <UBadge
                v-if="articleSansObjet(article)"
                color="neutral"
                variant="subtle"
                :title="t('gestion.stock.shopping_no_longer_missing_hint')"
              >
                {{ t('gestion.stock.shopping_no_longer_missing') }}
              </UBadge>
              <UBadge v-else-if="quantiteDeLArticle(article)" color="error" variant="subtle">
                {{ quantiteDeLArticle(article) }}
              </UBadge>

              <UButton
                v-if="canManage"
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="xs"
                :title="t('gestion.stock.shopping_remove_item')"
                :loading="retrait.isLoading(cleArticle(liste.id, article.id))"
                @click="retirerArticle(liste.id, article.id)"
              />
            </li>
          </ul>
        </UCard>
      </div>
    </div>

    <!-- Barre d'enregistrement du comptage : elle ne paraît que s'il y a quelque chose à écrire,
         et compte les saisies en attente pour qu'on ne quitte pas la page sans les enregistrer. -->
    <div
      v-if="canManage && enAttente > 0"
      class="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-950"
    >
      <span class="text-sm">{{ t('gestion.stock.count_pending', { count: enAttente }) }}</span>
      <div class="flex gap-2">
        <UButton color="neutral" variant="ghost" size="sm" @click="saisies = {}">
          {{ t('common.cancel') }}
        </UButton>
        <UButton size="sm" :loading="comptageEnCours" @click="enregistrerComptage">
          {{ t('common.save') }}
        </UButton>
      </div>
    </div>

    <StockShoppingListModal
      v-model:open="modaleOuverte"
      :edition-id="editionId"
      :item-ids="itemIdsAVerser"
      :listes="listesSimples"
      :liste-a-renommer="listeARenommer"
      @saved="apresEnregistrement"
    />

    <UiConfirmModal
      v-model="confirmationOuverte"
      :title="t('gestion.stock.shopping_delete_title')"
      :description="
        t('gestion.stock.shopping_delete_confirm', { name: listeASupprimer?.name ?? '' })
      "
      :confirm-label="t('common.delete')"
      confirm-color="error"
      :loading="suppressionListe.loading.value"
      @confirm="supprimerListe"
      @cancel="confirmationOuverte = false"
    />
  </UContainer>
</template>

<script setup lang="ts">
import { useAuthStore, useEditionStore } from '#imports'

import {
  comptagesAEnvoyer,
  compteRetenu,
  nombreEnAttente,
  type LigneComptage,
} from '../../../../../utils/comptage-stock'
import { listeEnCours } from '../../../../../utils/compteur-listes-de-courses'
import { peutGererLeStock } from '../../../../../utils/droits-stock'
import {
  articleSansObjet,
  listeTerminee,
  quantiteDeLArticle,
  resumeListe,
  type ArticleDeListe,
} from '../../../../../utils/liste-de-courses'
import {
  objetsARacheter,
  objetsNonComptes,
  quantiteARacheter,
  resumeRachat,
  type ObjetManquant,
} from '../../../../../utils/manquants-stock'

import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const editionStore = useEditionStore()

const editionId = parseInt(route.params.id as string)

const edition = computed(() => editionStore.getEditionById(editionId))

/**
 * Peut-on écrire, ou seulement regarder&nbsp;?
 *
 * La page se lit avec le droit de CONSULTATION — celui qui va faire les courses n'est pas toujours
 * celui qui tient l'inventaire —, mais compter et tenir des listes demandent celui de GESTION.
 * Sans cette distinction, un consultant verrait des champs de saisie qui rendraient une 403 à
 * l'enregistrement, et croirait à un défaut.
 *
 * Le serveur décide seul : ceci ne fait que ne pas proposer ce qu'il refuserait.
 */
const canManage = computed(() =>
  peutGererLeStock(edition.value as any, authStore.user?.id, authStore.isAdminModeActive)
)

interface ListeDeCourses {
  id: number
  name: string
  createdAt: string
  items: ArticleDeListe[]
}

const objets = ref<ObjetManquant[]>([])
const listes = ref<ListeDeCourses[]>([])
const chargement = ref(true)
const ONGLETS = ['racheter', 'compter', 'listes'] as const
type Onglet = (typeof ONGLETS)[number]

/**
 * L'onglet ouvert vit dans l'URL.
 *
 * Sans cela, un lien partagé — « regarde ce qu'il reste à compter » — ramène toujours sur le
 * premier onglet, et revenir en arrière depuis une fiche rouvre la page au mauvais endroit. Un
 * onglet inconnu dans l'URL retombe sur le premier plutôt que d'afficher une page vide.
 */
const ongletActif = computed<Onglet>({
  get: () => {
    const demande = route.query.onglet
    return ONGLETS.includes(demande as Onglet) ? (demande as Onglet) : 'racheter'
  },
  set: (valeur) => {
    // `replace` et non `push` : changer d'onglet n'est pas une navigation dont on veut revenir par
    // le bouton « précédent », qui remonterait onglet par onglet avant de quitter la page.
    router.replace({
      query: { ...route.query, onglet: valeur === 'racheter' ? undefined : valeur },
    })
  },
})

/** Les saisies de la séance en cours, non encore enregistrées. Clé : identifiant de l'objet. */
const saisies = ref<Record<number, number | null>>({})
const comptageEnCours = ref(false)

/**
 * La sélection est celle du TABLEAU, pas une liste tenue à part.
 *
 * Les clés sont les identifiants des objets — voir `get-row-id` dans le template —, si bien que
 * réordonner ou filtrer la liste ne déplace pas ce qui est coché.
 */
const selectionLignes = ref<Record<string, boolean>>({})

const modaleOuverte = ref(false)
const itemIdsAVerser = ref<number[]>([])
const listeARenommer = ref<{ id: number; name: string } | null>(null)

const confirmationOuverte = ref(false)
const listeASupprimer = ref<ListeDeCourses | null>(null)

/**
 * Les objets, augmentés de ce qui vient d'être tapé.
 *
 * La saisie du jour prime sur l'enregistré — c'est ce qui fait qu'un objet corrigé change d'onglet
 * sous le curseur, sans attendre l'enregistrement.
 */
const lignes = computed<ObjetManquant[]>(() =>
  objets.value.map((objet) => ({
    ...objet,
    ...(objet.id in saisies.value ? { saisie: saisies.value[objet.id] } : {}),
  }))
)

const manquants = computed(() => objetsARacheter(lignes.value))
const nonComptes = computed(() => objetsNonComptes(lignes.value))
const resume = computed(() => resumeRachat(lignes.value))
const enAttente = computed(() => nombreEnAttente(lignes.value as LigneComptage[]))

/**
 * Le compte va DANS le libellé, comme sur la page des emprunts.
 *
 * `UTabs` n'expose pas de pastille sur ses éléments : une propriété `badge` y serait ignorée sans
 * rien signaler, et l'onglet afficherait un libellé nu qu'on croirait juste. Le compte est ici la
 * moitié de l'information — savoir combien d'objets restent à compter sans changer d'onglet.
 */
const onglets = computed(() => [
  {
    label: `${t('gestion.stock.missing_tab_buy')} (${resume.value.objetsManquants})`,
    value: 'racheter',
  },
  {
    label: `${t('gestion.stock.missing_tab_count')} (${resume.value.nonComptes})`,
    value: 'compter',
  },
  {
    label: `${t('gestion.stock.shopping_lists')} (${listes.value.length})`,
    value: 'listes',
  },
])

const colonnesManquants = computed((): TableColumn<ObjetManquant>[] => [
  ...(canManage.value ? [{ id: 'choix', header: '' }] : []),
  { id: 'name', accessorKey: 'name', header: t('gestion.stock.item_name') },
  { id: 'group', header: t('gestion.stock.group') },
  { id: 'quantity', accessorKey: 'quantity', header: t('gestion.stock.count_expected') },
  { id: 'compte', header: t('gestion.stock.count_counted') },
  { id: 'racheter', header: t('gestion.stock.missing_to_buy') },
])

const colonnesACompter = computed((): TableColumn<ObjetManquant>[] => [
  { id: 'name', accessorKey: 'name', header: t('gestion.stock.item_name') },
  { id: 'group', header: t('gestion.stock.group') },
  { id: 'quantity', accessorKey: 'quantity', header: t('gestion.stock.count_expected') },
  { id: 'compte', header: t('gestion.stock.count_counted') },
])

const listesSimples = computed(() => listes.value.map(({ id, name }) => ({ id, name })))

/**
 * Combien de listes attendent encore des achats.
 *
 * La même règle que la pastille du menu, et non un calcul refait ici : les deux chiffres doivent
 * dire la même chose, sans quoi l'un contredit l'autre sous les yeux de l'utilisateur.
 */
const listesEnCours = computed(() => listes.value.filter(listeEnCours).length)

const resumeDe = (liste: ListeDeCourses) => resumeListe(liste.items)

/** Ce que la case affiche : la saisie du jour, sinon l'enregistré, sinon rien. */
function saisieAffichee(id: number): string {
  const ligne = lignes.value.find((l) => l.id === id)
  const compte = compteRetenu(ligne ?? { id, quantity: 0, finalQuantity: null })
  return compte === null ? '' : String(compte)
}

/**
 * Enregistre une frappe dans la séance, sans rien envoyer.
 *
 * Une case vidée vaut `null` et non zéro : c'est le geste qui efface un comptage écrit par erreur,
 * et le confondre avec « zéro exemplaire » ferait disparaître du matériel sur le papier. Même
 * règle que sur la page d'un groupe, d'où l'util partagé.
 */
function saisir(id: number, valeur: string | number) {
  const texte = String(valeur).trim()
  if (texte === '') {
    saisies.value = { ...saisies.value, [id]: null }
    return
  }
  const nombre = Number(texte)
  if (!Number.isFinite(nombre) || nombre < 0) return
  saisies.value = { ...saisies.value, [id]: Math.floor(nombre) }
}

/** Les identifiants cochés, dans l'ordre où le tableau les porte. */
const identifiantsSelectionnes = computed(() =>
  Object.entries(selectionLignes.value)
    .filter(([, coche]) => coche)
    .map(([id]) => Number(id))
)

function ouvrirAjout() {
  itemIdsAVerser.value = [...identifiantsSelectionnes.value]
  listeARenommer.value = null
  modaleOuverte.value = true
}

function ouvrirCreationVide() {
  itemIdsAVerser.value = []
  listeARenommer.value = null
  modaleOuverte.value = true
}

function ouvrirRenommage(liste: ListeDeCourses) {
  itemIdsAVerser.value = []
  listeARenommer.value = { id: liste.id, name: liste.name }
  modaleOuverte.value = true
}

async function apresEnregistrement() {
  selectionLignes.value = {}
  await chargerListes()
  ongletActif.value = 'listes'
}

/**
 * La clé d'une action sur un article.
 *
 * Composite, parce que la route a besoin des deux identifiants et le corps de l'état voulu. Tout
 * faire tenir dans la clé évite une variable partagée entre le clic et la requête, qui se
 * mélangerait si l'on cochait deux lignes coup sur coup.
 */
function cleArticle(listId: number, articleId: number, achete?: boolean): string {
  return achete === undefined
    ? `${listId}:${articleId}`
    : `${listId}:${articleId}:${achete ? 1 : 0}`
}

const bascule = useApiActionById(
  (cle) => {
    const [listId, articleId] = String(cle).split(':')
    return `/api/editions/${editionId}/stock-shopping-lists/${listId}/items/${articleId}`
  },
  {
    method: 'PATCH',
    body: (cle) => ({ purchased: String(cle).split(':')[2] === '1' }),
    silentSuccess: true,
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => chargerListes(),
  }
)

const retrait = useApiActionById(
  (cle) => {
    const [listId, articleId] = String(cle).split(':')
    return `/api/editions/${editionId}/stock-shopping-lists/${listId}/items/${articleId}`
  },
  {
    method: 'DELETE',
    silentSuccess: true,
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => chargerListes(),
  }
)

const suppressionListe = useApiActionById(
  (listId) => `/api/editions/${editionId}/stock-shopping-lists/${listId}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.stock.shopping_list_deleted') },
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => chargerListes(),
  }
)

function basculerAchat(listId: number, article: ArticleDeListe) {
  bascule.execute(cleArticle(listId, article.id, !article.purchased))
}

function retirerArticle(listId: number, articleId: number) {
  retrait.execute(cleArticle(listId, articleId))
}

function demanderSuppression(liste: ListeDeCourses) {
  listeASupprimer.value = liste
  confirmationOuverte.value = true
}

async function supprimerListe() {
  // `UiConfirmModal` n'émet que `confirm` et `cancel` : la refermer revient à l'appelant.
  const liste = listeASupprimer.value
  if (liste) await suppressionListe.execute(liste.id)
  confirmationOuverte.value = false
  listeASupprimer.value = null
}

async function enregistrerComptage() {
  const comptage = comptagesAEnvoyer(lignes.value as LigneComptage[])
  if (comptage.length === 0) return

  comptageEnCours.value = true
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/bulk`, {
      method: 'PATCH',
      body: { itemIds: comptage.map((entree) => entree.id), comptage },
    })
    useToast().add({
      title: t('common.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    saisies.value = {}
    // Les listes aussi : une quantité y est relue sur l'objet, et un comptage vient de la changer.
    await Promise.all([chargerObjets(), chargerListes()])
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    comptageEnCours.value = false
  }
}

async function chargerObjets() {
  const reponse = await $fetch<{ data: { items: ObjetManquant[] } }>(
    `/api/editions/${editionId}/stock-comptage`
  )
  objets.value = reponse.data?.items ?? []
}

async function chargerListes() {
  const reponse = await $fetch<{ data: { lists: ListeDeCourses[] } }>(
    `/api/editions/${editionId}/stock-shopping-lists`
  )
  listes.value = reponse.data?.lists ?? []

  // La pastille du menu compte les listes non terminées : cocher un article, en ajouter ou
  // supprimer une liste la change. Le menu ne recalcule qu'au montage, c'est donc ici qu'il faut
  // le lui dire — et de façon CIBLÉE : un rafraîchissement complet effacerait les compteurs des
  // autres modules, qui ne sont pas rechargés ici.
  await rafraichirCompteursNavigation({ editionId }, ['stock-courses'])
}

onMounted(async () => {
  try {
    // L'édition d'abord : c'est elle qui dit si l'on peut écrire, et l'écran doit le savoir avant
    // d'afficher des champs de saisie.
    await editionStore.fetchEditionById(editionId, { force: true })
    await Promise.all([chargerObjets(), chargerListes()])
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    chargement.value = false
  }
})
</script>
