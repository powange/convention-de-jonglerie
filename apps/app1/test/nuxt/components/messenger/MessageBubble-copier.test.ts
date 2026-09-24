import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'

import MessageBubble from '../../../../app/components/messenger/MessageBubble.vue'

mockNuxtImport('useI18n', () => () => ({
  t: (cle: string) => cle,
  locale: { value: 'fr' },
}))

const copier = vi.fn()
const estSupporte = { value: true }
mockNuxtImport('useClipboard', () => () => ({ copy: copier, isSupported: estSupporte }))

const toasts: Array<{ title: string; color?: string }> = []
mockNuxtImport('useToast', () => () => ({
  add: (t: { title: string; color?: string }) => toasts.push(t),
}))

/**
 * Copier un message depuis mobile.
 *
 * Sur mobile, l'appui long est capté par ce composant pour ouvrir sa modale d'actions, ce qui
 * empêche le geste natif de sélection de texte : c'est donc cette modale qui rendait le
 * copier-coller impossible. Le bouton la répare.
 *
 * Ce qui est éprouvé ici : ce qu'on met dans le presse-papiers, et le fait qu'on DISE ce qui s'est
 * passé. Une copie qui échoue en silence laisse coller l'ancien contenu sans comprendre.
 */
describe('MessageBubble — copier le message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toasts.length = 0
    estSupporte.value = true
  })

  /**
   * Monte la bulle, puis reproduit l'APPUI LONG qui ouvre la modale.
   *
   * On passe par le geste plutôt que d'appeler la fonction : elle n'est pas exposée, et l'exposer
   * pour les besoins d'un test reviendrait à élargir la surface du composant pour rien. C'est
   * aussi le chemin que prend l'utilisateur.
   */
  const ouvrirLesActions = async (props: Record<string, unknown> = {}) => {
    vi.useFakeTimers()
    const composant = await mountSuspended(MessageBubble, {
      props: { messageId: 'm1', canDelete: false, texte: 'on se retrouve à 14h', ...props },
    })
    await composant.find('div').trigger('touchstart', {
      touches: [{ clientX: 0, clientY: 0 }],
    })
    vi.advanceTimersByTime(600)
    vi.useRealTimers()
    await composant.vm.$nextTick()
    return composant
  }

  /** Le bouton « Copier » de la modale, téléportée hors du composant. */
  const boutonCopier = () =>
    [...document.body.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('messenger.copy')
    )

  it('copie l’auteur puis le texte', async () => {
    await ouvrirLesActions({ auteur: 'Marie' })
    boutonCopier()?.click()
    await new Promise((r) => setTimeout(r, 0))

    // On copie souvent pour transmettre : savoir de qui l'on cite fait partie du message.
    expect(copier).toHaveBeenCalledWith('Marie : on se retrouve à 14h')
  })

  it('copie le seul texte quand l’auteur est inconnu', async () => {
    await ouvrirLesActions()
    boutonCopier()?.click()
    await new Promise((r) => setTimeout(r, 0))

    expect(copier).toHaveBeenCalledWith('on se retrouve à 14h')
  })

  it('dit que c’est copié', async () => {
    await ouvrirLesActions({ auteur: 'Marie' })
    boutonCopier()?.click()
    await new Promise((r) => setTimeout(r, 0))

    expect(toasts.map((t) => t.title)).toContain('messenger.copied')
  })

  it('dit quand le navigateur ne le permet pas, et ne copie rien', async () => {
    estSupporte.value = false
    await ouvrirLesActions()
    boutonCopier()?.click()
    await new Promise((r) => setTimeout(r, 0))

    expect(copier).not.toHaveBeenCalled()
    expect(toasts.map((t) => t.title)).toContain('messenger.copy_unavailable')
  })

  it('dit quand la copie échoue', async () => {
    copier.mockRejectedValueOnce(new Error('refusé'))
    await ouvrirLesActions()
    boutonCopier()?.click()
    await new Promise((r) => setTimeout(r, 0))

    // Sans ce message, l'utilisateur colle l'ancien contenu sans comprendre pourquoi.
    expect(toasts.map((t) => t.title)).toContain('messenger.copy_failed')
  })
})
