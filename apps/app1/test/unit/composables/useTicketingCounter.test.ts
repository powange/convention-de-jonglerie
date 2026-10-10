import { describe, it, expect, beforeEach, vi } from 'vitest'
import { onBeforeUnmount } from 'vue'

/**
 * La file d'attente du compteur partagé.
 *
 * ## ⚠️ LE DÉFAUT (constat B7)
 *
 * `increment` / `decrement` mettaient en attente **toute** erreur, sans distinguer une coupure
 * réseau d'un **refus définitif** : un `step` invalide (400), un jeton régénéré (404), une session
 * expirée (401). Une opération que le serveur refusera toujours ne part donc jamais.
 *
 * Et comme `syncPendingOperations` faisait `break` à la première erreur, elle restait **en tête de
 * file et retenait toutes les suivantes**. L'écran annonçait « 1 opération en attente »
 * indéfiniment, avec un total optimiste faux, jusqu'au rechargement de la page.
 *
 * Troisième moitié du même défaut : la file n'était rejouée qu'à l'événement SSE `connected`, donc
 * **jamais** tant que le flux restait ouvert. Un échec passager y dormait alors que la connexion
 * était revenue.
 *
 * ## Le harnais, et pourquoi il faut un faux `EventSource`
 *
 * `isConnected` n'est pas pilotable de l'extérieur : seul l'événement SSE `connected` le lève. Sans
 * ce faux flux, tous les gestes partiraient dans la file et le chemin « en ligne » — celui que ce
 * lot corrige — ne serait **jamais exercé**. C'est le genre de test qui passerait au vert sans rien
 * éprouver.
 */
class FauxEventSource {
  static derniere: FauxEventSource | null = null
  private ecouteurs = new Map<string, ((e: { data: string }) => void)[]>()
  onerror: ((e: unknown) => void) | null = null

  constructor(public url: string) {
    FauxEventSource.derniere = this
  }

  addEventListener(type: string, fn: (e: { data: string }) => void) {
    this.ecouteurs.set(type, [...(this.ecouteurs.get(type) ?? []), fn])
  }

  close() {}

  /** Joue un événement du serveur, comme le ferait un vrai flux. */
  emettre(type: string, donnees: unknown) {
    for (const fn of this.ecouteurs.get(type) ?? []) fn({ data: JSON.stringify(donnees) })
  }
}

const COMPTEUR = {
  id: 5,
  name: 'Entrée principale',
  token: 'jeton',
  value: 10,
  editionId: 7,
  createdAt: '',
  updatedAt: '',
}

const fetchMock = vi.fn()

vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
vi.stubGlobal('EventSource', FauxEventSource as unknown as typeof EventSource)
vi.stubGlobal('$fetch', fetchMock)

const { useTicketingCounter } =
  await import('../../../../../layers/ticketing/app/composables/useTicketingCounter')

/** Une erreur telle que `$fetch` la lève : le code vit sur `statusCode`. */
const erreurHttp = (statusCode: number, message = 'refusé') =>
  Object.assign(new Error(message), { statusCode, data: { message } })

describe('useTicketingCounter — la file d’attente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    FauxEventSource.derniere = null
    fetchMock.mockResolvedValue({ success: true, data: { counter: { ...COMPTEUR } } })
  })

  /** Un compteur chargé et un flux ouvert, comme après le montage de l'écran. */
  const enLigne = async () => {
    const c = useTicketingCounter(7, 'jeton')
    await c.init()
    FauxEventSource.derniere!.emettre('connected', { activeConnections: 1 })
    expect(c.isConnected.value, 'le faux flux doit avoir levé isConnected').toBe(true)
    fetchMock.mockClear()
    return c
  }

  describe('hors ligne', () => {
    it('met le geste en attente et avance la valeur affichée', async () => {
      const c = useTicketingCounter(7, 'jeton')
      await c.init() // pas d'événement `connected` : on reste hors ligne
      fetchMock.mockClear()

      await c.increment(3)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(c.pendingCount.value).toBe(1)
      expect(c.displayValue.value).toBe(13)
    })
  })

  describe('un refus DÉFINITIF du serveur', () => {
    it('⚠️ N’EST PAS MIS EN FILE, et la valeur affichée ne bouge pas', async () => {
      /*
       * LE CŒUR DU CONSTAT. Un 400 — un `step` que zod refuse — ne passera jamais, quel que soit le
       * nombre de tentatives. Le mettre en file revenait à bloquer la file pour toujours.
       */
      const c = await enLigne()
      fetchMock.mockRejectedValue(erreurHttp(400, 'step invalide'))

      await expect(c.increment(2)).rejects.toThrow()

      expect(c.pendingCount.value).toBe(0)
      expect(c.displayValue.value).toBe(10)
      expect(c.error.value).toContain('step invalide')
    })

    it('vaut aussi pour un jeton régénéré (404) et une session expirée (401)', async () => {
      for (const code of [401, 404]) {
        /*
         * ⚠️ REMETTRE LE MOCK EN RÉUSSITE AVANT CHAQUE `enLigne()`. Sans cela, le `$fetch` du
         * chargement initial hérite du rejet de l'itération précédente : `counter.value` reste
         * `null`, `increment` sort immédiatement sans lever, et le test échoue sur « promise
         * resolved undefined » en accusant le code au lieu du harnais.
         */
        fetchMock.mockResolvedValue({ success: true, data: { counter: { ...COMPTEUR } } })
        const c = await enLigne()
        fetchMock.mockRejectedValue(erreurHttp(code))
        await expect(c.increment(1)).rejects.toThrow()
        expect(c.pendingCount.value, `code ${code}`).toBe(0)
      }
    })
  })

  describe('un échec PASSAGER', () => {
    it('garde le geste en file — coupure réseau, sans code', async () => {
      /*
       * ⚠️ LE TÉMOIN QUI BORNE LES CAS CI-DESSUS. Sans lui, abandonner TOUTE erreur les
       * satisferait — et le mode hors-ligne, qui est la raison d'être de cette file, aurait
       * disparu. Une erreur sans code HTTP est une coupure : le geste doit survivre.
       */
      const c = await enLigne()
      fetchMock.mockRejectedValue(new Error('Failed to fetch'))

      await expect(c.increment(2)).rejects.toThrow()

      expect(c.pendingCount.value).toBe(1)
      expect(c.displayValue.value).toBe(12)
    })

    it('garde le geste en file sur un 5xx, et le retente sur 429', async () => {
      for (const code of [500, 502, 429]) {
        fetchMock.mockResolvedValue({ success: true, data: { counter: { ...COMPTEUR } } })
        const c = await enLigne()
        fetchMock.mockRejectedValue(erreurHttp(code))
        await expect(c.increment(1)).rejects.toThrow()
        expect(c.pendingCount.value, `code ${code}`).toBe(1)
      }
    })
  })

  describe('la reprise de la file', () => {
    it('⚠️ A LIEU DÈS QU’UN ENVOI DIRECT RÉUSSIT, sans attendre une reconnexion', async () => {
      /*
       * La file n'était rejouée qu'à l'événement `connected`. Un échec passager pendant que le flux
       * restait ouvert y dormait donc jusqu'au rechargement de la page. Un envoi qui réussit est la
       * meilleure preuve que le serveur répond de nouveau.
       */
      const c = await enLigne()
      fetchMock.mockRejectedValueOnce(erreurHttp(502))
      await expect(c.increment(4)).rejects.toThrow()
      expect(c.pendingCount.value).toBe(1)

      fetchMock.mockResolvedValue({ success: true })
      await c.increment(1)
      await new Promise((r) => setTimeout(r, 0)) // la reprise n'est pas attendue, volontairement

      expect(c.pendingCount.value).toBe(0)
    })

    it('abandonne une opération en file que le serveur refuse définitivement', async () => {
      /*
       * LE CAS QUI DÉBLOQUE LA FILE. Avant, `break` laissait l'opération fautive en tête et
       * retenait tout le reste. Elle est maintenant retirée, la valeur optimiste défaite, et le
       * message dit ce qui s'est passé — un geste perdu en silence serait pire qu'un geste refusé.
       */
      const c = await enLigne()
      fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'))
      await expect(c.increment(5)).rejects.toThrow()
      expect(c.displayValue.value).toBe(15)

      // La reprise se heurte à un refus définitif sur l'opération en attente.
      /*
       * ⚠️ L'ORDRE DES MOCKS SUIT L'ORDRE DES APPELS, et il m'a piégé une fois : l'envoi direct
       * part AVANT la reprise. Mettre le rejet en premier le faisait consommer par l'envoi direct,
       * qui levait alors — et l'erreur ressortait non gérée en accusant le code.
       */
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce({ success: true }) // 1. l'envoi direct réussit
      fetchMock.mockRejectedValue(erreurHttp(400, 'pas invalide')) // 2. la reprise est refusée
      await c.increment(1)
      await new Promise((r) => setTimeout(r, 0))

      expect(c.pendingCount.value).toBe(0)
      /*
       * 10, et non 11 : un envoi direct qui RÉUSSIT ne touche pas la valeur optimiste — c'est le
       * flux SSE qui porte la vérité, et il n'a pas parlé dans ce test. Le 15 du geste abandonné,
       * lui, est bien redescendu à 10. C'est précisément ce qu'on vérifie : la valeur affichée ne
       * garde pas la trace d'un comptage que le serveur a refusé.
       */
      expect(c.displayValue.value).toBe(10)
    })
  })

  describe('le pas', () => {
    it('⚠️ UN CHAMP VIDÉ NE PRODUIT PLUS UN APPEL REFUSÉ', async () => {
      /*
       * `v-model.number` sur un champ vidé rend la chaîne vide, pas `0`. Le serveur refusait en 400
       * et ce refus jammait la file. `Number.isFinite` l'écarte — et non `Math.max(1, x)`, qui
       * rendrait `NaN` : piège déjà payé ailleurs dans ce dépôt.
       */
      const c = await enLigne()
      fetchMock.mockResolvedValue({ success: true })

      await c.increment('' as unknown as number)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: { step: 1 } })
      )
    })

    it('tronque un pas décimal et refuse un pas négatif', async () => {
      const c = await enLigne()
      fetchMock.mockResolvedValue({ success: true })

      await c.increment(2.7)
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ body: { step: 2 } })
      )

      await c.increment(-5)
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ body: { step: 1 } })
      )
    })
  })
})
