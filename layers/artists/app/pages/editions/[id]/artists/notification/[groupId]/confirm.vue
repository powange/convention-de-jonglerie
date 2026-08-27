<template>
  <!-- Aucune mise en page maison ici : la disposition par défaut encadre déjà le contenu dans
       UMain > UPage > UPageBody > UContainer, dont les marges suivent la largeur de l'écran.
       La version précédente ajoutait par-dessus une hauteur d'écran entière et ses propres
       marges, ce qui imposait de faire défiler sur un téléphone pour un contenu qui tient. -->
  <UPageCard
    icon="i-heroicons-bell"
    :title="$t('artists.notification_confirm.confirm_page_title')"
    :description="envoi?.title"
    class="max-w-xl mx-auto"
  >
    <div v-if="chargement" class="flex items-center gap-2 text-gray-500">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-5" />
      {{ $t('common.loading') }}
    </div>

    <UAlert
      v-else-if="erreur"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="subtle"
      :title="$t('artists.notification_confirm.confirm_page_error')"
      :description="erreur"
    />

    <div v-else-if="envoi" class="space-y-3">
      <UAlert color="info" variant="subtle" :description="envoi.message" />

      <!-- Deux dates coexistent : celle de l'envoi et celle de la confirmation. La mention
           lève l'ambiguïté. -->
      <p class="text-xs text-muted">
        {{ $t('artists.notification_confirm.sent_on', { date: formatDate(envoi.sentAt) }) }}
      </p>

      <UAlert
        icon="i-heroicons-check-circle"
        color="success"
        variant="subtle"
        :title="
          envoi.alreadyConfirmed
            ? $t('artists.notification_confirm.already_confirmed')
            : $t('artists.notification_confirm.confirmed_now')
        "
        :description="formatDate(envoi.confirmedAt)"
      />
    </div>
  </UPageCard>
</template>

<script setup lang="ts">
import { formatDate } from '~/utils/date'

/**
 * La lecture est confirmée dès l'ouverture de la page : c'est le clic sur le lien de la
 * notification qui vaut accusé, demander un second clic n'apporterait rien.
 */
definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()

interface Envoi {
  alreadyConfirmed: boolean
  confirmedAt: string
  title: string
  message: string
  sentAt: string
}

const envoi = ref<Envoi | null>(null)
const chargement = ref(true)
const erreur = ref('')

onMounted(async () => {
  try {
    const reponse = await $fetch<{ data: Envoi }>(
      `/api/editions/${route.params.id}/artists/notification/${route.params.groupId}/confirm`,
      { method: 'POST' }
    )
    envoi.value = reponse.data
  } catch (e: any) {
    erreur.value = e?.data?.message || e?.message || ''
  } finally {
    chargement.value = false
  }
})
</script>
