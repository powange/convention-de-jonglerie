<template>
  <div class="minimal-md-editor space-y-2" :class="{ fullscreen: isFullscreen }">
    <div class="flex flex-wrap gap-2 items-center justify-between">
      <div class="flex flex-wrap gap-2 items-center">
        <!-- Indicateur de mode -->
        <UBadge v-if="splitMode" color="success" variant="soft" size="xs" class="mr-2">
          {{ t('common.editor.split_mode') }}
        </UBadge>
        <UBadge v-else-if="showPreview" color="info" variant="soft" size="xs" class="mr-2">
          {{ t('common.editor.preview_mode') }}
        </UBadge>
        <div v-if="!showPreview || splitMode" class="flex flex-wrap gap-2">
          <UButtonGroup size="xs" variant="ghost">
            <UTooltip :text="t('common.editor.bold_tooltip')">
              <UButton :disabled="!canEdit" @click="surround('**', '**')">
                <UIcon name="i-heroicons-bold" class="w-4 h-4" />
              </UButton>
            </UTooltip>
            <UTooltip :text="t('common.editor.italic_tooltip')">
              <UButton :disabled="!canEdit" @click="surround('*', '*')">
                <UIcon name="i-material-symbols-format-italic" class="w-4 h-4" />
              </UButton>
            </UTooltip>
          </UButtonGroup>

          <UButtonGroup size="xs" variant="ghost">
            <UTooltip :text="t('common.editor.heading1_tooltip')">
              <UButton :disabled="!canEdit" @click="insertHeading(1)">
                <UIcon name="i-heroicons-h1" class="w-4 h-4" />
              </UButton>
            </UTooltip>
            <UTooltip :text="t('common.editor.heading2_tooltip')">
              <UButton :disabled="!canEdit" @click="insertHeading(2)">
                <UIcon name="i-heroicons-h2" class="w-4 h-4" />
              </UButton>
            </UTooltip>
          </UButtonGroup>

          <UButtonGroup size="xs" variant="ghost">
            <UTooltip :text="t('common.editor.bullet_list_tooltip')">
              <UButton :disabled="!canEdit" @click="prependLines('- ')">
                <UIcon name="i-heroicons-list-bullet" class="w-4 h-4" />
              </UButton>
            </UTooltip>
            <UTooltip :text="t('common.editor.numbered_list_tooltip')">
              <UButton :disabled="!canEdit" @click="prependLines('1. ')">
                <UIcon name="i-heroicons-queue-list" class="w-4 h-4" />
              </UButton>
            </UTooltip>
          </UButtonGroup>

          <UButtonGroup size="xs" variant="ghost">
            <UTooltip :text="t('common.editor.code_tooltip')">
              <UButton :disabled="!canEdit" @click="surround('`', '`')">
                <UIcon name="i-heroicons-code-bracket" class="w-4 h-4" />
              </UButton>
            </UTooltip>
            <UTooltip :text="t('common.editor.block_tooltip')">
              <UButton :disabled="!canEdit" @click="insertCodeBlock">
                <UIcon name="i-heroicons-code-bracket-square" class="w-4 h-4" />
              </UButton>
            </UTooltip>
          </UButtonGroup>

          <UButtonGroup size="xs" variant="ghost">
            <UTooltip :text="t('common.editor.quote_tooltip')">
              <UButton :disabled="!canEdit" @click="prependLines('> ')">
                <UIcon name="i-heroicons-chat-bubble-left-right" class="w-4 h-4" />
              </UButton>
            </UTooltip>
            <UTooltip :text="t('common.editor.link_tooltip')">
              <UButton :disabled="!canEdit" @click="insertLink">
                <UIcon name="i-heroicons-link" class="w-4 h-4" />
              </UButton>
            </UTooltip>
          </UButtonGroup>
        </div>

        <div class="flex gap-2">
          <UTooltip :text="t('common.editor.split_tooltip')">
            <UButton size="xs" :variant="splitMode ? 'soft' : 'ghost'" @click="toggleSplitMode">
              <UIcon name="i-heroicons-rectangle-group" class="w-4 h-4" />
            </UButton>
          </UTooltip>

          <UTooltip
            :text="
              isFullscreen
                ? t('common.editor.exit_fullscreen')
                : t('common.editor.fullscreen_tooltip')
            "
          >
            <UButton size="xs" variant="ghost" @click="toggleFullscreen">
              <UIcon
                :name="
                  isFullscreen
                    ? 'i-heroicons-arrows-pointing-in'
                    : 'i-heroicons-arrows-pointing-out'
                "
                class="w-4 h-4"
              />
            </UButton>
          </UTooltip>

          <UTooltip
            :text="
              showPreview ? t('common.editor.back_to_edit') : t('common.editor.toggle_preview')
            "
          >
            <UButton size="xs" variant="soft" :disabled="splitMode" @click="togglePreview">
              <UIcon
                :name="showPreview ? 'i-heroicons-pencil' : 'i-heroicons-eye'"
                class="w-4 h-4 mr-1"
              />
              {{ showPreview ? t('common.editor.edit_mode') : t('common.editor.preview_mode') }}
            </UButton>
          </UTooltip>
        </div>
      </div>

      <span class="text-xs text-gray-500">{{ charCount }} caractères</span>
    </div>
    <!-- Mode split : les deux côte à côte -->
    <div v-if="splitMode" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Zone d'édition -->
      <div>
        <textarea
          ref="ta"
          v-model="localValue"
          class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 font-mono text-sm resize-none min-h-[300px] max-h-[60vh] overflow-y-auto focus:outline-none focus:ring-1 focus:ring-primary-500"
          :disabled="!canEdit"
          @input="onInput"
          @focus="adjustHeight"
          @blur="emit('blur')"
          @paste="nextTick(adjustHeight)"
        />
      </div>

      <!-- Zone de prévisualisation -->
      <div
        class="prose prose-sm max-w-none border rounded-md p-3 bg-white dark:bg-gray-900 min-h-[300px] max-h-[60vh] overflow-y-auto"
      >
        <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="hasContent" v-html="previewHtml" />
        <div v-else class="text-xs text-gray-500 italic">({{ emptyLabel }})</div>
      </div>
    </div>

    <!-- Mode normal : un seul panneau -->
    <div v-else>
      <div v-if="!showPreview">
        <textarea
          ref="ta"
          v-model="localValue"
          class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 font-mono text-sm resize-none min-h-[180px] focus:outline-none focus:ring-1 focus:ring-primary-500 overflow-hidden"
          :disabled="!canEdit"
          @input="onInput"
          @focus="adjustHeight"
          @blur="emit('blur')"
          @paste="nextTick(adjustHeight)"
        />
      </div>
      <div v-else class="prose prose-sm max-w-none border rounded-md p-3 bg-white dark:bg-gray-900">
        <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="hasContent" v-html="previewHtml" />
        <div v-else class="text-xs text-gray-500 italic">({{ emptyLabel }})</div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'

import { markdownToHtml } from '~/utils/markdown'

const { t } = useI18n()

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  preview?: boolean
  emptyPlaceholder?: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'blur'): void
}>()

const localValue = ref(props.modelValue || '')
const showPreview = ref(!!props.preview)
const previewHtml = ref('')
const ta = ref<HTMLTextAreaElement | null>(null)
const isFullscreen = ref(false)
const splitMode = ref(false)
let renderTimer: any = null

const canEdit = computed(() => !props.disabled)
const charCount = computed(() => localValue.value.length)
const hasContent = computed(() => localValue.value.trim().length > 0)
const emptyLabel = computed(() => props.emptyPlaceholder || 'Vide')

watch(
  () => props.modelValue,
  (nv) => {
    if (nv !== localValue.value) {
      localValue.value = nv || ''
      scheduleRender()
      nextTick(adjustHeight)
    }
  }
)

watch(showPreview, (nv) => {
  if (nv) {
    scheduleRender()
  } else {
    // Réajuster la hauteur quand on revient en mode édition
    nextTick(adjustHeight)
  }
})

watch(splitMode, (nv) => {
  if (nv) {
    // En mode split, toujours rendre le preview
    scheduleRender()
    // Désactiver le mode preview classique
    showPreview.value = false
  }
  // Réajuster la hauteur après le changement de mode
  nextTick(adjustHeight)
})

function emitChange() {
  emit('update:modelValue', localValue.value)
  scheduleRender()
}

function togglePreview() {
  showPreview.value = !showPreview.value
}

function getSelection(): { start: number; end: number } {
  const el = ta.value
  if (!el) return { start: 0, end: 0 }
  return { start: el.selectionStart, end: el.selectionEnd }
}

function replaceSelection(before: string, after: string, placeholder?: string) {
  const el = ta.value
  if (!el || !canEdit.value) return
  const { start, end } = getSelection()
  const text = localValue.value
  const selected = text.slice(start, end) || placeholder || ''
  const insert = before + selected + after
  localValue.value = text.slice(0, start) + insert + text.slice(end)
  emitChange()
  const cursor = start + before.length + selected.length
  nextTick(() => {
    el.focus()
    el.selectionStart = cursor
    el.selectionEnd = cursor
    adjustHeight()
  })
}

function surround(left: string, right: string) {
  replaceSelection(left, right)
}

function insertCodeBlock() {
  const el = ta.value
  if (!el || !canEdit.value) return

  const { start, end } = getSelection()
  const text = localValue.value
  const selected = text.slice(start, end)

  if (selected) {
    // Si du texte est sélectionné, l'entourer avec un bloc de code
    const before = text.slice(0, start)
    const after = text.slice(end)
    const newText = before + '```\n' + selected + '\n```' + after
    localValue.value = newText
    emitChange()

    // Placer le curseur après le bloc de code
    const cursorPos = start + 4 + selected.length + 4
    nextTick(() => {
      el.focus()
      el.selectionStart = cursorPos
      el.selectionEnd = cursorPos
      adjustHeight()
    })
  } else {
    // Si aucun texte n'est sélectionné, insérer un modèle de bloc
    replaceSelection('```\n', '\n```', 'code')
  }
}

function insertHeading(level: number) {
  const el = ta.value
  if (!el || !canEdit.value) return
  const { start, end } = getSelection()
  const text = localValue.value
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const prefix = '#'.repeat(level) + ' '
  if (!text.slice(lineStart).startsWith(prefix)) {
    localValue.value = text.slice(0, lineStart) + prefix + text.slice(lineStart)
    const delta = prefix.length
    nextTick(() => {
      el.selectionStart = start + delta
      el.selectionEnd = end + delta
      emitChange()
    })
  }
}

function prependLines(prefix: string) {
  const el = ta.value
  if (!el || !canEdit.value) return

  const { start, end } = getSelection()
  const text = localValue.value

  // Si pas de sélection, appliquer à la ligne courante
  if (start === end) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const lineEnd = text.indexOf('\n', start)
    const actualLineEnd = lineEnd === -1 ? text.length : lineEnd
    const currentLine = text.slice(lineStart, actualLineEnd)

    // Toggle: retirer le prefix s'il existe déjà
    if (currentLine.startsWith(prefix)) {
      const newLine = currentLine.slice(prefix.length)
      localValue.value = text.slice(0, lineStart) + newLine + text.slice(actualLineEnd)
      // Repositionner le curseur
      nextTick(() => {
        el.selectionStart = start - prefix.length
        el.selectionEnd = start - prefix.length
      })
    } else {
      localValue.value = text.slice(0, lineStart) + prefix + currentLine + text.slice(actualLineEnd)
      // Repositionner le curseur
      nextTick(() => {
        el.selectionStart = start + prefix.length
        el.selectionEnd = start + prefix.length
      })
    }
  } else {
    // Code existant pour les sélections multiples
    const before = text.slice(0, start)
    const selected = text.slice(start, end)
    const after = text.slice(end)
    const lines = selected
    const replaced = lines
      .split(/\n/)
      .map((l) => (l.length ? prefix + l : prefix.trim()))
      .join('\n')
    localValue.value = before + replaced + after
  }

  emitChange()
}

function insertLink() {
  const el = ta.value
  if (!el) return

  const { start, end } = getSelection()
  const selectedText = localValue.value.slice(start, end)

  if (selectedText) {
    // Si du texte est sélectionné, l'utiliser comme texte du lien
    replaceSelection('[', '](https://)', selectedText)
  } else {
    // Sinon, insérer un modèle de lien
    replaceSelection('[', '](https://)', 'texte du lien')
  }
}

// Support des raccourcis clavier
function handleKeydown(e: KeyboardEvent) {
  if (!ta.value?.contains(document.activeElement as Node) || !canEdit.value) return

  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'b':
        e.preventDefault()
        surround('**', '**')
        break
      case 'i':
        e.preventDefault()
        surround('*', '*')
        break
      case 'k':
        e.preventDefault()
        insertLink()
        break
      case '`':
        e.preventDefault()
        surround('`', '`')
        break
    }
  }

  // Échap pour quitter le plein écran
  if (e.key === 'Escape' && isFullscreen.value) {
    e.preventDefault()
    toggleFullscreen()
  }
}

// Mode plein écran
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value

  if (isFullscreen.value) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }

  // Réajuster la hauteur après le changement de mode
  nextTick(adjustHeight)
}

// Mode split
function toggleSplitMode() {
  splitMode.value = !splitMode.value
}

// Auto-resize du textarea
function adjustHeight() {
  const el = ta.value
  if (!el) return

  // Réinitialiser la hauteur pour mesurer le contenu
  el.style.height = 'auto'

  // Calculer la nouvelle hauteur (minimum 180px)
  const newHeight = Math.max(180, el.scrollHeight)

  // Appliquer la nouvelle hauteur
  el.style.height = newHeight + 'px'
}

function onInput() {
  emitChange()
  nextTick(adjustHeight)
}

async function renderMarkdown(src: string) {
  try {
    previewHtml.value = await markdownToHtml(src)
  } catch {
    previewHtml.value = ''
  }
}

function scheduleRender() {
  if (!showPreview.value && !splitMode.value) return
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => renderMarkdown(localValue.value), 150)
}

// Lifecycle hooks
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // Ajuster la hauteur initiale
  nextTick(adjustHeight)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  // Nettoyer le plein écran si nécessaire
  if (isFullscreen.value) {
    document.body.style.overflow = ''
  }
})

// initial
scheduleRender()
</script>
<style scoped>
.minimal-md-editor textarea {
  line-height: 1.35;
}

/* Mode plein écran */
.minimal-md-editor.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  background: white;
  padding: 1rem;
  overflow: auto;
}

.dark .minimal-md-editor.fullscreen {
  background: rgb(17 24 39); /* gray-900 */
}

/* Adaptation du textarea en plein écran */
.minimal-md-editor.fullscreen textarea {
  min-height: calc(100vh - 200px);
  max-height: calc(100vh - 200px);
  resize: vertical;
}

/* Adaptation de la preview en plein écran */
.minimal-md-editor.fullscreen .prose {
  min-height: calc(100vh - 200px);
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

/* Mode split responsive */
@media (max-width: 1023px) {
  /* Sur mobile/tablette, mode split devient vertical */
  .minimal-md-editor .grid-cols-1.lg\\:grid-cols-2 {
    grid-template-rows: 1fr 1fr;
  }

  .minimal-md-editor .grid-cols-1.lg\\:grid-cols-2 > div:first-child textarea {
    min-height: 250px;
  }

  .minimal-md-editor .grid-cols-1.lg\\:grid-cols-2 > div:last-child {
    min-height: 250px;
  }
}

/* Mode split en plein écran */
.minimal-md-editor.fullscreen textarea,
.minimal-md-editor.fullscreen .prose {
  max-height: calc(100vh - 150px);
}
</style>
