<template>
  <div class="space-y-4">
    <!-- État vide -->
    <div
      v-if="acts.length === 0"
      class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center"
    >
      <UIcon name="i-heroicons-queue-list" class="text-4xl text-gray-400 dark:text-gray-500" />
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('gestion.shows.no_acts') }}</p>
      <UButton icon="i-heroicons-plus" color="primary" variant="soft" size="sm" @click="add">
        {{ $t('gestion.shows.add_act') }}
      </UButton>
    </div>

    <!-- Une carte par numéro -->
    <UCard v-for="(act, index) in acts" :key="index">
      <template #header>
        <div class="flex items-center gap-3">
          <UBadge color="primary" variant="subtle" class="shrink-0">
            {{ $t('gestion.shows.act_number', { number: index + 1 }) }}
          </UBadge>
          <span
            class="flex-1 truncate font-medium"
            :class="{ 'text-gray-400 dark:text-gray-500 italic': !act.title }"
          >
            {{ act.title || $t('gestion.shows.act_untitled') }}
          </span>
          <div class="flex gap-1 shrink-0">
            <UButton
              icon="i-heroicons-arrow-up"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="index === 0"
              :aria-label="$t('gestion.shows.act_move_up')"
              @click="move(index, -1)"
            />
            <UButton
              icon="i-heroicons-arrow-down"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="index === acts.length - 1"
              :aria-label="$t('gestion.shows.act_move_down')"
              @click="move(index, 1)"
            />
            <UButton
              icon="i-heroicons-trash"
              color="error"
              variant="ghost"
              size="xs"
              :aria-label="$t('gestion.shows.act_delete')"
              @click="remove(index)"
            />
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <!-- Titre + Durée -->
        <div class="flex flex-col gap-4 sm:flex-row">
          <UFormField :label="$t('gestion.shows.act_title')" required class="flex-1">
            <UInput
              v-model="act.title"
              :placeholder="$t('gestion.shows.act_title_placeholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.shows.act_duration')" class="sm:w-40">
            <UInputNumber v-model="act.duration" :min="0" :step="5" class="w-full" />
          </UFormField>
        </div>

        <!-- Artistes -->
        <UFormField :label="$t('gestion.shows.act_artists')">
          <USelectMenu
            v-model="act.artistIds"
            :items="artistOptions"
            value-key="value"
            multiple
            :placeholder="$t('gestion.shows.select_artists')"
            class="w-full"
          >
            <template #label>
              <span v-if="act.artistIds.length === 0">
                {{ $t('gestion.shows.no_artists_selected') }}
              </span>
              <span v-else>
                {{ $t('gestion.shows.artists_count', { count: act.artistIds.length }) }}
              </span>
            </template>
          </USelectMenu>
        </UFormField>

        <div v-if="artistsOf(act).length > 0" class="flex flex-wrap gap-2">
          <UBadge
            v-for="artist in artistsOf(act)"
            :key="artist.id"
            color="warning"
            variant="subtle"
          >
            <UiUserName :user="artist.user" />
          </UBadge>
        </div>

        <!-- Description -->
        <UFormField :label="$t('gestion.shows.act_description')">
          <UTextarea
            v-model="act.description"
            :placeholder="$t('gestion.shows.act_description_placeholder')"
            rows="2"
            class="w-full"
          />
        </UFormField>

        <!-- Besoins techniques + Mise en place scène -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField :label="$t('gestion.shows.act_technical_needs')">
            <UTextarea
              v-model="act.technicalNeeds"
              :placeholder="$t('gestion.shows.act_technical_needs_placeholder')"
              rows="3"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.shows.act_stage_setup')">
            <UTextarea
              v-model="act.stageSetup"
              :placeholder="$t('gestion.shows.act_stage_setup_placeholder')"
              rows="3"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>
    </UCard>

    <!-- Ajouter un numéro -->
    <UButton
      v-if="acts.length > 0"
      icon="i-heroicons-plus"
      color="neutral"
      variant="outline"
      block
      @click="add"
    >
      {{ $t('gestion.shows.add_act') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
interface ActInput {
  title: string
  duration: number | string | null
  description: string | null
  technicalNeeds: string | null
  stageSetup: string | null
  artistIds: number[]
}

const acts = defineModel<ActInput[]>({ required: true })

const props = defineProps<{
  artists: any[]
}>()

const artistOptions = computed(() =>
  props.artists.map((artist) => ({
    label: `${artist.user?.prenom || ''} ${artist.user?.nom || ''}`.trim() || artist.user?.email,
    value: artist.id,
  }))
)

const artistsOf = (act: ActInput) => props.artists.filter((a) => act.artistIds.includes(a.id))

const add = () => {
  acts.value = [
    ...acts.value,
    {
      title: '',
      duration: null,
      description: null,
      technicalNeeds: null,
      stageSetup: null,
      artistIds: [],
    },
  ]
}

const remove = (index: number) => {
  acts.value = acts.value.filter((_, i) => i !== index)
}

// L'ordre du tableau fait foi : c'est lui que le serveur convertit en position
const move = (index: number, delta: number) => {
  const target = index + delta
  if (target < 0 || target >= acts.value.length) return
  const next = [...acts.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  acts.value = next
}
</script>
