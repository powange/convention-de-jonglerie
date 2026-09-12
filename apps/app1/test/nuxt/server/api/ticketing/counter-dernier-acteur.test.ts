import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())
const mockBroadcast = vi.hoisted(() => vi.fn())
const mockNotify = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

vi.mock('#server/utils/ticketing-counter-sse', () => ({
  broadcastCounterUpdate: mockBroadcast,
  notifyCounterUpdate: mockNotify,
}))

import decrementParId from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/counters/[counterId]/decrement.patch'
import incrementParId from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/counters/[counterId]/increment.patch'
import resetParId from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/counters/[counterId]/reset.patch'
import decrementParJeton from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/counters/token/[token]/decrement.patch'
import incrementParJeton from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/counters/token/[token]/increment.patch'

import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const UTILISATEUR = { id: 7, pseudo: 'marie' }
const compteur = { id: 12, name: 'Gala', value: 40, editionId: 22, token: 'jeton-du-compteur' }

const evenementParId = {
  context: { params: { id: '22', counterId: '12' }, user: UTILISATEUR },
}
const evenementParJeton = {
  context: { params: { id: '22', token: 'jeton-du-compteur' }, user: UTILISATEUR },
}

/**
 * Un compteur de passage se partage par QR code : plusieurs personnes l'incrémentent au cours
 * d'une soirée. `updatedAt` disait *quand* il avait bougé, jamais *qui* l'avait fait — de quoi
 * constater un total aberrant le lendemain sans pouvoir l'expliquer ni savoir qui appeler.
 *
 * `lastActorId` est renseigné par les **cinq** chemins qui modifient la valeur, des deux familles
 * de routes. Ces tests existent parce qu'un oubli sur un seul d'entre eux rendrait la trace
 * silencieusement fausse : elle désignerait l'avant-dernière personne, ce qui est pire que rien.
 *
 * `regenerate-token` en est volontairement exclu : il change le jeton, pas la valeur.
 */
describe('trace du dernier acteur sur un compteur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.ticketingCounter.findFirst.mockResolvedValue(compteur)
    // Prisma rend une valeur RÉSOLUE, pas l'opération qu'on lui a demandée : un mock qui
    // recopierait `data` tel quel rendrait `{ increment: 1 }` là où le code attend un nombre —
    // et la diffusion SSE partirait avec un objet à la place du total.
    prismaMock.ticketingCounter.update.mockImplementation(async ({ data }: any) => {
      const valeur =
        typeof data.value === 'number'
          ? data.value
          : data.value?.increment !== undefined
            ? compteur.value + data.value.increment
            : compteur.value - (data.value?.decrement ?? 0)

      return {
        ...compteur,
        ...data,
        value: valeur,
        updatedAt: new Date('2026-09-12T21:00:00Z'),
      }
    })
    global.readBody = vi.fn().mockResolvedValue({ step: 1 })
  })

  const ecriture = () => prismaMock.ticketingCounter.update.mock.calls[0][0].data

  describe('les cinq chemins qui modifient la valeur', () => {
    it.each([
      ['incrément par identifiant', () => incrementParId(evenementParId as any)],
      ['décrément par identifiant', () => decrementParId(evenementParId as any)],
      ['remise à zéro par identifiant', () => resetParId(evenementParId as any)],
      ['incrément par jeton', () => incrementParJeton(evenementParJeton as any)],
      ['décrément par jeton', () => decrementParJeton(evenementParJeton as any)],
    ])('enregistre l’auteur : %s', async (_nom, appeler) => {
      await appeler()

      expect(ecriture().lastActorId).toBe(UTILISATEUR.id)
    })
  })

  describe('ce que la valeur devient', () => {
    it('l’auteur ne remplace pas la modification demandée', async () => {
      // Le risque d'une écriture ajoutée à un `data` existant est d'en écraser le contenu.
      await incrementParId(evenementParId as any)

      expect(ecriture()).toMatchObject({ value: { increment: 1 }, lastActorId: 7 })
    })

    it('la remise à zéro reste une remise à zéro', async () => {
      await resetParId(evenementParId as any)

      expect(ecriture()).toEqual({ value: 0, lastActorId: 7 })
    })
  })

  describe('ce que les écrans connectés reçoivent', () => {
    it('la diffusion porte le pseudo, pas seulement la valeur', async () => {
      // Sans lui, un appareil resté ouvert afficherait le nouveau total à côté du nom de la
      // personne PRÉCÉDENTE — plus trompeur que de ne rien afficher.
      await incrementParId(evenementParId as any)

      expect(mockBroadcast).toHaveBeenCalledWith(22, 12, expect.anything(), UTILISATEUR.pseudo)
    })

    it('la famille par jeton aussi', async () => {
      await incrementParJeton(evenementParJeton as any)

      expect(mockNotify).toHaveBeenCalledWith(
        22,
        12,
        expect.any(Number),
        expect.any(String),
        UTILISATEUR.pseudo
      )
    })
  })
})
