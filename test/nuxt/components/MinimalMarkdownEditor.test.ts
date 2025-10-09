import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import MinimalMarkdownEditor from '../../../app/components/MinimalMarkdownEditor.vue'

// Mock useI18n pour éviter les problèmes d'initialisation
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

// Mock markdownToHtml pour éviter les problèmes avec unified
vi.mock('../../../app/utils/markdown', () => ({
  markdownToHtml: vi.fn((md: string) => Promise.resolve(`<p>${md}</p>`)),
}))

describe('MinimalMarkdownEditor', () => {
  it('vérifie que le composant peut être importé', () => {
    expect(MinimalMarkdownEditor).toBeDefined()
  })
})
