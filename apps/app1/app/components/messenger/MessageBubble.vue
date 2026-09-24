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
        <!--
          Copier, en tête de liste.

          Sur mobile, l'appui long est capté ici pour ouvrir cette modale, ce qui empêche le geste
          natif de sélection de texte du navigateur : c'est donc cette modale elle-même qui rendait
          le copier-coller impossible. Ce bouton ne comble pas un manque, il rend ce que le geste
          avait pris.
        -->
        <UButton
          v-if="!isDeleted && texte"
          color="neutral"
          variant="soft"
          block
          size="lg"
          icon="i-heroicons-clipboard-document"
          :label="$t('messenger.copy')"
          class="justify-start"
          @click="handleCopy"
        />
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
        <!--
          `!isDeleted` autant que `canDelete` : le bouton restait proposé sur un message qu'on
          venait de supprimer. Le clic partait, le serveur refusait — il ne peut pas modifier un
          message supprimé —, et l'utilisateur recevait « Impossible de supprimer le message »
          pour une suppression qui avait pourtant réussi la première fois.

          La garde vit ici plutôt que chez l'appelant : le composant connaissait déjà `isDeleted`,
          dont il se sert pour désactiver le balayage tactile. Elle manquait au seul bouton.
        -->
        <UButton
          v-if="canDelete && !isDeleted"
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
  /** Le contenu à copier. Absent, le bouton « Copier » ne s'affiche pas. */
  texte?: string
  /** Qui l'a écrit, préfixé au texte copié pour qu'on sache de qui on cite. */
  auteur?: string
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
/*
 * `useClipboard` de VueUse plutôt que l'API du navigateur appelée en direct.
 *
 * Sept écrans du dépôt appellent l'API du navigateur sans filet ; celui-ci se replie quand elle
 * n'est pas disponible — contexte non sécurisé, permission refusée. Et l'on DIT ce qui s'est
 * passé : une copie qui échoue en silence laisse l'utilisateur coller l'ancien contenu sans
 * comprendre.
 */
const { t } = useI18n()
const { copy, isSupported } = useClipboard()
const toast = useToast()

async function handleCopy() {
  showActionsModal.value = false
  // L'auteur devant le texte : on copie souvent pour transmettre, et savoir de qui l'on cite.
  const contenu = props.auteur ? `${props.auteur} : ${props.texte}` : (props.texte ?? '')

  if (!isSupported.value) {
    toast.add({
      title: t('messenger.copy_unavailable'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    return
  }

  try {
    await copy(contenu)
    toast.add({ title: t('messenger.copied'), icon: 'i-heroicons-check-circle', color: 'success' })
  } catch {
    toast.add({
      title: t('messenger.copy_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

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
