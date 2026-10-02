import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TENTATIVES_DE_CHARGEMENT,
  composantDiffere,
  echecDeBribe,
  reprendreLeChargement,
  surEchecDeChargement,
} from '../../../app/utils/composant-differe'

/**
 * Ce que ces tests prouvent, et pourquoi ils ne se contentent pas des deux prédicats.
 *
 * Le défaut d'origine n'était pas une erreur de classement — il était qu'un `import()` raté
 * n'était jamais rejoué. Un test qui vérifierait seulement `echecDeBribe('…')` resterait vert si
 * `composantDiffere` oubliait d'appeler `reessayer` : d'où les deux derniers cas, qui COMPTENT les
 * chargements réellement tentés.
 */

const MESSAGE_CHROME = 'Failed to fetch dynamically imported module: https://x/_nuxt/CIevb1RL.js'
const MESSAGE_FIREFOX = 'error loading dynamically imported module: https://x/_nuxt/CIevb1RL.js'
const MESSAGE_SAFARI = 'Importing a module script failed.'

describe('echecDeBribe', () => {
  it('reconnaît les trois formulations des navigateurs pour la même cause', () => {
    expect(echecDeBribe(new Error(MESSAGE_CHROME))).toBe(true)
    expect(echecDeBribe(new Error(MESSAGE_FIREFOX))).toBe(true)
    expect(echecDeBribe(new Error(MESSAGE_SAFARI))).toBe(true)
    expect(echecDeBribe(new Error('Unable to preload CSS for /_nuxt/entry.css'))).toBe(true)
  })

  it("lit le message d'une erreur SÉRIALISÉE, qui n'est pas une instance d'Error", () => {
    /*
     * 🔬 LE CAS DE PRODUCTION. L'erreur transmise à `error.vue` a traversé une sérialisation : un
     * objet nu `{ statusCode, message }`. Une version précédente ne lisait `.message` que sur une
     * vraie `Error` et retombait sur `String(erreur)`, soit « [object Object] » — la détection
     * échouait donc exactement là où elle servait, sans rien signaler.
     */
    expect(echecDeBribe({ statusCode: 500, message: MESSAGE_CHROME })).toBe(true)
    expect(echecDeBribe({ statusCode: 500, statusMessage: MESSAGE_SAFARI })).toBe(true)
    expect(echecDeBribe(MESSAGE_FIREFOX)).toBe(true)
    expect(echecDeBribe({ statusCode: 500, message: 'Boum' })).toBe(false)
  })

  it('ne confond pas une erreur du composant lui-même avec une bribe manquante', () => {
    // Rejouer celle-ci deux fois de plus ne ferait que retarder l'affichage de l'erreur.
    expect(echecDeBribe(new Error("Cannot read properties of undefined (reading 'name')"))).toBe(
      false
    )
    expect(echecDeBribe(undefined)).toBe(false)
  })
})

describe('reprendreLeChargement', () => {
  it('reprend aux deux premiers échecs, abandonne au troisième', () => {
    const erreur = new Error(MESSAGE_CHROME)
    expect(reprendreLeChargement(erreur, 1)).toBe(true)
    expect(reprendreLeChargement(erreur, 2)).toBe(true)
    expect(reprendreLeChargement(erreur, TENTATIVES_DE_CHARGEMENT)).toBe(false)
  })

  it("n'accorde aucune reprise à une erreur qui n'est pas une bribe manquante", () => {
    expect(reprendreLeChargement(new Error('boum'), 1)).toBe(false)
  })
})

describe('composantDiffere', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const Contenu = defineComponent({
    render: () => h('p', { class: 'charge' }, 'carte'),
  })

  function monter(chargeur: () => Promise<unknown>) {
    const Differe = composantDiffere(chargeur as never)
    return mount(defineComponent({ render: () => h(Differe) }))
  }

  it('affiche le composant après deux échecs de bribe', async () => {
    const chargeur = vi
      .fn()
      .mockRejectedValueOnce(new Error(MESSAGE_CHROME))
      .mockRejectedValueOnce(new Error(MESSAGE_FIREFOX))
      .mockResolvedValue(Contenu)

    const vue = monter(chargeur)
    await vi.advanceTimersByTimeAsync(2000)
    await vue.vm.$nextTick()

    expect(chargeur).toHaveBeenCalledTimes(3)
    expect(vue.html()).toContain('carte')
  })

  it('rejoue la bribe manquante, après une courte attente', async () => {
    const reessayer = vi.fn()
    const abandonner = vi.fn()

    surEchecDeChargement(new Error(MESSAGE_CHROME), reessayer, abandonner, 1)

    // Pas tout de suite : une coupure franche ne se résorbe pas dans la même milliseconde.
    expect(reessayer).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(reessayer).toHaveBeenCalledTimes(1)
    expect(abandonner).not.toHaveBeenCalled()
  })

  it('abandonne au dernier essai, sans attendre', async () => {
    const reessayer = vi.fn()
    const abandonner = vi.fn()

    surEchecDeChargement(new Error(MESSAGE_CHROME), reessayer, abandonner, TENTATIVES_DE_CHARGEMENT)

    expect(abandonner).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(reessayer).not.toHaveBeenCalled()
  })

  it("n'accorde aucune reprise à une erreur venue du composant", async () => {
    const reessayer = vi.fn()
    const abandonner = vi.fn()

    surEchecDeChargement(new Error('setup a levé'), reessayer, abandonner, 1)

    expect(abandonner).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(reessayer).not.toHaveBeenCalled()
  })
})
