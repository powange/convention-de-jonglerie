import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn(async () => true))
const mockEnvoyerCourriel = vi.hoisted(() => vi.fn(async () => true))
const mockNotifier = vi.hoisted(() => vi.fn(async () => ({})))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    organizers: { canManage: mockCanManage },
    email: { send: mockEnvoyerCourriel },
  }),
}))

vi.mock('#server/utils/notification-service', () => ({
  NotificationService: { create: mockNotifier },
}))

vi.mock('#server/utils/emailService', () => ({
  generateVolunteerScheduleEmailHtml: vi.fn(async () => '<p>planning</p>'),
  getSiteUrl: vi.fn(() => 'https://exemple.test'),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/notify-schedules.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * POST /api/editions/[id]/volunteers/notify-schedules — publier le planning.
 *
 * ⚠️ CE POINT D'API N'AVAIT AUCUN TEST, et il fait trois choses qui ne se rattrapent pas : il
 * publie le planning (donc découvre les créneaux à tous les bénévoles), il envoie une notification
 * et un courriel à chacun. Rien de tout cela ne se reprend une fois parti.
 *
 * ⚠️ LA DIFFUSION A LIEU APRÈS LA RÉPONSE (`apresLaReponse`). Dans les tests, l'événement est un
 * objet nu sans `waitUntil`, donc le repli `setImmediate` s'applique : les envois ne sont PAS
 * terminés quand le handler rend. D'où le `await attendreLaDiffusion()` avant d'asserter sur les
 * envois — sans lui, les assertions porteraient sur des mocks encore vides et le fichier passerait
 * au vert en ne prouvant rien.
 */

const EDITION = 22

const evenement = { context: { params: { id: String(EDITION) }, user: { id: 1 } } }

/**
 * Vide la file de macrotâches, où `setImmediate` a déposé la diffusion.
 *
 * ⚠️ PLUSIEURS TOURS, et non un seul. La diffusion enchaîne des `await` — la notification, la
 * génération du courriel, l'envoi — donc un unique `setImmediate` la laisse à mi-chemin. Et une
 * diffusion à mi-chemin ne s'arrête pas à la fin du test : elle reprend pendant le SUIVANT et
 * gonfle ses compteurs. C'est ce qui est arrivé en écrivant ce fichier — un test comptait deux
 * envois là où il en attendait un, à cause du test précédent.
 *
 * D'où aussi le `afterEach` : chaque test rend la file vide au suivant.
 */
const attendreLaDiffusion = async () => {
  for (let tour = 0; tour < 20; tour++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

const benevole = (id: number, equipes: any[] = []) => ({
  id,
  user: {
    id,
    email: `b${id}@exemple.test`,
    pseudo: `b${id}`,
    prenom: 'Bé',
    preferredLanguage: 'fr',
  },
  teamAssignments: equipes.map((team) => ({ team })),
})

const creneau = (userId: number) => ({
  userId,
  timeSlot: {
    startDateTime: new Date('2026-08-01T08:00:00Z'),
    endDateTime: new Date('2026-08-01T12:00:00Z'),
    delayMinutes: 0,
    team: { name: 'Bar' },
  },
})

describe('publier le planning des bénévoles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    mockEnvoyerCourriel.mockResolvedValue(true)
    global.readBody = vi.fn().mockResolvedValue({})
    prismaMock.eventVolunteerSettings.upsert.mockResolvedValue({})
    prismaMock.event.findUnique.mockResolvedValue({ name: 'EJC' })
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevole(1)])
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([creneau(1)])
  })

  // Aucun reste de diffusion ne doit franchir la frontière d'un test.
  afterEach(attendreLaDiffusion)

  it('publie le planning AVANT de diffuser', async () => {
    /*
     * L'ordre est essentiel : si la publication n'était enregistrée qu'après une diffusion réussie,
     * un échec d'envoi laisserait l'écran masquer des créneaux dont les bénévoles ont déjà reçu le
     * détail par courriel — des horaires connus, introuvables en ligne, et impossible de savoir
     * lesquels font foi.
     */
    mockEnvoyerCourriel.mockRejectedValue(new Error('service de courriel indisponible'))

    await handler(evenement as any)
    await attendreLaDiffusion()

    expect(prismaMock.eventVolunteerSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { planningPublished: true },
        create: { eventId: EDITION, planningPublished: true },
      })
    )
  })

  it('ne demande les affectations QU’UNE FOIS, pour toute l’édition', async () => {
    // Le cœur du lot : il y avait une requête PAR bénévole, à la file. Trois bénévoles, une seule
    // requête — et elle porte sur l'édition, pas sur une personne.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      benevole(1),
      benevole(2),
      benevole(3),
    ])
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([creneau(1), creneau(2), creneau(3)])

    await handler(evenement as any)
    await attendreLaDiffusion()

    expect(prismaMock.volunteerAssignment.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.volunteerAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { timeSlot: { eventId: EDITION } } })
    )
  })

  it('rend le compte des DESTINATAIRES sans attendre les envois', async () => {
    // La réponse part avant la diffusion : elle ne peut donc pas annoncer des succès. `count` est
    // le nombre de personnes à qui l'on écrit, et c'est ce que le champ signifie désormais.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevole(1), benevole(2)])
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([creneau(1)])

    const reponse: any = await handler(evenement as any)

    // Aucun envoi encore parti à cet instant : c'est précisément ce qu'on veut.
    expect(mockEnvoyerCourriel).not.toHaveBeenCalled()
    expect(reponse.data).toMatchObject({ count: 1, total: 2 })
  })

  describe('à qui l’on écrit', () => {
    it('écarte par défaut les bénévoles sans aucun créneau', async () => {
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(1),
        benevole(2), // sans créneau
      ])
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([creneau(1)])

      await handler(evenement as any)
      await attendreLaDiffusion()

      expect(mockEnvoyerCourriel).toHaveBeenCalledTimes(1)
      expect(mockEnvoyerCourriel).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'b1@exemple.test' })
      )
    })

    it('les inclut sur demande explicite', async () => {
      global.readBody = vi.fn().mockResolvedValue({ inclureSansCreneau: true })
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevole(1), benevole(2)])
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([creneau(1)])

      await handler(evenement as any)
      await attendreLaDiffusion()

      expect(mockEnvoyerCourriel).toHaveBeenCalledTimes(2)
    })

    it('n’écrit JAMAIS à un volant sans créneau, même sur demande explicite', async () => {
      /*
       * Pour lui, l'absence de créneau n'est pas un retard de planification : c'est sa situation.
       * Le message de repli annonce que « les créneaux arriveront bientôt » — il ne viendra pas.
       */
      global.readBody = vi.fn().mockResolvedValue({ inclureSansCreneau: true })
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(2, [{ isFloatingTeam: true, isAutonomousTeam: false }]),
      ])
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([])

      await handler(evenement as any)
      await attendreLaDiffusion()

      expect(mockEnvoyerCourriel).not.toHaveBeenCalled()
    })

    it('n’écrit pas non plus à un réservé à une équipe autonome', async () => {
      // Ses heures ne se décident pas ici : son équipe se gère à part.
      global.readBody = vi.fn().mockResolvedValue({ inclureSansCreneau: true })
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(3, [{ isFloatingTeam: false, isAutonomousTeam: true }]),
      ])
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([])

      await handler(evenement as any)
      await attendreLaDiffusion()

      expect(mockEnvoyerCourriel).not.toHaveBeenCalled()
    })

    it('écrit à un volant QUI A un créneau', async () => {
      // La règle porte sur le repli, pas sur la personne : un volant à qui l'on a confié un
      // renfort doit connaître son horaire comme tout le monde.
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(1, [{ isFloatingTeam: true, isAutonomousTeam: false }]),
      ])
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([creneau(1)])

      await handler(evenement as any)
      await attendreLaDiffusion()

      expect(mockEnvoyerCourriel).toHaveBeenCalledTimes(1)
    })

    it('écrit à quelqu’un dont UNE équipe seulement est autonome', async () => {
      // La double appartenance annule la réserve : rattacher quelqu'un à une seconde équipe, c'est
      // avoir décidé de le partager. Même règle que le reste du module.
      global.readBody = vi.fn().mockResolvedValue({ inclureSansCreneau: true })
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(4, [{ isAutonomousTeam: true }, { isAutonomousTeam: false }]),
      ])
      prismaMock.volunteerAssignment.findMany.mockResolvedValue([])

      await handler(evenement as any)
      await attendreLaDiffusion()

      expect(mockEnvoyerCourriel).toHaveBeenCalledTimes(1)
    })
  })

  it('un échec dans une tranche ne prive pas la tranche SUIVANTE', async () => {
    /*
     * ⚠️ CE TEST A D'ABORD ÉTÉ ÉCRIT AVEC TROIS BÉNÉVOLES, et il ne prouvait RIEN : retirer le
     * `try/catch`, remplacer `allSettled` par `all`, retirer les deux — il restait vert.
     *
     * La raison est instructive : à l'intérieur d'une tranche, `map` démarre tous les envois
     * d'emblée, donc un échec ne peut pas empêcher ses voisins d'être tentés. Ce qui est en jeu,
     * c'est la tranche SUIVANTE — avec `all` qui rejette, la boucle s'arrête et le reste ne part
     * jamais. Il faut donc DÉPASSER la taille de tranche (10) pour que la question existe : d'où
     * douze destinataires, et l'échec placé dans la première tranche.
     *
     * Ce que ce test attrape exactement, mesuré : retirer `allSettled` SEUL ne le fait pas tomber,
     * ni retirer le `try/catch` SEUL — les deux protections sont alternatives. Il faut les retirer
     * toutes les deux, et alors il rend 10 au lieu de 12. C'est donc la tolérance aux échecs qu'il
     * verrouille, sans pouvoir désigner lequel des deux mécanismes l'assure.
     */
    const douze = Array.from({ length: 12 }, (_, i) => benevole(i + 1))
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue(douze)
    prismaMock.volunteerAssignment.findMany.mockResolvedValue(douze.map((b) => creneau(b.user.id)))
    mockEnvoyerCourriel.mockRejectedValueOnce(new Error('boîte pleine'))

    await handler(evenement as any)
    await attendreLaDiffusion()

    // Les douze tentés, y compris les deux de la seconde tranche.
    expect(mockEnvoyerCourriel).toHaveBeenCalledTimes(12)
  })

  it('refuse sans le droit de gestion, avant de rien publier', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toMatchObject({ status: 403 })
    expect(prismaMock.eventVolunteerSettings.upsert).not.toHaveBeenCalled()
  })

  it('accepte un corps vide', async () => {
    // Le cas courant : le client n'envoyait rien avant ce lot, et un ancien onglet n'enverra
    // toujours rien. Un schéma qui exigerait le champ casserait la publication.
    global.readBody = vi.fn().mockRejectedValue(new Error('pas de corps'))

    const reponse: any = await handler(evenement as any)

    expect(reponse.data.count).toBe(1)
  })
})
