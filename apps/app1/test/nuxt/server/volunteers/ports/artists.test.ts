import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultVolunteerPorts } from '../../../../../server/volunteers/ports/default-binding'
import { champsDuModele } from './champs-du-schema'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port artists (câblage jonglerie par défaut)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addEligibleMealSelections', () => {
    it('upsert uniquement les artistes éligibles selon leurs dates', async () => {
      prismaMock.editionArtist.findMany.mockResolvedValue([
        { id: 1, arrivalDateTime: null, departureDateTime: null }, // toujours éligible
        { id: 2, arrivalDateTime: new Date('2099-01-01T09:00:00.000Z'), departureDateTime: null }, // arrive trop tard
      ])

      await createDefaultVolunteerPorts().artists.addEligibleMealSelections({
        editionId: 10,
        mealId: 42,
        date: new Date('2026-06-16'),
        mealType: 'LUNCH',
      })

      expect(prismaMock.editionArtist.findMany).toHaveBeenCalledWith({
        where: { editionId: 10 },
        select: { id: true, arrivalDateTime: true, departureDateTime: true },
      })
      // Seul l'artiste 1 (éligible) est upserté
      expect(prismaMock.artistMealSelection.upsert).toHaveBeenCalledTimes(1)
      /*
       * ⚠️ `update: {}` ET NON `{ accepted: true }` — constat B3.
       *
       * Écrire `accepted: true` à la réactivation d'un repas RÉ-INSCRIVAIT d'office un artiste
       * qui l'avait décliné : son refus était une réponse explicite, et il disparaissait sans un
       * mot — avec un effet sur les quantités commandées en cuisine. L'`upsert` ne sert plus
       * qu'à créer la ligne manquante sans échouer sur celle qui existe déjà.
       */
      expect(prismaMock.artistMealSelection.upsert).toHaveBeenCalledWith({
        where: { artistId_mealId: { artistId: 1, mealId: 42 } },
        create: { artistId: 1, mealId: 42, accepted: true },
        update: {},
      })

      // Même garde que côté bénévoles : on confronte les champs écrits au schéma, plutôt que de
      // redire ce que le code écrit. `getMealArtistParticipants` lit déjà `accepted` plus bas —
      // la lecture et l'écriture se contredisaient dans ce fichier même.
      const colonnes = champsDuModele('ArtistMealSelection')
      const argument = prismaMock.artistMealSelection.upsert.mock.calls[0][0]
      for (const champ of [...Object.keys(argument.create), ...Object.keys(argument.update)]) {
        expect(colonnes, `champ « ${champ} » écrit sur ArtistMealSelection`).toContain(champ)
      }
    })
  })

  describe('removeMealSelections', () => {
    /**
     * ⚠️⚠️ CE CAS DISAIT L'INVERSE, et il figeait le défaut — constat B3.
     *
     * Il exigeait un `deleteMany` sur toutes les sélections du repas. Or ce `deleteMany` effaçait
     * les `consumedAt` posés au comptoir et les `afterShow` : un clic malheureux sur le
     * commutateur pendant l'événement perdait l'historique de service d'un repas entier.
     *
     * 📍 CE QUI REND L'INERTIE SÛRE, et c'est vérifié plutôt que supposé : toutes les lectures
     * bornent sur `enabled: true` — celle des bénévoles (`meals-service.ts`) comme celle des
     * participants d'un repas (`participants.get.ts`, l. 58-62). Les lignes d'un repas désactivé
     * n'apparaissent nulle part ; elles attendent.
     *
     * Ce cas garde donc désormais une DÉCISION : s'il tombe, c'est que quelqu'un a remis une
     * suppression, et à lui de dire pourquoi.
     */
    it('⚠️ NE SUPPRIME PLUS RIEN — les repas servis survivent à une désactivation', async () => {
      await createDefaultVolunteerPorts().artists.removeMealSelections(42)

      expect(prismaMock.artistMealSelection.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe('getMealArtistParticipants', () => {
    it('mappe les sélections acceptées en participants par repas', async () => {
      prismaMock.artistMealSelection.findMany.mockResolvedValue([
        {
          mealId: 42,
          afterShow: true,
          artist: {
            // Régime et allergies vivent sur le PROFIL depuis la suppression des colonnes
            // dupliquées : c'est le `user` de la fiche que le code lit.
            user: {
              nom: 'Star',
              prenom: 'Jo',
              email: 'jo@x.fr',
              phone: '0600',
              dietaryPreference: 'VEGAN',
              allergies: 'arachides',
              allergySeverity: 'HIGH',
            },
          },
        },
      ])

      const result = await createDefaultVolunteerPorts().artists.getMealArtistParticipants([42])

      expect(result).toEqual({
        42: [
          {
            nom: 'Star',
            prenom: 'Jo',
            email: 'jo@x.fr',
            phone: '0600',
            dietaryPreference: 'VEGAN',
            allergies: 'arachides',
            allergySeverity: 'HIGH',
            afterShow: true,
          },
        ],
      })
      expect(prismaMock.artistMealSelection.findMany).toHaveBeenCalledWith({
        where: { mealId: { in: [42] }, accepted: true },
        select: expect.objectContaining({ mealId: true, afterShow: true }),
      })
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const result = await createDefaultVolunteerPorts().artists.getMealArtistParticipants([])

      expect(result).toEqual({})
      expect(prismaMock.artistMealSelection.findMany).not.toHaveBeenCalled()
    })
  })
  describe('getShowSchedule', () => {
    it('ne remonte que les spectacles ayant au moins une représentation', async () => {
      prismaMock.show.findMany.mockResolvedValue([])

      await createDefaultVolunteerPorts().artists.getShowSchedule(7)

      // Un spectacle sans représentation n'offre rien à manquer : l'écarter en base évite de
      // le transporter jusqu'au front pour l'ignorer là-bas.
      expect(prismaMock.show.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { editionId: 7, performances: { some: {} } } })
      )
    })

    it('rend la durée du spectacle et les instants de ses représentations', async () => {
      prismaMock.show.findMany.mockResolvedValue([
        {
          id: 3,
          title: 'Cabaret',
          duration: 90,
          performances: [
            { startDateTime: new Date('2026-08-01T20:00:00.000Z') },
            { startDateTime: new Date('2026-08-02T20:00:00.000Z') },
          ],
        },
      ])

      const programme = await createDefaultVolunteerPorts().artists.getShowSchedule(7)

      expect(programme).toEqual([
        {
          id: 3,
          title: 'Cabaret',
          durationMinutes: 90,
          performances: [
            { startDateTime: '2026-08-01T20:00:00.000Z' },
            { startDateTime: '2026-08-02T20:00:00.000Z' },
          ],
        },
      ])
    })

    it('transmet une durée absente telle quelle, sans en inventer une', async () => {
      prismaMock.show.findMany.mockResolvedValue([
        {
          id: 4,
          title: 'Scène ouverte',
          duration: null,
          performances: [{ startDateTime: new Date('2026-08-01T20:00:00.000Z') }],
        },
      ])

      const programme = await createDefaultVolunteerPorts().artists.getShowSchedule(7)

      expect(programme[0]?.durationMinutes).toBeNull()
    })
  })
})
