<template>
  <UModal v-model:open="showBanner" title="Installer l'application">
    <template #body>
      <p class="text-sm text-gray-600 mb-3">Ajoutez l'application à votre écran d'accueil pour un accès rapide.</p>
      
    <div class="flex gap-2">
      <UButton label="Installer" class="bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600" @click="installApp" />
      <UButton label="Plus tard" class="text-gray-500 px-3 py-2 rounded text-sm hover:text-gray-700" @click="dismiss" />
    </div>
  </template>
  </UModal>
</template>

<script setup lang="ts">
// Version simple sans i18n
const showBanner = ref(false)

let deferredPrompt: any = null

const installApp = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      showBanner.value = false
    }
    deferredPrompt = null
  }
}

const dismiss = () => {
  showBanner.value = false
  localStorage.setItem('pwa-dismissed', Date.now().toString())
}

onMounted(() => {
  // Vérifier si déjà installé
  console.log('Display mode:', window.matchMedia('(display-mode: standalone)').matches)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return
  }

  // Vérifier si récemment refusé
  const dismissed = localStorage.getItem('pwa-dismissed')
  console.log('Dismissed:', dismissed)
  if (dismissed) {
    const dismissedTime = parseInt(dismissed)
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000)
    if (dismissedTime > threeDaysAgo) {
      return
    }
  }

  // Écouter l'événement d'installation
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    setTimeout(() => {
      showBanner.value = true
    }, 3000)
  })
})
</script>