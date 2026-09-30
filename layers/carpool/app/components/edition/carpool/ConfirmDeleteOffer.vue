<template>
  <UModal
    v-model:open="ouverte"
    :title="$t('components.carpool.confirm_delete_offer_title')"
    :description="description"
  >
    <template #body>
      <!-- L'avertissement n'apparaît QUE s'il y a des passagers. Un encart « 0 passager » serait
           du bruit sur le cas le plus courant, et affaiblirait celui qui compte. -->
      <UAlert
        v-if="passengerCount > 0"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="$t('components.carpool.confirm_delete_offer_passengers', { count: passengerCount })"
        :description="$t('components.carpool.confirm_delete_offer_passengers_hint')"
      />
      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('components.carpool.confirm_delete_offer_no_passenger') }}
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" @click="ouverte = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="error" icon="i-heroicons-trash" @click="confirmer">
          {{ $t('components.carpool.delete_offer') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/**
 * Confirmation de suppression d'une offre de covoiturage.
 *
 * ⚠️ POURQUOI UN COMPOSANT, et pas un `confirm()` dans chacun des deux écrans. La suppression est
 * irréversible et, depuis ce lot, elle NOTIFIE tous les passagers acceptés et en attente. Le
 * `confirm()` natif ne pouvait pas dire combien ils sont : il affichait la même phrase pour une
 * offre vide et pour une offre où trois personnes ont organisé leur week-end autour du trajet.
 *
 * La carte et le détail suppriment la même offre ; la question posée doit donc être la même, avec
 * le même compte. D'où un composant partagé plutôt que la phrase recopiée deux fois — recopiée,
 * elle aurait divergé au premier changement de libellé.
 */
interface Props {
  /** Nombre de passagers dont la réservation est ACCEPTÉE. */
  passengerCount: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ confirm: [] }>()

const ouverte = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const description = computed(() =>
  props.passengerCount > 0
    ? t('components.carpool.confirm_delete_offer_with_passengers')
    : t('components.carpool.confirm_delete_offer')
)

const confirmer = () => {
  ouverte.value = false
  emit('confirm')
}
</script>
