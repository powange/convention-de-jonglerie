<template>
  <UContainer class="py-10">
    <AdminNav />
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">
        {{ codes.length }} code(s) · {{ totalUtilisations }} utilisation(s) au total
      </p>
      <UButton icon="i-heroicons-plus" label="Créer un code" @click="ouvrirCreation" />
    </div>

    <UTable :data="codes" :columns="colonnes" :loading="pending" @select="ouvrir">
      <template #code-cell="{ row }">
        <p class="font-mono font-semibold">{{ row.original.code }}</p>
        <p v-if="row.original.label" class="text-xs text-muted">{{ row.original.label }}</p>
      </template>
      <template #avantage-cell="{ row }">{{ row.original.resume }}</template>
      <template #formules-cell="{ row }">{{ portee(row.original) }}</template>
      <template #utilisations-cell="{ row }">
        <span class="tabular-nums">
          {{ row.original.utilisations }} / {{ row.original.maxRedemptions ?? '∞' }}
        </span>
      </template>
      <template #validite-cell="{ row }">
        {{ row.original.expiresAt ? date(row.original.expiresAt) : '—' }}
      </template>
      <template #etat-cell="{ row }">
        <UBadge
          :color="ETATS[row.original.etat]?.couleur ?? 'neutral'"
          variant="subtle"
          :label="ETATS[row.original.etat]?.libelle ?? row.original.etat"
        />
      </template>
      <template #actions-cell="{ row }">
        <UButton
          size="xs"
          variant="ghost"
          icon="i-heroicons-link"
          label="Copier le lien"
          @click.stop="copierLien(row.original.code)"
        />
      </template>
    </UTable>

    <UModal
      v-model:open="creationOuverte"
      title="Nouveau code promo"
      description="Le lien du code ouvre la page tarifs avec les prix remisés. L'avantage ne se modifie plus une fois créé."
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Code" required help="Majuscules, chiffres et tirets.">
            <UInput
              v-model="formulaire.code"
              placeholder="ASSO-JONGLE"
              class="w-full font-mono"
              @update:model-value="(v) => (formulaire.code = normaliserCode(String(v)))"
            />
          </UFormField>
          <UFormField label="Note interne" help="Visible seulement ici.">
            <UInput
              v-model="formulaire.label"
              placeholder="Associations de jonglerie"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Avantage" required>
            <USelect v-model="formulaire.advantage" :items="AVANTAGES_LIBELLES" class="w-full" />
          </UFormField>
          <UFormField
            v-if="formulaire.advantage === 'percent'"
            label="Remise (%)"
            required
            help="De 1 à 100."
          >
            <UInputNumber v-model="formulaire.pourcentage" :min="1" :max="100" class="w-full" />
          </UFormField>
          <UFormField
            v-else-if="formulaire.advantage === 'amount'"
            label="Montant retiré"
            required
            help="Retiré de chaque paiement couvert."
          >
            <UiMoneyInput v-model="formulaire.montant" currency="EUR" class="w-full" />
          </UFormField>
          <div v-else class="hidden sm:block" />

          <UFormField label="Formules" help="Aucune cochée : toutes.">
            <div class="flex flex-wrap gap-4 pt-1">
              <UCheckbox
                v-for="f in FORMULES_PAYANTES"
                :key="f.cle"
                :model-value="formulaire.formules.includes(f.cle)"
                :label="f.libelle"
                @update:model-value="(v) => basculer(formulaire.formules, f.cle, v === true)"
              />
            </div>
          </UFormField>
          <UFormField label="Périodes" help="Aucune cochée : les deux.">
            <div class="flex flex-wrap gap-4 pt-1">
              <UCheckbox
                :model-value="formulaire.periods.includes('monthly')"
                label="Mensuel"
                @update:model-value="(v) => basculer(formulaire.periods, 'monthly', v === true)"
              />
              <UCheckbox
                :model-value="formulaire.periods.includes('annual')"
                label="Annuel"
                @update:model-value="(v) => basculer(formulaire.periods, 'annual', v === true)"
              />
            </div>
          </UFormField>

          <UFormField label="Durée de l'avantage" required>
            <USelect v-model="formulaire.duration" :items="DUREES_LIBELLES" class="w-full" />
          </UFormField>
          <UFormField v-if="formulaire.duration === 'months'" label="Nombre de mois" required>
            <UInputNumber v-model="formulaire.durationMonths" :min="1" :max="120" class="w-full" />
          </UFormField>
          <div v-else class="hidden sm:block" />

          <UFormField label="Valable à partir du" help="Vide : dès maintenant.">
            <UInput v-model="formulaire.startsAt" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Valable jusqu'au" help="Vide : sans limite.">
            <UInput v-model="formulaire.expiresAt" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Utilisations maximum" help="Vide : illimité. Une seule par compte.">
            <UInputNumber
              v-model="formulaire.maxRedemptions"
              :min="1"
              placeholder="Illimité"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Réservé à" help="Vide : tout le monde.">
            <UInput
              v-model="formulaire.reservedEmail"
              type="email"
              placeholder="contact@festival.fr"
              class="w-full"
            />
          </UFormField>
        </div>
        <UAlert
          class="mt-4"
          color="neutral"
          variant="subtle"
          icon="i-heroicons-eye"
          :title="`Aperçu : ${apercu}`"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Annuler"
            @click="creationOuverte = false"
          />
          <UButton
            icon="i-heroicons-check"
            label="Créer le code"
            :loading="creation"
            :disabled="formulaire.code.length < 3"
            @click="creer"
          />
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

<script setup lang="ts">
/**
 * Administration des codes promo de Flowvent (shared/codes-promo.ts, docs/flowvent-abonnements.md) :
 * la liste, la création, et le lien à transmettre (`/pricing?code=…`). Le détail d'un code (comptes
 * qui l'ont utilisé, désactivation) est sur sa page.
 */
import type { TableColumn, TableRow } from '@nuxt/ui'

import { normaliserCode, resumeAvantage } from '#shared/codes-promo'
import { FORMULES, FORMULES_PAYANTES } from '#shared/formules'

definePageMeta({ middleware: ['admin'] })
useSeoMeta({ title: 'Codes promo — Administration Flowvent' })

interface CodeListe {
  id: number
  code: string
  label: string | null
  resume: string
  formules: string[] | null
  periods: string[] | null
  utilisations: number
  maxRedemptions: number | null
  expiresAt: string | null
  etat: string
}

const toast = useToast()
const { data, pending, refresh } = await useFetch<{ codes: CodeListe[] }>('/api/admin/promo-codes')
const codes = computed(() => data.value?.codes ?? [])
const totalUtilisations = computed(() => codes.value.reduce((n, c) => n + c.utilisations, 0))

const ETATS: Record<
  string,
  { libelle: string; couleur: 'success' | 'warning' | 'neutral' | 'error' | 'info' }
> = {
  actif: { libelle: 'Actif', couleur: 'success' },
  'a-venir': { libelle: 'À venir', couleur: 'info' },
  epuise: { libelle: 'Épuisé', couleur: 'warning' },
  expire: { libelle: 'Expiré', couleur: 'neutral' },
  desactive: { libelle: 'Désactivé', couleur: 'error' },
}

const colonnes: TableColumn<CodeListe>[] = [
  { id: 'code', header: 'Code' },
  { id: 'avantage', header: 'Avantage' },
  { id: 'formules', header: 'Formules' },
  { id: 'utilisations', header: 'Utilisations' },
  { id: 'validite', header: "Valable jusqu'au" },
  { id: 'etat', header: 'État' },
  { id: 'actions', header: '' },
]

function portee(c: { formules: string[] | null; periods: string[] | null }) {
  const formules = c.formules?.length
    ? c.formules.map((f) => FORMULES.find((x) => x.cle === f)?.libelle ?? f).join(', ')
    : 'Toutes'
  const periodes =
    c.periods?.length === 1 ? (c.periods[0] === 'annual' ? ' · annuel' : ' · mensuel') : ''
  return formules + periodes
}

// Fuseau fixé (celui de Flowvent) : sans lui, le rendu serveur (UTC) et le navigateur ne tombent
// pas sur le même jour pour une fin de validité à 23 h 59, et l'hydratation diverge.
const date = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })

const ouvrir = (_e: Event, row: TableRow<CodeListe>) =>
  navigateTo(`/admin/codes-promo/${row.original.id}`)

async function copierLien(code: string) {
  const lien = `${window.location.origin}/pricing?code=${encodeURIComponent(code)}`
  try {
    await navigator.clipboard.writeText(lien)
    toast.add({
      title: 'Lien copié',
      description: lien,
      icon: 'i-heroicons-check',
      color: 'success',
    })
  } catch {
    toast.add({ title: 'Copie impossible', description: lien, color: 'warning' })
  }
}

// Création.
const AVANTAGES_LIBELLES = [
  { label: 'Remise en pourcentage', value: 'percent' },
  { label: 'Montant retiré', value: 'amount' },
  { label: 'Gratuité', value: 'free' },
]
const DUREES_LIBELLES = [
  { label: 'Le premier paiement', value: 'once' },
  { label: 'Pendant N mois', value: 'months' },
  { label: 'À vie', value: 'forever' },
]

const vierge = () => ({
  code: '',
  label: '',
  advantage: 'percent' as 'percent' | 'amount' | 'free',
  pourcentage: 20 as number | null,
  montant: null as number | null,
  formules: [] as string[],
  periods: [] as string[],
  duration: 'once' as 'once' | 'months' | 'forever',
  durationMonths: 12 as number | null,
  startsAt: '',
  expiresAt: '',
  maxRedemptions: null as number | null,
  reservedEmail: '',
})
const formulaire = reactive(vierge())
const creationOuverte = ref(false)

function ouvrirCreation() {
  Object.assign(formulaire, vierge())
  creationOuverte.value = true
}

function basculer(liste: string[], valeur: string, coche: boolean) {
  const i = liste.indexOf(valeur)
  if (coche && i < 0) liste.push(valeur)
  if (!coche && i >= 0) liste.splice(i, 1)
}

const valeur = computed(() =>
  formulaire.advantage === 'percent'
    ? (formulaire.pourcentage ?? 0)
    : formulaire.advantage === 'amount'
      ? Math.round((formulaire.montant ?? 0) * 100)
      : 0
)
const apercu = computed(
  () =>
    `${resumeAvantage({
      advantage: formulaire.advantage,
      value: valeur.value,
      duration: formulaire.duration,
      durationMonths: formulaire.durationMonths,
    })} · ${portee(formulaire)}`
)

const { execute: creer, loading: creation } = useApiAction('/api/admin/promo-codes', {
  method: 'POST',
  body: () => ({
    code: formulaire.code,
    label: formulaire.label || null,
    advantage: formulaire.advantage,
    value: valeur.value,
    formules: formulaire.formules,
    periods: formulaire.periods,
    duration: formulaire.duration,
    durationMonths: formulaire.duration === 'months' ? formulaire.durationMonths : null,
    // Dates converties ICI, à l'heure de l'administrateur : envoyées sans fuseau, le serveur les lirait
    // en UTC et « jusqu'au 31 décembre » finirait le 1er janvier à 1 h.
    startsAt: formulaire.startsAt
      ? new Date(`${formulaire.startsAt}T00:00:00`).toISOString()
      : null,
    // Valable JUSQU'AU jour indiqué inclus : jusqu'à la fin de cette journée.
    expiresAt: formulaire.expiresAt
      ? new Date(`${formulaire.expiresAt}T23:59:59`).toISOString()
      : null,
    maxRedemptions: formulaire.maxRedemptions,
    reservedEmail: formulaire.reservedEmail || null,
  }),
  successMessage: { title: 'Code créé' },
  errorMessages: { default: "Le code n'a pas pu être créé" },
  onSuccess: async () => {
    creationOuverte.value = false
    await refresh()
  },
})
</script>
