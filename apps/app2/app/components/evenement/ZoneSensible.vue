<template>
  <div class="space-y-4">
    <USeparator label="Zone sensible" />
    <div class="grid gap-4 lg:grid-cols-2">
      <!-- Archiver : lecture seule complète, et une place libérée dans la formule du propriétaire.
           Permis même quand la gestion est en lecture seule : c'est le moyen d'en sortir. -->
      <UCard>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold">
              {{ archivedAt ? 'Événement archivé' : "Archiver l'événement" }}
            </p>
            <p class="text-sm text-muted">
              {{
                archivedAt
                  ? `Archivé le ${new Date(archivedAt).toLocaleDateString('fr-FR')} : tout reste consultable, rien n'est modifiable. Le désarchiver reprend une place de votre formule.`
                  : "Pour un événement passé : tout reste consultable, plus rien n'est modifiable, et il libère une place parmi les événements en cours de votre formule."
              }}
            </p>
          </div>
          <UButton
            color="neutral"
            variant="outline"
            :icon="archivedAt ? 'i-heroicons-arrow-uturn-left' : 'i-heroicons-archive-box'"
            :label="archivedAt ? 'Désarchiver' : 'Archiver'"
            :loading="archivage"
            class="shrink-0"
            @click="basculerArchive"
          />
        </div>
      </UCard>

      <!-- Le propriétaire seul supprime (décision de l'utilisateur). -->
      <UCard :ui="{ root: 'ring-error/40' }">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold text-error">Supprimer l'événement</p>
            <p class="text-sm text-muted">
              Définitif : toutes ses données partent avec lui (candidatures, équipes, créneaux,
              planning, organisateurs).
            </p>
          </div>
          <UButton
            color="error"
            variant="soft"
            icon="i-heroicons-trash"
            label="Supprimer…"
            class="shrink-0"
            @click="fenetreSuppression = true"
          />
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="fenetreSuppression"
      title="Supprimer l'événement ?"
      :description="`« ${nom} » et toutes ses données seront effacés. Cette action est irréversible.`"
    >
      <template #body>
        <UFormField :label="`Pour confirmer, retapez le nom : ${nom}`" name="confirmation">
          <UInput v-model="confirmation" class="w-full" autocomplete="off" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Annuler"
            @click="fenetreSuppression = false"
          />
          <UButton
            color="error"
            icon="i-heroicons-trash"
            label="Supprimer définitivement"
            :loading="suppression"
            :disabled="confirmation.trim() !== nom.trim()"
            @click="supprimer"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
/**
 * Archiver ou supprimer un événement — en bas de l'accueil de sa gestion, réservé au propriétaire.
 * Émet `archive` une fois l'archivage basculé, pour que la page relise l'événement.
 */
const props = defineProps<{
  /** L'identifiant de l'événement dans l'adresse (public). */
  refEvenement: string
  nom: string
  archivedAt: string | null
}>()
const emit = defineEmits<{ archive: [] }>()

const { execute: basculerArchive, loading: archivage } = useApiAction(
  () => `/api/events/${props.refEvenement}/archive`,
  {
    method: 'POST',
    body: () => ({ archive: !props.archivedAt }),
    // Lu au moment du message, AVANT le rafraîchissement : l'état d'avant dit ce qui vient d'être fait.
    successMessage: {
      get title() {
        return props.archivedAt ? 'Événement désarchivé' : 'Événement archivé'
      },
    },
    errorMessages: { default: "L'archivage n'a pas abouti" },
    onSuccess: async () => {
      // Le bandeau de lecture seule de la gestion lit l'accès : on le relit avec l'événement.
      await refreshNuxtData(`acces-gestion-${props.refEvenement}`)
      emit('archive')
    },
  }
)

const fenetreSuppression = ref(false)
const confirmation = ref('')
watch(fenetreSuppression, (ouverte) => {
  if (ouverte) confirmation.value = ''
})

const { execute: supprimer, loading: suppression } = useApiAction(
  () => `/api/events/${props.refEvenement}`,
  {
    method: 'DELETE',
    body: () => ({ confirmation: confirmation.value }),
    successMessage: { title: 'Événement supprimé' },
    errorMessages: { default: "L'événement n'a pas pu être supprimé" },
    onSuccess: async () => {
      await navigateTo('/dashboard')
    },
  }
)
</script>
