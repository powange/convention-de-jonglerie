<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <UAlert
      v-if="erreur"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      title="Événement introuvable, ou vous n'y avez pas accès."
    />
    <USkeleton v-else-if="!accueil" class="h-96 w-full" />

    <template v-else>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">{{ accueil.evenement.name }}</h1>
          <p class="mt-1 flex flex-wrap gap-3 text-sm text-muted">
            <span v-if="accueil.evenement.location" class="flex items-center gap-1">
              <UIcon name="i-heroicons-map-pin" /> {{ accueil.evenement.location }}
            </span>
            <span v-if="periode" class="flex items-center gap-1">
              <UIcon name="i-heroicons-calendar" /> {{ periode }}
            </span>
          </p>
        </div>
        <UButton
          v-if="accueil.modules.benevoles"
          icon="i-heroicons-link"
          color="neutral"
          variant="outline"
          label="Copier le lien de la page bénévoles"
          @click="copierLien"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Bénévoles : le module, avec ce qui attend une décision. -->
        <UCard
          v-if="accueil.benevoles"
          class="cursor-pointer transition hover:ring-2 hover:ring-primary sm:col-span-2"
          @click="navigateTo(`${base}/volunteers/applications`)"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <UIcon name="i-heroicons-hand-raised" class="text-2xl" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold">Bénévoles</p>
              <p class="text-sm text-muted">
                {{
                  accueil.benevoles.candidaturesOuvertes
                    ? 'Candidatures ouvertes'
                    : 'Candidatures fermées'
                }}
                ·
                {{ accueil.benevoles.pagePublique ? 'page publique' : 'page masquée' }}
              </p>
              <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div v-for="c in chiffresBenevoles" :key="c.libelle">
                  <p class="text-xl font-bold" :class="c.urgent ? 'text-warning' : ''">
                    {{ c.valeur }}
                  </p>
                  <p class="text-xs text-muted">{{ c.libelle }}</p>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <UCard
          v-for="carte in cartes"
          :key="carte.to"
          class="cursor-pointer transition hover:ring-2 hover:ring-primary"
          @click="navigateTo(carte.to)"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-lg"
              :class="carte.couleur"
            >
              <UIcon :name="carte.icone" class="text-2xl" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold">{{ carte.titre }}</p>
              <p class="text-sm text-muted">{{ carte.description }}</p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Modules : le point d'entrée où chaque nouveau module viendra s'ajouter. -->
      <UCard>
        <template #header>
          <p class="font-semibold">Modules</p>
          <p class="text-sm text-muted">
            Activez les outils dont l'événement a besoin. Désactiver un module ne supprime rien :
            ses données reviennent telles quelles à la réactivation.
          </p>
        </template>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-hand-raised" class="mt-0.5 size-5 text-primary" />
            <div>
              <p class="font-medium">Bénévoles</p>
              <p class="text-sm text-muted">
                Candidatures, équipes, planning, échanges, notifications, et la page publique où
                l'on candidate.
              </p>
            </div>
          </div>
          <USwitch
            :model-value="accueil.modules.benevoles"
            :disabled="!accueil.droits.modifier || enregistrementModules"
            :label="accueil.modules.benevoles ? 'Activé' : 'Désactivé'"
            @update:model-value="basculerBenevoles"
          />
        </div>
        <p v-if="!accueil.droits.modifier" class="mt-3 text-xs text-muted">
          Seuls le propriétaire et les organisateurs autorisés à modifier l'événement changent les
          modules.
        </p>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Accueil de la gestion d'un événement : une carte par module que la personne peut ouvrir (avec ses
 * chiffres), et l'activation des modules — le point d'entrée où chaque module à venir s'ajoutera.
 */
definePageMeta({ middleware: ['subscription'] })

interface Accueil {
  evenement: {
    publicId: string
    name: string
    location: string | null
    startDate: string | null
    endDate: string | null
    timezone: string | null
  }
  droits: { modifier: boolean; organisateurs: boolean; benevoles: boolean }
  modules: { benevoles: boolean }
  organisateurs: number
  benevoles: null | {
    enAttente: number
    acceptes: number
    equipes: number
    creneaux: number
    echangesAValider: number
    candidaturesOuvertes: boolean
    pagePublique: boolean
  }
}

const route = useRoute()
const refEvenement = String(route.params.id)
const base = `/events/${refEvenement}/gestion`
const toast = useToast()

const {
  data: accueil,
  error: erreur,
  refresh,
} = await useFetch<Accueil>(`/api/events/${refEvenement}/accueil`)

const periode = computed(() =>
  accueil.value?.evenement
    ? periodeEvenement({
        ...accueil.value.evenement,
        timezone: accueil.value.evenement.timezone ?? undefined,
      })
    : ''
)

const chiffresBenevoles = computed(() => {
  const b = accueil.value?.benevoles
  if (!b) return []
  return [
    { libelle: 'candidatures à traiter', valeur: b.enAttente, urgent: b.enAttente > 0 },
    { libelle: 'bénévoles acceptés', valeur: b.acceptes, urgent: false },
    { libelle: `équipes · ${b.creneaux} créneaux`, valeur: b.equipes, urgent: false },
    { libelle: 'échanges à valider', valeur: b.echangesAValider, urgent: b.echangesAValider > 0 },
  ]
})

const cartes = computed(() => {
  const a = accueil.value
  if (!a) return []
  return [
    {
      titre: "Informations de l'événement",
      description: a.droits.modifier
        ? 'Nom, lieu, dates, fuseau.'
        : 'Nom, lieu, dates (lecture seule).',
      icone: 'i-lucide-settings',
      couleur: 'bg-primary/10 text-primary',
      to: `${base}/evenement`,
    },
    {
      titre: 'Organisateurs',
      description:
        a.organisateurs === 0
          ? 'Aucun co-organisateur pour l’instant.'
          : `${a.organisateurs} co-organisateur${a.organisateurs > 1 ? 's' : ''}.`,
      icone: 'i-heroicons-user-plus',
      couleur: 'bg-secondary/10 text-secondary',
      to: `${base}/organisateurs`,
    },
    ...(a.modules.benevoles
      ? [
          {
            titre: 'Page des bénévoles',
            description: 'Ce que voient les candidats.',
            icone: 'i-heroicons-eye',
            couleur: 'bg-secondary/10 text-secondary',
            to: `/events/${refEvenement}/volunteers`,
          },
        ]
      : []),
  ]
})

async function copierLien() {
  await navigator.clipboard.writeText(`${window.location.origin}/events/${refEvenement}/volunteers`)
  toast.add({ title: 'Lien copié', icon: 'i-heroicons-check', color: 'success' })
}

const voulu = ref(true)
const { execute: enregistrerModules, loading: enregistrementModules } = useApiAction(
  `/api/events/${refEvenement}/modules`,
  {
    method: 'PUT',
    body: () => ({ benevoles: voulu.value }),
    successMessage: { title: 'Modules mis à jour' },
    errorMessages: { default: "Le module n'a pas pu être modifié" },
    onSuccess: async () => {
      await refresh()
      // La barre latérale lit les modules dans l'accès à la gestion : on le relit aussi.
      await refreshNuxtData(`acces-gestion-${refEvenement}`)
    },
  }
)
function basculerBenevoles(valeur: boolean) {
  voulu.value = valeur
  enregistrerModules()
}
</script>
