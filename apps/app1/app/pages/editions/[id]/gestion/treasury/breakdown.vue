<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">{{ $t('gestion.treasury.breakdown_title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ $t('gestion.treasury.breakdown_subtitle') }}
        </p>
      </div>
      <UButton
        :to="`/editions/${editionId}/gestion/treasury`"
        icon="i-heroicons-arrow-left"
        color="neutral"
        variant="ghost"
      >
        {{ $t('gestion.treasury.title') }}
      </UButton>
    </div>

    <USkeleton v-if="pending" class="h-64 w-full" />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-triangle"
      :title="$t('common.error')"
      :description="error.message"
    />

    <template v-else>
      <!--
        Deux sections, dans l'ordre des exports : charges puis produits. L'écran et le PDF se
        lisent alors pareil, ce qui est la seule façon de les comparer sans y passer la soirée.
      -->
      <TreasuryBreakdownSection
        :titre="$t('gestion.treasury.expenses')"
        :groupes="groupesDeCharges"
        :total="totalDesCharges"
        :money="money"
      />
      <TreasuryBreakdownSection
        :titre="$t('gestion.treasury.incomes')"
        :groupes="groupesDeProduits"
        :total="totalDesProduits"
        :money="money"
      />

      <!--
        Le solde général : produits moins charges.

        📍 C'EST AUSSI UN CONTRÔLE. L'engagé doit valoir exactement la carte « Solde » du compte de
        résultat — même chiffre, deux chemins de calcul. Deux écrans qui ne tombent pas d'accord se
        voient alors d'un coup d'œil, au lieu de se découvrir en assemblée générale.
      -->
      <UCard>
        <!-- `data-solde-general` plutôt qu'un chemin dans la structure : un parcours qui vise par
             la position suit la mise en page, et attrape le bloc du libellé le jour où l'on ajoute
             un conteneur. C'est exactement ce qui est arrivé en écrivant ce test. -->
        <div data-solde-general class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="font-semibold">{{ $t('gestion.treasury.balance') }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('gestion.treasury.balance_hint') }}
            </p>
          </div>
          <div class="flex items-center gap-6 shrink-0">
            <div class="text-right">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('gestion.treasury.export_engaged') }}
              </p>
              <p class="text-lg font-semibold tabular-nums" :class="couleurDuSolde(solde.engage)">
                {{ money(solde.engage) }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('gestion.treasury.export_settled') }}
              </p>
              <p class="text-lg font-semibold tabular-nums" :class="couleurDuSolde(solde.regle)">
                {{ money(solde.regle) }}
              </p>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { regrouperParCode, totalDesGroupes, type LigneTresorerie } from '~/utils/export-tresorerie'

import { DEFAULT_CURRENCY, formatCents } from '~~/shared/utils/money'

/**
 * La répartition par imputation : une ligne par code, et son total.
 *
 * C'est une **balance** au sens comptable — un total par compte — et non un grand livre : le détail
 * des écritures reste sur la page de trésorerie, qui est faite pour ça.
 *
 * ## Trois partis pris
 *
 * **Lecture seule.** Aucun sélecteur de code, aucune action : les montants et les imputations se
 * corrigent sur la trésorerie, qui est le seul endroit où on les écrit. Deux écrans modifiant la
 * même donnée finissent toujours par diverger sur une garde ou un rafraîchissement.
 *
 * **Sans filtre, jamais.** La page montre l'édition ENTIÈRE. Un récapitulatif comptable doit être
 * le même pour tout le monde, et correspondre au PDF ; un total filtré se lit comme un total, et
 * c'est ainsi qu'on présente un chiffre faux en assemblée générale.
 *
 * ⚠️ **Le regroupement n'est PAS réimplémenté ici.** `regrouperParCode` et `totalDesGroupes` sont
 * ceux des exports CSV et PDF — ordre du plan comptable, « sans code » en fin de liste, total
 * calculé sur les groupes et non sur les lignes. Une seconde implémentation aurait fini par
 * diverger, et un total d'écran qui ne retombe plus sur celui du PDF ne s'explique pas six mois
 * plus tard.
 */
definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t, locale } = useI18n()

const editionId = computed(() => parseInt(route.params.id as string))

/** Ce que cette page lit du rapport : les montants par code, rien de plus. */
interface LigneDeRepartition extends LigneTresorerie {
  key: string
}

/*
 * Le MÊME point d'API que la trésorerie, et pas un nouveau.
 *
 * Il rend déjà les lignes avec leur code, leur sens et leurs montants : en ajouter un second qui
 * recalculerait la même chose serait la meilleure façon d'obtenir deux vérités.
 */
const { data, pending, error } = await useFetch<{
  currency: string
  lines: LigneDeRepartition[]
}>(() => `/api/editions/${editionId.value}/treasury`, {
  key: `treasury-breakdown-${editionId.value}`,
  transform: (reponse: any) => reponse?.data ?? reponse,
})

const currency = computed(() => data.value?.currency || DEFAULT_CURRENCY)
const money = (cents: number) => formatCents(cents, currency.value, locale.value)

const lignes = computed(() => data.value?.lines ?? [])

const groupesDeCharges = computed(() => regrouperParCode([...lignes.value], 'EXPENSE'))
const groupesDeProduits = computed(() => regrouperParCode([...lignes.value], 'INCOME'))
const totalDesCharges = computed(() => totalDesGroupes(groupesDeCharges.value))
const totalDesProduits = computed(() => totalDesGroupes(groupesDeProduits.value))

/**
 * Produits moins charges, sur l'engagé comme sur le réglé.
 *
 * `soldeDe` est celui des exports : le chiffre du bas de cette page est donc le même que celui du
 * PDF, par construction et non par coïncidence.
 */
const solde = computed(() => soldeDe(totalDesCharges.value, totalDesProduits.value))

/** Un solde négatif se voit : c'est la seule information que la couleur ajoute ici. */
const couleurDuSolde = (montant: number) =>
  montant < 0 ? 'text-error' : 'text-gray-900 dark:text-white'

useSeoMeta({
  title: t('gestion.treasury.breakdown_title'),
})
</script>
