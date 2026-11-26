<template>
  <!-- Plus large que le défaut : chaque ligne porte un libellé, une imputation et un montant.
       `content` et non `width` — `UModal` n'a pas de part `width`, et une part inventée est muette. -->
  <UModal
    v-model:open="isOpen"
    :ui="{ content: 'sm:max-w-3xl' }"
    :title="$t('gestion.treasury.to_pay_out')"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          :description="$t('gestion.treasury.payouts_help')"
        />

        <!-- Les deux vues demandées : un virement par compte, ou le détail ligne à ligne. -->
        <UFieldGroup>
          <UButton
            v-for="vue in vues"
            :key="vue.value"
            :color="mode === vue.value ? 'primary' : 'neutral'"
            :variant="mode === vue.value ? 'solid' : 'outline'"
            :icon="vue.icon"
            :label="vue.label"
            @click="mode = vue.value"
          />
        </UFieldGroup>

        <!-- Vue GROUPÉE : un bloc par compte, c'est-à-dire un virement à faire. -->
        <ul v-if="mode === 'groupe'" class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="destinataire in destinataires" :key="destinataire.cle" class="py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="font-medium truncate">{{ destinataire.label }}</p>
                <!-- L'IBAN par groupes de quatre, comme sur un relevé : c'est ainsi qu'on le
                     relit pour le recopier dans sa banque. -->
                <p v-if="destinataire.iban" class="font-mono text-xs text-gray-500 truncate">
                  {{ formaterIbanParGroupes(destinataire.iban) }}
                  <span v-if="destinataire.bic"> · {{ destinataire.bic }}</span>
                </p>
                <p v-else class="text-xs text-amber-600 dark:text-amber-400">
                  {{ $t('gestion.treasury.payout_no_iban') }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  {{
                    $t('gestion.treasury.payout_lines_count', { count: destinataire.lignes.length })
                  }}
                </p>
              </div>
              <span class="font-semibold shrink-0 tabular-nums">
                {{ money(destinataire.montant) }}
              </span>
            </div>
          </li>
        </ul>

        <!-- Vue PAR ENTRÉE : chaque dépense séparément, avec son destinataire rappelé. -->
        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="ligne in lignesAPlat" :key="ligne.cle" class="py-2">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate">{{ ligne.libelle }}</p>
                <p class="text-xs text-gray-500 truncate">
                  {{ ligne.destinataire }}
                  <span v-if="ligne.code"> · {{ ligne.code.code }} {{ ligne.code.label }}</span>
                </p>
              </div>
              <span class="shrink-0 tabular-nums">{{ money(ligne.montant) }}</span>
            </div>
          </li>
        </ul>

        <!-- Le total, répété en bas : après avoir fait défiler vingt lignes, il n'est plus à
             l'écran, et c'est le chiffre qu'on vérifie avant de passer à sa banque. -->
        <div class="flex items-center justify-between border-t pt-3 dark:border-gray-800">
          <span class="font-medium">{{ $t('gestion.treasury.payout_total') }}</span>
          <span class="font-semibold tabular-nums">{{ money(total) }}</span>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { formaterIbanParGroupes } from '#core/shared/utils/coordonnees-bancaires'

interface LigneAVerser {
  cle: string
  libelle: string
  montant: number
  code: { code: string; label: string } | null
}

interface Destinataire {
  cle: string
  payeeId: number
  label: string
  iban: string | null
  bic: string | null
  montant: number
  lignes: LigneAVerser[]
}

const props = defineProps<{
  open: boolean
  destinataires: Destinataire[]
  total: number
  /** Le formateur de la page : la devise appartient à l'édition, pas à ce composant. */
  money: (centimes: number) => string
}>()

const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const mode = ref<'groupe' | 'lignes'>('groupe')

const vues = computed(() => [
  {
    value: 'groupe' as const,
    label: t('gestion.treasury.payout_by_account'),
    icon: 'i-heroicons-banknotes',
  },
  {
    value: 'lignes' as const,
    label: t('gestion.treasury.payout_by_entry'),
    icon: 'i-lucide-list',
  },
])

/**
 * Les lignes à plat, chacune rappelant son destinataire.
 *
 * ⚠️ Dérivées du MÊME regroupement que la vue groupée, et non rechargées autrement : les deux vues
 * doivent montrer exactement les mêmes écritures et sommer au même total. Les obtenir de deux
 * sources ferait deux règles à tenir en accord, et un écart entre les deux vues ne se remarquerait
 * qu'en recomptant à la main.
 */
const lignesAPlat = computed(() =>
  props.destinataires
    .flatMap((destinataire) =>
      destinataire.lignes.map((ligne) => ({ ...ligne, destinataire: destinataire.label }))
    )
    .sort((a, b) => b.montant - a.montant)
)
</script>
