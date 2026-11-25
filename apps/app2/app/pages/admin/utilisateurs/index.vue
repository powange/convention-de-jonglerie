<template>
  <UContainer class="py-10">
    <AdminNav />
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="recherche"
        icon="i-heroicons-magnifying-glass"
        placeholder="E-mail, pseudo, prénom ou nom"
        class="w-full sm:w-80"
      />
      <USelect v-model="tri" :items="TRIS" class="w-56" />
      <span class="text-sm text-muted">{{ data?.total ?? 0 }} compte(s)</span>
    </div>

    <UTable :data="data?.comptes ?? []" :columns="colonnes" :loading="pending" @select="ouvrir">
      <template #compte-cell="{ row }">
        <div class="flex items-center gap-2">
          <UiUserAvatar :user="row.original" size="sm" />
          <div class="min-w-0">
            <p class="truncate font-medium">
              {{ row.original.pseudo }}
              <UBadge v-if="row.original.isGlobalAdmin" size="sm" variant="subtle" label="admin" />
            </p>
            <p class="truncate text-xs text-muted">{{ row.original.email }}</p>
          </div>
        </div>
      </template>
      <template #connexion-cell="{ row }">
        <span class="text-sm">{{
          FOURNISSEURS[row.original.authProvider] ?? row.original.authProvider
        }}</span>
        <UBadge
          v-if="!row.original.isEmailVerified"
          color="warning"
          variant="subtle"
          size="sm"
          class="ml-1"
          label="non vérifié"
        />
      </template>
      <template #inscription-cell="{ row }">{{ date(row.original.createdAt) }}</template>
      <template #derniere-cell="{ row }">
        {{ row.original.lastLoginAt ? date(row.original.lastLoginAt) : 'jamais' }}
      </template>
      <template #abonnement-cell="{ row }">
        <UBadge
          v-if="row.original.abonne"
          color="success"
          variant="subtle"
          size="sm"
          :label="row.original.formule === 'annual' ? 'annuel' : 'mensuel'"
        />
        <span v-else class="text-sm text-muted">—</span>
      </template>
    </UTable>

    <div v-if="(data?.total ?? 0) > (data?.parPage ?? 25)" class="mt-4 flex justify-center">
      <UPagination
        v-model:page="page"
        :total="data?.total ?? 0"
        :items-per-page="data?.parPage ?? 25"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'

definePageMeta({ middleware: ['admin'] })
useSeoMeta({ title: 'Utilisateurs — Administration Flowvent' })

interface Compte {
  id: number
  email: string
  pseudo: string
  emailHash: string | null
  profilePicture: string | null
  updatedAt: string
  authProvider: string
  isEmailVerified: boolean
  isGlobalAdmin: boolean
  createdAt: string
  lastLoginAt: string | null
  abonne: boolean
  formule: string | null
  evenements: number
  candidatures: number
}

const FOURNISSEURS: Record<string, string> = {
  email: 'E-mail',
  google: 'Google',
  facebook: 'Facebook',
  MANUAL: 'Invité',
}
const TRIS = [
  { label: 'Inscription (récentes)', value: 'inscription' },
  { label: 'Dernière connexion', value: 'connexion' },
  { label: 'Pseudo', value: 'pseudo' },
]

const recherche = ref('')
const rechercheEnvoyee = useDebounce(recherche, 300)
const tri = ref('inscription')
const page = ref(1)
watch([rechercheEnvoyee, tri], () => (page.value = 1))

const { data, pending } = await useFetch<{ total: number; parPage: number; comptes: Compte[] }>(
  '/api/admin/users',
  { query: { q: rechercheEnvoyee, tri, page } }
)

const colonnes: TableColumn<Compte>[] = [
  { id: 'compte', header: 'Compte' },
  { id: 'connexion', header: 'Connexion' },
  { id: 'inscription', header: 'Inscription' },
  { id: 'derniere', header: 'Dernière connexion' },
  { id: 'abonnement', header: 'Abonnement' },
  { accessorKey: 'evenements', header: 'Événements' },
  { accessorKey: 'candidatures', header: 'Candidatures' },
]

const date = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const ouvrir = (_e: Event, row: TableRow<Compte>) =>
  navigateTo(`/admin/utilisateurs/${row.original.id}`)
</script>
