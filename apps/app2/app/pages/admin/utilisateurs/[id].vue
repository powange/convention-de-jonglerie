<template>
  <UContainer class="py-10">
    <AdminNav />
    <UButton
      to="/admin/utilisateurs"
      variant="link"
      color="neutral"
      icon="i-heroicons-arrow-left"
      label="Tous les utilisateurs"
      class="-ml-2 mb-4"
    />
    <UAlert v-if="erreur" color="error" variant="soft" title="Compte introuvable." />
    <USkeleton v-else-if="!compte" class="h-64 w-full" />

    <div v-else class="space-y-6">
      <UCard>
        <div class="flex flex-wrap items-start gap-4">
          <UiUserAvatar :user="compte" :size="72" />
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-bold">
              {{ [compte.prenom, compte.nom].filter(Boolean).join(' ') || compte.pseudo }}
            </h2>
            <p class="text-sm break-all text-muted">{{ compte.pseudo }} · {{ compte.email }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <UBadge
                :color="compte.isEmailVerified ? 'success' : 'warning'"
                variant="subtle"
                :label="compte.isEmailVerified ? 'Adresse vérifiée' : 'Adresse non vérifiée'"
              />
              <UBadge
                v-if="compte.motDePasse"
                variant="subtle"
                color="neutral"
                label="Mot de passe"
              />
              <UBadge v-if="compte.google" variant="subtle" color="neutral" label="Google" />
              <UBadge v-if="compte.facebook" variant="subtle" color="neutral" label="Facebook" />
              <UBadge
                v-if="compte.abonnement"
                :color="compte.abonnement.actif ? 'success' : 'neutral'"
                variant="subtle"
                :label="`${libelleFormuleAbonnement(compte.abonnement.formule, compte.abonnement.plan)} · ${compte.abonnement.actif ? 'actif' : 'expiré'}`"
              />
            </div>
            <p class="mt-2 text-sm text-muted">
              Inscrit le {{ date(compte.createdAt) }} · dernière connexion :
              {{ compte.lastLoginAt ? date(compte.lastLoginAt) : 'jamais' }}
            </p>
          </div>
          <!-- Sur téléphone, l'interrupteur passe sous le reste : à côté, il serrait la colonne du
               nom et des dates en une bande de quelques mots par ligne. -->
          <USwitch
            :model-value="compte.isGlobalAdmin"
            label="Administrateur"
            :disabled="estMoi && compte.isGlobalAdmin"
            class="max-sm:w-full"
            @update:model-value="changerAdmin"
          />
        </div>
      </UCard>

      <div class="grid gap-4 md:grid-cols-3">
        <UCard v-for="bloc in blocs" :key="bloc.titre">
          <template #header>
            <p class="font-semibold">{{ bloc.titre }} ({{ bloc.lignes.length }})</p>
          </template>
          <ul v-if="bloc.lignes.length" class="space-y-2 text-sm">
            <li
              v-for="l in bloc.lignes"
              :key="l.cle"
              class="flex items-center justify-between gap-2"
            >
              <ULink :to="l.to" class="truncate">{{ l.nom }}</ULink>
              <span v-if="l.detail" class="shrink-0 text-xs text-muted">{{ l.detail }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">Aucun.</p>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

interface Evt {
  id: number
  publicId: string
  name: string
}
interface Compte {
  id: number
  email: string
  emailHash: string | null
  pseudo: string
  prenom: string | null
  nom: string | null
  profilePicture: string | null
  updatedAt: string
  isEmailVerified: boolean
  isGlobalAdmin: boolean
  createdAt: string
  lastLoginAt: string | null
  motDePasse: boolean
  google: boolean
  facebook: boolean
  abonnement: {
    plan: string
    formule: string
    modules: unknown
    actif: boolean
  } | null
  events: (Evt & { startDate: string | null })[]
  coOrganise: Evt[]
  volunteerApplications: { id: number; status: string; event: Evt }[]
}

const route = useRoute()
const id = Number(route.params.id)
const { user } = useUserSession()
const estMoi = computed(() => (user.value as { id?: number } | null)?.id === id)

const { data: compte, error: erreur, refresh } = await useFetch<Compte>(`/api/admin/users/${id}`)
useSeoMeta({ title: () => `${compte.value?.pseudo ?? 'Compte'} — Administration Flowvent` })

const STATUTS: Record<string, string> = {
  PENDING: 'en attente',
  ACCEPTED: 'acceptée',
  REJECTED: 'refusée',
}
const blocs = computed(() => {
  const c = compte.value
  if (!c) return []
  return [
    {
      titre: 'Événements créés',
      lignes: c.events.map((e) => ({
        cle: `e${e.id}`,
        nom: e.name,
        to: `/events/${e.publicId}/gestion`,
        detail: e.startDate ? date(e.startDate) : '',
      })),
    },
    {
      titre: 'Co-organise',
      lignes: c.coOrganise.map((e) => ({
        cle: `o${e.id}`,
        nom: e.name,
        to: `/events/${e.publicId}/gestion`,
        detail: '',
      })),
    },
    {
      titre: 'Candidatures de bénévole',
      lignes: c.volunteerApplications.map((a) => ({
        cle: `a${a.id}`,
        nom: a.event.name,
        to: `/events/${a.event.publicId}/gestion/volunteers/applications`,
        detail: STATUTS[a.status] ?? a.status,
      })),
    },
  ]
})

const voulu = ref(false)
const { execute: envoyer } = useApiAction(`/api/admin/users/${id}`, {
  method: 'PATCH',
  body: () => ({ isGlobalAdmin: voulu.value }),
  successMessage: { title: 'Statut mis à jour' },
  errorMessages: { default: "Le statut n'a pas pu être modifié" },
  onSuccess: () => refresh(),
})
function changerAdmin(valeur: boolean) {
  voulu.value = valeur
  envoyer()
}

const date = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
</script>
