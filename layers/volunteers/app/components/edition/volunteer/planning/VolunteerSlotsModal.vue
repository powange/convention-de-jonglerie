<!--
  Les créneaux d'une personne, et ce qui les sépare.

  Le relevé par bénévole donne un total d'heures ; il ne dit pas comment elles s'enchaînent. Une
  pause de vingt minutes entre deux postes, ou une journée coupée en trois, ne se voient nulle
  part dans un total. Ici elles se lisent d'un coup d'œil.
-->
<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-2xl' }">
    <template #header>
      <div class="flex items-center gap-3">
        <UiUserAvatar v-if="user" :user="user" size="sm" />
        <div>
          <h3 class="font-semibold">{{ user?.pseudo }}</h3>
          <p class="text-sm text-gray-500">
            {{ t('volunteers.slots_count', { count: lignes.length }) }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <p v-if="!lignes.length" class="text-sm text-gray-500 italic">
        {{ t('volunteers.no_slot_assigned_yet') }}
      </p>

      <ol v-else class="space-y-2">
        <template v-for="ligne in lignes" :key="ligne.creneau.id">
          <!-- L'intervalle avec le créneau précédent, intercalé entre les deux. Un chevauchement
               s'annonce en rouge : la personne est attendue à deux endroits à la fois, et cela ne
               doit pas se confondre avec un enchaînement serré. -->
          <li
            v-if="ligne.intervalleMinutes !== null"
            class="flex items-center gap-2 pl-3 text-xs"
            :class="
              ligne.intervalleMinutes < 0
                ? 'text-error-600 dark:text-error-400 font-medium'
                : 'text-gray-500'
            "
          >
            <span class="w-px h-5 bg-gray-300 dark:bg-gray-700 ml-1.5" />
            <UIcon
              :name="
                ligne.intervalleMinutes < 0
                  ? 'i-heroicons-exclamation-triangle'
                  : 'i-heroicons-pause'
              "
              class="size-3.5 shrink-0"
            />
            <span>{{ libelleIntervalle(ligne.intervalleMinutes) }}</span>
          </li>

          <li>
            <button
              type="button"
              class="w-full text-left border border-gray-200 dark:border-gray-700 border-l-4 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              :style="{ borderLeftColor: couleurDe(ligne.creneau) }"
              @click="choisirCreneau(ligne.creneau)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-medium truncate">
                    {{ ligne.creneau.title || t('edition.volunteers.untitled_slot') }}
                  </div>
                  <div class="text-sm text-gray-500 mt-0.5">
                    {{ formatDate(ligne.creneau.start) }} · {{ formatHeure(ligne.creneau.start) }} –
                    {{ formatHeure(ligne.creneau.end) }}
                  </div>
                  <!-- La couleur de l'équipe borde le créneau et marque son nom : c'est le repère
                       qu'on a déjà dans la frise, et le retrouver ici évite de retraduire un nom
                       d'équipe en couleur. -->
                  <div
                    class="flex items-center gap-1.5 mt-1 text-xs text-gray-600 dark:text-gray-400"
                  >
                    <span
                      class="size-2.5 rounded-full shrink-0"
                      :style="{ backgroundColor: couleurDe(ligne.creneau) }"
                    />
                    <span>{{ nomEquipeDe(ligne.creneau) }}</span>
                  </div>
                </div>
                <UBadge
                  v-if="dureeDe(ligne.creneau)"
                  color="neutral"
                  variant="soft"
                  class="shrink-0"
                >
                  {{ t(dureeDe(ligne.creneau)!.cle, dureeDe(ligne.creneau)!.valeurs) }}
                </UBadge>
              </div>
            </button>
          </li>
        </template>
      </ol>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">
          {{ t('common.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { creneauxDuBenevole } from '../../../../utils/creneaux-du-benevole'
import { dureeTraduisible, formatHeure } from '../../../../utils/plage-horaire'

const props = defineProps<{
  modelValue: boolean
  /** La personne dont on regarde les créneaux — bénévole ou organisateur. */
  user: { id: number; pseudo: string; [key: string]: any } | null
  /** Tous les créneaux du planning : le tri et le filtrage se font ici. */
  timeSlots: Array<{ id: string | number; start: string; end: string; [key: string]: any }>
  /** Les équipes de l'édition, pour nommer et colorer chaque créneau. */
  teams: Array<{ id: string; name: string; color?: string | null }>
  formatDate: (date: string) => string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Le créneau choisi, à traiter comme un clic depuis le planning. */
  'slot-click': [slot: any]
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const lignes = computed(() =>
  props.user ? creneauxDuBenevole(props.timeSlots, props.user.id) : []
)

const dureeDe = (creneau: { start: string; end: string }) =>
  dureeTraduisible(creneau.start, creneau.end)

const equipeDe = (creneau: any) => props.teams.find((equipe) => equipe.id === creneau.teamId)

const nomEquipeDe = (creneau: any) => equipeDe(creneau)?.name || t('volunteers.no_team')

/**
 * La couleur de l'équipe, celle du créneau à défaut, et un gris neutre en dernier recours : un
 * créneau sans équipe ne doit pas emprunter la couleur du précédent.
 */
const couleurDe = (creneau: any) => equipeDe(creneau)?.color || creneau.color || '#9ca3af'

/** « 3h30 de pause », ou le chevauchement dit en positif — « 30min de chevauchement ». */
function libelleIntervalle(minutes: number): string {
  const absolu = Math.abs(minutes)
  const heures = Math.floor(absolu / 60)
  const reste = absolu % 60
  const duree =
    heures > 0 && reste > 0
      ? t('volunteers.duration_hours_minutes', { hours: heures, minutes: reste })
      : heures > 0
        ? t('volunteers.duration_hours', { hours: heures })
        : t('volunteers.duration_minutes', { minutes: reste })

  if (minutes < 0) return t('volunteers.slots_overlap_by', { duration: duree })
  if (minutes === 0) return t('volunteers.slots_back_to_back')
  return t('volunteers.slots_break_of', { duration: duree })
}

function choisirCreneau(creneau: any) {
  emit('slot-click', creneau)
  isOpen.value = false
}
</script>
