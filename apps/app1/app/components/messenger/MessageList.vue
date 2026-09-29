<template>
  <UChatMessages :should-scroll-to-bottom="false" :should-auto-scroll="false">
    <div
      v-for="message in affiches"
      :id="`message-${message.id}`"
      :key="message.id"
      @click="basculerHeureTactile(message.id)"
    >
      <!--
        Repère de reprise, au milieu du fil : la date et l'heure du premier message après une
        longue pause ou un changement de jour. Il n'appartient à aucun message, il situe la suite.
      -->
      <div v-if="message.repereDeReprise" class="flex items-center gap-3 py-3 text-xs text-muted">
        <USeparator class="flex-1" />
        <span class="shrink-0">{{ message.repereDeReprise }}</span>
        <USeparator class="flex-1" />
      </div>

      <!--
        Pas d'avatar sur ses propres messages : leur place à droite dit déjà qu'ils sont les
        nôtres. Sur ceux des autres, l'avatar ne vient qu'en tête de série ; les suivants gardent
        sa place (invisible) pour que les bulles restent alignées.
      -->
      <UChatMessage
        :id="message.id"
        role="user"
        :parts="[{ type: 'text', text: message.source.content }]"
        :side="message.estLeMien ? 'right' : 'left'"
        variant="subtle"
        :color="message.estLeMien ? 'secondary' : 'neutral'"
        :avatar="message.estLeMien ? undefined : { src: message.avatarUrl.value }"
        :ui="{
          leadingAvatar: message.debutDeSerie ? undefined : 'invisible',
          actions: '[@media(hover:hover)]:opacity-100',
        }"
      >
        <template #content>
          <MessengerMessageBubble
            :message-id="message.id"
            :can-delete="message.estLeMien"
            :can-edit="message.modifiable"
            :is-deleted="message.supprime"
            :texte="message.source.content"
            :auteur="message.source.participant.user.pseudo"
            @reply="emit('repondre', message.source)"
            @edit="emit('modifier', message.source)"
            @delete="emit('supprimer', message.id)"
          >
            <div>
              <!--
                Nom de l'auteur, pour les messages des autres, en tête de série seulement :
                répété sur chaque message d'une même personne, il ne disait rien de plus.
              -->
              <p
                v-if="!message.estLeMien && message.debutDeSerie"
                class="text-xs font-medium mb-1 opacity-70"
              >
                {{ message.source.participant.user.pseudo }}
              </p>

              <!-- Citation du message auquel on répond -->
              <div
                v-if="message.source.replyTo"
                class="mb-2 p-2 rounded-md bg-gray-100 dark:bg-gray-800 border-l-4 border-primary cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                @click.stop="allerAuMessage(message.source.replyTo.id)"
              >
                <p class="text-xs font-medium text-primary mb-1">
                  {{ message.source.replyTo.participant.user.pseudo }}
                </p>
                <p
                  class="text-xs opacity-70 truncate"
                  :class="{ italic: message.source.replyTo.deletedAt }"
                >
                  {{ message.source.replyTo.content }}
                </p>
              </div>

              <!-- Contenu du message (déjà « Message supprimé » si supprimé, côté serveur) -->
              <p
                class="text-sm break-words whitespace-pre-wrap"
                :class="{ 'italic opacity-50': message.supprime }"
              >
                <MessengerMessageText :texte="message.source.content" />
              </p>
            </div>
          </MessengerMessageBubble>
        </template>

        <!--
          Sous la bulle, dans la bande que le composant réserve à ses actions : l'heure,
          « modifié », puis les actions. La bande est rendue visible en permanence (le composant la
          masque hors survol) pour que « modifié » le reste : c'est une information sur le
          contenu, qu'on ne doit pas avoir à chercher. L'heure et les actions, elles, n'apparaissent
          qu'au survol ; sur un écran tactile, où le survol n'existe pas, un appui court sur le
          message montre l'heure.
        -->
        <template #actions>
          <div
            class="flex items-center gap-2 text-xs text-muted"
            :class="{ 'flex-row-reverse': message.estLeMien }"
          >
            <span
              class="[@media(hover:hover)]:opacity-0 group-hover/message:opacity-100 transition-opacity"
              :class="{ '[@media(hover:none)]:hidden': heureTactileVisible !== message.id }"
              :title="formatDateComplete(message.source.createdAt)"
            >
              {{ formatHeure(message.source.createdAt) }}
            </span>
            <span v-if="message.source.editedAt && !message.supprime">
              {{ $t('messenger.edited') }}
            </span>
            <div
              v-if="!ecranTactile && message.actions.length"
              class="flex items-center opacity-0 group-hover/message:opacity-100 transition-opacity"
            >
              <UTooltip v-for="action in message.actions" :key="action.label" :text="action.label">
                <UButton
                  size="sm"
                  variant="ghost"
                  :color="action.color"
                  :icon="action.icon"
                  :aria-label="action.label"
                  @click.stop="action.onClick()"
                />
              </UTooltip>
            </div>
          </div>
        </template>
      </UChatMessage>

      <!-- Indicateur « lu » : avatars des participants dont c'est le dernier message lu -->
      <div
        v-if="luPar?.[message.id]?.length"
        class="flex justify-end items-center gap-0.5 mt-1 pr-1"
      >
        <UiUserAvatar
          v-for="lecteur in luPar[message.id]!.slice(0, 3)"
          :key="lecteur.id"
          :user="lecteur"
          :size="16"
          :title="$t('messenger.seen_by', { name: lecteur.pseudo })"
        />
        <span
          v-if="luPar[message.id]!.length > 3"
          class="text-[10px] text-gray-500 dark:text-gray-400 ml-0.5"
        >
          +{{ luPar[message.id]!.length - 3 }}
        </span>
      </div>
    </div>
  </UChatMessages>
</template>

<script setup lang="ts">
import type { ConversationMessage, ConversationParticipant } from '~/composables/useMessenger'
import { useAuthStore } from '~/stores/auth'
import { useAvatar } from '~/utils/avatar'
import { toIntlLocale } from '~/utils/locales'

import { messageEncoreModifiable } from '~~/shared/utils/message-modifiable'

/**
 * Le fil d'une conversation : séries par auteur, repères datés, bulles, heure au survol,
 * « modifié », et les actions d'un message (copier, répondre, modifier, supprimer).
 *
 * Partagé par la messagerie et la discussion d'une candidature d'artiste, qui affichent la même
 * conversation : elle doit s'y lire de la même façon. Le composant ne fait qu'afficher ; répondre,
 * modifier et supprimer remontent au parent, qui tient la zone de saisie.
 */
const props = defineProps<{
  /** Les messages, triés par date d'envoi. */
  messages: readonly ConversationMessage[]
  /** Pour chaque message, les participants dont c'est le dernier message lu. */
  luPar?: Record<string, ConversationParticipant['user'][]>
}>()

const emit = defineEmits<{
  repondre: [message: ConversationMessage]
  modifier: [message: ConversationMessage]
  supprimer: [messageId: string]
}>()

const { t, locale } = useI18n()
const authStore = useAuthStore()
const { getUserAvatarWithCache } = useAvatar()
const { copierMessage } = useCopierMessage()

// Au-delà de cet écart, deux messages d'une même personne ouvrent chacun leur série.
const PAUSE_ENTRE_SERIES_MS = 5 * 60 * 1000
// Au-delà de celui-ci (ou au changement de jour), un repère daté s'affiche au milieu du fil.
const PAUSE_AVANT_REPERE_MS = 60 * 60 * 1000

// Fait disparaître « Modifier » une fois le délai passé, sans attendre un autre rendu.
const maintenant = useNow({ interval: 30_000 })

// Sur un écran tactile, les actions passent par l'appui long (`MessageBubble`), pas par le survol.
const ecranTactile = ref(false)
onMounted(() => {
  ecranTactile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
})

const affiches = computed(() => {
  const moi = authStore.user?.id
  return props.messages.map((message, index) => {
    const estLeMien = message.participant.user.id === moi
    const supprime = !!message.deletedAt
    const modifiable =
      estLeMien && !supprime && messageEncoreModifiable(message.createdAt, maintenant.value)

    // Une série : des messages consécutifs d'une même personne, sans longue pause entre eux.
    // Seul le premier porte le pseudo et l'avatar.
    const precedent = props.messages[index - 1]
    const envoye = new Date(message.createdAt)
    const ecart = precedent ? envoye.getTime() - new Date(precedent.createdAt).getTime() : Infinity

    // Le premier message affiché en porte un aussi : sans lui, rien ne daterait le début du fil.
    const repereDeReprise =
      !precedent ||
      ecart > PAUSE_AVANT_REPERE_MS ||
      !memeJour(new Date(precedent.createdAt), envoye)
        ? libelleRepere(envoye, maintenant.value)
        : null

    // Un repère coupe aussi la série : la reprise se lit comme un nouveau départ.
    const debutDeSerie =
      !!repereDeReprise ||
      !precedent ||
      precedent.participant.user.id !== message.participant.user.id ||
      ecart > PAUSE_ENTRE_SERIES_MS

    // Rendues sous la bulle en boutons-icônes : le libellé y sert d'infobulle et de nom accessible.
    const actions = supprime
      ? []
      : [
          {
            icon: 'i-heroicons-clipboard-document',
            color: 'neutral' as const,
            label: t('messenger.copy'),
            onClick: () => copierMessage(message.content, message.participant.user.pseudo),
          },
          {
            icon: 'i-heroicons-arrow-uturn-left',
            color: 'neutral' as const,
            label: t('messenger.reply'),
            onClick: () => emit('repondre', message),
          },
          ...(modifiable
            ? [
                {
                  icon: 'i-heroicons-pencil-square',
                  color: 'neutral' as const,
                  label: t('messenger.edit'),
                  onClick: () => emit('modifier', message),
                },
              ]
            : []),
          ...(estLeMien
            ? [
                {
                  icon: 'i-lucide-trash',
                  color: 'error' as const,
                  label: t('messenger.delete'),
                  onClick: () => emit('supprimer', message.id),
                },
              ]
            : []),
        ]

    return {
      id: message.id,
      source: message,
      estLeMien,
      supprime,
      modifiable,
      debutDeSerie,
      repereDeReprise,
      actions,
      avatarUrl: getUserAvatarWithCache(message.participant.user, 32).currentUrl,
    }
  })
})

/*
 * Heures et dates de la conversation, dans le fuseau de celui qui lit — pas `Europe/Paris` comme
 * `useDateFormat` : « 14:32 » doit être l'heure de sa propre montre. La langue, elle, suit
 * l'interface (`toIntlLocale`, pour que `en` ne devienne pas `en-US` par défaut).
 */
const intlLocale = computed(() => toIntlLocale(locale.value))

function formatHeure(date: Date | string) {
  return new Date(date).toLocaleTimeString(intlLocale.value, { hour: '2-digit', minute: '2-digit' })
}

/** La date complète, en infobulle sur l'heure : l'heure seule ne dit pas quel jour. */
function formatDateComplete(date: Date | string) {
  return new Date(date).toLocaleString(intlLocale.value, { dateStyle: 'full', timeStyle: 'short' })
}

function memeJour(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

/** Le libellé d'un repère de reprise : « Aujourd'hui, 14:32 », « Hier, 09:10 », puis la date. */
function libelleRepere(date: Date | string, aujourdhui: Date) {
  const d = new Date(date)
  const hier = new Date(aujourdhui)
  hier.setDate(hier.getDate() - 1)

  if (memeJour(d, aujourdhui)) return t('messenger.resume_today', { time: formatHeure(d) })
  if (memeJour(d, hier)) return t('messenger.resume_yesterday', { time: formatHeure(d) })
  return d.toLocaleString(intlLocale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    // L'année seulement quand ce n'est pas la courante : elle encombrerait tous les autres.
    year: d.getFullYear() === aujourdhui.getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/*
 * Sur un écran tactile, pas de survol : un appui court sur un message en montre l'heure, un
 * second la masque. Un seul à la fois. Sur ordinateur, le survol suffit et le clic ne fait rien.
 */
const heureTactileVisible = ref<string | null>(null)

function basculerHeureTactile(messageId: string) {
  if (!ecranTactile.value) return
  heureTactileVisible.value = heureTactileVisible.value === messageId ? null : messageId
}

/** Amène à l'écran le message cité, et le fait clignoter pour qu'on le repère. */
function allerAuMessage(messageId: string) {
  nextTick(() => {
    const element = document.getElementById(`message-${messageId}`)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.classList.add('highlight-message')
    setTimeout(() => element.classList.remove('highlight-message'), 2000)
  })
}
</script>

<style scoped>
@keyframes highlight-pulse {
  0% {
    background-color: transparent;
  }
  50% {
    background-color: rgb(59 130 246 / 0.2);
  }
  100% {
    background-color: transparent;
  }
}

.highlight-message {
  animation: highlight-pulse 2s ease-in-out;
}
</style>
