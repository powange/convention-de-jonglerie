<template>
  <UContainer class="max-w-5xl space-y-8 py-10">
    <template v-if="page">
      <!-- Aperçu pour l'équipe : la page n'est pas (encore) visible de tous. -->
      <UAlert
        v-if="!page.estPublique && page.droits"
        color="neutral"
        variant="subtle"
        icon="i-heroicons-eye-slash"
        title="Cette page n'est visible que de l'équipe d'organisation"
        :description="
          page.droits.estProprietaire
            ? 'Rendez-la publique depuis les informations de l’événement pour la partager.'
            : 'Le propriétaire ou un organisateur autorisé peut la rendre publique.'
        "
        :actions="[
          {
            label: 'Informations de l’événement',
            to: `/events/${e.publicId}/gestion/evenement`,
            color: 'neutral',
            variant: 'outline',
          },
        ]"
      />
      <UAlert
        v-if="e.annule"
        color="error"
        variant="subtle"
        icon="i-heroicons-x-circle"
        title="Cet événement est annulé"
      />

      <!-- En-tête : l'affiche, puis le nom, les dates, le lieu et les liens. -->
      <div class="flex flex-col gap-6 sm:flex-row sm:items-start">
        <img
          v-if="e.imageUrl"
          :src="e.imageUrl"
          :alt="`Affiche de ${e.name}`"
          class="w-full max-w-xs self-center rounded-lg object-cover shadow-sm sm:w-56 sm:self-start"
        />
        <div class="min-w-0 flex-1 space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <h1 class="text-3xl font-bold text-balance">{{ e.name }}</h1>
            <UButton
              v-if="page.droits"
              :to="`/events/${e.publicId}/gestion`"
              icon="i-heroicons-squares-2x2"
              label="Gérer l'événement"
            />
          </div>

          <ul class="space-y-2 text-sm">
            <li v-if="dates" class="flex items-start gap-2">
              <UIcon name="i-heroicons-calendar" class="mt-0.5 size-5 shrink-0 text-muted" />
              <span>{{ dates }}</span>
            </li>
            <li v-if="e.location || adresse" class="flex items-start gap-2">
              <UIcon name="i-heroicons-map-pin" class="mt-0.5 size-5 shrink-0 text-muted" />
              <span>
                <span v-if="e.location" class="block font-medium">{{ e.location }}</span>
                <span v-if="adresse" class="block text-muted">{{ adresse }}</span>
                <ULink
                  v-if="lienCarte"
                  :to="lienCarte"
                  target="_blank"
                  class="text-primary hover:underline"
                >
                  Voir sur la carte
                </ULink>
              </span>
            </li>
          </ul>

          <p v-if="e.contactEmail" class="flex items-start gap-2 text-sm">
            <UIcon name="i-heroicons-envelope" class="mt-0.5 size-5 shrink-0 text-muted" />
            <ULink :to="`mailto:${e.contactEmail}`" class="text-primary hover:underline">
              {{ e.contactEmail }}
            </ULink>
          </p>

          <div v-if="liens.length" class="flex flex-wrap gap-2">
            <UButton
              v-for="l in liens"
              :key="l.to"
              :to="l.to"
              target="_blank"
              :icon="l.icone"
              :label="l.libelle"
              color="neutral"
              variant="outline"
              size="sm"
            />
          </div>
        </div>
      </div>

      <!-- Le lieu sur une carte, quand ses coordonnées GPS sont connues. -->
      <!-- Sans ClientOnly : le composant ne touche à Leaflet que dans onMounted (navigateur). -->
      <EvenementCarteDuLieu
        v-if="e.coordonnees"
        :latitude="e.coordonnees.latitude"
        :longitude="e.coordonnees.longitude"
        :titre="e.location || e.name"
      />

      <section v-if="e.description" class="space-y-2">
        <h2 class="text-lg font-semibold">À propos</h2>
        <p class="whitespace-pre-line text-muted">{{ e.description }}</p>
      </section>

      <!-- Participer : ce que l'organisateur a ouvert au public. -->
      <section v-if="participations.length" class="space-y-3">
        <h2 class="text-lg font-semibold">Participer</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard
            v-for="p in participations"
            :key="p.to"
            class="cursor-pointer transition hover:ring-2 hover:ring-primary"
            @click="ouvrir(p)"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex size-11 shrink-0 items-center justify-center rounded-lg"
                :class="p.couleur"
              >
                <UIcon :name="p.icone" class="text-2xl" />
              </div>
              <div class="min-w-0">
                <p class="font-semibold">{{ p.titre }}</p>
                <p class="text-sm text-muted">{{ p.description }}</p>
              </div>
            </div>
          </UCard>
        </div>
      </section>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
/**
 * La page PUBLIQUE d'un événement Flowvent, lisible sans connexion quand l'organisateur l'a rendue
 * publique (ou qu'un autre accès public est ouvert : page bénévoles, appel à spectacles) — règle
 * de `resoudreEvenement`, servie par GET /api/events/:id/public. L'équipe d'organisation y voit en
 * plus l'accès à la gestion, et un aperçu quand la page n'est pas encore publique.
 *
 * Le pendant de la page d'une édition d'app1 (`/editions/:id`) : informations, affiche, adresse,
 * liens, et ce à quoi on peut participer.
 */
const route = useRoute()

interface PagePublique {
  evenement: {
    id: number
    publicId: string
    name: string
    description: string | null
    location: string | null
    adresse: {
      ligne1: string | null
      ligne2: string | null
      codePostal: string | null
      ville: string | null
      pays: string | null
    }
    coordonnees: { latitude: number; longitude: number } | null
    contactEmail: string | null
    startDate: string | null
    endDate: string | null
    timezone: string | null
    imageUrl: string | null
    liens: {
      siteOfficiel: string | null
      billetterie: string | null
      facebook: string | null
      instagram: string | null
    }
    annule: boolean
    archive: boolean
  }
  estPublique: boolean
  pagePublique: boolean
  benevoles: { candidaturesOuvertes: boolean } | null
  appels: { id: number; nom: string; ouvert: boolean; dateLimite: string | null }[]
  faq: boolean
  programme: boolean
  droits: { voir: boolean; estProprietaire: boolean } | null
}

const { data: page, error } = await useFetch<PagePublique>(
  () => `/api/events/${route.params.id}/public`
)
if (error.value || !page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Événement introuvable', fatal: true })
}
const e = computed(() => page.value!.evenement)

const dates = computed(() =>
  periodeEvenement({ ...e.value, timezone: e.value.timezone ?? undefined })
)

/** « 12 rue des Lilas, 69001 Lyon, France » — les parties renseignées seulement. */
const adresse = computed(() => {
  const a = e.value.adresse
  const ville = [a.codePostal, a.ville].filter(Boolean).join(' ')
  return [a.ligne1, a.ligne2, ville, a.pays].filter(Boolean).join(', ')
})

/** Le lieu sur OpenStreetMap : ses coordonnées si on les a, sinon une recherche par l'adresse. */
const lienCarte = computed(() => {
  const c = e.value.coordonnees
  if (c) {
    return `https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}`
  }
  const requete = adresse.value || e.value.location
  return requete
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(requete)}`
    : null
})

const liens = computed(() => {
  const l = e.value.liens
  return [
    l.siteOfficiel && {
      to: l.siteOfficiel,
      libelle: 'Site officiel',
      icone: 'i-heroicons-globe-alt',
    },
    l.billetterie && { to: l.billetterie, libelle: 'Billetterie', icone: 'i-heroicons-ticket' },
    l.facebook && { to: l.facebook, libelle: 'Facebook', icone: 'i-simple-icons-facebook' },
    l.instagram && { to: l.instagram, libelle: 'Instagram', icone: 'i-simple-icons-instagram' },
  ].filter(Boolean) as { to: string; libelle: string; icone: string }[]
})

interface Participation {
  titre: string
  description: string
  icone: string
  couleur: string
  to: string
  externe?: boolean
}

const participations = computed<Participation[]>(() => {
  const p = page.value!
  const base = `/events/${e.value.publicId}`
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return [
    ...(p.benevoles
      ? [
          {
            titre: 'Devenir bénévole',
            description: p.benevoles.candidaturesOuvertes
              ? 'Les candidatures sont ouvertes.'
              : 'Les candidatures sont fermées pour le moment.',
            icone: 'i-heroicons-hand-raised',
            couleur: 'bg-primary/10 text-primary',
            to: `${base}/volunteers`,
          },
        ]
      : []),
    ...p.appels.map((a) => ({
      titre: a.nom,
      description: a.ouvert
        ? a.dateLimite
          ? `Appel à spectacles ouvert jusqu'au ${formatDate(a.dateLimite)}.`
          : 'Appel à spectacles ouvert.'
        : 'Appel à spectacles clos.',
      icone: 'i-heroicons-star',
      couleur: 'bg-secondary/10 text-secondary',
      to: `${base}/shows-call/${a.id}`,
    })),
    ...(p.programme
      ? [
          {
            titre: 'Programme',
            description: 'Spectacles et moments forts, jour par jour.',
            icone: 'i-heroicons-calendar-days',
            couleur: 'bg-warning/10 text-warning',
            to: `${base}/program`,
          },
        ]
      : []),
    ...(p.faq
      ? [
          {
            titre: 'Questions fréquentes',
            description: 'Les réponses aux questions que l’on se pose avant de venir.',
            icone: 'i-heroicons-question-mark-circle',
            couleur: 'bg-info/10 text-info',
            to: `${base}/faq`,
          },
        ]
      : []),
    ...(e.value.liens.billetterie
      ? [
          {
            titre: 'Prendre un billet',
            description: 'Sur la billetterie de l’événement.',
            icone: 'i-heroicons-ticket',
            couleur: 'bg-success/10 text-success',
            to: e.value.liens.billetterie,
            externe: true,
          },
        ]
      : []),
  ]
})

function ouvrir(p: Participation) {
  if (p.externe) window.open(p.to, '_blank', 'noopener')
  else navigateTo(p.to)
}

useSeoMeta({
  title: () => `${e.value.name} — Flowvent`,
  description: () => e.value.description?.slice(0, 160) || `${e.value.name}, ${dates.value}`,
  ogImage: () => e.value.imageUrl ?? undefined,
  // Un aperçu d'équipe ne doit pas être indexé.
  robots: () => (page.value?.estPublique ? 'index, follow' : 'noindex, nofollow'),
})
</script>
