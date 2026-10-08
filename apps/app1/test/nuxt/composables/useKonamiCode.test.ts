import { describe, it, expect, vi } from 'vitest'
import { effectScope } from 'vue'

import { useKonamiCode } from '../../../app/composables/useKonamiCode'

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

/** `bubbles` est indispensable pour les frappes émises depuis un champ : l'écoute est sur `window`. */
function taper(touches: string[], cible: EventTarget = window, options: KeyboardEventInit = {}) {
  for (const key of touches) {
    cible.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
  }
}

/** Le composable s'écoute dans une portée, comme dans un composant : on peut ainsi la refermer. */
function monter(auKonami: () => void) {
  const portee = effectScope()
  portee.run(() => useKonamiCode(auKonami))
  return portee
}

describe('useKonamiCode', () => {
  it('appelle le rappel sur la séquence', () => {
    const vu = vi.fn()
    const portee = monter(vu)

    taper(KONAMI)

    expect(vu).toHaveBeenCalledTimes(1)
    portee.stop()
  })

  /*
   * LE cas qui distingue une fenêtre glissante d'un compteur d'avancement. Avec un index remis à
   * zéro dès qu'une touche sort de la séquence, ce `↑` de trop annulerait tout — alors que les
   * deux derniers forment bel et bien le début du code.
   */
  it('tolère une touche de trop au début', () => {
    const vu = vi.fn()
    const portee = monter(vu)

    taper(['ArrowUp', ...KONAMI])

    expect(vu).toHaveBeenCalledTimes(1)
    portee.stop()
  })

  it('ignore une séquence fausse', () => {
    const vu = vi.fn()
    const portee = monter(vu)

    taper(['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'a', 'b'])

    expect(vu).not.toHaveBeenCalled()
    portee.stop()
  })

  // Le rappel BASCULE l'affichage : s'il ne partait qu'une fois, les balles ne disparaîtraient plus.
  it('repart à chaque saisie du code', () => {
    const vu = vi.fn()
    const portee = monter(vu)

    taper(KONAMI)
    taper(KONAMI)

    expect(vu).toHaveBeenCalledTimes(2)
    portee.stop()
  })

  // Et surtout : il ne part pas DEUX fois pour une seule saisie, ce qui annulerait la bascule.
  it('ne part pas deux fois sur une fin de séquence répétée', () => {
    const vu = vi.fn()
    const portee = monter(vu)

    taper([...KONAMI, 'b', 'a'])

    expect(vu).toHaveBeenCalledTimes(1)
    portee.stop()
  })

  it('ne compte pas les répétitions d’une touche maintenue', () => {
    const vu = vi.fn()
    const portee = monter(vu)

    // Un `↑` maintenu émet des `keydown` en rafale : les compter permettrait de déclencher le code
    // avec trois touches au lieu de dix.
    taper(['ArrowUp'], window, { repeat: true })
    taper(['ArrowUp'], window, { repeat: true })
    taper(KONAMI.slice(2))

    expect(vu).not.toHaveBeenCalled()
    portee.stop()
  })

  it('ne se déclenche pas depuis un champ de saisie', () => {
    const vu = vi.fn()
    const portee = monter(vu)
    const champ = document.createElement('input')
    document.body.appendChild(champ)

    taper(KONAMI, champ)

    expect(vu).not.toHaveBeenCalled()
    champ.remove()
    portee.stop()
  })

  /*
   * Le champ ne doit pas seulement être ignoré, il doit REMETTRE le compteur à zéro : sans quoi
   * les huit premières touches frappées sur la page, puis `b` et `a` tapés dans une recherche,
   * suffiraient à déclencher l'easter egg.
   */
  it('oublie la séquence en cours quand la frappe part d’un champ', () => {
    const vu = vi.fn()
    const portee = monter(vu)
    const champ = document.createElement('input')
    document.body.appendChild(champ)

    taper(KONAMI.slice(0, 8))
    taper(['b', 'a'], champ)
    taper(['b', 'a'])

    expect(vu).not.toHaveBeenCalled()
    champ.remove()
    portee.stop()
  })

  it('n’écoute plus une fois la portée refermée', () => {
    const vu = vi.fn()
    monter(vu).stop()

    taper(KONAMI)

    expect(vu).not.toHaveBeenCalled()
  })
})
