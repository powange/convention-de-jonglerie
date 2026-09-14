<!--
  Qui peut prêter main-forte, maintenant.

  Cet écran se consulte debout, d'un téléphone, pendant que quelque chose déborde. Tout y est
  ordonné par cette contrainte : les gens qu'on peut appeler tout de suite sont en haut, leur
  numéro est à un geste, et rien ne demande de chercher.

  ⚠️ L'heure vient du NAVIGATEUR et avance toute seule : la liste se réordonne au fil des minutes
  sans rappeler l'API. Un état calculé côté serveur aurait été périmé à l'affichage, puis figé
  jusqu'au prochain chargement — sur un écran dont c'est toute la raison d'être, ce serait un
  mensonge tranquille.

  Les règles vivent dans `disponibilite-volants`, éprouvées hors Nuxt. Cet écran les affiche.
-->
<template>
  <UContainer class="py-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div class="flex items-center gap-3">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :to="`/editions/${editionId}/gestion/volunteers`"
        />
        <UIcon name="i-heroicons-bolt" class="text-info-500 size-6" />
        <h1 class="text-2xl font-semibold">{{ t('volunteers.renforts_title') }}</h1>
      </div>

      <!-- L'heure de référence, affichée : sans elle, on ne sait pas de quand date ce qu'on lit. -->
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('volunteers.renforts_as_of', { heure: heureAffichee }) }}
      </p>
    </div>

    <div v-if="chargement" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div v-else-if="renforts.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-bolt-slash" class="size-12 text-gray-300 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400">{{ t('volunteers.renforts_none') }}</p>
      <p class="text-sm text-gray-500 mt-1">{{ t('volunteers.renforts_none_hint') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-3 gap-3">
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('volunteers.renforts_available') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums text-green-600 dark:text-green-400">
            {{ resume.disponibles }}
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('volunteers.renforts_busy') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums">{{ resume.occupes }}</p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('volunteers.renforts_away') }}
          </p>
          <p class="text-2xl font-semibold tabular-nums text-gray-400">{{ resume.absents }}</p>
        </UCard>
      </div>

      <UCard
        v-for="renfort in renfortsTries"
        :key="renfort.id"
        :ui="{ body: 'p-4' }"
        :class="etatDe(renfort) === 'absent' ? 'opacity-60' : ''"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UiUserAvatar :user="renfort.user" size="md" />

          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{{ renfort.user?.pseudo }}</p>
            <p class="text-xs text-gray-500 truncate">
              {{ renfort.equipes.map((e: Equipe) => e.name).join(', ') }}
            </p>
          </div>

          <UBadge :color="couleurEtat(etatDe(renfort))" variant="subtle">
            {{ t(`volunteers.renforts_state_${etatDe(renfort)}`) }}
          </UBadge>

          <!-- Le numéro est l'objet même de cet écran : un geste, pas deux. -->
          <UButton
            v-if="renfort.phone"
            :to="`tel:${renfort.phone}`"
            icon="i-heroicons-phone"
            color="neutral"
            variant="outline"
            size="sm"
            :label="renfort.phone"
          />
          <UBadge v-else color="neutral" variant="subtle">
            {{ t('volunteers.renforts_no_phone') }}
          </UBadge>
        </div>

        <!-- Ce qui nuance la disponibilité : ce qui le mobilise à l'instant, ou ce qui l'attend.
             « Libre mais attendu dans vingt minutes » n'est pas la même offre que « libre ce soir ». -->
        <p v-if="creneauActuel(renfort)" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <UIcon name="i-heroicons-clock" class="size-4 inline mr-1" />
          {{
            t('volunteers.renforts_busy_until', {
              equipe: creneauActuel(renfort)?.equipe?.name ?? t('volunteers.renforts_no_team'),
              heure: heureDe(creneauActuel(renfort)?.fin),
            })
          }}
        </p>
        <p
          v-else-if="creneauSuivant(renfort)"
          class="mt-2 text-sm text-gray-500 dark:text-gray-400"
        >
          <UIcon name="i-heroicons-forward" class="size-4 inline mr-1" />
          {{
            t('volunteers.renforts_expected_at', {
              equipe: creneauSuivant(renfort)?.equipe?.name ?? t('volunteers.renforts_no_team'),
              heure: heureDe(creneauSuivant(renfort)?.debut),
            })
          }}
        </p>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import {
  creneauEnCours,
  etatDuVolant,
  prochainCreneau,
  resumeDesRenforts,
  volantsParDisponibilite,
  type EtatDuVolant,
} from '~~/shared/utils/disponibilite-volants'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t, locale } = useI18n()

const editionId = parseInt(route.params.id as string)

interface Equipe {
  id: string
  name: string
  color?: string | null
}

interface CreneauDuRenfort {
  debut: string
  fin: string
  titre: string | null
  equipe: Equipe | null
}

interface Renfort {
  id: number
  user: { id: number; pseudo: string; [key: string]: unknown }
  phone: string | null
  entreeValidee: boolean
  equipes: Equipe[]
  creneaux: CreneauDuRenfort[]
}

const renforts = ref<Renfort[]>([])
const chargement = ref(true)

/**
 * L'instant de référence, qui avance tout seul.
 *
 * Rafraîchi chaque minute : c'est le pas le plus lent qui garde l'écran honnête, puisqu'un créneau
 * se termine à la minute. Plus souvent ne dirait rien de plus et réordonnerait la liste sous les
 * doigts de quelqu'un qui est en train de la lire.
 */
const maintenant = ref(new Date())
let horloge: ReturnType<typeof setInterval> | null = null

const heureAffichee = computed(() =>
  maintenant.value.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
)

const heureDe = (date: string | Date | undefined) =>
  date
    ? new Date(date).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    : ''

const renfortsTries = computed(() => volantsParDisponibilite(renforts.value, maintenant.value))
const resume = computed(() => resumeDesRenforts(renforts.value, maintenant.value))

const etatDe = (renfort: Renfort) => etatDuVolant(renfort, maintenant.value)
const creneauActuel = (renfort: Renfort) =>
  creneauEnCours(renfort.creneaux, maintenant.value) as CreneauDuRenfort | null
const creneauSuivant = (renfort: Renfort) =>
  prochainCreneau(renfort.creneaux, maintenant.value) as CreneauDuRenfort | null

const couleurEtat = (etat: EtatDuVolant) =>
  etat === 'disponible' ? 'success' : etat === 'occupe' ? 'warning' : 'neutral'

onMounted(async () => {
  horloge = setInterval(() => {
    maintenant.value = new Date()
  }, 60_000)

  try {
    const reponse = await $fetch<{ data: { renforts: Renfort[] } }>(
      `/api/editions/${editionId}/volunteers/renforts`
    )
    renforts.value = reponse.data?.renforts ?? []
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    chargement.value = false
  }
})

onBeforeUnmount(() => {
  if (horloge) clearInterval(horloge)
})
</script>
