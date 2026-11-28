<template>
  <UPopover v-model:open="ouvert" :content="{ align: 'end', sideOffset: 8 }">
    <!-- Le bouton est le déclencheur direct : enveloppé dans la pastille, il n'ouvrait rien. -->
    <UButton
      icon="i-heroicons-bell"
      color="neutral"
      variant="ghost"
      class="relative"
      :aria-label="libelle"
    >
      <UChip
        v-if="nonLues > 0"
        :text="pastille"
        color="error"
        size="3xl"
        standalone
        class="absolute -top-0.5 -right-0.5"
      />
    </UButton>

    <template #content>
      <div class="flex w-[min(24rem,calc(100vw-2rem))] flex-col">
        <div class="flex items-center justify-between gap-2 border-b border-default px-4 py-3">
          <p class="font-semibold">Notifications</p>
          <UButton
            v-if="nonLues > 0"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-check"
            label="Tout marquer comme lu"
            :loading="marquageGlobal"
            @click="toutMarquer"
          />
        </div>

        <div v-if="!notifications.length" class="px-4 py-10 text-center text-sm text-muted">
          <UIcon name="i-heroicons-bell-slash" class="mx-auto mb-2 size-8" />
          Aucune notification pour l'instant.
        </div>
        <ul v-else class="max-h-[60vh] divide-y divide-default overflow-y-auto">
          <li
            v-for="n in notifications"
            :key="n.id"
            class="group flex items-start gap-3 px-4 py-3 transition hover:bg-elevated"
            :class="n.lue ? '' : 'bg-primary/5'"
          >
            <UIcon
              :name="ICONES[n.type] ?? 'i-heroicons-information-circle'"
              class="mt-0.5 size-5 shrink-0"
              :class="COULEURS[n.type] ?? 'text-info'"
            />
            <button type="button" class="min-w-0 flex-1 text-left" @click="ouvrir(n)">
              <p class="text-sm" :class="n.lue ? 'text-default' : 'font-semibold text-highlighted'">
                {{ n.titre }}
              </p>
              <p v-if="n.message" class="mt-0.5 text-sm text-muted">{{ n.message }}</p>
              <p class="mt-1 text-xs text-dimmed">
                {{ depuis(n.creeeLe) }}
                <span v-if="n.url && n.action" class="text-primary"> · {{ n.action }}</span>
              </p>
            </button>
            <div class="flex shrink-0 flex-col items-center gap-1">
              <span
                v-if="!n.lue"
                class="mt-1.5 size-2 rounded-full bg-primary"
                aria-label="Non lue"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-x-mark"
                class="opacity-60 group-hover:opacity-100"
                :aria-label="`Supprimer la notification « ${n.titre} »`"
                @click="supprimer(n)"
              />
            </div>
          </li>
        </ul>

        <!-- Recevoir ces notifications sur le téléphone : proposé tant que cet appareil ne les
             reçoit pas (et qu'il le peut). La permission se demande sur ce geste. -->
        <div
          v-if="etatPush === 'inactif'"
          class="flex items-center justify-between gap-3 border-t border-default px-4 py-3"
        >
          <p class="text-sm text-muted">Les recevoir aussi sur cet appareil ?</p>
          <UButton
            size="sm"
            icon="i-heroicons-bell-alert"
            label="Activer"
            :loading="activation"
            @click="activerPush"
          />
        </div>
        <p
          v-else-if="etatPush === 'refuse'"
          class="border-t border-default px-4 py-3 text-xs text-muted"
        >
          Notifications bloquées dans ce navigateur : autorisez-les dans les réglages du site.
        </p>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
/**
 * La cloche des notifications du compte (modèle `Notification`, créées par les modules : échanges
 * de créneaux, candidatures, appels à spectacles…). Montée dans l'en-tête du site et dans la barre
 * de la gestion.
 *
 * Relue à l'ouverture, au retour sur l'onglet, et chaque minute tant que la page est visible : pas
 * de flux en direct ici, une minute de retard sur une pastille suffit.
 */
interface NotificationAffichee {
  id: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  titre: string
  message: string
  action: string | null
  url: string | null
  lue: boolean
  creeeLe: string
}

const ICONES: Record<string, string> = {
  INFO: 'i-heroicons-information-circle',
  SUCCESS: 'i-heroicons-check-circle',
  WARNING: 'i-heroicons-exclamation-triangle',
  ERROR: 'i-heroicons-x-circle',
}
const COULEURS: Record<string, string> = {
  INFO: 'text-info',
  SUCCESS: 'text-success',
  WARNING: 'text-warning',
  ERROR: 'text-error',
}

const ouvert = ref(false)
const { data, refresh } = useFetch<{ nonLues: number; notifications: NotificationAffichee[] }>(
  '/api/notifications',
  {
    key: 'notifications-du-compte',
    server: false,
    default: () => ({ nonLues: 0, notifications: [] }),
  }
)
const notifications = computed(() => data.value?.notifications ?? [])
const nonLues = computed(() => data.value?.nonLues ?? 0)
const pastille = computed(() => (nonLues.value > 9 ? '9+' : String(nonLues.value)))
const libelle = computed(() =>
  nonLues.value === 0
    ? 'Notifications'
    : `Notifications, ${nonLues.value} non lue${nonLues.value > 1 ? 's' : ''}`
)

const toast = useToast()
const { etat: etatPush, rafraichir: rafraichirPush, activer } = usePushNotifications()
watch(ouvert, (o) => {
  if (!o) return
  refresh()
  if (etatPush.value === 'inconnu') rafraichirPush()
})

const activation = ref(false)
async function activerPush() {
  activation.value = true
  try {
    if (await activer()) {
      toast.add({
        title: 'Notifications activées sur cet appareil',
        icon: 'i-heroicons-bell',
        color: 'success',
      })
    }
  } catch {
    toast.add({ title: "Les notifications n'ont pas pu être activées", color: 'error' })
  } finally {
    activation.value = false
  }
}

let minuterie: ReturnType<typeof setInterval> | undefined
function auRetour() {
  if (document.visibilityState === 'visible') refresh()
}
/** Un push vient d'arriver (prévenu par le service worker) : la pastille suit à l'instant. */
function aLaReception(message: MessageEvent) {
  if ((message.data as { type?: string } | null)?.type === 'flowvent:push') refresh()
}
onMounted(() => {
  minuterie = setInterval(() => {
    if (document.visibilityState === 'visible') refresh()
  }, 60_000)
  document.addEventListener('visibilitychange', auRetour)
  navigator.serviceWorker?.addEventListener('message', aLaReception)
})
onBeforeUnmount(() => {
  clearInterval(minuterie)
  document.removeEventListener('visibilitychange', auRetour)
  navigator.serviceWorker?.removeEventListener('message', aLaReception)
})

/** « à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 j », puis la date. */
function depuis(date: string): string {
  const secondes = Math.round((Date.now() - new Date(date).getTime()) / 1000)
  if (secondes < 60) return "à l'instant"
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`
  if (secondes < 7 * 86400) return `il y a ${Math.floor(secondes / 86400)} j`
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

async function ouvrir(n: NotificationAffichee) {
  if (!n.lue) {
    // L'affichage d'abord : le marquage se fait en tâche de fond, sans bloquer la navigation. Puis
    // on relit : la page ouverte remonte la cloche, qui a pu relire la liste AVANT le marquage et
    // garder l'ancienne pastille jusqu'au prochain rafraîchissement.
    n.lue = true
    if (data.value) data.value.nonLues = Math.max(0, data.value.nonLues - 1)
    $fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
      .catch(() => null)
      .finally(() => refresh())
  }
  if (n.url) {
    ouvert.value = false
    await navigateTo(n.url)
  }
}

const marquageGlobal = ref(false)
async function toutMarquer() {
  marquageGlobal.value = true
  try {
    await $fetch('/api/notifications/mark-all-read', { method: 'PATCH' })
  } finally {
    marquageGlobal.value = false
    await refresh()
  }
}

async function supprimer(n: NotificationAffichee) {
  if (data.value) {
    data.value.notifications = data.value.notifications.filter((x) => x.id !== n.id)
    if (!n.lue) data.value.nonLues = Math.max(0, data.value.nonLues - 1)
  }
  await $fetch(`/api/notifications/${n.id}`, { method: 'DELETE' }).catch(() => refresh())
}
</script>
