<template>
  <div>
    <!-- Le déclencheur porte le choix courant. Un bouton pleine largeur plutôt qu'un `select` :
         il peut montrer l'équipe et la personne, ce qu'une liste déroulante native ne sait pas
         faire — et c'est justement ce qui manquait pour choisir en connaissance de cause. -->
    <UButton
      color="neutral"
      variant="outline"
      class="w-full justify-between"
      :aria-label="titre"
      @click="ouvert = true"
    >
      <span v-if="choisi" class="min-w-0 text-left">
        <span class="block truncate">{{ intitule(choisi) }}</span>
        <span class="block truncate text-xs text-gray-500">{{ horaire(choisi) }}</span>
      </span>
      <span v-else class="text-gray-500">{{ placeholder }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0" />
    </UButton>

    <UModal v-model:open="ouvert" :title="titre">
      <template #body>
        <p v-if="choix.length === 0" class="text-sm text-gray-500">{{ messageVide }}</p>

        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="option in choix" :key="option.id">
            <button
              type="button"
              class="flex w-full flex-col gap-1 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"
              :class="{ 'bg-primary-50 dark:bg-primary-950/30': option.id === modelValue }"
              @click="choisir(option.id)"
            >
              <span class="flex flex-wrap items-center gap-2">
                <UBadge
                  v-if="option.equipe"
                  :style="
                    option.equipe.color ? { backgroundColor: option.equipe.color } : undefined
                  "
                  :color="option.equipe.color ? undefined : 'neutral'"
                  variant="solid"
                  size="xs"
                >
                  {{ option.equipe.name }}
                </UBadge>
                <span class="font-medium">{{
                  option.titre || t('volunteers.swap_slot_untitled')
                }}</span>
              </span>

              <span class="text-sm text-gray-600 dark:text-gray-400">{{ horaire(option) }}</span>

              <!-- Qui tient le créneau : l'information décisive pour choisir avec qui échanger. -->
              <span v-if="option.benevole" class="flex items-center gap-2 text-sm">
                <UiUserDisplay :user="option.benevole" size="xs" />
              </span>

              <span v-if="option.places" class="text-xs text-gray-500">
                {{ t('volunteers.swap_slot_places', { places: option.places }) }}
              </span>
            </button>
          </li>
        </ul>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
export interface ChoixCreneau {
  id: string
  titre?: string | null
  debut: string
  fin: string
  equipe?: { name: string; color?: string | null } | null
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
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t } = useI18n()
const ouvert = ref(false)

const choisi = computed(() => props.choix.find((c) => c.id === props.modelValue) ?? null)

const intitule = (c: ChoixCreneau) =>
  [c.equipe?.name, c.titre || t('volunteers.swap_slot_untitled')].filter(Boolean).join(' · ')

const horaire = (c: ChoixCreneau) => {
  const d = new Date(c.debut)
  const f = new Date(c.fin)
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const heure = (x: Date) => x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${jour} · ${heure(d)} – ${heure(f)}`
}

function choisir(id: string) {
  emit('update:modelValue', id)
  ouvert.value = false
}
</script>
