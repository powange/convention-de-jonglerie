<template>
  <div class="space-y-3">
    <div v-if="acts.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
      {{ $t('gestion.shows.no_acts') }}
    </div>

    <div
      v-for="(act, index) in acts"
      :key="index"
      class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3"
    >
      <div class="flex items-start gap-2">
        <UBadge color="neutral" variant="subtle" class="mt-2 shrink-0">
          {{ index + 1 }}
        </UBadge>

        <UFormField :label="$t('gestion.shows.act_title')" required class="flex-1">
          <UInput
            v-model="act.title"
            :placeholder="$t('gestion.shows.act_title_placeholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('gestion.shows.act_duration')" class="w-28 shrink-0">
          <UInput v-model="act.duration" type="number" min="1" placeholder="—" class="w-full" />
        </UFormField>

        <div class="flex gap-1 mt-6 shrink-0">
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

      <UFormField :label="$t('gestion.shows.act_description')">
        <UTextarea
          v-model="act.description"
          :placeholder="$t('gestion.shows.act_description_placeholder')"
          rows="2"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="$t('gestion.shows.act_technical_needs')">
        <UTextarea
          v-model="act.technicalNeeds"
          :placeholder="$t('gestion.shows.act_technical_needs_placeholder')"
          rows="2"
          class="w-full"
        />
      </UFormField>

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
            <span v-else>{{
              $t('gestion.shows.artists_count', { count: act.artistIds.length })
            }}</span>
          </template>
        </USelectMenu>
      </UFormField>

      <div v-if="artistsOf(act).length > 0" class="flex flex-wrap gap-2">
        <UBadge v-for="artist in artistsOf(act)" :key="artist.id" color="warning" variant="subtle">
          <UiUserName :user="artist.user" />
        </UBadge>
      </div>
    </div>

    <UButton icon="i-heroicons-plus" color="neutral" variant="outline" size="sm" @click="add">
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
    { title: '', duration: null, description: null, technicalNeeds: null, artistIds: [] },
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
