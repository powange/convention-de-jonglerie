import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultVolunteerPorts } from '../../../../../server/volunteers/ports/default-binding'
import { champsDuModele } from './champs-du-schema'
import { corpsDuRetrait } from '../../../../../../../layers/meals/app/utils/retrait-de-repas'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port meals (câblage jonglerie → module repas cœur)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createVolunteerMealSelections', () => {
    it('crée les sélections des repas éligibles non encore existantes', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        id: 5,
        setupAvailability: true,
        teardownAvailability: true,
        eventAvailability: true,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          enabled: true,
        },
        {
          id: 2,
          date: new Date('2026-06-16'),
          mealType: 'DINNER',
          phases: ['EVENT'],
          enabled: true,
        },
      ])
      prismaMock.volunteerMealSelection.findMany.mockResolvedValue([{ mealId: 1 }]) // 1 existe déjà

      await createDefaultVolunteerPorts().meals.createVolunteerMealSelections(5, 10)

      expect(prismaMock.volunteerMealSelection.createMany).toHaveBeenCalledWith({
        data: [{ volunteerId: 5, mealId: 2, accepted: true }],
      })
    })

    it('lève si le bénévole est introuvable', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)

      await expect(
        createDefaultVolunteerPorts().meals.createVolunteerMealSelections(999, 10)
      ).rejects.toThrow()
    })
  })

  describe('deleteVolunteerMealSelections', () => {
    it('supprime toutes les sélections du bénévole', async () => {
      await createDefaultVolunteerPorts().meals.deleteVolunteerMealSelections(5)

      expect(prismaMock.volunteerMealSelection.deleteMany).toHaveBeenCalledWith({
        where: { volunteerId: 5 },
      })
    })
  })

  describe('getCateringMealsForDate', () => {
    const dbMeals = [
      {
        id: 1,
        mealType: 'LUNCH',
        phases: ['EVENT'],
        mealSelections: [
          {
            volunteer: {
              // Ces informations vivent sur le PROFIL depuis la suppression des colonnes
              // dupliquées : c'est le `user` de la candidature que le code lit.
              user: {
                nom: 'Doe',
                prenom: 'John',
                email: 'j@x.fr',
                phone: '0700',
                dietaryPreference: 'VEGAN',
                allergies: 'arachides',
                allergySeverity: 'HIGH',
                emergencyContactName: 'Maman',
                emergencyContactPhone: '0600',
              },
            },
          },
        ],
      },
    ]

    const expectedVolunteers = [
      {
        nom: 'Doe',
        prenom: 'John',
        email: 'j@x.fr',
        phone: '0700',
        dietaryPreference: 'VEGAN',
        allergies: 'arachides',
        allergySeverity: 'HIGH',
        emergencyContactName: 'Maman',
        emergencyContactPhone: '0600',
      },
    ]

    const dbOrganizer = {
      mealSelections: [],
      organizer: {
        user: {
          nom: 'Roe',
          prenom: 'Jane',
          email: 'jane@x.fr',
          phone: '0800',
          dietaryPreference: 'VEGETARIAN',
          allergies: null,
          allergySeverity: null,
        },
      },
    }

    it('mappe les repas avec leurs participants bénévoles acceptés', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue(dbMeals)
      prismaMock.editionOrganizer.findMany.mockResolvedValue([])

      const result = await createDefaultVolunteerPorts().meals.getCateringMealsForDate(
        10,
        '2026-06-16'
      )

      expect(result).toEqual([
        {
          id: 1,
          mealType: 'LUNCH',
          phases: ['EVENT'],
          volunteers: expectedVolunteers,
          organizers: [],
        },
      ])
    })

    it('ajoute les organisateurs présents, qui ont accès au repas par défaut', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue(dbMeals)
      prismaMock.editionOrganizer.findMany.mockResolvedValue([dbOrganizer])

      const result = await createDefaultVolunteerPorts().meals.getCateringMealsForDate(
        10,
        '2026-06-16'
      )

      expect(result[0].organizers).toEqual([
        {
          nom: 'Roe',
          prenom: 'Jane',
          email: 'jane@x.fr',
          phone: '0800',
          dietaryPreference: 'VEGETARIAN',
          allergies: null,
          allergySeverity: null,
          // Sans ligne de sélection, c'est un repas ordinaire : l'absence vaut « pas après le
          // spectacle ». Un organisateur qui le déclare porte, lui, une ligne `accepted: true`.
          afterShow: false,
        },
      ])
    })

    it('exclut un organisateur dont le repas a été décoché', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue(dbMeals)
      prismaMock.editionOrganizer.findMany.mockResolvedValue([
        { ...dbOrganizer, mealSelections: [{ mealId: 1 }] },
      ])

      const result = await createDefaultVolunteerPorts().meals.getCateringMealsForDate(
        10,
        '2026-06-16'
      )

      expect(result[0].organizers).toEqual([])
    })
  })

  describe('getVolunteerMeals', () => {
    it('renvoie les repas avec sélection et éligibilité calculée', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        eventId: 10,
        setupAvailability: false,
        eventAvailability: true,
        teardownAvailability: false,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          mealSelections: [{ id: 99, accepted: true }],
        },
      ])

      const result = await createDefaultVolunteerPorts().meals.getVolunteerMeals(10, 5)

      expect(result).toEqual([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          selectionId: 99,
          accepted: true,
          // La sélection simulée ne porte pas le drapeau : sans ligne ni valeur, c'est un repas
          // ordinaire — l'absence vaut « pas après le spectacle ».
          afterShow: false,
          eligible: true,
        },
      ])
    })

    it('lève 404 si le bénévole n’appartient pas à l’édition', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({ eventId: 999 })

      await expect(createDefaultVolunteerPorts().meals.getVolunteerMeals(10, 5)).rejects.toThrow()
    })
  })

  describe('getEditionMealSchedule', () => {
    it('crée les repas manquants (3 par jour de la période)', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        startDate: new Date('2026-06-16'),
        endDate: new Date('2026-06-16'),
        volunteerSettings: null,
      })
      prismaMock.volunteerMeal.findMany
        .mockResolvedValueOnce([]) // repas existants
        .mockResolvedValueOnce([{ id: 1, handoutItems: [] }]) // re-lecture finale

      await createDefaultVolunteerPorts().meals.getEditionMealSchedule(10)

      expect(prismaMock.volunteerMeal.createMany).toHaveBeenCalledTimes(1)
      const created = prismaMock.volunteerMeal.createMany.mock.calls[0][0].data
      expect(created).toHaveLength(3)
      expect(created.map((m: any) => m.mealType)).toEqual(['BREAKFAST', 'LUNCH', 'DINNER'])
      expect(created.every((m: any) => m.editionId === 10 && m.phases[0] === 'EVENT')).toBe(true)
    })

    it('ne crée ni ne supprime rien si le planning est déjà à jour', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        startDate: new Date('2026-06-16'),
        endDate: new Date('2026-06-16'),
        volunteerSettings: null,
      })
      const existing = [{ id: 1, date: new Date('2026-06-16'), handoutItems: [] }]
      prismaMock.volunteerMeal.findMany.mockResolvedValue(existing)

      const result = await createDefaultVolunteerPorts().meals.getEditionMealSchedule(10)

      expect(prismaMock.volunteerMeal.createMany).not.toHaveBeenCalled()
      expect(prismaMock.volunteerMeal.deleteMany).not.toHaveBeenCalled()
      expect(result).toBe(existing)
    })

    it('lève 404 si l’événement est introuvable', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null)

      await expect(
        createDefaultVolunteerPorts().meals.getEditionMealSchedule(999)
      ).rejects.toThrow()
    })
  })

  describe('updateEditionMealsConfig', () => {
    /**
     * ⚠️ CE CAS EXIGEAIT UN `upsert` AVEC `update: { accepted: true }` — constat B3.
     *
     * C'est-à-dire qu'il figeait le défaut : réactiver un repas RÉ-INSCRIVAIT d'office les
     * bénévoles qui l'avaient décliné. Leur refus était une réponse explicite, et il disparaissait
     * sans un mot — avec un effet sur les quantités commandées en cuisine.
     *
     * La réactivation ne crée désormais que les lignes MANQUANTES, par un `createMany` précédé de
     * la lecture de celles qui existent. Les choix déjà faits, acceptation comme refus, sont
     * intacts.
     */
    it('à l’activation d’un repas, ne crée QUE les sélections manquantes', async () => {
      prismaMock.volunteerMeal.findMany
        .mockResolvedValueOnce([{ id: 1, enabled: false }]) // état avant (currentMeals)
        .mockResolvedValueOnce([{ id: 1, handoutItems: [] }]) // re-lecture finale
      prismaMock.volunteerMeal.findUnique.mockResolvedValue({
        date: new Date('2026-06-16'),
        mealType: 'LUNCH',
        phases: ['EVENT'],
      })
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        {
          id: 1,
          setupAvailability: true,
          teardownAvailability: true,
          eventAvailability: true,
          arrivalDateTime: null,
          departureDateTime: null,
        },
      ])

      const { toggles } = await createDefaultVolunteerPorts().meals.updateEditionMealsConfig(10, [
        { id: 1, enabled: true },
      ])

      expect(prismaMock.volunteerMeal.update).toHaveBeenCalled()
      // Plus aucun `upsert` : c'est lui qui écrasait les refus.
      expect(prismaMock.volunteerMealSelection.upsert).not.toHaveBeenCalled()
      expect(prismaMock.volunteerMealSelection.createMany).toHaveBeenCalledWith({
        data: [{ volunteerId: 1, mealId: 1, accepted: true }],
        skipDuplicates: true,
      })

      /*
       * Et la même chose sans recopier le littéral : les champs écrits existent-ils dans le
       * schéma ? Prisma est bouché par un mock, donc l'assertion ci-dessus passerait tout aussi
       * bien sur une colonne inexistante — c'est précisément ce qui a figé `selected` ici.
       */
      const colonnes = champsDuModele('VolunteerMealSelection')
      const argument = prismaMock.volunteerMealSelection.createMany.mock.calls[0][0]
      for (const champ of Object.keys(argument.data[0])) {
        expect(colonnes, `champ « ${champ} » écrit sur VolunteerMealSelection`).toContain(champ)
      }
      expect(toggles).toEqual([
        { mealId: 1, date: new Date('2026-06-16'), mealType: 'LUNCH', enabled: true },
      ])
    })

    /**
     * ⚠️⚠️ CE CAS DISAIT L'INVERSE, et il figeait le défaut — constat B3.
     *
     * Il exigeait un `deleteMany` sur toutes les sélections du repas. Or ce `deleteMany` effaçait
     * les `consumedAt` déjà posés au comptoir : un clic malheureux sur le commutateur pendant
     * l'événement perdait l'historique de service d'un repas entier, et les choix des personnes
     * avec — sans message, sans retour possible.
     *
     * 📍 CE QUI REND LA CONSERVATION SÛRE, vérifié plutôt que supposé : toutes les lectures
     * bornent sur `enabled: true` — celle des bénévoles comme celle des participants d'un repas
     * (`participants.get.ts`, l. 58-62). Les lignes d'un repas désactivé n'apparaissent nulle
     * part ; elles attendent, et réapparaissent telles quelles à la réactivation.
     *
     * Ce cas garde donc une DÉCISION : s'il tombe, c'est que quelqu'un a remis une suppression,
     * et à lui de dire pourquoi.
     */
    it('⚠️ à la désactivation, NE SUPPRIME PLUS RIEN et renvoie une bascule off', async () => {
      prismaMock.volunteerMeal.findMany
        .mockResolvedValueOnce([{ id: 2, enabled: true }]) // état avant
        .mockResolvedValueOnce([{ id: 2, handoutItems: [] }]) // re-lecture finale

      const { toggles } = await createDefaultVolunteerPorts().meals.updateEditionMealsConfig(10, [
        { id: 2, enabled: false },
      ])

      expect(prismaMock.volunteerMealSelection.deleteMany).not.toHaveBeenCalled()
      expect(toggles).toEqual([{ mealId: 2, date: new Date(0), mealType: '', enabled: false }])
    })

    /**
     * ⚠️ LE CAS QUI MANQUAIT, et c'est celui qui dit le lot en entier.
     *
     * Les deux cas ci-dessus mesurent chacun une moitié : « rien n'est supprimé » et « on ne crée
     * que le manquant ». Pris séparément, ils laisseraient passer une implémentation qui conserve
     * la ligne puis la réécrit à `accepted: true` — c'est-à-dire exactement le défaut d'origine,
     * déplacé d'une étape. Ce qu'il faut garder est l'INVARIANT sur le cycle complet : un REFUS
     * traverse une désactivation suivie d'une réactivation.
     */
    it('⚠️ UN REFUS SURVIT à un cycle désactivation puis réactivation', async () => {
      prismaMock.volunteerMeal.findMany
        .mockResolvedValueOnce([{ id: 3, enabled: false }]) // état avant : le repas est éteint
        .mockResolvedValueOnce([{ id: 3, handoutItems: [] }])
      prismaMock.volunteerMeal.findUnique.mockResolvedValue({
        date: new Date('2026-06-16'),
        mealType: 'LUNCH',
        phases: ['EVENT'],
      })
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        {
          id: 8,
          setupAvailability: true,
          teardownAvailability: true,
          eventAvailability: true,
          arrivalDateTime: null,
          departureDateTime: null,
        },
      ])
      // Le bénévole 8 a DÉCLINÉ ce repas, et sa ligne a survécu à la désactivation.
      prismaMock.volunteerMealSelection.findMany.mockResolvedValue([{ volunteerId: 8 }])

      await createDefaultVolunteerPorts().meals.updateEditionMealsConfig(10, [
        { id: 3, enabled: true },
      ])

      // Ni création — la ligne existe — ni réécriture : son refus est intact.
      expect(prismaMock.volunteerMealSelection.createMany).not.toHaveBeenCalled()
      expect(prismaMock.volunteerMealSelection.upsert).not.toHaveBeenCalled()
      expect(prismaMock.volunteerMealSelection.update).not.toHaveBeenCalled()
      expect(prismaMock.volunteerMealSelection.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('getVolunteerSelfMeals', () => {
    it('auto-crée les sélections manquantes et renvoie les repas', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        id: 7,
        status: 'ACCEPTED',
        setupAvailability: true,
        teardownAvailability: true,
        eventAvailability: true,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          enabled: true,
        },
      ])
      prismaMock.volunteerMealSelection.findMany
        .mockResolvedValueOnce([]) // sélections existantes
        .mockResolvedValueOnce([{ id: 50, mealId: 1, accepted: true }]) // nouvelles relues

      const result = await createDefaultVolunteerPorts().meals.getVolunteerSelfMeals(10, 99)

      expect(prismaMock.volunteerMealSelection.createMany).toHaveBeenCalledWith({
        data: [{ volunteerId: 7, mealId: 1, accepted: true }],
      })
      expect(result).toEqual([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          selectionId: 50,
          accepted: true,
          // La sélection vient d'être créée : aucune assiette n'est mise de côté tant qu'un
          // organisateur ne l'a pas demandé. `false` et non absent — un champ manquant se lirait
          // comme « la donnée n'existe pas » plutôt que « pas d'assiette ».
          afterShow: false,
        },
      ])
    })

    it('lève 403 si la candidature n’est pas ACCEPTED', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        id: 7,
        status: 'PENDING',
      })

      await expect(
        createDefaultVolunteerPorts().meals.getVolunteerSelfMeals(10, 99)
      ).rejects.toThrow()
    })
  })

  describe('setVolunteerMeals', () => {
    it('crée les sélections sans selectionId et met à jour celles avec', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        eventId: 10,
        setupAvailability: true,
        eventAvailability: true,
        teardownAvailability: true,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([])

      await createDefaultVolunteerPorts().meals.setVolunteerMeals(10, 5, [
        { mealId: 1, accepted: true }, // pas de selectionId → create
        { selectionId: 88, mealId: 2, accepted: false }, // selectionId → update
      ])

      expect(prismaMock.volunteerMealSelection.create).toHaveBeenCalledWith({
        data: { volunteerId: 5, mealId: 1, accepted: true, afterShow: false },
      })
      expect(prismaMock.volunteerMealSelection.update).toHaveBeenCalledWith({
        where: { id: 88, volunteerId: 5 },
        data: { accepted: false, afterShow: false },
      })
    })

    /**
     * Le corps que fabrique la page des doublons doit réellement écrire.
     *
     * `setVolunteerMeals` ouvre sur `if (!selection.mealId) return` : une sélection sans repas est
     * ignorée **en silence**, et le point d'API répond quand même 200 avec la liste inchangée. La
     * page envoyait `{ selectionId, accepted: false }` — « Désactiver » affichait son succès et ne
     * retirait rien. Le cas au-dessus ne l'avait pas vu : il passe `mealId` partout.
     *
     * D'où ce test qui part du VRAI constructeur de corps plutôt que d'un littéral réécrit à la
     * main : un littéral se contenterait de répéter l'hypothèse qu'on cherche à vérifier.
     */
    it('écrit bien à partir du corps fabriqué par la page des doublons', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        eventId: 10,
        setupAvailability: true,
        eventAvailability: true,
        teardownAvailability: true,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([])

      const corps = corpsDuRetrait([
        { source: 'volunteer', mealId: 2, userId: 7, roleId: 5, selectionId: 88 },
      ])

      await createDefaultVolunteerPorts().meals.setVolunteerMeals(10, 5, corps.selections)

      expect(prismaMock.volunteerMealSelection.update).toHaveBeenCalledWith({
        where: { id: 88, volunteerId: 5 },
        data: { accepted: false, afterShow: false },
      })
      // Et surtout : il ne CRÉE pas une seconde ligne au passage.
      expect(prismaMock.volunteerMealSelection.create).not.toHaveBeenCalled()
    })
  })
})
