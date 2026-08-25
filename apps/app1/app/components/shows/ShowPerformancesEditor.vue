<template>
  <div class="space-y-4">
    <!-- Une carte par représentation -->
    <UCard v-for="(performance, index) in performances" :key="index">
      <template #header>
        <div class="flex items-center gap-3">
          <UBadge color="primary" variant="subtle" class="shrink-0">
            {{ $t('gestion.shows.performance_number', { number: index + 1 }) }}
          </UBadge>
          <div class="grow" />
          <USwitch
            :model-value="performance.isPublic"
            :label="$t('gestion.shows.performance_public')"
            @update:model-value="majPublication(index, $event)"
          />
          <!-- La dernière représentation ne se retire pas : un spectacle sans date
               n'apparaîtrait ni au programme, ni sur la carte. -->
          <UButton
            v-if="performances.length > 1"
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="sm"
            :aria-label="$t('gestion.shows.remove_performance')"
            @click="retirer(index)"
          />
        </div>
      </template>

      <div class="space-y-4">
        <UiDateTimePicker
          :model-value="performance.startDateTime"
          :date-label="$t('gestion.shows.start_date')"
          :time-label="$t('gestion.shows.start_time')"
          :placeholder="$t('gestion.shows.start_datetime')"
          required
          @update:model-value="majDate(index, $event)"
        />

        <EditionLocationPicker
          :location-name="performance.location"
          :zone-id="performance.zoneId"
          :marker-id="performance.markerId"
          :edition-id="editionId"
          :site-map-enabled="siteMapEnabled"
          :label="$t('gestion.shows.location')"
          :placeholder-carte="$t('gestion.shows.select_zone_or_marker')"
          :placeholder-texte="$t('gestion.shows.free_text_placeholder')"
          @update:location-name="majChamp(index, 'location', $event)"
          @update:zone-id="majChamp(index, 'zoneId', $event)"
          @update:marker-id="majChamp(index, 'markerId', $event)"
        />
      </div>
    </UCard>

    <UButton icon="i-heroicons-plus" color="primary" variant="soft" size="sm" @click="ajouter">
      {{ $t('gestion.shows.add_performance') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { performanceVierge, type PerformanceInput } from '~/utils/show-performances'

const performances = defineModel<PerformanceInput[]>({ required: true })

defineProps<{
  editionId: number
  siteMapEnabled?: boolean
}>()

// Les champs sont remplacés un à un plutôt que mutés en place : le suivi des modifications du
// formulaire observe le tableau, et une mutation profonde lui échapperait par moments.
const majChamp = (index: number, champ: keyof PerformanceInput, valeur: unknown) => {
  performances.value = performances.value.map((performance, i) =>
    i === index ? { ...performance, [champ]: valeur } : performance
  )
}

const majDate = (index: number, valeur: string) => majChamp(index, 'startDateTime', valeur)
const majPublication = (index: number, valeur: boolean) => majChamp(index, 'isPublic', valeur)

/**
 * Le lendemain, à la même heure : « joué deux soirs de suite » est le cas courant, et une
 * représentation sans date fait échouer l'enregistrement sur un message qui ne dit pas laquelle.
 * Mieux vaut une date à corriger qu'un champ vide à deviner.
 */
const lendemainDe = (valeur: string): string => {
  if (!valeur) return ''
  const [datePart, heure] = valeur.split('T')
  const jour = new Date(`${datePart}T00:00:00`)
  if (Number.isNaN(jour.getTime())) return ''
  jour.setDate(jour.getDate() + 1)
  const [a, m, j] = [jour.getFullYear(), jour.getMonth() + 1, jour.getDate()]
  return `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}T${heure ?? '00:00'}`
}

const ajouter = () => {
  // La nouvelle reprend le lieu de la précédente : jouer deux fois au même endroit est le cas
  // courant. Sa date, elle, avance d'un jour pour ne pas dupliquer le passage à l'identique.
  const derniere = performances.value[performances.value.length - 1]
  performances.value = [
    ...performances.value,
    {
      ...performanceVierge(),
      startDateTime: lendemainDe(derniere?.startDateTime ?? ''),
      location: derniere?.location ?? '',
      zoneId: derniere?.zoneId ?? null,
      markerId: derniere?.markerId ?? null,
    },
  ]
}

const retirer = (index: number) => {
  performances.value = performances.value.filter((_, i) => i !== index)
}
</script>
