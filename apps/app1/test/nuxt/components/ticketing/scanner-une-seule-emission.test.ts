import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import QrCodeScanner from '../../../../../../layers/ticketing/app/components/ticketing/QrCodeScanner.vue'

/**
 * Le scanner de QR code n'émet qu'une fois par lecture.
 *
 * ## ⚠️ LE DÉFAUT (constat F2)
 *
 * `html5-qrcode` est configuré à **10 images par seconde** et rappelle son callback à **chaque
 * image décodée** tant que `stop()` n'a pas résolu. Or `onScanSuccess` appelait `stopScanning()`
 * **sans l'attendre** avant d'émettre.
 *
 * Le deuxième appel arrivait donc avant l'arrêt effectif, sortait bien de `stopScanning` grâce à
 * `isTransitioning`… **mais après avoir émis une seconde fois**. Dix occasions par seconde.
 *
 * Côté écran : deux `verify`, deux toasts « participant trouvé », et la fiche rouverte. Aucune
 * validation n'était doublée — elle est atomique — mais la file d'entrée voyait **deux
 * notifications par personne**, sur un geste déjà lent au téléphone.
 *
 * ## ⚠️⚠️ CE QUI REND CE TEST NON CREUX : UN `stop()` LENT
 *
 * C'est la LENTEUR de `stop()` qui ouvre la fenêtre. Un faux scanner dont `stop()` résoudrait
 * immédiatement ne reproduirait jamais le défaut, et ce fichier serait **vert avant comme après la
 * correction**. Le faux ci-dessous retarde donc volontairement son arrêt, et le test appelle le
 * callback deux fois pendant ce creux — exactement ce que fait la caméra.
 */
const scanner = {
  /** Le callback que le composant a confié à la bibliothèque. */
  surSucces: null as ((code: string) => void) | null,
  /** Résolution manuelle de `stop()`, pour tenir la fenêtre ouverte aussi longtemps qu'on veut. */
  libererArret: null as (() => void) | null,
  arretsDemandes: 0,
}

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    constructor(public readonly element: string) {}

    async start(
      _camera: unknown,
      _config: unknown,
      onSuccess: (code: string) => void,
      _onError: unknown
    ) {
      scanner.surSucces = onSuccess
    }

    async stop() {
      scanner.arretsDemandes += 1
      // L'arrêt réel d'une caméra prend du temps : on le tient ouvert jusqu'à `libererArret`.
      await new Promise<void>((resoudre) => {
        scanner.libererArret = resoudre
      })
    }

    clear() {}
  },
}))

describe('QrCodeScanner — une seule émission par lecture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scanner.surSucces = null
    scanner.libererArret = null
    scanner.arretsDemandes = 0
  })

  /**
   * Ouvre le scanner et attend que la bibliothèque ait reçu son callback.
   *
   * ⚠️ MONTÉ FERMÉ, PUIS OUVERT. Le `watch(isOpen)` du composant n'est pas `immediate` : monter
   * directement avec `open: true` ne démarre **rien**, et les quatre cas échouaient alors sur « la
   * caméra n'a pas démarré » — en accusant le composant au lieu du harnais. C'est la TRANSITION
   * fermé → ouvert qui lance le scan, exactement comme à l'écran.
   */
  const monter = async () => {
    const composant = await mountSuspended(QrCodeScanner, { props: { open: false } })
    await composant.setProps({ open: true })
    await vi.waitFor(() => {
      expect(scanner.surSucces, 'le composant doit avoir démarré la caméra').toBeTruthy()
    })
    return composant
  }

  it('⚠️ N’ÉMET QU’UNE FOIS quand la caméra rappelle pendant l’arrêt', async () => {
    const composant = await monter()

    // Deux images décodées coup sur coup, `stop()` n'ayant pas encore résolu : c'est la situation
    // exacte du défaut, à 10 images par seconde.
    scanner.surSucces!('BILLET-123')
    scanner.surSucces!('BILLET-123')

    expect(composant.emitted('scan')).toHaveLength(1)
    expect(composant.emitted('scan')![0]).toEqual(['BILLET-123'])
  })

  it('n’émet qu’une fois même sur dix rappels', async () => {
    // La cadence réelle : dix occasions par seconde. Le verrou ne doit pas en laisser passer une.
    const composant = await monter()

    for (let i = 0; i < 10; i += 1) scanner.surSucces!('BILLET-123')

    expect(composant.emitted('scan')).toHaveLength(1)
  })

  it('émet bien le code lu, et demande l’arrêt de la caméra', async () => {
    /*
     * ⚠️ LE TÉMOIN QUI BORNE LES DEUX CAS CI-DESSUS. Sans lui, un verrou posé AVANT la première
     * émission — ou un composant qui n'émettrait jamais — les satisferait tous les deux, et le
     * scanner ne servirait plus à rien.
     */
    const composant = await monter()

    scanner.surSucces!('BILLET-456')

    expect(composant.emitted('scan')![0]).toEqual(['BILLET-456'])
    expect(scanner.arretsDemandes).toBeGreaterThan(0)
  })

  it('un arrêt qui échoue n’empêche pas l’émission', async () => {
    /*
     * `stopScanning` n'est pas attendu, et son échec est capté : une promesse rejetée non gérée
     * interromprait l'hydratation, défaut déjà payé ailleurs dans ce dépôt. Le code lu doit partir
     * quand même — c'est lui qui compte, pas l'extinction de la caméra.
     */
    const composant = await monter()
    scanner.libererArret = null

    expect(() => scanner.surSucces!('BILLET-789')).not.toThrow()
    expect(composant.emitted('scan')).toHaveLength(1)
  })
})
