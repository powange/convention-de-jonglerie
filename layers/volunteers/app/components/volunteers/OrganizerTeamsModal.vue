<script setup lang="ts">
/** La ligne telle que la rend `edition-organizers.get` : l'utilisateur y est déjà aplati. */
interface OrganizerProp {
  id: number
  user?: { pseudo?: string; prenom?: string | null; nom?: string | null }
  teams?: Array<{ id: string; name: string }>
}

const props = defineProps<{
  modelValue: boolean
  organizer: OrganizerProp | null
  editionId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'teams-saved': []
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const nomAffiche = computed(() => {
  const u = props.organizer?.user
  return [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.pseudo || ''
})

const title = computed(() =>
  props.organizer ? t('gestion.organizers.teams.title_for', { name: nomAffiche.value }) : ''
)

const equipes = ref<Array<{ id: string; name: string; color?: string }>>([])
const selection = ref<string[]>([])

const equipeItems = computed(() =>
  equipes.value.map((equipe) => ({
    label: equipe.name,
    value: equipe.id,
    color: equipe.color || '#6b7280',
  }))
)

// L'endpoint rend un tableau nu, et non un objet `{ teams }` : c'est ce que lisent les deux
// autres appelants du dépôt.
const { execute: chargerEquipes, loading } = useApiAction<
  unknown,
  Array<{ id: string; name: string; color?: string }>
>(() => `/api/editions/${props.editionId}/volunteer-teams`, {
  method: 'GET',
  silentSuccess: true,
  errorMessages: { default: t('gestion.organizers.teams.load_error') },
  onSuccess: (result) => {
    equipes.value = result ?? []
  },
})

watch(
  () => props.modelValue,
  (ouvert) => {
    if (ouvert) {
      selection.value = (props.organizer?.teams ?? []).map((equipe) => equipe.id)
      chargerEquipes()
    }
  },
  { immediate: true }
)

const { execute: enregistrer, loading: saving } = useApiAction(
  () =>
    `/api/editions/${props.editionId}/organizers/edition-organizers/${props.organizer?.id}/teams`,
  {
    method: 'PUT',
    body: () => ({ teamIds: selection.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      emit('teams-saved')
      isOpen.value = false
    },
  }
)
</script>

<template>
  <UModal v-model:open="isOpen" :title="title" :ui="{ content: 'sm:max-w-lg' }">
    <template #body>
      <div v-if="loading" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
      </div>

      <div v-else class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('gestion.organizers.teams.description') }}
        </p>

        <p
          v-if="equipes.length === 0"
          class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
        >
          {{ $t('gestion.organizers.teams.no_teams') }}
        </p>

        <!-- `UCheckboxGroup` relaie son slot `label` à chaque case, avec l'item en portée :
             c'est ce qui permet la pastille de couleur sans revenir à une liste faite main. -->
        <UCheckboxGroup
          v-else
          v-model="selection"
          :items="equipeItems"
          variant="card"
          class="grid grid-cols-1 gap-2"
        >
          <template #label="{ item }">
            <span class="flex items-center gap-2">
              <span class="size-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
              {{ item.label }}
            </span>
          </template>
        </UCheckboxGroup>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="saving"
          :disabled="loading"
          @click="() => void enregistrer()"
        >
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
