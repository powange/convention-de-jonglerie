<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-chart-bar" class="text-orange-600 dark:text-orange-400" />
          {{ $t('gestion.ticketing.quotas_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.ticketing.quotas_description') }}
        </p>
      </div>

      <div class="space-y-8">
        <TicketingQuotasList
          :quotas="quotas"
          :loading="loadingQuotas"
          :edition-id="editionId"
          @refresh="loadQuotas"
        />

        <!-- Associer les quotas : à quoi chaque quota se rattache, et donc ce qu'il compte.
             Même disposition que les articles à remettre, dont c'est la même question posée
             autrement. Les trois onglets sont encore vides — ce lot pose la structure. -->
        <div class="border-t border-gray-200 dark:border-gray-800 pt-8">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {{ $t('gestion.ticketing.assign_quotas_title') }}
          </h2>

          <!-- Sur un écran étroit, « Champs personnalisés » occupe à lui seul la moitié de la
               largeur : la barre d'onglets cède la place à un select, qui pilote le même état.
               Seule la barre est masquée, pas le composant — ce sont ses panneaux qui portent
               le contenu. -->
          <USelect
            v-model="cibleActive"
            :items="ciblesPourSelect"
            value-key="value"
            :icon="cibleCourante?.icon"
            class="w-full sm:hidden mb-4"
          />
          <UTabs
            v-model="cibleActive"
            :items="cibles"
            variant="link"
            :ui="{ list: 'hidden sm:flex' }"
          >
            <template #tiers>
              <TicketingQuotaAssociationList
                :elements="tarifsAssociables"
                :loading="loadingTiers"
                :message-vide="$t('gestion.ticketing.assign_quotas_no_tier')"
                :libelle-edition="$t('gestion.ticketing.assign_quotas_edit')"
                @editer="ouvrirQuotasDuTarif"
              />
            </template>

            <template #options>
              <TicketingQuotaAssociationList
                :elements="optionsAssociables"
                :loading="loadingOptions"
                :message-vide="$t('gestion.ticketing.assign_quotas_no_option')"
                :libelle-edition="$t('gestion.ticketing.assign_quotas_edit_option')"
                @editer="ouvrirQuotasDeLOption"
              />
            </template>

            <!-- Les organisateurs ne s'achètent pas : ce sont des personnes déjà présentes sur
                 l'édition. D'où deux blocs, et non une simple liste — ce qui vaut pour TOUS se
                 règle une fois, au lieu d'être répété sur chacun et de devenir faux dès qu'un
                 organisateur s'ajoute. Même découpage que la page des articles à remettre. -->
            <template #organizers>
              <div class="pt-4 space-y-6">
                <TicketingQuotaBlocGlobal
                  :titre="$t('gestion.ticketing.assign_quotas_all_organizers')"
                  :aide="$t('gestion.ticketing.assign_quotas_all_organizers_hint')"
                  :libelle-edition="$t('gestion.ticketing.assign_quotas_edit_organizers')"
                  :quotas="quotasGlobauxOrganisateurs"
                  :loading="loadingOrganisateurs"
                  @editer="ouvrirQuotasGlobauxOrganisateurs"
                />

                <div>
                  <h4 class="font-medium">
                    {{ $t('gestion.ticketing.assign_quotas_per_organizer') }}
                  </h4>
                  <p class="text-sm text-dimmed">
                    {{ $t('gestion.ticketing.assign_quotas_per_organizer_hint') }}
                  </p>

                  <TicketingQuotaAssociationList
                    :elements="organisateursAssociables"
                    :loading="loadingOrganisateurs"
                    :message-vide="$t('gestion.organizers.no_organizers_on_edition')"
                    :libelle-edition="$t('gestion.ticketing.assign_quotas_edit_organizer')"
                    @editer="ouvrirQuotasDeLOrganisateur"
                  >
                    <!-- Le nom d'une personne, rendu par le composant qui en porte la règle,
                         plutôt que recomposé ici à partir du pseudo et de l'état civil. -->
                    <template #nom="{ element }">
                      <!-- `sm` (20 px) et pas une valeur inventée : le composant ne connaît que
                           xs/sm/md/lg/xl, et une taille absente de sa table ne lui fait poser
                           AUCUNE classe de dimension — l'image retombe alors sur sa taille
                           native, différente pour une photo téléversée, un Gravatar ou un avatar
                           généré. C'est aussi la taille des logos de provenance des autres
                           onglets, donc les lignes s'alignent. -->
                      <UiUserAvatar
                        :user="organisateurParId.get(element.id)?.user"
                        size="sm"
                        class="shrink-0"
                      />
                      <span class="font-medium truncate">
                        <UiUserName :user="organisateurParId.get(element.id)?.user" />
                      </span>
                    </template>
                  </TicketingQuotaAssociationList>
                </div>
              </div>
            </template>

            <!-- Les bénévoles se rattachent par ÉQUIPE, comme les articles à remettre. La
                 différence est ailleurs : là-bas les articles d'une équipe remplacent les
                 articles globaux, ici les associations s'additionnent. Un article est un colis
                 qu'on reçoit ; un quota est une place qu'on occupe, et on l'occupe une fois. -->
            <template #volunteers>
              <div class="pt-4 space-y-6">
                <TicketingQuotaBlocGlobal
                  :titre="$t('gestion.ticketing.assign_quotas_all_volunteers')"
                  :aide="$t('gestion.ticketing.assign_quotas_all_volunteers_hint')"
                  :libelle-edition="$t('gestion.ticketing.assign_quotas_edit_volunteers')"
                  :quotas="quotasGlobauxBenevoles"
                  :loading="loadingBenevoles"
                  @editer="ouvrirQuotasGlobauxBenevoles"
                />

                <div>
                  <h4 class="font-medium">
                    {{ $t('gestion.ticketing.assign_quotas_per_team') }}
                  </h4>
                  <p class="text-sm text-dimmed">
                    {{ $t('gestion.ticketing.assign_quotas_per_team_hint') }}
                  </p>

                  <TicketingQuotaAssociationList
                    :elements="equipesAssociables"
                    :loading="loadingBenevoles"
                    :message-vide="$t('gestion.ticketing.assign_quotas_no_team')"
                    :libelle-edition="$t('gestion.ticketing.assign_quotas_edit_team')"
                    @editer="ouvrirQuotasDeLEquipe"
                  />
                </div>
              </div>
            </template>

            <!-- Les artistes se rattachent par SPECTACLE, comme les articles à remettre. Un
                 artiste qui joue dans deux spectacles associés au même quota n'y occupe qu'une
                 place : le dédoublonnage porte sur la personne, pas sur l'association. -->
            <template #artists>
              <div class="pt-4 space-y-6">
                <TicketingQuotaBlocGlobal
                  :titre="$t('gestion.ticketing.assign_quotas_all_artists')"
                  :aide="$t('gestion.ticketing.assign_quotas_all_artists_hint')"
                  :libelle-edition="$t('gestion.ticketing.assign_quotas_edit_artists')"
                  :quotas="quotasGlobauxArtistes"
                  :loading="loadingArtistes"
                  @editer="ouvrirQuotasGlobauxArtistes"
                />

                <div>
                  <h4 class="font-medium">
                    {{ $t('gestion.ticketing.assign_quotas_per_show') }}
                  </h4>
                  <p class="text-sm text-dimmed">
                    {{ $t('gestion.ticketing.assign_quotas_per_show_hint') }}
                  </p>

                  <TicketingQuotaAssociationList
                    :elements="spectaclesAssociables"
                    :loading="loadingArtistes"
                    :message-vide="$t('gestion.shows.no_shows')"
                    :libelle-edition="$t('gestion.ticketing.assign_quotas_edit_show')"
                    @editer="ouvrirQuotasDuSpectacle"
                  />
                </div>
              </div>
            </template>

            <template #customfields>
              <TicketingQuotaAssociationList
                :elements="champsAssociables"
                :loading="loadingChamps"
                :message-vide="$t('gestion.ticketing.assign_quotas_no_custom_field')"
                :libelle-edition="$t('gestion.ticketing.assign_quotas_edit_custom_field')"
                @editer="ouvrirQuotasDuChamp"
              >
                <!-- Les quotas d'un champ se lisent PAR RÉPONSE : c'est la réponse qui décide
                     lequel s'applique, et le même quota peut viser plusieurs d'entre elles. Une
                     rangée plate les aurait affichés côte à côte sans dire à quoi ils répondent. -->
                <template #detail="{ element }">
                  <!-- Un champ sans liste de choix n'a rien à tabuler : ses quotas s'affichent à
                       plat, comme sur les tarifs et les options. -->
                  <div
                    v-if="detailDuChamp(element.id)[0]?.reponse === undefined"
                    class="flex flex-wrap gap-1 mt-1"
                  >
                    <UBadge
                      v-for="quota in detailDuChamp(element.id)[0]?.quotas ?? []"
                      :key="quota.id"
                      color="warning"
                      variant="subtle"
                    >
                      {{ quota.title }}
                    </UBadge>
                    <span v-if="!detailDuChamp(element.id)[0]?.quotas.length" class="text-dimmed">
                      {{ $t('gestion.ticketing.assign_quotas_none') }}
                    </span>
                  </div>

                  <!-- Un tableau, parce que deux colonnes alignées se lisent d'un coup d'œil là où
                       des paires côte à côte obligent à suivre chaque ligne.

                       Un `<table>` nu plutôt qu'un `UTable` : celui-ci monte une instance TanStack
                       par tableau — tri, colonnes, sélection — pour deux colonnes statiques, et il
                       y en aurait un par champ personnalisé de la liste. -->
                  <div v-else class="mt-2 overflow-x-auto">
                    <!-- Bordures sur toutes les cellules : sans elles, on ne voyait pas où
                         s'arrêtait une réponse ni à quelle ligne appartenaient des étiquettes qui
                         passent sur deux rangs. Jetons `border-default` du dépôt, pour que le
                         tableau se pose comme le reste des encadrés. -->
                    <table
                      class="text-sm border border-default rounded-lg border-separate border-spacing-0"
                    >
                      <thead>
                        <tr class="text-dimmed bg-gray-50 dark:bg-gray-800/50">
                          <th
                            class="text-left font-medium px-3 py-1.5 border-b border-r border-default"
                          >
                            {{ $t('gestion.ticketing.assign_quotas_choice') }}
                          </th>
                          <th class="text-left font-medium px-3 py-1.5 border-b border-default">
                            {{ $t('gestion.ticketing.quotas_title') }}
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-default">
                        <tr
                          v-for="ligne in detailDuChamp(element.id)"
                          :key="ligne.reponse ?? '*'"
                          class="align-top"
                        >
                          <td
                            class="px-3 py-1.5 whitespace-nowrap border-r border-t border-default"
                          >
                            <!-- La ligne transverse se distingue : elle ne vise aucune réponse en
                                 particulier, elle vaut pour toutes. -->
                            <span :class="ligne.reponse === null ? 'italic text-dimmed' : ''">
                              {{
                                ligne.reponse ?? $t('gestion.ticketing.assign_quotas_any_choice')
                              }}
                            </span>
                          </td>
                          <td class="px-3 py-1.5 border-t border-default">
                            <div v-if="ligne.quotas.length" class="flex flex-wrap gap-1">
                              <UBadge
                                v-for="quota in ligne.quotas"
                                :key="quota.id"
                                color="warning"
                                variant="subtle"
                              >
                                {{ quota.title }}
                              </UBadge>
                            </div>
                            <span v-else class="text-dimmed">
                              {{ $t('gestion.ticketing.assign_quotas_none') }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
              </TicketingQuotaAssociationList>
            </template>
          </UTabs>
        </div>
      </div>
    </div>

    <!-- Ne modifie QUE les quotas, du tarif ou de l'option selon ce qu'on a ouvert. Les PUT
         génériques réécrivent les repas sans condition et exigent d'autres champs : passer par
         eux effacerait des données que cette fenêtre ne montre même pas. D'où deux endpoints
         dédiés, sur le modèle de celui des articles à remettre. -->
    <UModal
      v-model:open="editionQuotasOuverte"
      :title="$t('gestion.ticketing.assign_quotas_modal_title')"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-dimmed">{{ nomEnEdition }}</p>

          <UFormField :label="$t('gestion.ticketing.quotas_title')">
            <USelectMenu
              v-model="quotasSelectionnes"
              :items="quotas.map((q) => ({ label: q.title, value: q.id }))"
              value-key="value"
              multiple
              searchable
              :placeholder="$t('ticketing.tiers.modal.quotas_placeholder')"
              class="w-full"
            >
              <template #label>
                <span v-if="quotasSelectionnes.length === 0">
                  {{ $t('ticketing.tiers.modal.no_quota_selected') }}
                </span>
                <span v-else>
                  {{
                    $t('gestion.ticketing.assign_quotas_count', {
                      count: quotasSelectionnes.length,
                    })
                  }}
                </span>
              </template>
            </USelectMenu>
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="editionQuotasOuverte = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="enregistrementQuotas" @click="enregistrerLesQuotas">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Les champs personnalisés ont leur propre fenêtre : une association y porte un CHOIX de
         réponse en plus du quota, ce que la fenêtre des tarifs et des options n'a pas à connaître.
         Le même quota peut y apparaître deux fois, pour deux réponses différentes. -->
    <UModal
      v-model:open="editionChampOuverte"
      :title="$t('gestion.ticketing.assign_quotas_custom_field_modal_title')"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-dimmed">{{ champEnEdition?.label }}</p>

          <div
            v-if="associationsDuChamp.length === 0"
            class="text-center py-6 bg-gray-50 dark:bg-gray-900 rounded-lg"
          >
            <p class="text-sm text-dimmed">
              {{ $t('gestion.ticketing.assign_quotas_none') }}
            </p>
          </div>

          <div
            v-for="(association, index) in associationsDuChamp"
            :key="index"
            class="flex items-end gap-2"
          >
            <UFormField :label="$t('gestion.ticketing.quotas_title')" class="flex-1 min-w-0">
              <USelect
                v-model="association.quotaId"
                :items="quotas.map((q) => ({ label: q.title, value: q.id }))"
                value-key="value"
                :placeholder="$t('ticketing.tiers.modal.quotas_placeholder')"
                class="w-full"
              />
            </UFormField>

            <!-- Le choix n'a de sens que pour un champ à liste : ailleurs, le quota vaut quelle
                 que soit la réponse, et proposer un choix ferait croire à un réglage inexistant. -->
            <UFormField
              v-if="choixDuChamp.length > 0"
              :label="$t('gestion.ticketing.assign_quotas_choice')"
              class="flex-1 min-w-0"
            >
              <USelect
                v-model="association.choiceValue"
                :items="choixDuChamp"
                value-key="value"
                :placeholder="$t('gestion.ticketing.assign_quotas_any_choice')"
                class="w-full"
              />
            </UFormField>

            <UButton
              icon="i-heroicons-trash"
              color="error"
              variant="ghost"
              :title="$t('common.delete')"
              @click="associationsDuChamp.splice(index, 1)"
            />
          </div>

          <UButton
            icon="i-heroicons-plus"
            color="primary"
            variant="soft"
            size="sm"
            @click="associationsDuChamp.push({ quotaId: null, choiceValue: null })"
          >
            {{ $t('gestion.ticketing.assign_quotas_add') }}
          </UButton>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="editionChampOuverte = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="enregistrementChamp" @click="enregistrerQuotasDuChamp">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

import { logoDuFournisseur, nomDuFournisseur } from '../../../../../utils/ticketing/fournisseur'
import { fetchOptions, type TicketingOption } from '../../../../../utils/ticketing/options'
import { fetchTiers, type TicketingTier } from '../../../../../utils/ticketing/tiers'

import type { ElementAssociable } from '../../../../../components/ticketing/QuotaAssociationList.vue'

/**
 * Les quotas, sur leur propre page.
 *
 * Ils étaient le quatrième onglet de « Tarifs, options & quotas ». Les en sortir n'est pas un
 * rangement : un quota n'est pas un attribut du catalogue de vente, c'est une **capacité** — les
 * places d'un spectacle, par exemple. Il se trouve qu'aujourd'hui il ne sait compter que des
 * billets, mais ce sont des personnes présentes qu'il mesure, et les bénévoles comme les
 * organisateurs en sont.
 *
 * Cette page est le point d'accroche de cette évolution. Ce lot ne fait que le déplacement :
 * aucun changement de base, de schéma ni de comportement.
 */
const route = useRoute()
const router = useRouter()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = parseInt(route.params.id as string)
const { t } = useI18n()

useSeoMeta({
  title: () => `${t('gestion.ticketing.quotas_title')} - ${t('gestion.ticketing.title')}`,
})

const edition = computed(() => editionStore.getEditionById(editionId))

const loadingQuotas = ref(true)
const quotas = ref<any[]>([])

// Gestion de la billetterie (droit dédié, au niveau édition ou convention) — la même garde que
// les autres pages de la section.
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageTicketing(edition.value, authStore.user.id)
})

const loadQuotas = async () => {
  loadingQuotas.value = true
  try {
    const response = await $fetch<any>(`/api/editions/${editionId}/ticketing/quotas`)
    quotas.value = Array.isArray(response?.data?.quotas) ? response.data.quotas : []
  } catch {
    // Erreur silencieuse : la liste reste vide plutôt que de casser la page.
  } finally {
    loadingQuotas.value = false
  }
}

/**
 * Les cibles auxquelles un quota peut se rattacher.
 *
 * Quatre désormais. Les trois premières désignent ce qu'on achète ; la quatrième désigne des
 * PERSONNES — un organisateur occupe une place sur l'édition sans passer par un billet. Restent
 * les bénévoles, qui relèvent de la même idée.
 */
const cibles = computed(() => [
  {
    label: t('gestion.ticketing.audience_tiers'),
    icon: 'i-heroicons-ticket',
    slot: 'tiers',
    value: 'tiers',
  },
  {
    label: t('gestion.ticketing.audience_options'),
    icon: 'i-heroicons-adjustments-horizontal',
    slot: 'options',
    value: 'options',
  },
  {
    label: t('gestion.ticketing.audience_custom_fields'),
    icon: 'i-heroicons-document-text',
    slot: 'customfields',
    value: 'customfields',
  },
  {
    label: t('gestion.ticketing.audience_organizers'),
    icon: 'i-heroicons-user-group',
    slot: 'organizers',
    value: 'organizers',
  },
  {
    label: t('gestion.ticketing.audience_artists'),
    icon: 'i-heroicons-sparkles',
    slot: 'artists',
    value: 'artists',
  },
  {
    label: t('gestion.ticketing.audience_volunteers'),
    icon: 'i-heroicons-hand-raised',
    slot: 'volunteers',
    value: 'volunteers',
  },
])

// Onglet actif via le hash, pour qu'un lien direct atteigne la bonne cible.
const cibleActive = computed({
  get() {
    const hash = route.hash.replace('#', '')
    if (hash && cibles.value.some((cible) => cible.value === hash)) return hash
    return cibles.value[0]?.value ?? ''
  },
  set(onglet: string) {
    router.replace({ hash: `#${onglet}` })
  },
})

// Le select ne reprend que ce qu'il affiche ; l'icône est celle de la cible courante.
const ciblesPourSelect = computed(() => cibles.value.map(({ value, label }) => ({ value, label })))
const cibleCourante = computed(() =>
  cibles.value.find((cible) => cible.value === cibleActive.value)
)

// --- Onglets d'association : quels quotas chaque tarif, chaque option fait-il jouer ---

const tiers = ref<TicketingTier[]>([])
const loadingTiers = ref(true)
const options = ref<TicketingOption[]>([])
const loadingOptions = ref(true)

const loadTiers = async () => {
  loadingTiers.value = true
  try {
    tiers.value = await fetchTiers(editionId)
  } catch {
    // Erreur silencieuse : l'onglet reste vide plutôt que de casser la page.
  } finally {
    loadingTiers.value = false
  }
}

const loadOptions = async () => {
  loadingOptions.value = true
  try {
    options.value = await fetchOptions(editionId)
  } catch {
    // Erreur silencieuse, même raison.
  } finally {
    loadingOptions.value = false
  }
}

/**
 * Les deux listes projetées dans la forme neutre qu'attend la liste d'association.
 *
 * Un tarif porte une provenance — il peut venir d'une billetterie externe —, une option non : le
 * logo est donc absent de la seconde plutôt que rempli d'un placeholder qui ne dirait rien.
 */
const tarifsAssociables = computed<ElementAssociable[]>(() =>
  tiers.value.map((tarif) => ({
    id: tarif.id,
    nom: tarif.customName || tarif.name,
    quotas: (tarif.quotas ?? []).map((lien) => lien.quota),
    logo: logoDuFournisseur(tarif.provider),
    origine: nomDuFournisseur(tarif.provider) ?? t('gestion.ticketing.origin_site'),
  }))
)

const optionsAssociables = computed<ElementAssociable[]>(() =>
  options.value.map((option) => ({
    id: option.id,
    nom: option.name,
    quotas: (option.quotas ?? []).map((lien) => lien.quota),
  }))
)

/** Ce qu'on est en train de modifier : un tarif ou une option, jamais les deux. */
// --- Onglet « Organisateurs » : des personnes, pas des articles ---

/**
 * Un organisateur consomme une place dans un quota une fois son ENTRÉE VALIDÉE — décision prise
 * avec l'utilisateur. La liste ci-dessous montre en revanche tous les organisateurs inscrits :
 * on règle les associations à l'avance, elles ne comptent qu'à l'arrivée.
 */
interface AssociationOrganisateur {
  id: number
  quotaId: number
  /** `null` = la ligne globale, valable pour tout organisateur de l'édition. */
  organizerId: number | null
  quota: { id: number; title: string }
}

const associationsOrganisateurs = ref<AssociationOrganisateur[]>([])
const organisateurs = ref<any[]>([])
const loadingOrganisateurs = ref(true)

const loadOrganisateurs = async () => {
  loadingOrganisateurs.value = true
  try {
    // Les deux listes ensemble : l'écran n'a de sens qu'une fois les deux là, et les enchaîner
    // doublerait l'attente pour rien.
    const [associations, inscrits] = await Promise.all([
      $fetch<any>(`/api/editions/${editionId}/ticketing/organizers/quotas`),
      $fetch<any>(`/api/editions/${editionId}/organizers/edition-organizers`),
    ])
    associationsOrganisateurs.value = associations?.data?.quotas ?? []
    organisateurs.value = inscrits?.data?.organizers ?? []
  } catch {
    // Erreur silencieuse, même raison que pour les autres onglets.
  } finally {
    loadingOrganisateurs.value = false
  }
}

/** Les quotas valables pour TOUS les organisateurs. */
const quotasGlobauxOrganisateurs = computed(() =>
  associationsOrganisateurs.value
    .filter((association) => association.organizerId === null)
    .map((association) => association.quota)
)

/**
 * Les associations propres à chaque organisateur, groupées une seule fois.
 *
 * Une table plutôt qu'un filtre appelé depuis le gabarit : celui-ci interroge la liste une fois
 * par ligne, et un filtre y refait le balayage complet des associations à chaque rendu.
 */
const quotasParOrganisateur = computed(() => {
  const table = new Map<number | string, Array<{ id: number; title: string }>>()
  for (const association of associationsOrganisateurs.value) {
    if (association.organizerId === null) continue
    const existants = table.get(association.organizerId)
    if (existants) existants.push(association.quota)
    else table.set(association.organizerId, [association.quota])
  }
  return table
})

const organisateursAssociables = computed<ElementAssociable[]>(() =>
  organisateurs.value.map((organisateur) => ({
    id: organisateur.id,
    // Le nom réel est rendu par le créneau `#nom`, qui délègue à `UiUserName`. Cette valeur ne
    // sert que d'infobulle de repli.
    nom: organisateur.user?.pseudo ?? '',
    quotas: quotasParOrganisateur.value.get(organisateur.id) ?? [],
  }))
)

/** L'organisateur derrière une ligne, pour le créneau qui rend son nom et son portrait. */
const organisateurParId = computed(
  () =>
    new Map<number | string, any>(
      organisateurs.value.map((organisateur) => [organisateur.id, organisateur])
    )
)

const ouvrirQuotasGlobauxOrganisateurs = () => {
  cibleEnEdition.value = {
    type: 'organisateurs',
    id: null,
    nom: t('gestion.ticketing.assign_quotas_all_organizers'),
  }
  quotasSelectionnes.value = quotasGlobauxOrganisateurs.value.map((quota) => quota.id)
  editionQuotasOuverte.value = true
}

const ouvrirQuotasDeLOrganisateur = (id: number | string) => {
  const organisateur = organisateurParId.value.get(id)
  if (!organisateur) return
  cibleEnEdition.value = {
    type: 'organisateur',
    id,
    nom: organisateur.user?.pseudo ?? '',
  }
  quotasSelectionnes.value = (quotasParOrganisateur.value.get(id) ?? []).map((quota) => quota.id)
  editionQuotasOuverte.value = true
}

// --- Onglets « Bénévoles » et « Artistes » : deux autres familles de personnes ---

/**
 * Les deux onglets partagent la forme des organisateurs : une ligne globale, puis des lignes par
 * sous-ensemble — une équipe pour les bénévoles, un spectacle pour les artistes.
 *
 * Les quotas d'une équipe S'AJOUTENT à ceux de la ligne globale. C'est une divergence assumée
 * avec les articles à remettre, où ceux d'une équipe REMPLACENT les articles globaux : un article
 * est un colis qu'on reçoit, un quota est une place qu'on occupe, et on l'occupe une fois.
 */
interface AssociationParCle<C> {
  id: number
  quotaId: number
  cle: C | null
  quota: { id: number; title: string }
}

const grouperParCle = <C,>(associations: Array<AssociationParCle<C>>) => {
  const table = new Map<C, Array<{ id: number; title: string }>>()
  for (const association of associations) {
    if (association.cle === null) continue
    const existants = table.get(association.cle)
    if (existants) existants.push(association.quota)
    else table.set(association.cle, [association.quota])
  }
  return table
}

// --- Bénévoles ---

const associationsBenevoles = ref<Array<AssociationParCle<string>>>([])
const equipes = ref<any[]>([])
const loadingBenevoles = ref(true)

const loadBenevoles = async () => {
  loadingBenevoles.value = true
  try {
    const [associations, listeEquipes] = await Promise.all([
      $fetch<any>(`/api/editions/${editionId}/ticketing/volunteers/quotas`),
      $fetch<any>(`/api/editions/${editionId}/volunteer-teams`),
    ])
    associationsBenevoles.value = (associations?.data?.quotas ?? []).map((association: any) => ({
      ...association,
      cle: association.teamId,
    }))
    equipes.value = listeEquipes?.data?.teams ?? listeEquipes?.teams ?? []
  } catch {
    // Erreur silencieuse, même raison que pour les autres onglets.
  } finally {
    loadingBenevoles.value = false
  }
}

const quotasGlobauxBenevoles = computed(() =>
  associationsBenevoles.value
    .filter((association) => association.cle === null)
    .map((association) => association.quota)
)

const quotasParEquipe = computed(() => grouperParCle(associationsBenevoles.value))

const equipesAssociables = computed<ElementAssociable[]>(() =>
  equipes.value.map((equipe) => ({
    id: equipe.id,
    nom: equipe.name,
    quotas: quotasParEquipe.value.get(equipe.id) ?? [],
  }))
)

const ouvrirQuotasGlobauxBenevoles = () => {
  cibleEnEdition.value = {
    type: 'benevoles',
    id: null,
    nom: t('gestion.ticketing.assign_quotas_all_volunteers'),
  }
  quotasSelectionnes.value = quotasGlobauxBenevoles.value.map((quota) => quota.id)
  editionQuotasOuverte.value = true
}

const ouvrirQuotasDeLEquipe = (id: number | string) => {
  const equipe = equipes.value.find((candidate) => candidate.id === id)
  if (!equipe) return
  cibleEnEdition.value = { type: 'equipe', id, nom: equipe.name }
  quotasSelectionnes.value = (quotasParEquipe.value.get(String(id)) ?? []).map((quota) => quota.id)
  editionQuotasOuverte.value = true
}

// --- Artistes ---

const associationsArtistes = ref<Array<AssociationParCle<number>>>([])
const spectacles = ref<any[]>([])
const loadingArtistes = ref(true)

const loadArtistes = async () => {
  loadingArtistes.value = true
  try {
    const [associations, listeSpectacles] = await Promise.all([
      $fetch<any>(`/api/editions/${editionId}/ticketing/artists/quotas`),
      $fetch<any>(`/api/editions/${editionId}/shows`),
    ])
    associationsArtistes.value = (associations?.data?.quotas ?? []).map((association: any) => ({
      ...association,
      cle: association.showId,
    }))
    spectacles.value = listeSpectacles?.data?.shows ?? []
  } catch {
    // Erreur silencieuse, même raison que pour les autres onglets.
  } finally {
    loadingArtistes.value = false
  }
}

const quotasGlobauxArtistes = computed(() =>
  associationsArtistes.value
    .filter((association) => association.cle === null)
    .map((association) => association.quota)
)

const quotasParSpectacle = computed(() => grouperParCle(associationsArtistes.value))

const spectaclesAssociables = computed<ElementAssociable[]>(() =>
  spectacles.value.map((spectacle) => ({
    id: spectacle.id,
    nom: spectacle.title,
    quotas: quotasParSpectacle.value.get(spectacle.id) ?? [],
  }))
)

const ouvrirQuotasGlobauxArtistes = () => {
  cibleEnEdition.value = {
    type: 'artistes',
    id: null,
    nom: t('gestion.ticketing.assign_quotas_all_artists'),
  }
  quotasSelectionnes.value = quotasGlobauxArtistes.value.map((quota) => quota.id)
  editionQuotasOuverte.value = true
}

const ouvrirQuotasDuSpectacle = (id: number | string) => {
  const spectacle = spectacles.value.find((candidate) => candidate.id === id)
  if (!spectacle) return
  cibleEnEdition.value = { type: 'spectacle', id, nom: spectacle.title }
  quotasSelectionnes.value = (quotasParSpectacle.value.get(Number(id)) ?? []).map(
    (quota) => quota.id
  )
  editionQuotasOuverte.value = true
}

/**
 * Ce que la fenêtre d'édition est en train de modifier.
 *
 * `organisateurs` (au pluriel) désigne la ligne GLOBALE : les quotas que consomme tout
 * organisateur de l'édition. Elle n'a pas d'identifiant, d'où le `id` nul — c'est ce qui la
 * distingue d'`organisateur`, qui en vise un seul.
 */
type CibleEnEdition = {
  type:
    | 'tarif'
    | 'option'
    | 'organisateur'
    | 'organisateurs'
    | 'equipe'
    | 'benevoles'
    | 'spectacle'
    | 'artistes'
  /** `string` pour une équipe, dont l'identifiant est un `cuid` et non un entier. */
  id: number | string | null
  nom: string
}

const cibleEnEdition = ref<CibleEnEdition | null>(null)
const editionQuotasOuverte = ref(false)
const quotasSelectionnes = ref<number[]>([])

const nomEnEdition = computed(() => cibleEnEdition.value?.nom ?? '')

const ouvrirQuotasDuTarif = (id: number | string) => {
  const tarif = tiers.value.find((t) => t.id === id)
  if (!tarif) return
  cibleEnEdition.value = { type: 'tarif', id, nom: tarif.customName || tarif.name }
  quotasSelectionnes.value = (tarif.quotas ?? []).map((lien) => lien.quota.id)
  editionQuotasOuverte.value = true
}

const ouvrirQuotasDeLOption = (id: number | string) => {
  const option = options.value.find((o) => o.id === id)
  if (!option) return
  cibleEnEdition.value = { type: 'option', id, nom: option.name }
  quotasSelectionnes.value = (option.quotas ?? []).map((lien) => lien.quota.id)
  editionQuotasOuverte.value = true
}

// --- Onglet « Champs personnalisés » : l'association y porte en plus un choix de réponse ---

interface ChampPersonnalise {
  id: number
  label: string
  type: string
  values?: string[] | null
  quotas?: Array<{ quota: { id: number; title: string }; choiceValue?: string | null }>
  provider?: string | null
}

/**
 * Une rangée du détail d'un champ : la réponse visée, et les quotas qu'elle déclenche.
 *
 * `reponse` distingue trois cas, et c'est tout l'intérêt de ce type : une chaîne est une réponse
 * de la liste, `null` vaut « quelle que soit la réponse », et `undefined` dit que le champ n'est
 * pas une liste de choix — il n'y a alors aucune réponse à afficher.
 */
interface LigneDeDetail {
  reponse?: string | null
  quotas: Array<{ id: number; title: string }>
}

const champs = ref<ChampPersonnalise[]>([])
const loadingChamps = ref(true)

const loadChamps = async () => {
  loadingChamps.value = true
  try {
    const reponse = await $fetch<any>(`/api/editions/${editionId}/ticketing/custom-fields`)
    champs.value = Array.isArray(reponse?.data?.customFields) ? reponse.data.customFields : []
  } catch {
    // Erreur silencieuse, même raison que pour les autres onglets.
  } finally {
    loadingChamps.value = false
  }
}

const champsAssociables = computed<ElementAssociable[]>(() =>
  champs.value.map((champ) => ({
    id: champ.id,
    nom: champ.label,
    // Le détail est rendu par le créneau ci-dessus, groupé par réponse : cette liste plate ne
    // sert plus qu'à satisfaire la forme commune.
    quotas: [],
    logo: logoDuFournisseur(champ.provider),
    origine: nomDuFournisseur(champ.provider) ?? t('gestion.ticketing.origin_site'),
  }))
)

/**
 * Le détail d'un champ, groupé par réponse.
 *
 * Trois règles, toutes décidées avec l'utilisateur :
 * - les quotas valables quelle que soit la réponse ouvrent la liste, sur une ligne à part ;
 * - un champ qui n'est pas une liste de choix n'a pas de réponses : ses quotas s'affichent à plat,
 *   sans libellé — d'où `reponse: undefined`, distinct de `null` qui veut dire « toute réponse » ;
 * - TOUTES les réponses sont listées, y compris celles sans quota : c'est ce qui rend visible ce
 *   qui n'est pas couvert.
 */
const construireLeDetail = (champ: ChampPersonnalise): LigneDeDetail[] => {
  const associations = champ.quotas ?? []
  const quotasDe = (choix: string | null) =>
    associations.filter((lien) => (lien.choiceValue ?? null) === choix).map((lien) => lien.quota)

  const reponses = champ.values ?? []
  if (reponses.length === 0) {
    // Pas de liste de choix : tout à plat, sans colonne de réponse.
    return [{ reponse: undefined, quotas: associations.map((l) => l.quota) }]
  }

  const lignes: LigneDeDetail[] = []

  const transverses = quotasDe(null)
  if (transverses.length > 0) lignes.push({ reponse: null, quotas: transverses })

  for (const reponse of reponses) lignes.push({ reponse, quotas: quotasDe(reponse) })

  return lignes
}

/**
 * Le détail de tous les champs, calculé une fois par rafraîchissement.
 *
 * Le gabarit interroge le détail d'une même ligne jusqu'à quatre fois — le test du premier
 * élément, ses quotas, le test du vide, puis la boucle du tableau. Appelée directement depuis le
 * gabarit, la construction refaisait à chaque fois la recherche du champ et le filtrage de ses
 * associations, pour toutes les lignes, à chaque rendu.
 */
const detailParChamp = computed<Map<number | string, LigneDeDetail[]>>(
  () => new Map(champs.value.map((champ) => [champ.id, construireLeDetail(champ)]))
)

const detailDuChamp = (champId: number | string): LigneDeDetail[] =>
  detailParChamp.value.get(champId) ?? []

const editionChampOuverte = ref(false)
const champEnEdition = ref<ChampPersonnalise | null>(null)
const associationsDuChamp = ref<Array<{ quotaId: number | null; choiceValue: string | null }>>([])

/**
 * Les réponses possibles, pour un champ à liste de choix ; vide sinon.
 *
 * « Quelle que soit la réponse » est une OPTION à part entière, pas seulement le texte
 * d'invite : sans elle, choisir une réponse était irréversible — on ne pouvait plus revenir à
 * l'association transverse sans supprimer la ligne et la refaire.
 */
const choixDuChamp = computed(() => {
  const valeurs = champEnEdition.value?.values ?? []
  if (valeurs.length === 0) return []
  return [
    { label: t('gestion.ticketing.assign_quotas_any_choice'), value: null },
    ...valeurs.map((valeur) => ({ label: valeur, value: valeur })),
  ]
})

const ouvrirQuotasDuChamp = (id: number | string) => {
  const champ = champs.value.find((c) => c.id === id)
  if (!champ) return
  champEnEdition.value = champ
  associationsDuChamp.value = (champ.quotas ?? []).map((lien) => ({
    quotaId: lien.quota.id,
    choiceValue: lien.choiceValue ?? null,
  }))
  editionChampOuverte.value = true
}

const { execute: enregistrerQuotasDuChamp, loading: enregistrementChamp } = useApiAction(
  () => `/api/editions/${editionId}/ticketing/custom-fields/${champEnEdition.value?.id}/quotas`,
  {
    method: 'PUT',
    // Les lignes sans quota choisi sont écartées : une ligne vide est un ajout qu'on n'a pas fini
    // de remplir, pas une association à enregistrer.
    body: () => ({
      quotas: associationsDuChamp.value
        .filter((association) => association.quotaId != null)
        .map((association) => ({
          quotaId: association.quotaId,
          choiceValue: association.choiceValue,
        })),
    }),
    successMessage: { title: t('gestion.ticketing.assign_quotas_saved') },
    errorMessages: { default: t('errors.error_occurred') },
    onSuccess: async () => {
      editionChampOuverte.value = false
      await loadChamps()
    },
  }
)

/**
 * L'adresse d'écriture, par cible.
 *
 * Une correspondance explicite plutôt qu'une cascade de ternaires : chaque cible a son endpoint
 * dédié, et il faut pouvoir lire d'un coup d'œil lequel. La ligne globale des organisateurs est
 * la seule sans identifiant dans son chemin.
 */
const urlDesQuotas = (cible: CibleEnEdition | null) => {
  const base = `/api/editions/${editionId}/ticketing`
  switch (cible?.type) {
    case 'option':
      return `${base}/options/${cible.id}/quotas`
    case 'organisateur':
      return `${base}/organizers/${cible.id}/quotas`
    case 'organisateurs':
      return `${base}/organizers/quotas`
    case 'equipe':
      return `${base}/volunteers/teams/${cible.id}/quotas`
    case 'benevoles':
      return `${base}/volunteers/quotas`
    case 'spectacle':
      return `${base}/artists/shows/${cible.id}/quotas`
    case 'artistes':
      return `${base}/artists/quotas`
    default:
      return `${base}/tiers/${cible?.id}/quotas`
  }
}

const { execute: enregistrerLesQuotas, loading: enregistrementQuotas } = useApiAction(
  () => urlDesQuotas(cibleEnEdition.value),
  {
    method: 'PUT',
    body: () => ({ quotaIds: quotasSelectionnes.value }),
    successMessage: { title: t('gestion.ticketing.assign_quotas_saved') },
    errorMessages: { default: t('errors.error_occurred') },
    onSuccess: async () => {
      editionQuotasOuverte.value = false
      // Relire la liste concernée : la ligne doit afficher les quotas qu'on vient de poser.
      const type = cibleEnEdition.value?.type
      if (type === 'option') await loadOptions()
      else if (type === 'organisateur' || type === 'organisateurs') await loadOrganisateurs()
      else if (type === 'equipe' || type === 'benevoles') await loadBenevoles()
      else if (type === 'spectacle' || type === 'artistes') await loadArtistes()
      else await loadTiers()
    },
  }
)

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch {
      return
    }
  }

  if (canAccess.value) {
    await loadQuotas()
    await loadTiers()
    await loadOptions()
    await loadChamps()
    await loadOrganisateurs()
    await loadBenevoles()
    await loadArtistes()
  }
})

// Recharger quand les permissions changent (mode super admin)
watch(canAccess, async (nouvelle, ancienne) => {
  if (nouvelle && !ancienne) {
    await loadQuotas()
    await loadTiers()
    await loadOptions()
    await loadChamps()
    await loadOrganisateurs()
    await loadBenevoles()
    await loadArtistes()
  }
})
</script>
