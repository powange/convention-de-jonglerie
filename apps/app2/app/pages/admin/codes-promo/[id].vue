<template>
  <UContainer class="py-10">
    <AdminNav />
    <UButton
      to="/admin/codes-promo"
      variant="link"
      color="neutral"
      icon="i-heroicons-arrow-left"
      label="Tous les codes"
      class="-ml-2 mb-4"
    />

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      title="Code introuvable."
    />

    <div v-else-if="code" class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="font-mono text-2xl font-bold">{{ code.code }}</h2>
          <p class="mt-1 text-muted">{{ code.resume }} · {{ portee }}</p>
          <p v-if="code.label" class="mt-1 text-sm text-muted">{{ code.label }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            variant="outline"
            color="neutral"
            icon="i-heroicons-link"
            label="Copier le lien"
            @click="copierLien"
          />
          <USwitch
            :model-value="code.active"
            :label="code.active ? 'Actif' : 'Désactivé'"
            :disabled="bascule"
            aria-label="Activer le code"
            @update:model-value="(v: boolean) => basculer(v)"
          />
        </div>
      </div>

      <UCard>
        <dl class="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt class="text-muted">Utilisations</dt>
            <dd class="font-semibold tabular-nums">
              {{ code.redemptions.length }} / {{ code.maxRedemptions ?? '∞' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">Valable</dt>
            <dd class="font-semibold">{{ validite }}</dd>
          </div>
          <div>
            <dt class="text-muted">Réservé à</dt>
            <dd class="font-semibold">{{ code.reservedEmail ?? 'tout le monde' }}</dd>
          </div>
          <div>
            <dt class="text-muted">Créé le</dt>
            <dd class="font-semibold">{{ date(code.createdAt) }}</dd>
          </div>
        </dl>
        <p class="mt-4 text-xs text-muted">
          Désactiver un code empêche toute nouvelle utilisation. Ceux qui en bénéficient déjà
          gardent leur avantage jusqu'à son terme.
        </p>
      </UCard>

      <div>
        <h3 class="mb-3 font-semibold">Comptes qui l'ont utilisé</h3>
        <UTable :data="code.redemptions" :columns="colonnes" :empty="'Personne pour l’instant.'">
          <template #compte-cell="{ row }">
            <ULink :to="`/admin/utilisateurs/${row.original.user.id}`">
              {{ row.original.user.pseudo }}
            </ULink>
            <p class="text-xs text-muted">{{ row.original.user.email }}</p>
          </template>
          <template #formule-cell="{ row }">
            {{ libelleFormuleAbonnement(row.original.formule, row.original.plan) }}
          </template>
          <template #montant-cell="{ row }">
            <span class="tabular-nums">{{ euros(row.original.amountPaid) }}</span>
          </template>
          <template #date-cell="{ row }">{{ date(row.original.createdAt) }}</template>
        </UTable>
      </div>

      <div v-if="code.redemptions.length === 0" class="flex justify-end">
        <UButton
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          label="Supprimer ce code"
          :loading="suppression"
          @click="supprimer"
        />
      </div>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
/**
 * Le détail d'un code promo : ses réglages, son activation, et les comptes qui l'ont utilisé. Un code
 * jamais utilisé se supprime (faute de frappe) ; un code utilisé se désactive seulement.
 */
import type { TableColumn } from '@nuxt/ui'

import { FORMULES, euros } from '#shared/formules'

definePageMeta({ middleware: ['admin'] })

interface Utilisation {
  id: number
  formule: string
  plan: string
  amountPaid: number
  createdAt: string
  user: { id: number; pseudo: string; email: string }
}
interface CodeDetail {
  id: number
  code: string
  label: string | null
  resume: string
  formules: string[] | null
  periods: string[] | null
  active: boolean
  startsAt: string | null
  expiresAt: string | null
  maxRedemptions: number | null
  reservedEmail: string | null
  createdAt: string
  redemptions: Utilisation[]
}

const route = useRoute()
const toast = useToast()
const id = String(route.params.id)
const { data, error, refresh } = await useFetch<{ code: CodeDetail }>(
  `/api/admin/promo-codes/${id}`
)
const code = computed(() => data.value?.code)
useSeoMeta({ title: () => `${code.value?.code ?? 'Code promo'} — Administration Flowvent` })

// Fuseau fixé (celui de Flowvent) : sans lui, le rendu serveur (UTC) et le navigateur ne tombent
// pas sur le même jour pour une fin de validité à 23 h 59, et l'hydratation diverge.
const date = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })

const portee = computed(() => {
  const c = code.value
  if (!c) return ''
  const formules = c.formules?.length
    ? c.formules.map((f) => FORMULES.find((x) => x.cle === f)?.libelle ?? f).join(', ')
    : 'toutes les formules'
  const periodes =
    c.periods?.length === 1 ? (c.periods[0] === 'annual' ? ', en annuel' : ', en mensuel') : ''
  return formules + periodes
})

const validite = computed(() => {
  const c = code.value
  if (!c) return ''
  if (c.startsAt && c.expiresAt) return `du ${date(c.startsAt)} au ${date(c.expiresAt)}`
  if (c.expiresAt) return `jusqu'au ${date(c.expiresAt)}`
  if (c.startsAt) return `à partir du ${date(c.startsAt)}`
  return 'sans limite'
})

const colonnes: TableColumn<Utilisation>[] = [
  { id: 'compte', header: 'Compte' },
  { id: 'formule', header: 'Formule' },
  { id: 'montant', header: 'Premier paiement' },
  { id: 'date', header: 'Le' },
]

async function copierLien() {
  if (!code.value) return
  const lien = `${window.location.origin}/pricing?code=${encodeURIComponent(code.value.code)}`
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

const actif = ref(true)
const { execute: enregistrerActivation, loading: bascule } = useApiAction(
  `/api/admin/promo-codes/${id}`,
  {
    method: 'PATCH',
    body: () => ({ active: actif.value }),
    successMessage: { title: 'Code mis à jour' },
    errorMessages: { default: "Le code n'a pas pu être modifié" },
    onSuccess: () => refresh(),
  }
)
function basculer(v: boolean) {
  actif.value = v
  enregistrerActivation()
}

const { execute: supprimer, loading: suppression } = useApiAction(`/api/admin/promo-codes/${id}`, {
  method: 'DELETE',
  successMessage: { title: 'Code supprimé' },
  errorMessages: { default: "Le code n'a pas pu être supprimé" },
  onSuccess: () => navigateTo('/admin/codes-promo'),
})
</script>
