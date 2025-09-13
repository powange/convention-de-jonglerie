<template>
  <UModal v-model:open="showBanner" :title="$t('pwa.install.title')">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600">
          {{ $t('pwa.install.description') }}
        </p>

        <div class="flex gap-2 justify-end">
          <UButton
            :label="$t('pwa.install.later')"
            variant="outline"
            color="neutral"
            @click="dismiss"
          />
          <UButton :label="$t('pwa.install.button')" color="primary" @click="installApp" />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()

const showBanner = ref(false)
let deferredPrompt: any = null

const installApp = async () => {
  if (!deferredPrompt) return

  try {
    // Afficher le prompt d'installation
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      // Installation acceptée
      showBanner.value = false
      toast.add({
        title: t('pwa.install.success.title'),
        description: t('pwa.install.success.description'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      // Installation refusée
      toast.add({
        title: t('pwa.install.cancelled.title'),
        description: t('pwa.install.cancelled.description'),
        icon: 'i-heroicons-information-circle',
        color: 'neutral',
      })
    }

    deferredPrompt = null
  } catch (error) {
    console.error("Erreur lors de l'installation:", error)
    toast.add({
      title: t('pwa.install.error.title'),
      description: t('pwa.install.error.description'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
  }
}

const dismiss = () => {
  showBanner.value = false
  // Stocker le refus pendant 7 jours
  localStorage.setItem('pwa-dismissed', Date.now().toString())
}

// Vérifier si on doit afficher la bannière
const shouldShowBanner = () => {
  // Vérifier si déjà installé
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return false
  }

  // Vérifier si récemment refusé (7 jours)
  const dismissed = localStorage.getItem('pwa-dismissed')
  if (dismissed) {
    const dismissedTime = parseInt(dismissed)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    if (dismissedTime > sevenDaysAgo) {
      return false
    }
  }

  return true
}

onMounted(() => {
  if (!shouldShowBanner()) return

  // Écouter l'événement d'installation
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e

    // Attendre 5 secondes avant d'afficher la bannière
    setTimeout(() => {
      if (shouldShowBanner()) {
        showBanner.value = true
      }
    }, 5000)
  })

  // Écouter l'événement d'installation réussie
  window.addEventListener('appinstalled', () => {
    console.log('PWA installée avec succès')
    showBanner.value = false
  })
})
</script>
