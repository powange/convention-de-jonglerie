<template>
  <UEditor
    v-slot="{ editor }"
    v-model="model"
    content-type="markdown"
    :extensions="editorExtensions"
    :placeholder="placeholder"
    class="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 focus-within:border-primary-500"
  >
    <UEditorToolbar
      :editor="editor"
      :items="toolbarItems"
      class="border-b border-muted py-2 px-8 sm:px-16 overflow-x-auto"
    />
    <UEditorToolbar :editor="editor" :items="bubbleItems" layout="bubble" />
    <UEditorEmojiMenu :editor="editor" :items="emojiItems" :append-to="appendToBody" />
  </UEditor>
</template>

<script setup lang="ts">
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji'

import type { EditorEmojiMenuItem, EditorToolbarItem } from '@nuxt/ui'

const model = defineModel<string>({ required: true })

defineProps<{
  placeholder?: string
}>()

const { t } = useI18n()

const editorExtensions = [Emoji]
const emojiItems: EditorEmojiMenuItem[] = gitHubEmojis.filter(
  (e) => !e.name.startsWith('regional_indicator_')
)
const appendToBody = import.meta.client ? () => document.body : undefined

const toolbarItems = computed<EditorToolbarItem[][]>(() => [
  [
    {
      icon: 'i-lucide-heading',
      tooltip: { text: t('common.editor.heading_tooltip') },
      items: [
        {
          kind: 'heading',
          level: 1,
          icon: 'i-lucide-heading-1',
          label: t('common.editor.heading1_tooltip'),
        },
        {
          kind: 'heading',
          level: 2,
          icon: 'i-lucide-heading-2',
          label: t('common.editor.heading2_tooltip'),
        },
        {
          kind: 'heading',
          level: 3,
          icon: 'i-lucide-heading-3',
          label: t('common.editor.heading3_tooltip'),
        },
      ],
    },
  ],
  [
    {
      kind: 'mark',
      mark: 'bold',
      icon: 'i-lucide-bold',
      tooltip: { text: t('common.editor.bold_tooltip') },
    },
    {
      kind: 'mark',
      mark: 'italic',
      icon: 'i-lucide-italic',
      tooltip: { text: t('common.editor.italic_tooltip') },
    },
    {
      kind: 'mark',
      mark: 'strike',
      icon: 'i-lucide-strikethrough',
      tooltip: { text: t('common.editor.strike_tooltip') },
    },
  ],
  [
    {
      kind: 'mark',
      mark: 'code',
      icon: 'i-lucide-code',
      tooltip: { text: t('common.editor.code_tooltip') },
    },
    {
      kind: 'link',
      icon: 'i-lucide-link',
      tooltip: { text: t('common.editor.link_tooltip') },
    },
  ],
  [
    {
      kind: 'bulletList',
      icon: 'i-lucide-list',
      tooltip: { text: t('common.editor.bullet_list_tooltip') },
    },
    {
      kind: 'orderedList',
      icon: 'i-lucide-list-ordered',
      tooltip: { text: t('common.editor.numbered_list_tooltip') },
    },
  ],
  [
    {
      kind: 'blockquote',
      icon: 'i-lucide-quote',
      tooltip: { text: t('common.editor.quote_tooltip') },
    },
    {
      kind: 'codeBlock',
      icon: 'i-lucide-square-code',
      tooltip: { text: t('common.editor.block_tooltip') },
    },
  ],
  [
    {
      kind: 'emoji',
      icon: 'i-lucide-smile',
      tooltip: { text: t('common.editor.emoji_tooltip') },
    },
  ],
])
const bubbleItems = computed<EditorToolbarItem[]>(() => [
  {
    kind: 'mark',
    mark: 'bold',
    icon: 'i-lucide-bold',
    tooltip: { text: t('common.editor.bold_tooltip') },
  },
  {
    kind: 'mark',
    mark: 'italic',
    icon: 'i-lucide-italic',
    tooltip: { text: t('common.editor.italic_tooltip') },
  },
  {
    kind: 'mark',
    mark: 'strike',
    icon: 'i-lucide-strikethrough',
    tooltip: { text: t('common.editor.strike_tooltip') },
  },
  {
    kind: 'mark',
    mark: 'code',
    icon: 'i-lucide-code',
    tooltip: { text: t('common.editor.code_tooltip') },
  },
  {
    kind: 'link',
    icon: 'i-lucide-link',
    tooltip: { text: t('common.editor.link_tooltip') },
  },
])
</script>
