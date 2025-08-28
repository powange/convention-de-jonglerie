<template>
  <div class="minimal-md-editor space-y-2">
    <div class="flex flex-wrap gap-2 items-center justify-between">
      <div class="flex flex-wrap gap-2">
        <UButtonGroup size="xs" variant="ghost">
          <UTooltip text="Texte en gras (Ctrl+B)">
            <UButton :disabled="!canEdit" @click="surround('**', '**')">
              <strong>B</strong>
            </UButton>
          </UTooltip>
          <UTooltip text="Texte en italique (Ctrl+I)">
            <UButton :disabled="!canEdit" @click="surround('*', '*')">
              <em>I</em>
            </UButton>
          </UTooltip>
        </UButtonGroup>

        <UButtonGroup size="xs" variant="ghost">
          <UTooltip text="Titre de niveau 1">
            <UButton :disabled="!canEdit" @click="insertHeading(1)">H1</UButton>
          </UTooltip>
          <UTooltip text="Titre de niveau 2">
            <UButton :disabled="!canEdit" @click="insertHeading(2)">H2</UButton>
          </UTooltip>
        </UButtonGroup>

        <UButtonGroup size="xs" variant="ghost">
          <UTooltip text="Liste à puces">
            <UButton :disabled="!canEdit" @click="prependLines('- ')">•</UButton>
          </UTooltip>
          <UTooltip text="Liste numérotée">
            <UButton :disabled="!canEdit" @click="prependLines('1. ')">1.</UButton>
          </UTooltip>
        </UButtonGroup>

        <UButtonGroup size="xs" variant="ghost">
          <UTooltip text="Code en ligne">
            <UButton :disabled="!canEdit" @click="surround('`', '`')">{{
              $t('common.code')
            }}</UButton>
          </UTooltip>
          <UTooltip text="Bloc de code">
            <UButton :disabled="!canEdit" @click="insertBlock('```\ncode\n```')">{{
              $t('common.block')
            }}</UButton>
          </UTooltip>
        </UButtonGroup>

        <UButtonGroup size="xs" variant="ghost">
          <UTooltip text="Citation">
            <UButton :disabled="!canEdit" @click="prependLines('> ')">{{
              $t('common.quote')
            }}</UButton>
          </UTooltip>
          <UTooltip text="Insérer un lien">
            <UButton :disabled="!canEdit" @click="insertLink">{{ $t('common.link') }}</UButton>
          </UTooltip>
        </UButtonGroup>

        <UTooltip :text="showPreview ? 'Revenir à l\'édition' : 'Voir le rendu'">
          <UButton size="xs" variant="soft" @click="togglePreview">
            {{ showPreview ? 'Éditer' : 'Prévisualiser' }}
          </UButton>
        </UTooltip>
      </div>

      <span class="text-xs text-gray-500">{{ charCount }} caractères</span>
    </div>
    <div v-if="!showPreview">
      <textarea
        ref="ta"
        v-model="localValue"
        class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 font-mono text-sm resize-y min-h-[180px] focus:outline-none focus:ring-1 focus:ring-primary-500"
        :disabled="!canEdit"
        @input="emitChange"
      />
    </div>
    <div v-else class="prose prose-sm max-w-none border rounded-md p-3 bg-white dark:bg-gray-900">
      <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="hasContent" v-html="previewHtml" />
      <div v-else class="text-xs text-gray-500 italic">({{ emptyLabel }})</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'

import { markdownToHtml } from '~/utils/markdown'

const { $t } = useI18n()

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  preview?: boolean
  emptyPlaceholder?: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const localValue = ref(props.modelValue || '')
const showPreview = ref(!!props.preview)
const previewHtml = ref('')
const ta = ref<HTMLTextAreaElement | null>(null)
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
    }
  }
)

watch(showPreview, (nv) => {
  if (nv) scheduleRender()
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
  })
}

function surround(left: string, right: string) {
  replaceSelection(left, right)
}

function insertBlock(block: string) {
  replaceSelection('', '', block)
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
  const before = text.slice(0, start)
  const selected = text.slice(start, end)
  const after = text.slice(end)
  const lines = selected || ''
  const replaced = lines
    .split(/\n/)
    .map((l) => (l.length ? prefix + l : prefix.trim()))
    .join('\n')
  localValue.value = before + replaced + after
  emitChange()
}

function insertLink() {
  replaceSelection('[', '](https://)', 'texte')
}

async function renderMarkdown(src: string) {
  try {
    previewHtml.value = await markdownToHtml(src)
  } catch {
    previewHtml.value = ''
  }
}

function scheduleRender() {
  if (!showPreview.value) return
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => renderMarkdown(localValue.value), 150)
}

// initial
scheduleRender()
</script>
<style scoped>
.minimal-md-editor textarea {
  line-height: 1.35;
}
</style>
