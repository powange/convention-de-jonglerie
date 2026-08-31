import { flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'

import { useLeafletEditable } from '../../../app/composables/useLeafletEditable'

/**
 * Ce test ne couvre qu'un point de `useLeafletEditable`, mais celui-là a coûté une demi-journée :
 * la carte rendue à l'appelant doit rester **manipulable par Leaflet**.
 *
 * Le composable garde ses instances dans un `shallowRef` — c'est écrit dans le code — précisément
 * pour que Vue ne les enveloppe pas dans un proxy réactif. Le retour les exposait pourtant en
 * `readonly()` profond, ce qui rétablissait exactement ce dont on voulait les préserver : chaque
 * écriture de Leaflet sur ses propres champs internes était refusée. `invalidateSize` s'exécutait
 * alors sans effet, et une carte redimensionnée après coup ne dessinait plus qu'une seule tuile.
 *
 * Rien ne le signalait : ni le lint, ni le typecheck, ni la suite de tests. Seule la console du
 * navigateur murmurait « Set operation on key "_sizeChanged" failed: target is readonly ».
 */

/** Le strict nécessaire pour qu'`initializeMap` aille au bout, sans charger la vraie Leaflet. */
const construireFausseLeaflet = () => {
  const instance = {
    // Champ interne, à l'image de ceux que Leaflet écrit pendant `invalidateSize`
    _sizeChanged: false,
    setView: () => instance,
    getContainer: () => document.createElement('div'),
    whenReady: (cb: () => void) => cb(),
    // Écriture via `this`, comme le fait la vraie Leaflet — et non sur la variable capturée : la
    // seconde contourne le proxy et rendrait ce test aveugle au défaut qu'il surveille.
    invalidateSize: vi.fn(function (this: { _sizeChanged: boolean }) {
      this._sizeChanged = true
    }),
    on: () => instance,
    off: () => instance,
  }
  const couche = { addTo: () => couche }
  return {
    instance,
    L: {
      map: () => instance,
      tileLayer: () => couche,
      control: { layers: () => couche },
    },
  }
}

let fausse: ReturnType<typeof construireFausseLeaflet>

beforeEach(() => {
  fausse = construireFausseLeaflet()
  ;(window as unknown as { L: unknown }).L = fausse.L
})

describe('useLeafletEditable', () => {
  it('rend une carte que Leaflet peut encore piloter', async () => {
    // Le conteneur est fourni d'emblée : un `watch` immédiat amorce la carte.
    const conteneur = ref(document.createElement('div'))
    const { map } = useLeafletEditable(conteneur)

    await flushPromises()

    // La carte est bien exposée…
    expect(map.value).toBeTruthy()

    // …et l'appeler à travers la ref atteint réellement l'instance.
    ;(map.value as unknown as { invalidateSize: () => void }).invalidateSize()
    expect(fausse.instance.invalidateSize).toHaveBeenCalled()

    // Le cœur du garde-fou : l'écriture interne de Leaflet aboutit. Avec un `readonly()` profond,
    // elle est silencieusement refusée et ce champ reste à `false`.
    expect(fausse.instance._sizeChanged).toBe(true)
  })

  it('interdit toujours de réaffecter la carte depuis l’extérieur', async () => {
    const conteneur = ref(document.createElement('div'))
    const { map } = useLeafletEditable(conteneur)
    await flushPromises()

    const avant = map.value
    expect(avant).toBeTruthy()

    // La lecture seule utile est conservée : la référence n'est pas cessible. Vue refuse
    // l'écriture en la signalant en console plutôt qu'en levant — c'est donc la valeur, et non
    // une exception, qui fait foi.
    ;(map as unknown as { value: unknown }).value = null
    expect(map.value).toBe(avant)
  })
})
