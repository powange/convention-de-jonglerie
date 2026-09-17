import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/permissions/volunteer-permissions', () => ({
  requireVolunteerPlanningAccess: vi.fn(),
  isAcceptedVolunteer: vi.fn(),
}))

vi.mock('../../../../../server/utils/organizer-management', () => ({
  canManageEditionVolunteers: vi.fn(),
}))

vi.mock('../../../../../server/utils/editions/volunteers/responsables-equipe', () => ({
  equipesDontIlEstResponsable: vi.fn(async () => []),
  // L'appartenance décide de ce qu'on voit NOMMÉMENT ; la responsabilité, de QUAND.
  equipesDontIlEstMembre: vi.fn(async () => []),
}))

import {
  requireVolunteerPlanningAccess,
  isAcceptedVolunteer,
} from '#server/utils/permissions/volunteer-permissions'
import { equipesDontIlEstResponsable } from '#server/utils/editions/volunteers/responsables-equipe'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import creneauxDeLEdition from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteer-time-slots/index.get'
import mesCreneaux from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/my-slots.get'
import maCandidature from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/my-application.get'

const prismaMock = (globalThis as any).prisma
const mockAccesPlanning = requireVolunteerPlanningAccess as ReturnType<typeof vi.fn>
const mockEstBenevoleAccepte = isAcceptedVolunteer as ReturnType<typeof vi.fn>
const mockPeutGerer = canManageEditionVolunteers as ReturnType<typeof vi.fn>
const mockEquipesResponsable = equipesDontIlEstResponsable as ReturnType<typeof vi.fn>

const evenement = { context: { params: { id: '1' }, user: { id: 10 } } }

/** Le réglage de l'édition, tel que la garde le lit. */
const planningPublie = (publie: boolean | null) =>
  prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue(
    publie === null ? null : { planningPublished: publie }
  )

/**
 * Un responsable construit ses plannings par itérations. Tant que ce travail était immédiatement
 * visible, un bénévole accepté voyait apparaître puis disparaître des services au fil de la
 * journée — et notait dans son agenda des horaires qui n'existeraient plus le lendemain.
 *
 * Ces tests couvrent les surfaces qui exposaient les créneaux. Ils existent surtout pour une
 * raison : le module a déjà connu un réglage qui promettait de cacher et ne cachait qu'à
 * l'affichage, l'API rendant tout (`visibilite-equipes.ts`). Vérifier le masquage à l'endpoint,
 * et non à l'écran, est le seul contrôle qui vaille.
 */
describe('publication des plannings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ planningPublished: true })
    mockPeutGerer.mockResolvedValue(false)
    mockEquipesResponsable.mockResolvedValue([])
  })

  describe('le planning complet de l’édition (affectations nominatives)', () => {
    beforeEach(() => {
      mockAccesPlanning.mockResolvedValue({ id: 10 })
      prismaMock.volunteerTimeSlot.findMany.mockResolvedValue([])
    })

    it('refuse un bénévole tant que le planning n’est pas publié', async () => {
      // C'est la surface la plus large : elle rend pseudo, nom, prénom, courriel et photo de
      // chaque personne affectée.
      mockEstBenevoleAccepte.mockResolvedValue(true)
      planningPublie(false)

      await expect(creneauxDeLEdition(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
      expect(prismaMock.volunteerTimeSlot.findMany).not.toHaveBeenCalled()
    })

    it('ne lit pas les créneaux avant d’avoir vérifié', async () => {
      // L'ordre compte : lire puis refuser laisserait la requête s'exécuter, et un refus tardif
      // est un refus qu'un remaniement peut oublier de propager.
      mockEstBenevoleAccepte.mockResolvedValue(true)
      planningPublie(false)

      await expect(creneauxDeLEdition(evenement as any)).rejects.toBeDefined()

      expect(prismaMock.volunteerTimeSlot.findMany).not.toHaveBeenCalled()
    })

    it('laisse passer le bénévole une fois publié', async () => {
      mockEstBenevoleAccepte.mockResolvedValue(true)
      planningPublie(true)

      await expect(creneauxDeLEdition(evenement as any)).resolves.toEqual([])
    })

    it('laisse toujours passer un gestionnaire, publié ou non', async () => {
      // Sans cela, le réglage masquerait le planning à celui qui le construit.
      mockPeutGerer.mockResolvedValue(true)
      planningPublie(false)

      await expect(creneauxDeLEdition(evenement as any)).resolves.toEqual([])
    })

    it('laisse passer un gestionnaire QUI EST AUSSI bénévole accepté', async () => {
      // ⚠️ Le défaut signalé en production : `!isAcceptedVolunteer(...)` servait de « est
      // gestionnaire ». Un administrateur inscrit comme bénévole sur sa propre édition se voyait
      // refuser son propre planning, avec un message lui expliquant qu'il n'était pas publié —
      // alors que c'est lui qui le publie.
      mockEstBenevoleAccepte.mockResolvedValue(true)
      mockPeutGerer.mockResolvedValue(true)
      planningPublie(false)

      await expect(creneauxDeLEdition(evenement as any)).resolves.toEqual([])
    })

    it('laisse passer un responsable d’équipe, même bénévole accepté', async () => {
      // Il est de ceux qui construisent le planning. Un responsable ORGANISATEUR passait déjà
      // avant ce correctif — n'étant pas bénévole accepté, l'ancienne négation le laissait
      // entrer ; ne garder que le droit de gestion le lui aurait retiré.
      mockEstBenevoleAccepte.mockResolvedValue(true)
      mockPeutGerer.mockResolvedValue(false)
      mockEquipesResponsable.mockResolvedValue(['equipe-1'])
      planningPublie(false)

      await expect(creneauxDeLEdition(evenement as any)).resolves.toEqual([])
    })

    it('refuse un bénévole qui ne construit rien', async () => {
      // La garde doit rester une garde : ni gestionnaire, ni responsable d'aucune équipe.
      mockEstBenevoleAccepte.mockResolvedValue(true)
      mockPeutGerer.mockResolvedValue(false)
      mockEquipesResponsable.mockResolvedValue([])
      planningPublie(false)

      await expect(creneauxDeLEdition(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('n’interroge même pas le réglage pour un gestionnaire', async () => {
      // Son écran de planification appelle cet endpoint en boucle : la question est déjà
      // tranchée pour lui, inutile d'aller la reposer en base à chaque fois.
      mockPeutGerer.mockResolvedValue(true)

      await creneauxDeLEdition(evenement as any)

      expect(prismaMock.eventVolunteerSettings.findUnique).not.toHaveBeenCalled()
    })

    it('refuse quand l’édition n’a jamais rien configuré', async () => {
      // Une absence de réglage ne doit pas ouvrir ce qu'un réglage fermerait.
      mockEstBenevoleAccepte.mockResolvedValue(true)
      planningPublie(null)

      await expect(creneauxDeLEdition(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('ma candidature', () => {
    const candidature = {
      id: 5,
      status: 'ACCEPTED',
      user: { id: 10, pseudo: 'marie' },
      teamAssignments: [{ team: { id: 1, name: 'Bar - nuit' } }],
    }

    beforeEach(() => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(candidature)
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
    })

    it('ne rend aucun créneau tant que le planning n’est pas publié', async () => {
      planningPublie(false)

      const reponse: any = await maCandidature(evenement as any)

      expect(reponse.assignedTimeSlots).toEqual([])
      expect(prismaMock.volunteerAssignment.findMany).not.toHaveBeenCalled()
    })

    it('masque aussi l’affectation d’équipe', async () => {
      // Décidé : savoir qu'on est placé dans « Bar - nuit » est déjà un résultat du travail de
      // planification. Montrer l'équipe en cachant l'horaire laisserait deviner la moitié.
      planningPublie(false)

      const reponse: any = await maCandidature(evenement as any)

      expect(reponse.teamAssignments).toEqual([])
    })

    it('dit à l’écran pourquoi il n’a rien à afficher', async () => {
      // Sans ce drapeau, un bénévole accepté arrive sur une page vide et conclut à une erreur —
      // ou pire, qu'on l'a désaffecté.
      planningPublie(false)

      expect((await maCandidature(evenement as any))?.planningPublished).toBe(false)
    })

    it('rend l’équipe et les créneaux une fois publié', async () => {
      planningPublie(true)

      const reponse: any = await maCandidature(evenement as any)

      expect(reponse.planningPublished).toBe(true)
      expect(reponse.teamAssignments).toEqual(candidature.teamAssignments)
      expect(prismaMock.volunteerAssignment.findMany).toHaveBeenCalled()
    })
  })

  describe('mes créneaux, toutes origines', () => {
    beforeEach(() => {
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([
        {
          id: 1,
          assignedAt: new Date('2026-09-01'),
          timeSlot: { id: 1, startDateTime: new Date('2026-09-10'), assignments: [] },
        },
      ])
      prismaMock.organizerSlotAssignment.findMany.mockResolvedValue([
        {
          assignedAt: new Date('2026-09-01'),
          timeSlot: { id: 2, startDateTime: new Date('2026-09-11'), assignments: [] },
        },
      ])
    })

    it('masque les créneaux, quelle que soit leur origine', async () => {
      // Y COMPRIS ceux tenus comme organisateur : ils sont le résultat du même travail de
      // planification, ils se déplacent et se suppriment au fil des itérations. Les montrer
      // pendant la construction donnerait des horaires qu'on note et qui changeront.
      planningPublie(false)

      const reponse: any = await mesCreneaux(evenement as any)

      expect(reponse.data.slots).toEqual([])
    })

    it('n’oublie pas les créneaux d’organisateur — le piège de ce endpoint', async () => {
      // Ce test existe parce que la première version les exemptait. Il réunit deux sources, et
      // n'en filtrer qu'une laisse la moitié du planning visible sans que rien ne le signale.
      planningPublie(false)

      const reponse: any = await mesCreneaux(evenement as any)

      expect(reponse.data.slots.map((c: any) => c.origine)).not.toContain('ORGANIZER')
    })

    it('rend les deux une fois publié', async () => {
      planningPublie(true)

      const reponse: any = await mesCreneaux(evenement as any)

      expect(reponse.data.slots.map((c: any) => c.origine).sort()).toEqual([
        'ORGANIZER',
        'VOLUNTEER',
      ])
    })
  })
})
