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

        <!-- Relancer ceux qui n'ont pas confirmé : le SMS ouvre l'application du téléphone
             avec les destinataires et le message pré-remplis. Repris du dispositif bénévole. -->
        <UAlert
          v-if="enAttenteAvecTelephone.length > 0"
          color="warning"
          variant="subtle"
          :title="
            $t('gestion.artists.notifications.pending_with_phone', {
              count: enAttenteAvecTelephone.length,
            })
          "
        >
          <template #actions>
            <UButton
              v-if="surMobile"
              size="sm"
              color="warning"
              icon="i-heroicons-chat-bubble-left-right"
              @click="envoyerSmsGroupe"
            >
              {{ $t('gestion.artists.notifications.send_group_sms') }}
            </UButton>
            <UButton
              size="sm"
              color="warning"
              variant="outline"
              icon="i-heroicons-clipboard-document"
              @click="copierNumeros"
            >
              {{ $t('gestion.artists.notifications.copy_phone_numbers') }}
            </UButton>
          </template>
        </UAlert>

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
  user: {
    id: number
    pseudo: string
    prenom?: string | null
    nom?: string | null
    phone?: string | null
    profilePicture?: string | null
  }
}

const props = defineProps<{ editionId: number; groupId: string | null }>()
const ouvert = defineModel<boolean>({ required: true })

const confirmations = ref<Confirmation[]>([])
const envoi = ref<{ id: string; message: string } | null>(null)
const chargement = ref(false)

const { t } = useI18n()
const toast = useToast()

/** Le lien `sms:` n'a de sens que là où une application de messagerie existe. */
const surMobile = computed(() =>
  import.meta.client
    ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    : false
)

const enAttenteAvecTelephone = computed(() =>
  confirmations.value.filter((c) => !c.confirmedAt && c.user.phone)
)

const nomComplet = (utilisateur: Confirmation['user']) =>
  [utilisateur.pseudo, utilisateur.prenom, utilisateur.nom].filter(Boolean).join(' ')

const envoyerSmsGroupe = () => {
  if (enAttenteAvecTelephone.value.length === 0 || !envoi.value) return

  const numeros = enAttenteAvecTelephone.value.map((c) => c.user.phone).filter(Boolean)
  const lien = `${window.location.origin}/editions/${props.editionId}/artists/notification/${envoi.value.id}/confirm`
  const corps = encodeURIComponent(
    `${t('gestion.artists.notifications.sms_intro')}\n${envoi.value.message}\n\n${t('gestion.artists.notifications.sms_confirm_link')} ${lien}`
  )

  window.location.href = `sms:${numeros.join(',')}?body=${corps}`

  toast.add({
    color: 'primary',
    title: t('gestion.artists.notifications.sms_app_opened'),
  })
}

const copierNumeros = async () => {
  if (enAttenteAvecTelephone.value.length === 0) return

  const liste = enAttenteAvecTelephone.value
    .map((c) => `${nomComplet(c.user)}: ${c.user.phone}`)
    .join('\n')

  try {
    await navigator.clipboard.writeText(liste)
    toast.add({
      color: 'success',
      title: t('gestion.artists.notifications.phone_numbers_copied', {
        count: enAttenteAvecTelephone.value.length,
      }),
    })
  } catch (error) {
    console.error('Erreur lors de la copie:', error)
    toast.add({ color: 'error', title: t('common.error') })
  }
}

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
    const reponse = await $fetch<{
      data: { confirmations: Confirmation[]; notification: { id: string; message: string } }
    }>(`/api/editions/${props.editionId}/artists/notification/${props.groupId}/confirmations`)
    confirmations.value = reponse.data.confirmations
    envoi.value = reponse.data.notification
  } catch {
    confirmations.value = []
    envoi.value = null
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
