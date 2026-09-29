<template>
  <div>
    <div v-if="pending" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="error">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="error.data?.message || error.message"
      />
    </div>

    <div v-else class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <ManagementPageHeader
            :titre="$t('gestion.treasury.title')"
            :description="$t('gestion.treasury.subtitle')"
          />
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <UButton
            icon="i-lucide-tags"
            color="neutral"
            variant="outline"
            :label="$t('gestion.treasury.manage_codes')"
            @click="codesModalOpen = true"
          />
          <UButton
            icon="i-lucide-plus"
            :label="$t('gestion.treasury.add_entry')"
            @click="openEntryModal()"
          />
        </div>
      </div>

      <!-- Totaux : le solde ne retient que ce qui est réglé, l'engagé est annoncé à part pour ne
           pas laisser croire qu'il est encaissé ou décaissé.

           Ils ignorent délibérément les filtres : ce sont les comptes de l'édition. -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UCard
          v-for="card in totalCards"
          :key="card.key"
          :class="card.onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''"
          @click="card.onClick?.()"
        >
          <div class="flex items-center gap-3">
            <div class="rounded-full p-2" :class="card.iconBg">
              <UIcon :name="card.icon" class="h-5 w-5" :class="card.iconColor" />
            </div>
            <div class="min-w-0">
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</p>
              <p class="text-xl font-semibold" :class="card.valueClass">{{ card.value }}</p>
              <p v-if="card.hint" class="text-xs text-gray-500 dark:text-gray-400">
                {{ card.hint }}
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Les filtres, APRÈS les totaux et non avant : ce qui ne leur obéit pas se lit d'abord.
           Les cartes ci-dessus portent les comptes de l'édition et ne bougent jamais ; placées
           sous la barre de filtres, elles auraient l'air d'en dépendre.

           Ici plutôt que dans chaque liste : ils commandent les deux natures à la fois, et l'on
           doit voir d'un coup d'œil qu'ils sont posés. -->
      <UCard data-testid="treasury-filters">
        <!-- Sur grand écran, les quatre contrôles en ligne. -->
        <TreasuryFilters
          v-model:texte="filtreTexte"
          v-model:codes="filtreCodes"
          v-model:du="filtreDu"
          v-model:au="filtreAu"
          :choix-de-code="choixDeCode"
          class="hidden lg:flex"
        >
          <template #actions>
            <UButton
              v-if="filtreActif"
              icon="i-lucide-filter-x"
              color="neutral"
              variant="ghost"
              :label="$t('gestion.treasury.filter_clear')"
              @click="effacerLesFiltres"
            />

            <!-- Les colonnes AVANT l'export, comme partout ailleurs : on choisit ce qu'on
                 montre, puis on l'emporte. L'ordre inverse se lit comme deux boutons sans
                 rapport. -->
            <UiColumnsMenu :table-api="tableaux[0]?.tableApi" :libelle="libelleDeColonne" />

            <!-- L'export avec les filtres, et non dans l'en-tête de page : ce sont les lignes
                 FILTRÉES qui partent dans le fichier. Le bouton posé à côté de ce qui le
                 détermine, on ne peut plus exporter un extrait en croyant emporter les comptes
                 complets.

                 Désactivé quand rien n'est affiché : un export sans lignes se lit comme un export
                 raté, et l'on cherche l'erreur là où il n'y en a pas. -->
            <UiExportMenu
              variant="outline"
              :disabled="lignesFiltrees.length === 0"
              :on-csv="exporterCsv"
              :on-pdf="exporterPdf"
            />
          </template>
        </TreasuryFilters>

        <!-- Sur téléphone, un seul bouton : quatre contrôles côte à côte y deviennent illisibles,
             et empilés ils repousseraient le tableau hors de l'écran. La pastille dit qu'un filtre
             est posé sans qu'on ait à ouvrir la modale pour s'en assurer. -->
        <div class="flex flex-wrap items-center gap-2 lg:hidden">
          <UButton
            icon="i-lucide-filter"
            color="neutral"
            variant="outline"
            :label="$t('gestion.treasury.filters')"
            @click="filtresOuverts = true"
          >
            <template v-if="filtreActif" #trailing>
              <UBadge color="primary" variant="solid" size="sm">
                {{ nombreDeFiltres }}
              </UBadge>
            </template>
          </UButton>

          <UButton
            v-if="filtreActif"
            icon="i-lucide-filter-x"
            color="neutral"
            variant="ghost"
            :label="$t('gestion.treasury.filter_clear')"
            @click="effacerLesFiltres"
          />

          <UiColumnsMenu :table-api="tableaux[0]?.tableApi" :libelle="libelleDeColonne" />

          <UiExportMenu
            variant="outline"
            :disabled="lignesFiltrees.length === 0"
            :on-csv="exporterCsv"
            :on-pdf="exporterPdf"
          />
        </div>

        <!-- Le sous-total du filtre, ici et pas dans les cartes du haut : celles-ci annoncent le
             solde de l'ÉDITION, et le voir changer avec un filtre ferait lire un chiffre partiel
             comme s'il était celui des comptes. Les deux coexistent, chacun nommé. -->
        <div
          v-if="filtreActif"
          class="mt-4 flex flex-col gap-2 border-t border-gray-200 pt-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-6 dark:border-gray-800"
          data-testid="treasury-filtered-subtotal"
        >
          <span class="font-medium">
            {{ $t('gestion.treasury.filtered_count', { count: sousTotalFiltre.lignes }) }}
          </span>
          <span class="text-gray-500 dark:text-gray-400">
            {{ $t('gestion.treasury.expenses') }}
            <span class="font-semibold text-gray-900 tabular-nums dark:text-white">
              {{ money(sousTotalFiltre.charges) }}
            </span>
          </span>
          <span class="text-gray-500 dark:text-gray-400">
            {{ $t('gestion.treasury.incomes') }}
            <span class="font-semibold text-gray-900 tabular-nums dark:text-white">
              {{ money(sousTotalFiltre.produits) }}
            </span>
          </span>
          <span class="text-gray-500 dark:text-gray-400">
            {{ $t('gestion.treasury.balance') }}
            <span
              class="font-semibold tabular-nums"
              :class="sousTotalFiltre.solde < 0 ? 'text-red-600' : 'text-emerald-600'"
            >
              {{ money(sousTotalFiltre.solde) }}
            </span>
          </span>
        </div>
      </UCard>

      <UCard v-for="(group, index) in groups" :key="group.kind">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon :name="group.icon" class="h-5 w-5" :class="group.iconColor" />
            <h2 class="font-semibold">{{ group.label }}</h2>
            <UBadge color="neutral" variant="subtle" size="sm">{{ group.lines.length }}</UBadge>
          </div>
        </template>

        <!-- Un tableau, et non plus une liste de blocs : six colonnes alignées se parcourent
             verticalement, ce qu'une trésorerie demande — retrouver toutes les lignes d'un code,
             suivre les montants, repérer un trou dans les dates. Le tri est disponible sur chaque
             colonne, sauf les actions qui n'ordonnent rien. -->
        <!-- Le clic droit ouvre les mêmes actions que la dernière colonne, mais nommées : les
             boutons y sont réduits à leur icône, et rien ne dit à quoi sert un crayon tant qu'on
             ne l'a pas survolé. Le motif est celui de la gestion des artistes. -->
        <UContextMenu :items="menuContextuel">
          <UTable
            :ref="(el: any) => el && (tableaux[index] = el)"
            v-model:sorting="tri"
            v-model:column-visibility="visibiliteDesColonnes"
            :data="group.lines"
            :columns="colonnes"
            :empty="$t('gestion.treasury.no_line')"
            class="w-full"
            @contextmenu="surClicDroit"
          >
            <template #libelle-cell="{ row }">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ lineTitle(row.original) }}</span>
                <!-- Simple marque de présence : la liste reste dense, et le ticket s'ouvre en
                   grand d'un clic quand on veut vraiment le relire. -->
                <UTooltip v-if="row.original.imageUrl" :text="$t('gestion.treasury.entry_receipt')">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-receipt"
                    :aria-label="$t('gestion.treasury.entry_receipt')"
                    @click="justificatifOuvert = row.original.imageUrl"
                  />
                </UTooltip>
                <!-- Deux états qui changent la lecture du montant : l'un dit qu'il n'est pas
                   encore payé, l'autre qu'il est dû à quelqu'un. -->
                <UBadge v-if="row.original.isForecast" color="neutral" variant="subtle" size="sm">
                  {{ $t('gestion.treasury.entry_forecast') }}
                </UBadge>
                <!-- Le nom affiché vient du compte quand il y en a un, du texte libre sinon :
                   l'un des deux seulement est renseigné, le serveur s'en assure. -->
                <UBadge
                  v-if="nomDeLAvance(row.original) && !row.original.reimbursed"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  :title="
                    $t('gestion.treasury.advanced_by_name', { name: nomDeLAvance(row.original) })
                  "
                >
                  {{
                    $t('gestion.treasury.advanced_by_name', { name: nomDeLAvance(row.original) })
                  }}
                </UBadge>
              </div>
            </template>

            <template #description-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">
                {{ row.original.description }}
              </span>
            </template>

            <!--
            La date de l'OPÉRATION, distincte de celle de la saisie.

            Rien plutôt qu'un tiret quand elle manque : une ligne calculée — billetterie,
            artistes — n'en a pas par nature, et les entrées antérieures au champ n'en ont pas
            reçu. Un tiret dirait « manquante » là où elle est simplement sans objet.
          -->
            <template #date-cell="{ row }">
              <span
                class="text-sm whitespace-nowrap tabular-nums text-gray-500 dark:text-gray-400"
                data-testid="treasury-operation-date"
              >
                {{ row.original.operationDate ? dateDOperation(row.original.operationDate) : '' }}
              </span>
            </template>

            <!-- Code d'imputation : modifiable même sur une ligne calculée, c'est la seule chose
               que la trésorerie décide pour elle. -->
            <template #code-cell="{ row }">
              <USelectMenu
                :model-value="row.original.code?.id ?? null"
                value-key="value"
                :items="codeItems(row.original)"
                size="sm"
                class="w-56"
                :placeholder="$t('gestion.treasury.no_code')"
                :search-input="{ placeholder: $t('gestion.treasury.code_search_all') }"
                :search-term="recherchesCode[row.original.key] ?? ''"
                @update:search-term="(v: string) => (recherchesCode[row.original.key] = v)"
                @update:model-value="(v: number | null) => assignCode(row.original, v)"
              />
            </template>

            <!-- Le montant engagé est le chiffre principal : une charge existe dès qu'elle est due,
               pas quand elle est payée. Le réglé n'apparaît que s'il diffère, pour ne pas alourdir
               les lignes déjà soldées. -->
            <template #montant-cell="{ row }">
              <div class="text-right whitespace-nowrap tabular-nums">
                <p class="font-semibold">{{ money(lineTotal(row.original)) }}</p>
                <p
                  v-if="row.original.pending"
                  class="text-xs text-gray-500 dark:text-gray-400"
                  :class="{ 'text-amber-600 dark:text-amber-400': !row.original.settled }"
                >
                  {{
                    $t('gestion.treasury.settled_amount', { amount: money(row.original.settled) })
                  }}
                </p>
              </div>
            </template>

            <!-- Des boutons, pas un menu : deux actions au plus par ligne, qu'on répète des dizaines
               de fois de suite. Les replier coûterait un clic à chacune. -->
            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  v-if="row.original.readOnly"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-external-link"
                  :to="sourceLink(row.original)"
                  :title="$t('gestion.treasury.open_source')"
                />
                <template v-else>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    :title="$t('common.edit')"
                    @click="openEntryModal(row.original)"
                  />
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    :title="$t('common.delete')"
                    :loading="deleteEntry.isLoading(row.original.entryId!)"
                    @click="removeEntry(row.original)"
                  />
                </template>
              </div>
            </template>
          </UTable>
        </UContextMenu>
      </UCard>
    </div>

    <!-- Les filtres sur téléphone. Les champs sont les mêmes qu'en ligne : un seul composant, pour
         que le rendu mobile ne prenne pas de retard sur l'autre. -->
    <UModal v-model:open="filtresOuverts" :title="$t('gestion.treasury.filters')">
      <template #body>
        <TreasuryFilters
          v-model:texte="filtreTexte"
          v-model:codes="filtreCodes"
          v-model:du="filtreDu"
          v-model:au="filtreAu"
          :choix-de-code="choixDeCode"
          empile
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="!filtreActif"
            :label="$t('gestion.treasury.filter_clear')"
            @click="effacerLesFiltres"
          />
          <!-- « Voir les N lignes » plutôt qu'un « Fermer » : le filtre s'applique au fur et à
               mesure, et le nombre annoncé dit ce qu'on trouvera en refermant. -->
          <UButton
            :label="$t('gestion.treasury.filtered_count', { count: sousTotalFiltre.lignes })"
            @click="filtresOuverts = false"
          />
        </div>
      </template>
    </UModal>

    <!-- Détail des avances : c'est au moment de rembourser qu'on veut savoir qui attend combien,
         et le total seul ne le dit pas. -->
    <UModal v-model:open="detailRemboursements" :title="$t('gestion.treasury.to_reimburse')">
      <template #body>
        <ul class="divide-y divide-gray-100 dark:divide-gray-800">
          <li
            v-for="ligne in data?.totals?.toReimburse?.detail ?? []"
            :key="ligne.cle"
            class="flex flex-wrap items-center justify-between gap-3 py-2"
          >
            <UiUserDisplay v-if="ligne.personne" :user="ligne.personne" size="sm" />
            <!-- Sans compte, il n'y a ni avatar ni pseudo à montrer : le nom saisi suffit, et une
                 icône dit d'où il vient pour qu'on ne le confonde pas avec un membre. -->
            <span v-else class="flex items-center gap-2 text-sm">
              <UIcon name="i-heroicons-user" class="text-gray-400" />
              {{ ligne.nomLibre }}
            </span>
            <div class="flex items-center gap-3">
              <span class="font-semibold">{{ money(ligne.montant) }}</span>
              <!-- On rembourse en un versement : pointer les lignes une par une était le geste
                   le plus fastidieux de la page, et le plus facile à laisser à moitié fait. -->
              <UButton
                size="xs"
                color="success"
                variant="soft"
                icon="i-lucide-check"
                :loading="rembourser.isLoading(ligne.cle)"
                :label="$t('gestion.treasury.mark_reimbursed')"
                @click="rembourser.execute(ligne.cle)"
              />
            </div>
          </li>
        </ul>
      </template>
    </UModal>

    <UModal
      :open="!!justificatifOuvert"
      size="xl"
      :title="$t('gestion.treasury.entry_receipt')"
      @update:open="(v: boolean) => !v && (justificatifOuvert = null)"
    >
      <template #body>
        <!-- Un justificatif peut être un PDF depuis que les factures le sont : l'afficher en `img`
             ne rendrait qu'une image cassée. L'`iframe` sert la visionneuse du navigateur, et le
             lien reste pour celui qui n'en a pas. -->
        <template v-if="justificatifOuvert && justificatifEstUnPdf">
          <iframe
            :src="justificatifOuvert"
            :title="$t('gestion.treasury.entry_receipt')"
            class="w-full h-[70vh] rounded-lg border border-default"
          />
          <ULink :to="justificatifOuvert" target="_blank" class="mt-2 inline-block text-sm">
            {{ $t('gestion.treasury.open_receipt_new_tab') }}
          </ULink>
        </template>
        <img
          v-else-if="justificatifOuvert"
          :src="justificatifOuvert"
          :alt="$t('gestion.treasury.entry_receipt')"
          class="w-full"
        />
      </template>
    </UModal>

    <TreasuryEntryModal
      v-model:open="entryModalOpen"
      :entry="editedLine"
      :codes="data?.codes ?? []"
      :currency="currency"
      :edition-id="editionId"
      :noms-avance-connus="nomsAvanceConnus"
      @saved="onEntrySaved"
    />

    <TreasuryCodesModal
      v-model:open="codesModalOpen"
      :codes="data?.codes ?? []"
      :edition-id="editionId"
      @changed="refresh()"
    />
  </div>
</template>

<script setup lang="ts">
import {
  montantPourPdf,
  nomFichierTresorerie,
  preparerTableau,
  regrouperParCode,
  soldeDe,
  totalDesGroupes,
  type GroupeDeCode,
  type TotalDeNature,
} from '~/utils/export-tresorerie'
import { tresorerieVersCsv } from '~/utils/export-tresorerie-csv'

import type { TableColumn } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'

import { cleDuNomAvance } from '~~/shared/utils/avance-nom-libre'
import { BOM_UTF8 } from '~~/shared/utils/csv'
import { listeDepuisUrl, texteDepuisUrl } from '~~/shared/utils/filtres-url'
import { DEFAULT_CURRENCY, formatCents } from '~~/shared/utils/money'
import { contientTousLesMots } from '~~/shared/utils/recherche-texte'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const editionId = computed(() => parseInt(route.params.id as string))

interface TreasuryCodeRef {
  id: number
  code: string
  label: string
}

/** Qui a avancé une dépense — de quoi l'afficher, rien de plus. */
interface PersonneAvance {
  id: number
  pseudo: string
  profilePicture?: string | null
  emailHash?: string | null
  updatedAt?: string | null
}

interface TreasuryLine {
  key: string
  origin: 'source' | 'manual'
  source?: string
  entryId?: number
  kind: 'EXPENSE' | 'INCOME'
  title: string
  description?: string | null
  code?: TreasuryCodeRef | null
  imageUrl?: string | null
  isForecast?: boolean
  /** Le jour où l'argent a bougé. Absente sur les entrées antérieures au champ. */
  operationDate?: string | null
  advancedBy?: PersonneAvance | null
  reimbursed?: boolean
  readOnly: boolean
  settled: number
  pending: number
}

const { data, pending, error, refresh } = await useFetch<{
  currency: string
  codes: TreasuryCodeRef[]
  lines: TreasuryLine[]
  totals: {
    expense: { settled: number; pending: number }
    income: { settled: number; pending: number }
    balance: number
    toReimburse: {
      total: number
      /** Un compte, ou un nom libre : `cle` porte l'origine et sert d'identifiant d'action. */
      detail: {
        cle: string
        personne: PersonneAvance | null
        nomLibre: string | null
        montant: number
      }[]
    }
  }
}>(() => `/api/editions/${editionId.value}/treasury`, {
  transform: (payload: any) => payload?.data ?? payload,
})

/**
 * La date d'opération, lisible.
 *
 * Formatée **en UTC**, et c'est le point : la colonne est une `DATE` que Prisma rend à minuit UTC.
 * La rendre dans le fuseau du lecteur la ferait glisser d'un jour à l'ouest de Greenwich — le 12
 * juin deviendrait le 11. Le formateur partagé du dépôt épingle `Europe/Paris`, ce qui la protège
 * par coïncidence ; ici c'est explicite, et ça le restera.
 */
const dateDOperation = (valeur: string) =>
  new Date(valeur).toLocaleDateString(locale.value, {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const currency = computed(() => data.value?.currency || DEFAULT_CURRENCY)
const money = (cents: number) => formatCents(cents, currency.value, locale.value)

/** Les origines calculées portent une clé, pas un libellé : elles se traduisent ici. */
const lineTitle = (line: TreasuryLine) =>
  line.origin === 'source' ? t(`gestion.treasury.source.${line.source}`) : line.title

/** Chaque origine renvoie vers la page où son montant se corrige. */
const sourceLink = (line: TreasuryLine) =>
  line.source?.startsWith('TICKETING_')
    ? `/editions/${editionId.value}/gestion/ticketing/orders`
    : `/editions/${editionId.value}/gestion/artists`

/** Terme tapé dans le select de chaque ligne. Une ligne, une recherche. */
const recherchesCode = ref<Record<string, string>>({})

/** La règle des codes proposés vit dans `codesProposes` : elle sert aussi au formulaire. */
const codeItems = (line: TreasuryLine) => {
  const proposes = codesProposes(data.value?.codes ?? [], {
    sens: line.kind,
    recherche: recherchesCode.value[line.key] ?? '',
    codeCourantId: line.code?.id ?? null,
  })

  return [
    { value: null, label: t('gestion.treasury.no_code') },
    ...proposes.map((c) => ({ value: c.id, label: `${c.code} — ${c.label}` })),
  ]
}

/*
 * ─── Filtres ───────────────────────────────────────────────────────────────────────────────────
 *
 * Côté client : les lignes sont déjà toutes chargées, et un aller-retour serveur n'apporterait
 * qu'une latence. Portés par l'URL, comme le filtre de provenance des candidatures : un écran
 * filtré se recopie, se met en favori et survit à un rafraîchissement.
 */

/**
 * L'entrée désignant les lignes SANS imputation.
 *
 * ⚠️ Elle ne peut pas être la chaîne vide, si tentant que ce soit : `USelectMenu` s'appuie sur un
 * Combobox qui réserve `''` à l'absence de sélection et refuse tout item qui la porte. Le menu
 * s'ouvrait alors sur une liste VIDE, sans message à l'écran — seule la console le disait.
 *
 * Une sélection VIDE vaut « tous les codes » : plus besoin d'une entrée pour le dire.
 */
const SANS_CODE = 'sans'

const filtreTexte = ref(texteDepuisUrl(route.query.q))
const filtreCodes = ref<string[]>(listeDepuisUrl(route.query.code))
const filtreDu = ref(texteDepuisUrl(route.query.du))
const filtreAu = ref(texteDepuisUrl(route.query.au))

const filtreActif = computed(() =>
  Boolean(filtreTexte.value || filtreCodes.value.length || filtreDu.value || filtreAu.value)
)

/** La modale des filtres, sur téléphone uniquement. */
const filtresOuverts = ref(false)

/** Combien de filtres sont posés — la pastille du bouton, sur téléphone. */
const nombreDeFiltres = computed(
  () =>
    [
      Boolean(filtreTexte.value),
      filtreCodes.value.length > 0,
      Boolean(filtreDu.value),
      Boolean(filtreAu.value),
    ].filter(Boolean).length
)

function effacerLesFiltres() {
  filtreTexte.value = ''
  filtreCodes.value = []
  filtreDu.value = ''
  filtreAu.value = ''
}

// `replace` et non `push` : filtrer n'est pas naviguer. Sans cela, chaque frappe empilerait une
// entrée d'historique et le bouton « Retour » remonterait la saisie lettre par lettre.
watch([filtreTexte, filtreCodes, filtreDu, filtreAu], ([q, codes, du, au]) => {
  router.replace({
    query: {
      ...route.query,
      q: q || undefined,
      // Séparés par des virgules, et absent quand rien n'est choisi : l'URL reste lisible.
      code: codes.length ? codes.join(',') : undefined,
      du: du || undefined,
      au: au || undefined,
    },
  })
})

const choixDeCode = computed(() => [
  { value: SANS_CODE, label: t('gestion.treasury.filter_code_none') },
  ...(data.value?.codes ?? []).map((c) => ({
    value: String(c.id),
    label: `${c.code} — ${c.label}`,
  })),
])

/**
 * Le jour de l'opération en `AAAA-MM-JJ`.
 *
 * Découpé sur l'ISO en UTC, jamais sur l'heure locale : la colonne est une DATE, et la relire
 * dans le fuseau du navigateur la ferait glisser d'un jour à l'ouest de Greenwich. Les bornes du
 * filtre sont de la même forme, si bien que la comparaison de chaînes suffit — une date ISO se
 * compare lexicographiquement comme elle se compare chronologiquement.
 */
const jourDeLOperation = (line: TreasuryLine): string | null =>
  line.operationDate ? new Date(line.operationDate).toISOString().slice(0, 10) : null

const correspondAuxFiltres = (line: TreasuryLine): boolean => {
  // Par MOTS, dans un ordre quelconque : « salle location » doit trouver « Location salle ». Une
  // recherche d'un bloc ne le ferait pas, et c'est ce qu'on tape quand on cherche de mémoire.
  if (!contientTousLesMots(filtreTexte.value, lineTitle(line), line.description)) return false

  // Sélection vide = tous les codes. Sinon la ligne doit porter l'un des codes retenus, ou aucun
  // code si « sans imputation » fait partie du choix.
  if (filtreCodes.value.length) {
    const sonCode = line.code ? String(line.code.id) : SANS_CODE
    if (!filtreCodes.value.includes(sonCode)) return false
  }

  // Une période écarte nécessairement les lignes sans date : les lignes calculées n'en ont pas par
  // nature, et les entrées antérieures au champ n'en ont pas reçu. Les inclure reviendrait à dire
  // qu'elles tombent dans la période, ce qu'on ignore.
  if (filtreDu.value || filtreAu.value) {
    const jour = jourDeLOperation(line)
    if (!jour) return false
    if (filtreDu.value && jour < filtreDu.value) return false
    if (filtreAu.value && jour > filtreAu.value) return false
  }

  return true
}

const lignesFiltrees = computed(() => (data.value?.lines ?? []).filter(correspondAuxFiltres))

/**
 * Le total de ce qui est affiché — annoncé à part, jamais à la place des cartes du haut.
 *
 * Celles-ci portent le solde de l'ÉDITION. Les voir changer avec un filtre ferait lire un chiffre
 * partiel comme s'il était celui des comptes, et une capture d'écran prise filtre actif dirait
 * autre chose que ce qu'elle paraît dire.
 */
const sousTotalFiltre = computed(() => {
  const somme = (kind: 'EXPENSE' | 'INCOME') =>
    lignesFiltrees.value
      .filter((l) => l.kind === kind)
      .reduce((total, l) => total + l.settled + l.pending, 0)

  const charges = somme('EXPENSE')
  const produits = somme('INCOME')
  return { lignes: lignesFiltrees.value.length, charges, produits, solde: produits - charges }
})

const groups = computed(() => {
  const lines = lignesFiltrees.value
  return [
    {
      kind: 'EXPENSE' as const,
      label: t('gestion.treasury.expenses'),
      icon: 'i-lucide-trending-down',
      iconColor: 'text-red-500',
      lines: lines.filter((l) => l.kind === 'EXPENSE'),
    },
    {
      kind: 'INCOME' as const,
      label: t('gestion.treasury.incomes'),
      icon: 'i-lucide-trending-up',
      iconColor: 'text-emerald-500',
      lines: lines.filter((l) => l.kind === 'INCOME'),
    },
  ]
})

/*
 * ─── Le tableau ────────────────────────────────────────────────────────────────────────────────
 */

/**
 * Un seul état de tri pour les deux tableaux.
 *
 * Charges et produits sont deux vues de la même chose : trier les dépenses par montant et laisser
 * les recettes par ordre d'arrivée donnerait deux lectures contradictoires sur un même écran.
 */
const tri = ref<{ id: string; desc: boolean }[]>([])

function enTeteTriable(column: Column<TreasuryLine>, label: string) {
  const sens = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: sens
      ? sens === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(sens === 'asc'),
  })
}

const colonnes = computed((): TableColumn<TreasuryLine>[] => [
  {
    id: 'libelle',
    accessorFn: (line) => lineTitle(line),
    header: ({ column }) => enTeteTriable(column, t('gestion.treasury.column_label')),
    // Masquer le libellé laisserait des rangées qu'on ne peut plus identifier.
    enableHiding: false,
  },
  {
    // Sa propre colonne, et non une seconde ligne sous le libellé : deux lignes de hauteur
    // inégale d'une rangée à l'autre empêchent l'œil de descendre une colonne d'un trait.
    id: 'description',
    accessorFn: (line) => line.description ?? '',
    header: ({ column }) => enTeteTriable(column, t('gestion.treasury.column_description')),
  },
  {
    // Les lignes sans date se regroupent en tête d'un tri croissant : ce sont les lignes calculées
    // et les entrées antérieures au champ, et les voir ensemble vaut mieux que les voir éparses.
    id: 'date',
    accessorFn: (line) => jourDeLOperation(line) ?? '',
    header: ({ column }) => enTeteTriable(column, t('gestion.treasury.column_date')),
  },
  {
    id: 'code',
    accessorFn: (line) => (line.code ? `${line.code.code} ${line.code.label}` : ''),
    header: ({ column }) => enTeteTriable(column, t('gestion.treasury.column_code')),
  },
  {
    // Trié sur le nombre, pas sur le montant formaté : « 1 000 € » se classerait avant « 90 € ».
    id: 'montant',
    accessorFn: (line) => line.settled + line.pending,
    header: ({ column }) => enTeteTriable(column, t('gestion.treasury.column_amount')),
    /*
     * La colonne se règle sur son contenu, au lieu de s'étirer.
     *
     * `w-px` avec la mise en page automatique d'un tableau demande la largeur MINIMALE : le
     * navigateur l'élargit jusqu'à ce que le contenu tienne, et pas au-delà. `whitespace-nowrap`
     * empêche un montant de se couper en deux lignes pour satisfaire cette demande. Sans quoi la
     * colonne prenait sa part de la largeur restante et laissait un vide entre le chiffre et le
     * libellé, que l'œil doit franchir à chaque ligne.
     */
    meta: { class: { th: 'w-px whitespace-nowrap', td: 'w-px whitespace-nowrap' } },
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    enableHiding: false,
    // Deux boutons : la colonne n'a aucune raison de s'étirer non plus.
    meta: { class: { th: 'w-px whitespace-nowrap', td: 'w-px whitespace-nowrap' } },
  },
])

/**
 * Les colonnes qu'on peut masquer, et leur nom dans le menu.
 *
 * Une liste littérale, volontairement : `useColonnesDansUrl` la lit PENDANT le `setup`, et lui
 * passer un `computed` déclaré plus bas ferait lever le setup — page entièrement blanche, sans
 * erreur serveur ni encart.
 */
const COLONNES_MASQUABLES = ['description', 'date', 'code', 'montant'] as const

const libelleDeColonne = (id: string): string =>
  ({
    libelle: t('gestion.treasury.column_label'),
    description: t('gestion.treasury.column_description'),
    date: t('gestion.treasury.column_date'),
    code: t('gestion.treasury.column_code'),
    montant: t('gestion.treasury.column_amount'),
  })[id] ?? id

const { visibilite: visibiliteDesColonnes } = useColonnesDansUrl(COLONNES_MASQUABLES)

/**
 * Les deux tableaux, charges et produits.
 *
 * Un `ref` dans un `v-for` rend un tableau d'instances. Le menu ne prend que la première : cocher
 * une colonne met à jour SA visibilité, qui redescend aussitôt dans l'autre par le `v-model`
 * partagé — les deux ne peuvent donc pas diverger.
 */
const tableaux = ref<{ tableApi?: unknown }[]>([])

/**
 * Les actions de la ligne, au clic droit.
 *
 * Les mêmes que la dernière colonne, mais NOMMÉES et colorées : réduits à leur icône, un crayon et
 * une corbeille ne se distinguent qu'au survol, ce qu'un écran tactile n'offre pas. « Supprimer »
 * y porte le rouge du bouton correspondant, pour qu'on ne le choisisse pas par inadvertance.
 */
const menuContextuel = ref<
  { type?: string; label?: string; icon?: string; color?: string; onSelect?: () => void }[]
>([])

const surClicDroit = (_evenement: Event, row: { original: TreasuryLine }) => {
  const ligne = row.original

  menuContextuel.value = [
    { type: 'label', label: lineTitle(ligne) },
    ...(ligne.readOnly
      ? [
          // Une ligne calculée ne se corrige pas ici : elle renvoie vers l'écran qui la produit.
          {
            label: t('gestion.treasury.open_source'),
            icon: 'i-lucide-external-link',
            onSelect: () => navigateTo(sourceLink(ligne)),
          },
        ]
      : [
          {
            label: t('common.edit'),
            icon: 'i-lucide-pencil',
            onSelect: () => openEntryModal(ligne),
          },
          { type: 'separator' },
          {
            label: t('common.delete'),
            icon: 'i-lucide-trash-2',
            color: 'error',
            onSelect: () => removeEntry(ligne),
          },
        ]),
  ]
}

/** Montant d'une ligne : ce qui est dû, réglé ou non. */
const lineTotal = (line: TreasuryLine) => line.settled + line.pending

const totalCards = computed(() => {
  const totals = data.value?.totals
  const engaged = (amounts?: { settled: number; pending: number }) =>
    (amounts?.settled ?? 0) + (amounts?.pending ?? 0)
  const hint = (amounts?: { settled: number; pending: number }) =>
    amounts?.pending ? t('gestion.treasury.settled_amount', { amount: money(amounts.settled) }) : ''

  return [
    {
      key: 'expense',
      label: t('gestion.treasury.expenses'),
      value: money(engaged(totals?.expense)),
      hint: hint(totals?.expense),
      icon: 'i-lucide-trending-down',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
      iconColor: 'text-red-600 dark:text-red-400',
      valueClass: '',
    },
    {
      key: 'income',
      label: t('gestion.treasury.incomes'),
      value: money(engaged(totals?.income)),
      hint: hint(totals?.income),
      icon: 'i-lucide-trending-up',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      valueClass: '',
    },
    {
      key: 'to_reimburse',
      label: t('gestion.treasury.to_reimburse'),
      value: money(totals?.toReimburse?.total ?? 0),
      hint: totals?.toReimburse?.total
        ? t('gestion.treasury.to_reimburse_hint', { count: totals.toReimburse.detail.length })
        : '',
      icon: 'i-lucide-hand-coins',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      valueClass: totals?.toReimburse?.total ? 'text-amber-600 dark:text-amber-400' : '',
      // Cliquable seulement s'il y a un détail à montrer : une carte à zéro qui s'ouvre sur une
      // liste vide promet quelque chose qu'elle n'a pas.
      onClick: totals?.toReimburse?.total ? () => (detailRemboursements.value = true) : undefined,
    },
    {
      key: 'balance',
      label: t('gestion.treasury.balance'),
      value: money(totals?.balance ?? 0),
      hint: t('gestion.treasury.balance_hint'),
      icon: 'i-lucide-scale',
      iconBg: 'bg-sky-100 dark:bg-sky-900/40',
      iconColor: 'text-sky-600 dark:text-sky-400',
      valueClass:
        (totals?.balance ?? 0) < 0
          ? 'text-red-600 dark:text-red-400'
          : 'text-emerald-600 dark:text-emerald-400',
    },
  ]
})

/**
 * Le nom de qui a avancé, quelle qu'en soit l'origine.
 *
 * Deux colonnes portent la même information selon que la personne a un compte ou non. Les lire
 * ensemble ici évite de répéter le `??` à chaque endroit qui l'affiche — et d'en oublier un, ce qui
 * ferait disparaître la pastille pour les avances saisies en texte libre.
 */
const nomDeLAvance = (line: {
  advancedBy?: { pseudo: string } | null
  advancedByName?: string | null
}) => line.advancedBy?.pseudo ?? line.advancedByName ?? null

/**
 * Les noms libres déjà employés sur cette édition, pour que la modale les repropose.
 *
 * Tirés des lignes DÉJÀ chargées : aucun appel réseau de plus. Les avances remboursées en font
 * partie — c'est un carnet d'adresses, pas une liste de dettes ouvertes.
 */
const nomsAvanceConnus = computed(() => {
  const vus = new Set<string>()
  const noms: string[] = []
  for (const line of data.value?.lines ?? []) {
    const nom = (line as { advancedByName?: string | null }).advancedByName
    const cle = cleDuNomAvance(nom)
    if (!cle || vus.has(cle)) continue
    vus.add(cle)
    noms.push(nom as string)
  }
  return noms
})

/** Détail des avances par personne, ouvert depuis la carte « à rembourser ». */
const detailRemboursements = ref(false)

/**
 * Solde en une fois toutes les avances d'une personne.
 *
 * La modale se referme quand il ne reste plus rien à rembourser : la laisser ouverte sur une liste
 * vide donnerait l'impression que l'action a échoué.
 */
const rembourser = useApiActionById<{ count: number }>(
  () => `/api/editions/${editionId.value}/treasury/entries/reimburse`,
  {
    method: 'POST',
    /*
     * La clé dit d'où vient l'avance : `u:<id>` pour un compte, `n:<nom normalisé>` sinon. Le nom
     * envoyé est donc déjà normalisé — le point d'API lui applique le même normaliseur, qui est
     * idempotent, et retrouve ainsi toutes les orthographes regroupées sous cette dette.
     */
    body: (cle: string | number) => {
      const valeur = String(cle)
      return valeur.startsWith('u:')
        ? { advancedById: Number(valeur.slice(2)) }
        : { advancedByName: valeur.slice(2) }
    },
    successMessage: { title: t('gestion.treasury.reimbursed_done') },
    errorMessages: { default: t('gestion.treasury.reimbursed_error') },
    onSuccess: async () => {
      await refresh()
      if (!data.value?.totals?.toReimburse?.total) detailRemboursements.value = false
    },
  }
)

/** Justificatif affiché en grand, ou `null`. */
const justificatifOuvert = ref<string | null>(null)

/**
 * Le justificatif ouvert est-il un PDF ? Décidé sur l'extension : c'est la seule information portée
 * par l'URL, et le serveur a déjà croisé type MIME et extension au dépôt.
 */
const justificatifEstUnPdf = computed(
  () => !!justificatifOuvert.value?.toLowerCase().split('?')[0]?.endsWith('.pdf')
)

const entryModalOpen = ref(false)
const codesModalOpen = ref(false)
const editedLine = ref<TreasuryLine | null>(null)

function openEntryModal(line?: TreasuryLine) {
  editedLine.value = line ?? null
  entryModalOpen.value = true
}

async function onEntrySaved() {
  entryModalOpen.value = false
  await refresh()
}

/**
 * `execute()` ne prend pas de corps : celui-ci vient d'une fabrique. La sélection en cours est
 * donc déposée ici avant l'appel, plutôt que passée en argument.
 */
const pendingCodeChange = ref<{ source?: string; codeId: number | null }>({ codeId: null })

const assignSourceCode = useApiAction(
  () => `/api/editions/${editionId.value}/treasury/source-codes`,
  {
    method: 'PUT',
    body: () => pendingCodeChange.value,
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('gestion.treasury.code_error') },
  }
)

const assignEntryCode = useApiActionById(
  (id) => `/api/editions/${editionId.value}/treasury/entries/${id}`,
  {
    method: 'PUT',
    body: () => ({ codeId: pendingCodeChange.value.codeId }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('gestion.treasury.code_error') },
  }
)

/** Le code se choisit ligne par ligne, mais son enregistrement diffère selon l'origine. */
async function assignCode(line: TreasuryLine, codeId: number | null) {
  pendingCodeChange.value = { source: line.source, codeId }
  if (line.origin === 'source') {
    await assignSourceCode.execute()
  } else {
    await assignEntryCode.execute(line.entryId!)
  }
  await refresh()
}

const deleteEntry = useApiActionById(
  (id) => `/api/editions/${editionId.value}/treasury/entries/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.treasury.entry_deleted') },
    errorMessages: { default: t('gestion.treasury.entry_delete_error') },
    onSuccess: () => refresh(),
  }
)

async function removeEntry(line: TreasuryLine) {
  if (line.entryId) await deleteEntry.execute(line.entryId)
}

// --- Export PDF ---
/**
 * L'édition, pour l'en-tête du document.
 *
 * Un PDF détaché de l'écran n'a plus rien pour se situer : deux exercices d'années différentes se
 * ressemblent trop pour qu'on les distingue sans le nom de la convention et celui de l'édition.
 */
const editionStore = useEditionStore()
const edition = computed(() => editionStore.getEditionById(editionId.value))

/**
 * La mention du filtre, portée par le document lui-même.
 *
 * Les exports partent de ce qui est affiché : filtrer par code puis exporter donne le détail de ce
 * code, et c'est l'usage même d'un filtre comptable. Mais un fichier se transmet, et rien dans un
 * tableau de lignes ne dit qu'il est partiel — d'où cette mention, sans laquelle un extrait se
 * prend pour les comptes complets.
 *
 * Vide quand aucun filtre n'est posé : le document est alors bien celui de l'édition entière.
 */
const mentionDuFiltre = computed(() => {
  if (!filtreActif.value) return ''

  const morceaux: string[] = []
  if (filtreTexte.value) morceaux.push(`« ${filtreTexte.value} »`)
  if (filtreCodes.value.length) {
    morceaux.push(
      filtreCodes.value
        .map((v) => choixDeCode.value.find((c) => c.value === v)?.label ?? v)
        .join(', ')
    )
  }
  if (filtreDu.value || filtreAu.value) {
    morceaux.push(
      t('gestion.treasury.filter_period_summary', {
        from: filtreDu.value || '…',
        to: filtreAu.value || '…',
      })
    )
  }

  return t('gestion.treasury.filtered_export_notice', {
    filters: morceaux.filter(Boolean).join(' · '),
  })
})

onMounted(() => {
  // Sans `force` : la page ne l'affiche pas, elle ne s'en sert que pour titrer l'export, et la
  // valeur déjà en cache fait l'affaire.
  editionStore.fetchEditionById(editionId.value).catch(() => {
    // Un en-tête sans nom d'édition vaut mieux qu'une page qui refuse de s'afficher : l'export
    // retombe sur le titre générique.
  })
})

/**
 * Le document que l'on envoie au trésorier, au comptable ou à l'assemblée générale.
 *
 * Ce qui en sort est décidé dans `export-tresorerie`, éprouvé par des tests : un PDF ne se
 * rattrape pas une fois envoyé, et un sous-total faux ne se voit qu'à la lecture.
 *
 * `jspdf` est importé à la demande — quelques centaines de kilo-octets qui n'ont rien à faire dans
 * le chargement d'une page que l'on n'exporte pas à chaque visite.
 */
/**
 * La trésorerie en CSV.
 *
 * Même ordre de lignes que le PDF — `regrouperParCode`, donc l'ordre du plan comptable avec les
 * lignes sans code en dernier — et même nom de fichier, à l'extension près : les deux exports d'une
 * même page doivent se comparer sans effort.
 *
 * Construit dans le navigateur comme le PDF : la page détient déjà toutes les lignes, et les
 * origines calculées portent des clés i18n que le serveur devrait sinon recopier en français.
 */
function exporterCsv() {
  const lignes = lignesFiltrees.value as TreasuryLine[]
  if (lignes.length === 0) return

  const contenu = tresorerieVersCsv(lignes, t, lineTitle as (l: TreasuryLine) => string)

  /*
   * La mention du filtre passe par le NOM du fichier, pas par son contenu.
   *
   * Une ligne de texte avant l'en-tête ferait sauter la lecture du fichier par un tableur : la
   * première ligne d'un CSV est l'en-tête des colonnes, et rien d'autre. Le nom, lui, se lit dans
   * la boîte de réception comme dans le dossier où il est rangé.
   */
  const suffixe = filtreActif.value ? '-extrait' : ''
  const nom = nomFichierTresorerie(edition.value?.name, new Date()).replace(
    /\.pdf$/,
    `${suffixe}.csv`
  )

  // `BOM_UTF8` en tête : sans lui, Excel sous Windows lit le fichier en ANSI et « Réglé » devient
  // « RÃ©glÃ© » sur toute la colonne. Voir `shared/utils/csv.ts`.
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(
    new Blob([BOM_UTF8 + contenu], { type: 'text/csv;charset=utf-8' })
  )
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(lien.href)
}

async function exporterPdf() {
  const lignes = lignesFiltrees.value as TreasuryLine[]
  if (lignes.length === 0) return

  // Ni indicateur d'attente ni rattrapage d'erreur ici : `UiExportMenu` tient les deux. Il
  // affiche le tournant pendant le chargement à la demande de `jspdf` et signale l'échec par un
  // toast — les dédoubler ici en produirait deux pour une seule panne.
  {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)

    // Portrait : cinq colonnes dont une seule de texte libre y tiennent, et un document comptable
    // se range et s'imprime plus volontiers dans ce sens.
    const doc = new jsPDF()
    const MARGE = 14
    const maintenant = new Date()

    // Le montant tel que jsPDF sait l'imprimer : sans les espaces insécables que ses polices
    // standard ne connaissent pas. Voir `montantPourPdf`.
    const montant = (centimes: number) => montantPourPdf(money(centimes))

    const charges = regrouperParCode(lignes, 'EXPENSE')
    const produits = regrouperParCode(lignes, 'INCOME')
    const totalCharges = totalDesGroupes(charges)
    const totalProduits = totalDesGroupes(produits)
    const solde = soldeDe(totalCharges, totalProduits)

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(t('gestion.treasury.title'), MARGE, 16)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const sousTitre = [edition.value?.convention?.name, edition.value?.name]
      .filter(Boolean)
      .join(' - ')
    if (sousTitre) doc.text(sousTitre, MARGE, 22)

    // La mention du filtre s'ajoute à la ligne de date plutôt que d'en occuper une nouvelle : une
    // ligne de plus décalerait tout ce qui suit, et chaque `startY` du document avec elle.
    doc.setFontSize(9)
    doc.text(
      [`${formatDate(maintenant)} - ${currency.value}`, mentionDuFiltre.value]
        .filter(Boolean)
        .join(' - '),
      MARGE,
      sousTitre ? 28 : 22
    )

    // Les chiffres clés d'abord, comme à l'écran : c'est ce qu'on lit en premier, et souvent la
    // seule chose que retiendra une assemblée.
    // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
    doc.autoTable({
      startY: sousTitre ? 33 : 27,
      margin: { left: MARGE, right: MARGE },
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [14, 116, 144] },
      head: [['', t('gestion.treasury.export_settled'), t('gestion.treasury.export_engaged')]],
      body: [
        [t('gestion.treasury.expenses'), montant(totalCharges.regle), montant(totalCharges.engage)],
        [
          t('gestion.treasury.incomes'),
          montant(totalProduits.regle),
          montant(totalProduits.engage),
        ],
        [t('gestion.treasury.balance'), montant(solde.regle), montant(solde.engage)],
      ],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      // Le solde est la ligne qu'on cherche du regard : elle se distingue des deux autres.
      didParseCell: (donnees: any) => {
        if (donnees.section === 'body' && donnees.row.index === 2) {
          donnees.cell.styles.fontStyle = 'bold'
        }
      },
    })

    /**
     * Les fonds des lignes de synthèse.
     *
     * Un gris neutre plutôt qu'une déclinaison du rouge ou du vert de l'en-tête : ces couleurs-là
     * disent déjà la nature du tableau, et les réemployer ferait croire à une information de plus.
     * Le total est le plus soutenu des deux, parce que c'est le chiffre qu'on cherche en dernier.
     */
    const TEINTE_SOUS_TOTAL: [number, number, number] = [237, 240, 243]
    const TEINTE_TOTAL: [number, number, number] = [214, 220, 227]

    const enTeteTableau = [
      t('gestion.treasury.export_code'),
      t('gestion.treasury.export_code_label'),
      t('gestion.treasury.entry_title'),
      t('gestion.treasury.export_settled'),
      t('gestion.treasury.export_engaged'),
    ]
    const sansCode = t('gestion.treasury.export_without_code')
    const sousTotal = t('gestion.treasury.export_subtotal')

    /** Un tableau par nature, précédé de son titre et suivi de son total. */
    const tableauDeNature = (
      titre: string,
      // ⚠️ Le type est nommé, et non déduit par `ReturnType<typeof regrouperParCode>` : la
      // fonction étant générique, `ReturnType` l'instancie sur sa CONTRAINTE — donc sur le type
      // minimal de l'util —, et la fonction de titrage ne pourrait plus lire `origin` ni
      // `source`. C'est ainsi que l'erreur de typage s'était déplacée ici après un premier
      // correctif.
      groupes: GroupeDeCode<TreasuryLine>[],
      total: TotalDeNature,
      teinte: [number, number, number]
    ) => {
      // @ts-expect-error - `lastAutoTable` est posé par le plugin après chaque tableau
      const y = (doc.lastAutoTable?.finalY ?? 40) + 12
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(titre, MARGE, y)

      const { lignes: corps, sousTotaux } = preparerTableau(
        groupes,
        montant,
        lineTitle,
        sansCode,
        sousTotal
      )
      // Le total ferme le tableau : son rang est celui qui suit la dernière écriture.
      const rangDuTotal = corps.length

      // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
      doc.autoTable({
        startY: y + 4,
        margin: { left: MARGE, right: MARGE },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: teinte },
        head: [enTeteTableau],
        body: [
          ...corps,
          [
            {
              content: t('gestion.treasury.export_total'),
              colSpan: 3,
              styles: { fontStyle: 'bold' },
            },
            { content: montant(total.regle), styles: { fontStyle: 'bold' } },
            { content: montant(total.engage), styles: { fontStyle: 'bold' } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 38 },
          3: { cellWidth: 26, halign: 'right' },
          4: { cellWidth: 26, halign: 'right' },
        },
        // Les lignes de synthèse se détachent du fond, pour qu'on les repère sans les lire. Deux
        // teintes et non une : un sous-total et un total ne se lisent pas au même niveau, et le
        // zébrage du thème par défaut suffirait sinon à les confondre avec une écriture.
        didParseCell: (donnees: any) => {
          if (donnees.section !== 'body') return
          if (donnees.row.index === rangDuTotal) {
            donnees.cell.styles.fillColor = TEINTE_TOTAL
            donnees.cell.styles.fontStyle = 'bold'
          } else if (sousTotaux.includes(donnees.row.index)) {
            donnees.cell.styles.fillColor = TEINTE_SOUS_TOTAL
            donnees.cell.styles.fontStyle = 'bold'
          }
        },
      })
    }

    tableauDeNature(t('gestion.treasury.expenses'), charges, totalCharges, [153, 27, 27])
    tableauDeNature(t('gestion.treasury.incomes'), produits, totalProduits, [6, 95, 70])

    // Le suffixe dit que le document est un extrait, comme pour le CSV : un PDF se transmet, et
    // son tableau de lignes ne dit rien de ce qui a été écarté.
    const suffixe = filtreActif.value ? '-extrait' : ''
    doc.save(
      nomFichierTresorerie(edition.value?.name, maintenant).replace(/\.pdf$/, `${suffixe}.pdf`)
    )
  }
}
</script>
