<template>
  <div>
    <!-- Le déclencheur porte le choix courant. Un bouton pleine largeur plutôt qu'un `select` :
         il peut montrer l'équipe et la personne, ce qu'une liste déroulante native ne sait pas
         faire — et c'est justement ce qui manquait pour choisir en connaissance de cause.

         Ici seulement, la LIGNE et non la carte : un bouton résume un choix déjà fait, et une
         carte bordée à l'intérieur d'un bouton se lirait comme une seconde zone cliquable. -->
    <UButton
      color="neutral"
      variant="outline"
      class="w-full justify-between"
      :aria-label="titre"
      @click="ouvert = true"
    >
      <span v-if="choisi" class="min-w-0 text-left">
        <VolunteersCreneauLigne :creneau="choisi.creneau" :fuseau="fuseau" />
        <span v-if="choisi.benevole" class="mt-1 flex items-center gap-2 text-sm">
          <UiUserDisplay :user="choisi.benevole" size="xs" />
        </span>
      </span>
      <span v-else class="text-gray-500">{{ placeholder }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0" />
    </UButton>

    <UModal v-model:open="ouvert" :title="titre">
      <template #body>
        <p v-if="choix.length === 0" class="text-sm text-gray-500">{{ messageVide }}</p>

        <!--
          Regroupé PAR CRÉNEAU, et non une ligne par personne.

          Un créneau à plusieurs places apparaissait autant de fois qu'il a de titulaires, avec
          une carte identique à chaque fois : sur l'édition mesurée, 44 créneaux sur 75 ont deux
          titulaires, si bien que la répétition était le cas majoritaire. L'information qui
          DISTINGUE les options — la personne — était alors la plus discrète de la ligne.

          On lit donc le créneau une fois, puis on choisit qui.
        -->
        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="groupe in groupes" :key="groupe.cle" class="py-3">
            <!-- Un seul choix sans titulaire nommé — le cas de « mes créneaux » : la carte EST
                 le bouton, sans liste de personnes à choisir. -->
            <button
              v-if="groupe.options.length === 1 && !groupe.options[0]!.benevole"
              type="button"
              class="w-full rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"
              :class="{
                'bg-primary-50 dark:bg-primary-950/30': groupe.options[0]!.id === modelValue,
              }"
              @click="choisir(groupe.options[0]!.id)"
            >
              <VolunteersTimeSlotCard
                :time-slot="groupe.options[0]!.creneau"
                :fuseau="fuseau"
                show-duration
              />
            </button>

            <template v-else>
              <VolunteersTimeSlotCard
                :time-slot="groupe.options[0]!.creneau"
                :fuseau="fuseau"
                show-duration
              />

              <p v-if="groupe.places" class="mt-1 text-xs text-gray-500">
                {{ t('volunteers.swap_slot_places', { places: groupe.places }) }}
              </p>

              <!-- Avec qui échanger : c'est le seul choix qui reste une fois le créneau lu. -->
              <p class="mt-2 mb-1 text-xs font-medium text-gray-500">
                {{ t('volunteers.swap_pick_person') }}
              </p>
              <div class="flex flex-col gap-1">
                <button
                  v-for="option in groupe.options"
                  :key="option.id"
                  type="button"
                  class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  :class="{
                    'bg-primary-50 dark:bg-primary-950/30': option.id === modelValue,
                  }"
                  @click="choisir(option.id)"
                >
                  <UiUserDisplay :user="option.benevole!" size="xs" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { CreneauLisible } from '../../composables/useCreneauLisible'

export interface ChoixCreneau {
  id: string
  /** Le créneau lui-même : c'est le composant partagé qui sait le dire. */
  creneau: CreneauLisible
  benevole?: { id: number; pseudo: string; profilePicture?: string | null } | null
  /** Occupation du créneau, quand elle est connue — « 2 / 3 bénévoles ». */
  places?: string | null
}

const props = defineProps<{
  modelValue: string | null
  choix: ChoixCreneau[]
  titre: string
  placeholder: string
  messageVide: string
  /** Fuseau de l'édition : un créneau s'annonce à l'heure du LIEU. */
  fuseau?: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t } = useI18n()
const ouvert = ref(false)

const choisi = computed(() => props.choix.find((c) => c.id === props.modelValue) ?? null)

/**
 * Les choix, rassemblés par créneau.
 *
 * La clé est l'identifiant du créneau quand il est là. À défaut, on retombe sur l'identifiant de
 * l'affectation : deux créneaux distincts ne doivent JAMAIS se retrouver dans le même groupe, et
 * un groupe d'un seul élément n'est qu'un affichage un peu plus verbeux — l'erreur inverse
 * fusionnerait deux créneaux différents sous une seule carte.
 */
const groupes = computed(() => {
  const parCreneau = new Map<
    string,
    { cle: string; options: ChoixCreneau[]; places?: string | null }
  >()

  for (const option of props.choix) {
    const cle = option.creneau.id ?? `affectation:${option.id}`
    const groupe = parCreneau.get(cle)
    if (groupe) groupe.options.push(option)
    else parCreneau.set(cle, { cle, options: [option], places: option.places })
  }

  return [...parCreneau.values()]
})

function choisir(id: string) {
  emit('update:modelValue', id)
  ouvert.value = false
}
</script>
