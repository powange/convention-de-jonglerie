import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultMealsPorts } from '../../../../../server/meals/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const userOf = (id: number) => ({
  id,
  nom: `Nom${id}`,
  prenom: `Prenom${id}`,
  pseudo: `pseudo${id}`,
  email: `u${id}@x.fr`,
  phone: `060${id}`,
})

describe('port artists du module repas (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMealParticipants', () => {
    it('renvoie les participants artistes ACCEPTÉS par repas', async () => {
      prismaMock.artistMealSelection.findMany.mockResolvedValue([
        {
          mealId: 42,
          afterShow: true,
          artist: {
            dietaryPreference: 'VEGAN',
            allergies: 'arachides',
            allergySeverity: 'HIGH',
            user: userOf(1),
          },
        },
      ])

      const result = await createDefaultMealsPorts().artists.getMealParticipants([42])

      expect(prismaMock.artistMealSelection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { mealId: { in: [42] }, accepted: true } })
      )
      expect(result[42]).toEqual([
        {
          userId: 1,
          nom: 'Nom1',
          prenom: 'Prenom1',
          pseudo: 'pseudo1',
          email: 'u1@x.fr',
          phone: '0601',
          dietaryPreference: 'VEGAN',
          allergies: 'arachides',
          allergySeverity: 'HIGH',
          afterShow: true,
        },
      ])
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const result = await createDefaultMealsPorts().artists.getMealParticipants([])
      expect(result).toEqual({})
      expect(prismaMock.artistMealSelection.findMany).not.toHaveBeenCalled()
    })
  })

  describe('listMealSelections', () => {
    it('renvoie TOUTES les sélections du repas (sans filtre accepted) avec consumedAt', async () => {
      const consumed = new Date('2026-06-16T12:00:00Z')
      prismaMock.artistMealSelection.findMany.mockResolvedValue([
        { id: 1, consumedAt: null, artist: { user: userOf(1) } },
        { id: 2, consumedAt: consumed, artist: { user: userOf(2) } },
      ])

      const rows = await createDefaultMealsPorts().artists.listMealSelections(10, 42)

      expect(prismaMock.artistMealSelection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { mealId: 42, artist: { editionId: 10 } } })
      )
      expect(rows).toEqual([
        {
          selectionId: 1,
          userId: 1,
          nom: 'Nom1',
          prenom: 'Prenom1',
          pseudo: 'pseudo1',
          email: 'u1@x.fr',
          phone: '0601',
          consumedAt: null,
        },
        {
          selectionId: 2,
          userId: 2,
          nom: 'Nom2',
          prenom: 'Prenom2',
          pseudo: 'pseudo2',
          email: 'u2@x.fr',
          phone: '0602',
          consumedAt: consumed,
        },
      ])
    })
  })

  describe('markConsumed', () => {
    it('ok quand la sélection existe et n’est pas encore consommée', async () => {
      prismaMock.artistMealSelection.findUnique.mockResolvedValue({
        artist: { editionId: 10 },
        mealId: 42,
      })
      prismaMock.artistMealSelection.updateMany.mockResolvedValue({ count: 1 })

      const res = await createDefaultMealsPorts().artists.markConsumed(10, 42, 5, new Date())

      expect(res).toEqual({ ok: true })
      expect(prismaMock.artistMealSelection.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5, consumedAt: null } })
      )
    })

    it('already quand déjà consommée (updateMany count 0)', async () => {
      prismaMock.artistMealSelection.findUnique.mockResolvedValue({
        artist: { editionId: 10 },
        mealId: 42,
      })
      prismaMock.artistMealSelection.updateMany.mockResolvedValue({ count: 0 })

      const res = await createDefaultMealsPorts().artists.markConsumed(10, 42, 5, new Date())
      expect(res).toEqual({ ok: false, reason: 'already' })
    })

    it('not_found si introuvable ou édition/repas ne correspondent pas', async () => {
      prismaMock.artistMealSelection.findUnique.mockResolvedValue(null)
      expect(await createDefaultMealsPorts().artists.markConsumed(10, 42, 5, new Date())).toEqual({
        ok: false,
        reason: 'not_found',
      })

      prismaMock.artistMealSelection.findUnique.mockResolvedValue({
        artist: { editionId: 99 },
        mealId: 42,
      })
      expect(await createDefaultMealsPorts().artists.markConsumed(10, 42, 5, new Date())).toEqual({
        ok: false,
        reason: 'not_found',
      })
      expect(prismaMock.artistMealSelection.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('cancelConsumed', () => {
    it('ok et remet consumedAt à null', async () => {
      prismaMock.artistMealSelection.findUnique.mockResolvedValue({
        artist: { editionId: 10 },
        mealId: 42,
      })

      const res = await createDefaultMealsPorts().artists.cancelConsumed(10, 42, 5)

      expect(res).toEqual({ ok: true })
      expect(prismaMock.artistMealSelection.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { consumedAt: null },
      })
    })

    it('not_found si la sélection n’appartient pas à l’édition/au repas', async () => {
      prismaMock.artistMealSelection.findUnique.mockResolvedValue({
        artist: { editionId: 10 },
        mealId: 999,
      })

      const res = await createDefaultMealsPorts().artists.cancelConsumed(10, 42, 5)
      expect(res).toEqual({ ok: false, reason: 'not_found' })
      expect(prismaMock.artistMealSelection.update).not.toHaveBeenCalled()
    })
  })
})
