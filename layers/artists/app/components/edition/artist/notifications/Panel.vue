<template>
  <div class="space-y-6">
    <!-- Formulaire d'envoi -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-paper-airplane" class="text-orange-500" />
          <h2 class="text-lg font-semibold">
            {{ $t('gestion.artists.notifications.send_title') }}
          </h2>
        </div>
      </template>

      <div class="space-y-4">
        <UFormField :label="$t('gestion.artists.notifications.target')">
          <URadioGroup v-model="perimetre" :items="choixPerimetre" />
        </UFormField>

        <UFormField
          v-if="perimetre === 'shows'"
          :label="$t('gestion.artists.notifications.shows')"
          :description="$t('gestion.artists.notifications.shows_hint')"
        >
          <USelectMenu
            v-model="spectaclesChoisis"
            :items="choixSpectacles"
            multiple
            value-key="value"
            class="w-full"
            :placeholder="$t('gestion.artists.notifications.shows_placeholder')"
          />
        </UFormField>

        <UFormField
          :label="$t('gestion.artists.notifications.message')"
          :description="$t('gestion.artists.notifications.message_hint', { max: MAX_CARACTERES })"
        >
          <UTextarea
            v-model="message"
            :rows="4"
            :maxlength="MAX_CARACTERES"
            class="w-full"
            :placeholder="$t('gestion.artists.notifications.message_placeholder')"
          />
          <p class="text-xs text-gray-500 mt-1 text-right">
            {{ message.length }} / {{ MAX_CARACTERES }}
          </p>
        </UFormField>

        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          variant="subtle"
          :description="$t('gestion.artists.notifications.channels_hint')"
        />

        <div class="flex justify-end">
          <UButton
            icon="i-heroicons-paper-airplane"
            :loading="envoiEnCours"
            :disabled="!peutEnvoyer"
            @click="confirmationOuverte = true"
          >
            {{ $t('gestion.artists.notifications.send') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Historique -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-clock" class="text-gray-500" />
          <h2 class="text-lg font-semibold">
            {{ $t('gestion.artists.notifications.history') }}
          </h2>
        </div>
      </template>

      <div v-if="chargementHistorique" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400 h-5 w-5" />
        <span class="ml-2 text-gray-500">{{ $t('common.loading') }}</span>
      </div>

      <div v-else-if="historique.length === 0" class="text-center py-8">
        <UIcon name="i-heroicons-bell-slash" class="mx-auto text-gray-400 h-8 w-8" />
        <p class="mt-2 text-gray-500">{{ $t('gestion.artists.notifications.history_empty') }}</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="envoi in historique"
          :key="envoi.id"
          class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm text-gray-500">
                {{ formatDate(envoi.sentAt) }} — {{ envoi.sender.pseudo }}
              </p>
              <p class="mt-1 whitespace-pre-line break-words">{{ envoi.message }}</p>
              <div class="flex flex-wrap items-center gap-2 mt-2">
                <UBadge variant="subtle" size="sm">
                  {{
                    envoi.targetType === 'all'
                      ? $t('gestion.artists.notifications.target_all')
                      : $t('gestion.artists.notifications.target_shows', {
                          count: (envoi.selectedShows ?? []).length,
                        })
                  }}
                </UBadge>
                <UBadge
                  :color="envoi.confirmedCount === envoi.recipientCount ? 'success' : 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  {{
                    $t('gestion.artists.notifications.confirmed_ratio', {
                      confirmes: envoi.confirmedCount,
                      total: envoi.recipientCount,
                    })
                  }}
                </UBadge>
              </div>
            </div>
            <UButton
              icon="i-heroicons-eye"
              color="neutral"
              variant="ghost"
              size="sm"
              class="shrink-0"
              :title="$t('gestion.artists.notifications.who_read')"
              @click="ouvrirConfirmations(envoi.id)"
            />
          </div>
        </div>
      </div>
    </UCard>

    <!-- Confirmation avant envoi : un message parti ne se rattrape pas -->
    <UModal
      v-model:open="confirmationOuverte"
      :title="$t('gestion.artists.notifications.confirm_title')"
    >
      <template #body>
        <div class="space-y-3">
          <p>{{ $t('gestion.artists.notifications.confirm_message') }}</p>
          <UAlert
            icon="i-heroicons-exclamation-triangle"
            color="warning"
            variant="subtle"
            :description="$t('gestion.artists.notifications.confirm_warning')"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3 w-full">
          <UButton color="neutral" variant="outline" @click="confirmationOuverte = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton :loading="envoiEnCours" @click="envoyer">
            {{ $t('gestion.artists.notifications.send') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <EditionArtistNotificationsConfirmationsModal
      v-model="confirmationsOuvertes"
      :edition-id="editionId"
      :group-id="groupeConsulte"
    />
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~/utils/date'

const props = defineProps<{
  editionId: number
  shows: { id: number; title: string }[]
}>()

const { t } = useI18n()

/** Même borne que côté bénévoles, et que celle appliquée par le serveur. */
const MAX_CARACTERES = 500

const perimetre = ref<'all' | 'shows'>('all')
const spectaclesChoisis = ref<number[]>([])
const message = ref('')
const confirmationOuverte = ref(false)
const confirmationsOuvertes = ref(false)
const groupeConsulte = ref<string | null>(null)

const choixPerimetre = computed(() => [
  { label: t('gestion.artists.notifications.target_all'), value: 'all' },
  { label: t('gestion.artists.notifications.target_by_show'), value: 'shows' },
])

const choixSpectacles = computed(() =>
  props.shows.map((show) => ({ label: show.title, value: show.id }))
)

const peutEnvoyer = computed(
  () =>
    message.value.trim().length > 0 &&
    (perimetre.value === 'all' || spectaclesChoisis.value.length > 0)
)

interface EnvoiHistorique {
  id: string
  message: string
  targetType: string
  selectedShows: number[] | null
  recipientCount: number
  confirmedCount: number
  sentAt: string
  sender: { id: number; pseudo: string }
}

const historique = ref<EnvoiHistorique[]>([])
const chargementHistorique = ref(false)

const chargerHistorique = async () => {
  chargementHistorique.value = true
  try {
    const reponse = await $fetch<{ data: { notifications: EnvoiHistorique[] } }>(
      `/api/editions/${props.editionId}/artists/notifications`
    )
    historique.value = reponse.data.notifications
  } catch {
    historique.value = []
  } finally {
    chargementHistorique.value = false
  }
}

const { execute: executerEnvoi, loading: envoiEnCours } = useApiAction<
  unknown,
  { recipientCount: number }
>(() => `/api/editions/${props.editionId}/artists/notifications`, {
  method: 'POST',
  body: () => ({
    targetType: perimetre.value,
    selectedShows: perimetre.value === 'shows' ? spectaclesChoisis.value : undefined,
    message: message.value.trim(),
  }),
  silentSuccess: true,
  errorMessages: { default: t('gestion.artists.notifications.send_error') },
  onSuccess: async (reponse: { recipientCount: number }) => {
    confirmationOuverte.value = false
    message.value = ''
    spectaclesChoisis.value = []
    useToast().add({
      color: 'success',
      title: t('gestion.artists.notifications.sent'),
      description: t('gestion.artists.notifications.sent_description', {
        count: reponse.recipientCount,
      }),
    })
    await chargerHistorique()
  },
  onError: () => {
    confirmationOuverte.value = false
  },
})

const envoyer = () => executerEnvoi()

const ouvrirConfirmations = (groupId: string) => {
  groupeConsulte.value = groupId
  confirmationsOuvertes.value = true
}

onMounted(chargerHistorique)
</script>
