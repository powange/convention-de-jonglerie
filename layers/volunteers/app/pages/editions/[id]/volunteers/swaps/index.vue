<template>
  <div v-if="edition">
    <EditionHeader :edition="edition" current-page="volunteers" />

    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold">{{ t('volunteers.swap_title') }}</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('volunteers.swap_intro') }}
        </p>
      </div>

      <!-- Proposer un échange -->
      <UCard>
        <div v-if="mesCreneaux.length === 0" class="text-sm text-gray-500">
          {{ t('volunteers.swap_no_assignment') }}
        </div>

        <div v-else class="space-y-4">
          <UFormField :label="t('volunteers.swap_choose_mine')">
            <VolunteersSwapSlotPicker
              v-model="creneauCede"
              :choix="mesChoix"
              :titre="t('volunteers.swap_choose_mine')"
              :placeholder="t('volunteers.swap_pick_placeholder')"
              :message-vide="t('volunteers.swap_no_assignment')"
            />
          </UFormField>

          <UFormField :label="t('volunteers.swap_choose_theirs')">
            <VolunteersSwapSlotPicker
              v-model="creneauVoulu"
              :choix="choixCandidats"
              :titre="t('volunteers.swap_choose_theirs')"
              :placeholder="
                chargementCandidats ? t('common.loading') : t('volunteers.swap_pick_placeholder')
              "
              :message-vide="
                erreurCandidats ? t('errors.loading_error') : t('volunteers.swap_no_candidate')
              "
            />
          </UFormField>

          <div class="flex justify-end">
            <UButton
              :disabled="!creneauCede || !creneauVoulu"
              :loading="envoiEnCours"
              icon="i-lucide-repeat"
              :label="t('volunteers.swap_propose')"
              @click="proposer()"
            />
          </div>
        </div>
      </UCard>

      <!-- Mes demandes, dans les deux sens -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UCard>
          <template #header>
            <h2 class="font-semibold">{{ t('volunteers.swap_received') }}</h2>
          </template>
          <p v-if="recues.length === 0" class="text-sm text-gray-500">
            {{ t('volunteers.swap_none') }}
          </p>
          <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
            <li v-for="demande in recues" :key="demande.id" class="space-y-2 py-3">
              <VolunteersSwapResume :demande="demande" :point-de-vue="'received'" />
              <div v-if="demande.status === 'PENDING_PEER'" class="flex gap-2">
                <UButton
                  size="xs"
                  color="success"
                  :loading="reponseEnCours(demande.id)"
                  :label="t('volunteers.swap_accept')"
                  @click="acceptation.execute(demande.id)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :loading="reponseEnCours(demande.id)"
                  :label="t('volunteers.swap_refuse')"
                  @click="refus.execute(demande.id)"
                />
              </div>
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">{{ t('volunteers.swap_sent') }}</h2>
          </template>
          <p v-if="envoyees.length === 0" class="text-sm text-gray-500">
            {{ t('volunteers.swap_none') }}
          </p>
          <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
            <li v-for="demande in envoyees" :key="demande.id" class="space-y-2 py-3">
              <VolunteersSwapResume :demande="demande" :point-de-vue="'sent'" />
              <UButton
                v-if="['PENDING_PEER', 'PENDING_MANAGER'].includes(demande.status)"
                size="xs"
                color="neutral"
                variant="ghost"
                :loading="annulation.isLoading(demande.id)"
                :label="t('volunteers.swap_cancel')"
                @click="annulation.execute(demande.id)"
              />
            </li>
          </ul>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth-protected'] })

const { t } = useI18n()
const route = useRoute()
const editionStore = useEditionStore()
const editionId = computed(() => Number(route.params.id))

const edition = computed(() => editionStore.getEditionById(editionId.value))
onMounted(() => editionStore.fetchEditionById(editionId.value))

/** Mes affectations sur cette édition : c'est parmi elles que se choisit le créneau cédé. */
const { data: planning } = await useFetch(
  () => `/api/editions/${editionId.value}/volunteers/my-assignments`,
  { transform: (p: any) => p?.data ?? p }
)
const mesCreneaux = computed(() => planning.value?.assignments ?? [])

/**
 * Le premier créneau est présélectionné : la page s'ouvre alors sur des candidats plutôt que sur
 * un formulaire vide. La plupart des bénévoles n'en tiennent qu'un ou deux, et choisir « lequel
 * je cède » avant même de savoir ce qui est disponible n'a pas de sens pour eux.
 */
const creneauCede = ref<string | null>(null)

watch(
  mesCreneaux,
  (liste) => {
    if (!creneauCede.value && liste.length > 0) creneauCede.value = liste[0].id
  },
  { immediate: true }
)
const creneauVoulu = ref<string | null>(null)

/**
 * L'occupation d'un créneau, quand le serveur la donne. Rendue `null` plutôt que « 0 / 0 » si
 * elle manque : une donnée absente ne doit pas se lire comme un créneau désert.
 */
const occupation = (creneau: { _count?: { assignments: number }; maxVolunteers?: number }) =>
  typeof creneau.maxVolunteers === 'number'
    ? `${creneau._count?.assignments ?? 0} / ${creneau.maxVolunteers}`
    : null

/** Mes créneaux, au format attendu par le sélecteur en modale. */
const mesChoix = computed(() =>
  mesCreneaux.value.map((a: any) => ({
    id: a.id,
    titre: a.timeSlot.title,
    debut: a.timeSlot.startDateTime,
    fin: a.timeSlot.endDateTime,
    equipe: a.timeSlot.team,
    places: occupation(a.timeSlot),
  }))
)

/**
 * Les candidats dépendent du créneau cédé : celui-ci se libérant, il ne compte pas dans les
 * chevauchements. On les recharge donc à chaque changement plutôt que de filtrer côté client.
 */
const chargementCandidats = ref(false)
const candidats = ref<any[]>([])
const erreurCandidats = ref(false)

// `immediate` : la présélection ci-dessus s'applique dès la construction, avant que cet
// observateur existe. Sans cela, la page s'ouvrait avec un créneau choisi et une liste de
// candidats vide — donc sur un message d'absence trompeur. Vu à l'inspection visuelle, pas par
// les tests, qui interrogeaient l'API directement.
//
// Côté serveur en revanche, on ne charge rien : `$fetch` n'y porte pas le cookie de session,
// l'API répondait 401 et Nuxt remplaçait la page entière par son écran d'erreur — au premier
// affichage comme à chaque rafraîchissement. L'observateur se rejoue à l'hydratation : c'est de
// là que part la requête, avec la session du navigateur.
watch(
  creneauCede,
  async (id) => {
    creneauVoulu.value = null
    candidats.value = []
    erreurCandidats.value = false
    if (!id || import.meta.server) return
    chargementCandidats.value = true
    try {
      const r = await $fetch<any>(`/api/editions/${editionId.value}/volunteers/swaps/candidates`, {
        params: { assignmentId: id },
      })
      candidats.value = (r?.data ?? r)?.candidates ?? []
    } catch {
      // Un échec doit se voir : sans ce drapeau, le sélecteur annoncerait « aucun créneau
      // échangeable », qui se lit comme une absence de candidat et non comme une panne.
      erreurCandidats.value = true
    } finally {
      chargementCandidats.value = false
    }
  },
  { immediate: true }
)

/** Les créneaux convoitables, avec la personne qui les tient — c'est elle qu'on sollicite. */
const choixCandidats = computed(() =>
  candidats.value.map((c: any) => ({
    id: c.assignmentId,
    titre: c.timeSlot.title,
    debut: c.timeSlot.startDateTime,
    fin: c.timeSlot.endDateTime,
    equipe: c.timeSlot.team,
    benevole: c.volunteer,
    places: occupation(c.timeSlot),
  }))
)

const { data: mesDemandes, refresh } = await useFetch(
  () => `/api/editions/${editionId.value}/volunteers/swaps`,
  { transform: (p: any) => p?.data ?? p }
)
const recues = computed(() => mesDemandes.value?.received ?? [])
const envoyees = computed(() => mesDemandes.value?.sent ?? [])

const { execute: proposer, loading: envoiEnCours } = useApiAction(
  () => `/api/editions/${editionId.value}/volunteers/swaps`,
  {
    method: 'POST',
    body: () => ({
      offeredAssignmentId: creneauCede.value,
      wantedAssignmentId: creneauVoulu.value,
    }),
    successMessage: { title: t('volunteers.swap_proposed') },
    errorMessages: { default: t('volunteers.swap_propose_error') },
    onSuccess: async () => {
      creneauVoulu.value = null
      await refresh()
    },
  }
)

/**
 * Deux actions plutôt qu'une : `useApiActionById` fixe son corps à la construction et n'en
 * accepte pas au moment de l'appel. Le passer en variable partagée marcherait, mais deux clics
 * rapprochés pourraient alors envoyer la mauvaise réponse.
 */
const acceptation = useApiActionById(
  (id) => `/api/editions/${editionId.value}/volunteers/swaps/${id}/respond`,
  {
    method: 'PATCH',
    body: () => ({ accept: true }),
    successMessage: { title: t('volunteers.swap_answered') },
    errorMessages: { default: t('volunteers.swap_answer_error') },
    onSuccess: () => refresh(),
  }
)

const refus = useApiActionById(
  (id) => `/api/editions/${editionId.value}/volunteers/swaps/${id}/respond`,
  {
    method: 'PATCH',
    body: () => ({ accept: false }),
    successMessage: { title: t('volunteers.swap_answered') },
    errorMessages: { default: t('volunteers.swap_answer_error') },
    onSuccess: () => refresh(),
  }
)

const reponseEnCours = (id: string) => acceptation.isLoading(id) || refus.isLoading(id)

const annulation = useApiActionById(
  (id) => `/api/editions/${editionId.value}/volunteers/swaps/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('volunteers.swap_cancelled') },
    errorMessages: { default: t('volunteers.swap_cancel_error') },
    onSuccess: () => refresh(),
  }
)
</script>
