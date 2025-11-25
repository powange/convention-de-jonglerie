<template>
  <div
    ref="messageRef"
    class="relative select-none touch-pan-y"
    :style="{ transform: `translateX(${swipeOffset}px)` }"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Indicateur de swipe (icône de réponse) - positionné à gauche du message -->
    <div
      v-if="swipeOffset > 0"
      class="absolute right-full top-1/2 -translate-y-1/2 pr-2 flex items-center"
      :style="{ opacity: Math.min(swipeOffset / swipeThreshold, 1) }"
    >
      <div
        class="p-2 rounded-full transition-colors"
        :class="swipeOffset > swipeThreshold ? 'bg-primary/40' : 'bg-primary/20'"
      >
        <UIcon name="i-heroicons-arrow-uturn-left" class="w-5 h-5 text-primary" />
      </div>
    </div>

    <!-- Contenu du message -->
    <slot />
  </div>

  <!-- Modal d'actions (long press) - adapté mobile -->
  <UModal v-model:open="showActionsModal" :title="$t('messenger.message_actions')">
    <template #body>
      <div class="flex flex-col gap-2">
        <UButton
          color="neutral"
          variant="soft"
          block
          size="lg"
          icon="i-heroicons-arrow-uturn-left"
          :label="$t('messenger.reply')"
          class="justify-start"
          @click="handleReply"
        />
        <UButton
          v-if="canDelete"
          color="error"
          variant="soft"
          block
          size="lg"
          icon="i-lucide-trash"
          :label="$t('messenger.delete')"
          class="justify-start"
          @click="handleDelete"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  messageId: string
  canDelete: boolean
  isDeleted?: boolean
}>()

const emit = defineEmits<{
  reply: []
  delete: []
}>()

const messageRef = ref<HTMLElement | null>(null)

// Swipe state
const swipeOffset = ref(0)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const isSwiping = ref(false)
const swipeThreshold = 60 // Distance en px pour déclencher l'action

// Long press state
const showActionsModal = ref(false)
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const longPressThreshold = 500 // Durée en ms pour déclencher le long press
const hasMoved = ref(false)

// Touch start
function handleTouchStart(e: TouchEvent) {
  if (props.isDeleted) return

  const touch = e.touches[0]
  swipeStartX.value = touch.clientX
  swipeStartY.value = touch.clientY
  hasMoved.value = false
  isSwiping.value = false

  // Démarrer le timer pour le long press
  longPressTimer.value = setTimeout(() => {
    if (!hasMoved.value) {
      // Vibration haptique si disponible
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }

      showActionsModal.value = true
    }
  }, longPressThreshold)
}

// Touch move
function handleTouchMove(e: TouchEvent) {
  if (props.isDeleted) return

  const touch = e.touches[0]
  const deltaX = touch.clientX - swipeStartX.value
  const deltaY = touch.clientY - swipeStartY.value

  // Détecter si on a bougé (pour annuler le long press)
  if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
    hasMoved.value = true

    // Annuler le long press si on bouge
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
  }

  // Si on swipe principalement horizontalement vers la droite
  if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
    isSwiping.value = true

    // Limiter le swipe à un maximum avec une résistance
    const maxSwipe = 100
    const resistance = 0.5
    swipeOffset.value = Math.min(deltaX * resistance, maxSwipe)
  }
}

// Touch end
function handleTouchEnd() {
  // Annuler le timer de long press
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // Si le swipe dépasse le seuil, déclencher l'action de réponse
  if (swipeOffset.value > swipeThreshold) {
    emit('reply')

    // Vibration haptique si disponible
    if (navigator.vibrate) {
      navigator.vibrate(30)
    }
  }

  // Réinitialiser le swipe avec animation
  swipeOffset.value = 0
  isSwiping.value = false
}

// Actions du menu
function handleReply() {
  showActionsModal.value = false
  emit('reply')
}

function handleDelete() {
  showActionsModal.value = false
  emit('delete')
}

// Cleanup
onUnmounted(() => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
  }
})
</script>

<style scoped>
/* Transition fluide pour le swipe */
div:first-child {
  transition: transform 0.15s ease-out;
}
</style>
