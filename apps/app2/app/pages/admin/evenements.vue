<template>
  <UContainer class="py-10">
    <AdminNav />
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="recherche"
        icon="i-heroicons-magnifying-glass"
        placeholder="Nom, lieu, propriétaire"
        class="w-full sm:w-80"
      />
      <span class="text-sm text-muted">{{ data?.total ?? 0 }} événement(s)</span>
    </div>

    <UTable :data="data?.evenements ?? []" :columns="colonnes" :loading="pending" @select="ouvrir">
      <template #nom-cell="{ row }">
        <p class="font-medium">{{ row.original.name }}</p>
        <p v-if="row.original.location" class="text-xs text-muted">{{ row.original.location }}</p>
      </template>
      <template #dates-cell="{ row }">
        {{
          periodeEvenement({ ...row.original, timezone: row.original.timezone ?? undefined }) || '—'
        }}
      </template>
      <template #proprietaire-cell="{ row }">
        <ULink :to="`/admin/utilisateurs/${row.original.owner.id}`" @click.stop>
          {{ row.original.owner.pseudo }}
        </ULink>
      </template>
      <template #benevoles-cell="{ row }">
        <span v-if="row.original.volunteersEnabled">
          {{ row.original.candidatures }} candidature(s) · {{ row.original.equipes }} équipe(s)
        </span>
        <span v-else class="text-sm text-muted">module désactivé</span>
      </template>
      <template #creation-cell="{ row }">{{ date(row.original.createdAt) }}</template>
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
useSeoMeta({ title: 'Événements — Administration Flowvent' })

interface Evenement {
  id: number
  publicId: string
  name: string
  location: string | null
  startDate: string | null
  endDate: string | null
  timezone: string | null
  createdAt: string
  volunteersEnabled: boolean
  owner: { id: number; pseudo: string; email: string }
  organisateurs: number
  candidatures: number
  equipes: number
}

const recherche = ref('')
const rechercheEnvoyee = useDebounce(recherche, 300)
const page = ref(1)
watch(rechercheEnvoyee, () => (page.value = 1))

const { data, pending } = await useFetch<{
  total: number
  parPage: number
  evenements: Evenement[]
}>('/api/admin/events', { query: { q: rechercheEnvoyee, page } })

const colonnes: TableColumn<Evenement>[] = [
  { id: 'nom', header: 'Événement' },
  { id: 'dates', header: 'Dates' },
  { id: 'proprietaire', header: 'Propriétaire' },
  { accessorKey: 'organisateurs', header: 'Co-organisateurs' },
  { id: 'benevoles', header: 'Bénévoles' },
  { id: 'creation', header: 'Créé le' },
]

const date = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
// Un administrateur ouvre la gestion de n'importe quel événement (droits-evenement.ts).
const ouvrir = (_e: Event, row: TableRow<Evenement>) =>
  navigateTo(`/events/${row.original.publicId}/gestion`)
</script>
