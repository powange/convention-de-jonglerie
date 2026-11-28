<template>
  <div class="space-y-8">
    <ProfileHeader />

    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-device-phone-mobile" class="size-5 text-primary" />
          <div>
            <h2 class="font-semibold">Notifications sur cet appareil</h2>
            <p class="text-sm text-muted">
              Échanges de créneaux, candidatures, nouvelles de vos événements : reçues sur ce
              téléphone ou cet ordinateur, même Flowvent fermé.
            </p>
          </div>
        </div>
      </template>

      <USkeleton v-if="etat === 'inconnu'" class="h-12 w-full" />
      <template v-else>
        <div v-if="etat === 'indisponible'" class="space-y-2 text-sm text-muted">
          <p>Ce navigateur ne reçoit pas de notifications.</p>
          <p>
            Sur iPhone, installez d'abord l'application de votre événement sur l'écran d'accueil
            (Partager → « Sur l'écran d'accueil »), puis ouvrez-la et revenez ici.
          </p>
        </div>
        <UAlert
          v-else-if="etat === 'refuse'"
          color="warning"
          variant="soft"
          icon="i-heroicons-no-symbol"
          title="Notifications bloquées pour Flowvent dans ce navigateur."
          description="Autorisez-les dans les réglages du site (l'icône à gauche de l'adresse, ou les réglages de l'application sur le téléphone), puis rechargez la page."
        />
        <div v-else class="flex flex-wrap items-center justify-between gap-4">
          <USwitch
            :model-value="etat === 'actif'"
            :loading="bascule"
            :disabled="bascule"
            :label="etat === 'actif' ? 'Activées sur cet appareil' : 'Désactivées sur cet appareil'"
            @update:model-value="basculer"
          />
          <UButton
            v-if="etat === 'actif'"
            color="neutral"
            variant="outline"
            icon="i-heroicons-paper-airplane"
            label="Envoyer une notification de test"
            :loading="envoiTest"
            @click="tester"
          />
        </div>
      </template>
    </UCard>

    <UCard v-if="appareils.length">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-computer-desktop" class="size-5 text-primary" />
          <div>
            <h2 class="font-semibold">Appareils qui reçoivent vos notifications</h2>
            <p class="text-sm text-muted">Retirez ceux que vous n'utilisez plus.</p>
          </div>
        </div>
      </template>
      <ul class="divide-y divide-default">
        <li
          v-for="a in appareils"
          :key="a.id"
          class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div class="min-w-0">
            <p class="font-medium">
              {{ nomAppareil(a.userAgent) }}
              <UBadge
                v-if="a.endpoint === endpointCourant"
                color="primary"
                variant="soft"
                size="sm"
              >
                Cet appareil
              </UBadge>
            </p>
            <p class="text-sm text-muted">
              Ajouté le {{ new Date(a.createdAt).toLocaleDateString('fr-FR') }}
              <template v-if="a.lastSuccessAt">
                · dernière notification le
                {{ new Date(a.lastSuccessAt).toLocaleDateString('fr-FR') }}
              </template>
            </p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-trash"
            :aria-label="`Retirer ${nomAppareil(a.userAgent)}`"
            @click="retirer(a)"
          />
        </li>
      </ul>
    </UCard>
  </div>
</template>

<script setup lang="ts">
/**
 * Les notifications push du compte (Web Push standard) : les activer sur cet appareil, s'envoyer
 * un test, et retirer un appareil qui ne sert plus.
 */
definePageMeta({ layout: 'profile', middleware: 'auth' })
useHead({ title: 'Notifications' })

interface Appareil {
  id: number
  endpoint: string
  userAgent: string | null
  createdAt: string
  lastSuccessAt: string | null
}

const toast = useToast()
const { etat, rafraichir, activer, desactiver } = usePushNotifications()
const { data, refresh } = useFetch<{ abonnements: Appareil[] }>('/api/push/abonnements', {
  server: false,
  default: () => ({ abonnements: [] }),
})
const appareils = computed(() => data.value?.abonnements ?? [])
const endpointCourant = ref<string | null>(null)

async function lireEndpoint() {
  try {
    const enregistrement = await navigator.serviceWorker?.getRegistration()
    endpointCourant.value = (await enregistrement?.pushManager?.getSubscription())?.endpoint ?? null
  } catch {
    endpointCourant.value = null
  }
}

onMounted(async () => {
  await rafraichir()
  await Promise.all([lireEndpoint(), refresh()])
})

/** « Chrome sur Android », « Safari sur iPhone »… — d'après le navigateur, à titre indicatif. */
function nomAppareil(ua: string | null): string {
  if (!ua) return 'Appareil inconnu'
  const navigateur = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Navigateur'
  const systeme = /iPhone|iPad/.test(ua)
    ? 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'appareil'
  return `${navigateur} sur ${systeme}`
}

const bascule = ref(false)
async function basculer(actif: boolean) {
  bascule.value = true
  try {
    if (actif) {
      const ok = await activer()
      if (ok)
        toast.add({ title: 'Notifications activées', icon: 'i-heroicons-bell', color: 'success' })
    } else {
      await desactiver()
      toast.add({ title: 'Notifications désactivées sur cet appareil', color: 'neutral' })
    }
  } catch {
    toast.add({ title: "Les notifications n'ont pas pu être activées", color: 'error' })
  } finally {
    bascule.value = false
    await Promise.all([lireEndpoint(), refresh()])
  }
}

const envoiTest = ref(false)
async function tester() {
  envoiTest.value = true
  try {
    const { atteints } = await $fetch<{ atteints: number }>('/api/push/test', { method: 'POST' })
    toast.add(
      atteints > 0
        ? {
            title: 'Notification envoyée',
            description: `Elle arrive dans un instant sur ${atteints} appareil${atteints > 1 ? 's' : ''}.`,
            color: 'success',
          }
        : { title: "Aucun appareil n'a pu être atteint", color: 'warning' }
    )
  } catch {
    toast.add({ title: "Le test n'a pas pu être envoyé", color: 'error' })
  } finally {
    envoiTest.value = false
  }
}

async function retirer(a: Appareil) {
  if (a.endpoint === endpointCourant.value) {
    await desactiver()
  } else {
    await $fetch('/api/push/abonnements', { method: 'DELETE', body: { id: a.id } }).catch(
      () => null
    )
  }
  await Promise.all([lireEndpoint(), refresh()])
}
</script>
