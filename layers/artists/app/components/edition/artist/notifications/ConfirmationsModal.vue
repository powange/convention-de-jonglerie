<template>
  <UModal v-model:open="ouvert" :title="$t('gestion.artists.notifications.who_read')">
    <template #body>
      <div v-if="chargement" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400 h-5 w-5" />
        <span class="ml-2 text-gray-500">{{ $t('common.loading') }}</span>
      </div>

      <div v-else class="space-y-4">
        <UAlert
          icon="i-heroicons-check-circle"
          :color="tousConfirme ? 'success' : 'info'"
          variant="subtle"
          :title="
            $t('gestion.artists.notifications.confirmed_ratio', {
              confirmes: nombreConfirme,
              total: confirmations.length,
            })
          "
        />

        <!-- Les non-confirmés d'abord : c'est eux qu'on cherche, pas ceux qui ont déjà lu -->
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          <li
            v-for="confirmation in confirmationsTriees"
            :key="confirmation.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <div class="flex items-center gap-2 min-w-0">
              <UiUserAvatar :user="confirmation.user" size="xs" />
              <span class="truncate">{{ confirmation.user.pseudo }}</span>
            </div>
            <UBadge
              :color="confirmation.confirmedAt ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{
                confirmation.confirmedAt
                  ? formatDate(confirmation.confirmedAt)
                  : $t('gestion.artists.notifications.not_read_yet')
              }}
            </UBadge>
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end w-full">
        <UButton color="neutral" variant="outline" @click="ouvert = false">
          {{ $t('common.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { formatDate } from '~/utils/date'

interface Confirmation {
  id: string
  confirmedAt: string | null
  user: { id: number; pseudo: string; profilePicture?: string | null; emailHash?: string }
}

const props = defineProps<{ editionId: number; groupId: string | null }>()
const ouvert = defineModel<boolean>({ required: true })

const confirmations = ref<Confirmation[]>([])
const chargement = ref(false)

const nombreConfirme = computed(() => confirmations.value.filter((c) => c.confirmedAt).length)
const tousConfirme = computed(
  () => confirmations.value.length > 0 && nombreConfirme.value === confirmations.value.length
)

// Les non-confirmés en tête : la question posée est « qui manque à l'appel ? »
const confirmationsTriees = computed(() =>
  [...confirmations.value].sort((a, b) => Number(!!a.confirmedAt) - Number(!!b.confirmedAt))
)

const charger = async () => {
  if (!props.groupId) return
  chargement.value = true
  try {
    const reponse = await $fetch<{ data: { confirmations: Confirmation[] } }>(
      `/api/editions/${props.editionId}/artists/notification/${props.groupId}/confirmations`
    )
    confirmations.value = reponse.data.confirmations
  } catch {
    confirmations.value = []
  } finally {
    chargement.value = false
  }
}

watch(
  () => [ouvert.value, props.groupId],
  ([estOuvert]) => {
    if (estOuvert) void charger()
  }
)
</script>
