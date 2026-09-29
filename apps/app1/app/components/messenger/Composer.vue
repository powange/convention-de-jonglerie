<template>
  <div>
    <!-- Réponse en cours : le message cité, et la croix pour y renoncer -->
    <div
      v-if="reponseA"
      class="mb-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 border-l-4 border-primary"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <UIcon name="i-heroicons-arrow-uturn-left" class="h-4 w-4 text-primary" />
            <p class="text-xs font-medium text-primary">
              {{ $t('messenger.reply_to', { pseudo: reponseA.participant.user.pseudo }) }}
            </p>
          </div>
          <p class="text-sm opacity-70 truncate">{{ reponseA.content }}</p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark"
          size="sm"
          :aria-label="$t('common.cancel')"
          @click="emit('annuler-reponse')"
        />
      </div>
    </div>

    <!--
      Modification en cours : le texte du message est remonté dans la zone de saisie, comme pour
      une réponse. La croix, ou Échap, rend le brouillon qu'on écrivait avant.
    -->
    <div
      v-if="enModification"
      class="mb-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 border-l-4 border-primary"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <UIcon name="i-heroicons-pencil-square" class="h-4 w-4 text-primary" />
            <p class="text-xs font-medium text-primary">{{ $t('messenger.editing') }}</p>
          </div>
          <p class="text-sm opacity-70 truncate">{{ enModification.content }}</p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark"
          size="sm"
          :aria-label="$t('common.cancel')"
          @click="emit('annuler-modification')"
        />
      </div>
    </div>

    <UChatPrompt
      ref="promptRef"
      v-model="texte"
      :placeholder="$t('messenger.message_placeholder')"
      :disabled="envoi"
      :autofocus="autofocus"
      @submit="emit('envoyer')"
      @input="!enModification && emit('frappe')"
      @keydown.esc="enModification && emit('annuler-modification')"
    >
      <UChatPromptSubmit
        :disabled="!texte.trim()"
        :loading="envoi"
        :icon="enModification ? 'i-heroicons-check' : undefined"
      />
    </UChatPrompt>
  </div>
</template>

<script setup lang="ts">
import type { ConversationMessage } from '~/composables/useMessenger'

/**
 * La zone de saisie d'une conversation, partagée par la messagerie et la discussion d'une
 * candidature d'artiste. Elle affiche ce que `useSaisieMessage` décrit — réponse ou
 * modification en cours — et laisse au parent le soin d'envoyer.
 */
withDefaults(
  defineProps<{
    reponseA?: ConversationMessage | null
    enModification?: ConversationMessage | null
    envoi?: boolean
    /**
     * Focaliser le champ à l'affichage. Juste sur la page de messagerie, qui EST la
     * conversation ; pas sur une carte au pied d'un long écran, que le navigateur ferait
     * défiler jusqu'au champ.
     */
    autofocus?: boolean
  }>(),
  { reponseA: null, enModification: null, envoi: false, autofocus: true }
)

const texte = defineModel<string>({ required: true })

const emit = defineEmits<{
  envoyer: []
  frappe: []
  'annuler-reponse': []
  'annuler-modification': []
}>()

const promptRef = ref()

/** Remet le curseur dans le champ : après une réponse choisie, un envoi, une modification. */
function focaliser() {
  nextTick(() => {
    promptRef.value?.$el?.querySelector('textarea')?.focus()
  })
}

defineExpose({ focaliser })
</script>
