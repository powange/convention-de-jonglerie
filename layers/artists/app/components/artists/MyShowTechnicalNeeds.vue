<template>
  <div class="space-y-2">
    <UFormField :label="$t('artists.tech_needs_label')">
      <UTextarea
        v-model="technicalNeeds"
        :rows="2"
        autoresize
        class="w-full"
        :placeholder="$t('artists.tech_needs_placeholder')"
      />
    </UFormField>

    <UFormField v-if="hasStageSetup" :label="$t('artists.stage_setup_label')">
      <UTextarea
        v-model="stageSetup"
        :rows="2"
        autoresize
        class="w-full"
        :placeholder="$t('artists.stage_setup_placeholder')"
      />
    </UFormField>

    <UAlert
      v-if="conflict"
      color="warning"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="$t('artists.tech_needs_conflict_title')"
      :description="$t('artists.tech_needs_conflict')"
    />

    <div class="flex justify-end">
      <UButton
        size="xs"
        icon="i-heroicons-check"
        :loading="loading"
        :disabled="!isDirty"
        @click="save"
      >
        {{ $t('common.save') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
// Édite les besoins techniques (et, pour un numéro, la mise en place scène) d'un spectacle
// standard OU d'un numéro de cabaret auquel l'artiste participe. Champ partagé côté serveur :
// on renvoie la valeur d'origine chargée pour détecter une édition concurrente (conflit) et
// éviter d'écraser en silence.
const props = defineProps<{
  editionId: number
  showId?: number
  actId?: number
  hasStageSetup?: boolean
  technicalNeeds: string | null
  stageSetup: string | null
}>()

const { t } = useI18n()
const toast = useToast()

const technicalNeeds = ref(props.technicalNeeds ?? '')
const stageSetup = ref(props.stageSetup ?? '')
// Valeurs de référence (dernier état connu du serveur) : dirty + détection de conflit.
const original = ref({
  technicalNeeds: props.technicalNeeds ?? '',
  stageSetup: props.stageSetup ?? '',
})
const conflict = ref(false)

const isDirty = computed(
  () =>
    technicalNeeds.value !== original.value.technicalNeeds ||
    (!!props.hasStageSetup && stageSetup.value !== original.value.stageSetup)
)

const { execute, loading } = useApiAction<unknown, any>(
  () => `/api/editions/${props.editionId}/my-show-technical-needs`,
  {
    method: 'PUT',
    body: () => ({
      showId: props.showId,
      actId: props.actId,
      technicalNeeds: technicalNeeds.value,
      stageSetup: props.hasStageSetup ? stageSetup.value : undefined,
      expectedTechnicalNeeds: original.value.technicalNeeds,
      expectedStageSetup: props.hasStageSetup ? original.value.stageSetup : undefined,
    }),
    silentSuccess: true,
    errorMessages: { default: t('artists.tech_needs_save_error') },
    onSuccess: (res: any) => {
      if (res?.conflict) {
        // La valeur a changé entre-temps (organisateur ou autre artiste) : on affiche l'actuelle
        // et on prévient. L'artiste peut re-décider puis réenregistrer.
        technicalNeeds.value = res.current?.technicalNeeds ?? ''
        if (props.hasStageSetup) stageSetup.value = res.current?.stageSetup ?? ''
        original.value = {
          technicalNeeds: res.current?.technicalNeeds ?? '',
          stageSetup: res.current?.stageSetup ?? '',
        }
        conflict.value = true
        toast.add({
          title: t('artists.tech_needs_conflict_title'),
          description: t('artists.tech_needs_conflict'),
          icon: 'i-heroicons-exclamation-triangle',
          color: 'warning',
        })
        return
      }
      original.value = {
        technicalNeeds: res?.technicalNeeds ?? '',
        stageSetup: res?.stageSetup ?? '',
      }
      technicalNeeds.value = res?.technicalNeeds ?? ''
      if (props.hasStageSetup) stageSetup.value = res?.stageSetup ?? ''
      conflict.value = false
      toast.add({
        title: t('artists.tech_needs_saved'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    },
  }
)

const save = () => {
  conflict.value = false
  execute()
}
</script>
