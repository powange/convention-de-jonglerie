<template>
  <UModal v-model:open="isOpen" :title="title" size="lg" :prevent-close="scanning">
    <template #body>
      <div class="space-y-4">
        <!-- Zone de scan -->
        <div v-if="!scanning && !error && !loading" class="text-center py-8">
          <UIcon name="i-heroicons-qr-code" class="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <p class="text-gray-600 dark:text-gray-400">
            Cliquez sur "Démarrer le scan" pour activer la caméra
          </p>
        </div>

        <!-- Loader -->
        <div v-if="loading" class="text-center py-8">
          <div class="flex flex-col items-center gap-4">
            <div
              class="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"
            ></div>
            <p class="text-gray-600 dark:text-gray-400">Activation de la caméra...</p>
          </div>
        </div>

        <!-- Vidéo de la caméra -->
        <div v-if="scanning" class="relative">
          <div id="qr-reader" class="w-full rounded-lg overflow-hidden"></div>
          <div
            class="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium"
          >
            <UIcon name="i-heroicons-camera" class="inline mr-1" />
            En cours...
          </div>
        </div>

        <!-- Message d'erreur -->
        <UAlert
          v-if="error"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="error"
        />

        <!-- Informations -->
        <UAlert
          v-if="!scanning"
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          description="Positionnez le QR code devant la caméra. La détection est automatique."
        />
      </div>
    </template>

    <template #footer>
      <UButton variant="ghost" :disabled="scanning || loading" @click="close">
        {{ scanning ? 'Arrêter' : 'Annuler' }}
      </UButton>
      <UButton
        v-if="!scanning && !loading"
        color="primary"
        icon="i-heroicons-camera"
        @click="startScanning"
      >
        Démarrer le scan
      </UButton>
      <UButton v-else-if="scanning" color="error" icon="i-heroicons-x-circle" @click="stopScanning">
        Arrêter le scan
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { Html5Qrcode } from 'html5-qrcode'
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'

interface Props {
  open: boolean
  title?: string
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'scan', code: string): void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Scanner un QR code',
})

const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const scanning = ref(false)
const loading = ref(false)
const error = ref('')
const isTransitioning = ref(false)
let html5QrCode: Html5Qrcode | null = null

// Démarrer le scan
const startScanning = async () => {
  if (isTransitioning.value) return

  error.value = ''
  loading.value = true
  isTransitioning.value = true

  try {
    // D'abord afficher l'élément #qr-reader en mettant scanning à true
    scanning.value = true

    // Attendre que le DOM soit mis à jour avec l'élément #qr-reader
    await nextTick()

    // Créer une instance de Html5Qrcode maintenant que l'élément existe
    html5QrCode = new Html5Qrcode('qr-reader')

    // Configuration du scanner
    const config = {
      fps: 10, // Images par seconde
      qrbox: { width: 250, height: 250 }, // Zone de scan
      aspectRatio: 1.0,
    }

    // Callback de succès
    const onScanSuccess = (decodedText: string) => {
      // Arrêter le scan et émettre le résultat
      stopScanning()
      emit('scan', decodedText)
      close()
    }

    // Callback d'erreur (ne pas afficher les erreurs de scan normales)
    const onScanError = () => {
      // Ignorer les erreurs de scan normales (pas de QR code détecté)
    }

    // Démarrer le scan avec la caméra arrière (mobile) ou par défaut (desktop)
    await html5QrCode.start(
      { facingMode: 'environment' }, // Préférer la caméra arrière
      config,
      onScanSuccess,
      onScanError
    )

    // Caméra activée avec succès
    loading.value = false
    isTransitioning.value = false
  } catch (err: any) {
    console.error('Erreur lors du démarrage du scan:', err)
    loading.value = false
    scanning.value = false
    isTransitioning.value = false

    // Messages d'erreur personnalisés
    if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
      error.value = "Permission refusée. Veuillez autoriser l'accès à la caméra."
    } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      error.value = 'Aucune caméra trouvée sur cet appareil.'
    } else if (err.name === 'NotReadableError') {
      error.value =
        "Impossible d'accéder à la caméra. Elle est peut-être utilisée par une autre application."
    } else {
      error.value = "Erreur lors de l'activation de la caméra."
    }
  }
}

// Arrêter le scan
const stopScanning = async () => {
  if (isTransitioning.value || !html5QrCode || !scanning.value) return

  isTransitioning.value = true

  try {
    await html5QrCode.stop()
    html5QrCode.clear()
    html5QrCode = null
  } catch (err: any) {
    // Ignorer les erreurs de transition
    if (!err.message?.includes('transition')) {
      console.error("Erreur lors de l'arrêt du scan:", err)
    }
  } finally {
    scanning.value = false
    isTransitioning.value = false
  }
}

// Fermer la modal
const close = () => {
  stopScanning()
  isOpen.value = false
  error.value = ''
  loading.value = false
}

// Arrêter le scan si la modal se ferme
watch(isOpen, (newValue) => {
  if (!newValue && scanning.value) {
    stopScanning()
  }
})

// Nettoyer lors de la destruction du composant
onBeforeUnmount(() => {
  stopScanning()
})
</script>

<style>
/* Styles pour le scanner */
#qr-reader {
  border: 2px solid #e5e7eb;
}

.dark #qr-reader {
  border-color: #374151;
}

#qr-reader video {
  border-radius: 0.5rem;
}
</style>
