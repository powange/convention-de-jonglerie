import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  getVolunteerSelfMeals,
  setVolunteerSelfMealAcceptances,
} from '../../../../server/meals/meals-service'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

/**
 * L'assiette mise de côté doit arriver jusqu'au bénévole, par les DEUX chemins.
 *
 * Elle est réglée par un organisateur et le bénévole ne peut pas la demander : sans qu'elle
 * remonte jusqu'à sa page, il n'a aucun moyen de vérifier qu'on a bien noté sa demande. La donnée
 * existait en base et s'arrêtait à l'écran de gestion.
 *
 * Deux chemins, parce que la carte se recharge depuis la réponse de l'ENREGISTREMENT autant que
 * depuis celle de la lecture. Le champ manquait aux deux : au premier clic sur « Sauvegarder », la
 * pastille aurait disparu alors que l'assiette restait mise de côté. C'est la raison d'être de ce
 * fichier — un seul des deux tests ne prouverait rien de l'autre.
 */
describe('l’assiette mise de côté remonte jusqu’au bénévole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const benevoleAccepte = {
    id: 5,
    status: 'ACCEPTED',
    setupAvailability: true,
    teardownAvailability: true,
    eventAvailability: true,
    arrivalDateTime: null,
    departureDateTime: null,
  }

  const repas = {
    id: 1,
    date: new Date('2026-06-16'),
    mealType: 'DINNER',
    phases: ['EVENT'],
    enabled: true,
  }

  describe('à la lecture', () => {
    it('rend `afterShow` tel qu’il est enregistré', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(benevoleAccepte)
      prismaMock.volunteerMeal.findMany.mockResolvedValue([repas])
      prismaMock.volunteerMealSelection.findMany.mockResolvedValue([
        { id: 90, mealId: 1, accepted: true, afterShow: true },
      ])

      const rendus = await getVolunteerSelfMeals(12, 34)

      expect(rendus).toHaveLength(1)
      expect(rendus[0]!.afterShow).toBe(true)
    })

    it('rend `false` quand aucune assiette n’est mise de côté', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(benevoleAccepte)
      prismaMock.volunteerMeal.findMany.mockResolvedValue([repas])
      prismaMock.volunteerMealSelection.findMany.mockResolvedValue([
        { id: 90, mealId: 1, accepted: true, afterShow: false },
      ])

      const rendus = await getVolunteerSelfMeals(12, 34)

      // `false` et non `undefined` : côté écran les deux se ressemblent, mais un champ absent se
      // lit comme « la donnée n'existe pas » plutôt que « pas d'assiette ».
      expect(rendus[0]!.afterShow).toBe(false)
    })
  })

  describe('après un enregistrement', () => {
    it('rend encore `afterShow` — la pastille ne doit pas disparaître au clic sur Sauvegarder', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        id: 5,
        status: 'ACCEPTED',
      })
      prismaMock.volunteerMealSelection.findMany.mockResolvedValue([
        {
          id: 90,
          accepted: false,
          afterShow: true,
          meal: repas,
        },
      ])

      const rendus = await setVolunteerSelfMealAcceptances(12, 34, [
        { selectionId: 90, accepted: false },
      ])

      expect(rendus).toHaveLength(1)
      expect(rendus[0]!.accepted).toBe(false)
      // Le bénévole vient de refuser le repas ; l'assiette mise de côté, elle, ne lui appartient
      // pas — elle reste ce que l'organisation en a dit.
      expect(rendus[0]!.afterShow).toBe(true)
    })
  })
})
