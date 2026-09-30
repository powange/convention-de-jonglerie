import { describe, it, expect, beforeEach, vi } from 'vitest'

const responsablesDeLEquipe = vi.hoisted(() => vi.fn(async () => [] as number[]))

vi.mock('../../../../server/utils/editions/volunteers/responsables-equipe', () => ({
  utilisateursResponsablesDeLEquipe: responsablesDeLEquipe,
}))

import {
  assurerConversationsEquipeDesMembres,
  ensureVolunteerConversations,
} from '../../../../server/utils/messenger-helpers'

const prismaMock = (globalThis as any).prisma

/**
 * La synchronisation des conversations d'une équipe, faite pour toute l'équipe d'un coup.
 *
 * ⚠️ CE QUE CETTE FONCTION REMPLACE. L'ouverture de la discussion d'équipe appelait la version à
 * une personne pour le demandeur PUIS pour chacun des membres acceptés, en série. Chaque appel
 * coûtait de quatre à huit requêtes, dont un `findMany` sur tous les fils privés de l'équipe avec
 * leurs participants — requête identique d'un membre au suivant. Pour une équipe de quarante
 * personnes, un clic valait ≈ 250 requêtes séquentielles avant que le premier message ne
 * s'affiche.
 *
 * ⚠️ POURQUOI ON NE POUVAIT PAS SIMPLEMENT « SAUTER LES MEMBRES DÉJÀ PARTICIPANTS », qui était la
 * correction proposée. Les participants du groupe sont bien posés à l'affectation (`teams.ts`),
 * mais nommer un responsable ne passe PAS par là : `setTeamLeader` se borne à écrire `isLeader`.
 * Les fils privés « membre ⇄ responsables » des membres déjà en place ne sont donc créés par
 * personne — sauf par ce rattrapage. Sauter un membre au motif qu'il est déjà dans le groupe lui
 * retirerait son fil avec ses responsables, sans erreur et sans que rien ne le signale.
 *
 * Ce fichier éprouve donc les deux exigences ensemble : le coût, et le rattrapage.
 */

const EDITION = 3
const EQUIPE = 'team-1'
const GROUPE = 'conv-groupe'

const participant = (id: string, userId: number, leftAt: Date | null = null) => ({
  id,
  userId,
  leftAt,
})

describe('assurerConversationsEquipeDesMembres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    responsablesDeLEquipe.mockResolvedValue([])
    // La conversation de groupe existe déjà, cas de loin le plus courant.
    prismaMock.conversation.findFirst.mockResolvedValue({ id: GROUPE })
    prismaMock.conversation.findMany.mockResolvedValue([])
    prismaMock.conversationParticipant.findMany.mockResolvedValue([])
    prismaMock.conversationParticipant.createMany.mockResolvedValue({ count: 0 })
    prismaMock.conversationParticipant.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.conversation.create.mockResolvedValue({ id: 'conv-neuve', participants: [] })
  })

  it('n’écrit RIEN quand tout est déjà en place', async () => {
    /*
     * 🔬 L'assertion qui mesure le gain. Une équipe déjà synchronisée, sans responsable : trois
     * lectures, zéro écriture. C'est le cas de la quasi-totalité des ouvertures.
     */
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      participant('p1', 1),
      participant('p2', 2),
    ])

    await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1, 2])

    expect(prismaMock.conversationParticipant.createMany).not.toHaveBeenCalled()
    expect(prismaMock.conversationParticipant.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.conversation.create).not.toHaveBeenCalled()
  })

  it('inscrit en UNE écriture tous les membres absents', async () => {
    // Le point de la version en lot : un `createMany`, pas un `create` par personne.
    prismaMock.conversationParticipant.findMany.mockResolvedValue([participant('p1', 1)])

    await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1, 2, 3])

    expect(prismaMock.conversationParticipant.createMany).toHaveBeenCalledTimes(1)
    const { data, skipDuplicates } = prismaMock.conversationParticipant.createMany.mock.calls[0][0]
    expect(data).toEqual([
      { conversationId: GROUPE, userId: 2 },
      { conversationId: GROUPE, userId: 3 },
    ])
    /*
     * ⚠️ Deux ouvertures simultanées de la même discussion passeraient ici avec la même liste. La
     * contrainte d'unicité (conversationId, userId) ferait échouer la seconde, et l'ouverture
     * rendrait 500 à qui n'a rien fait de mal.
     */
    expect(skipDuplicates).toBe(true)
  })

  it('ne demande les participants que pour les membres concernés', async () => {
    /*
     * La requête ne doit pas ramener les participants de toute la conversation : sur une équipe
     * restreinte d'une édition à plusieurs centaines de bénévoles, ce serait charger pour rien.
     * On mesure la FORME de la requête, que le mock ignore par ailleurs.
     */
    await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1, 2])

    const where = prismaMock.conversationParticipant.findMany.mock.calls[0][0].where
    expect(where.conversationId).toBe(GROUPE)
    expect(where.userId).toEqual({ in: [1, 2] })
  })

  it('réactive en UNE écriture ceux qui avaient été retirés', async () => {
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      participant('p1', 1),
      participant('p2', 2, new Date('2026-01-01')),
      participant('p3', 3, new Date('2026-01-02')),
    ])

    await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1, 2, 3])

    expect(prismaMock.conversationParticipant.updateMany).toHaveBeenCalledTimes(1)
    const appel = prismaMock.conversationParticipant.updateMany.mock.calls[0][0]
    expect(appel.where.id).toEqual({ in: ['p2', 'p3'] })
    expect(appel.data).toEqual({ leftAt: null })
  })

  it('dédoublonne la liste reçue', async () => {
    // Le demandeur est passé explicitement en plus des membres, où il figure déjà.
    await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1, 1, 2, 2, 2])

    expect(prismaMock.conversationParticipant.findMany.mock.calls[0][0].where.userId).toEqual({
      in: [1, 2],
    })
  })

  it('ne fait rien du tout sur une liste vide', async () => {
    await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [])

    expect(prismaMock.conversation.findFirst).not.toHaveBeenCalled()
  })

  it('crée la conversation de groupe quand elle n’existe pas', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null)
    prismaMock.conversation.create.mockResolvedValue({ id: 'conv-creee', participants: [] })

    await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1])

    expect(prismaMock.conversation.create.mock.calls[0][0].data).toMatchObject({
      editionId: EDITION,
      teamId: EQUIPE,
      type: 'TEAM_GROUP',
    })
  })

  describe('les fils privés avec les responsables', () => {
    it('ne lit les fils existants qu’UNE FOIS pour toute l’équipe', async () => {
      /*
       * 🔬 LA REQUÊTE QUI COÛTAIT LE PLUS CHER. Elle ramène tous les fils privés de l'équipe AVEC
       * leurs participants, et elle était rejouée à l'identique pour chacun des quarante membres.
       */
      responsablesDeLEquipe.mockResolvedValue([9])
      prismaMock.conversation.findMany.mockResolvedValue([])

      await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1, 2, 3, 4, 5])

      expect(prismaMock.conversation.findMany).toHaveBeenCalledTimes(1)
    })

    it('crée le fil manquant d’un membre DÉJÀ participant du groupe', async () => {
      /*
       * 🔬 LE TEST QUI INTERDIT L'OPTIMISATION NAÏVE. Le membre 1 est déjà dans la conversation de
       * groupe : « ne synchroniser que les absents » l'aurait sauté. Or son fil privé avec le
       * responsable 9 n'existe pas — parce que 9 a été nommé responsable APRÈS son affectation, et
       * que nommer un responsable ne synchronise rien.
       *
       * Sans ce rattrapage, ce membre n'aurait jamais de fil avec ses responsables, et personne ne
       * s'en apercevrait.
       */
      responsablesDeLEquipe.mockResolvedValue([9])
      prismaMock.conversationParticipant.findMany.mockResolvedValue([participant('p1', 1)])
      prismaMock.conversation.findMany.mockResolvedValue([])

      await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1])

      const creations = prismaMock.conversation.create.mock.calls.filter(
        (appel: any) => appel[0].data.type === 'TEAM_LEADER_PRIVATE'
      )
      expect(creations).toHaveLength(1)
      expect(creations[0][0].data.participants.create).toEqual([{ userId: 1 }, { userId: 9 }])
    })

    it('ne recrée PAS un fil qui existe déjà', async () => {
      responsablesDeLEquipe.mockResolvedValue([9])
      prismaMock.conversation.findMany.mockResolvedValue([
        { id: 'fil-1', participants: [participant('a', 1), participant('b', 9)] },
      ])

      await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1])

      expect(prismaMock.conversation.create).not.toHaveBeenCalled()
    })

    it('n’ouvre AUCUN fil au seul responsable de son équipe', async () => {
      // Il n'a personne à qui écrire en privé : le fil serait un monologue.
      responsablesDeLEquipe.mockResolvedValue([1])

      await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1])

      expect(prismaMock.conversation.create).not.toHaveBeenCalled()
    })

    it('ouvre à un responsable un fil avec les AUTRES responsables', async () => {
      responsablesDeLEquipe.mockResolvedValue([1, 9])

      await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1])

      const creation = prismaMock.conversation.create.mock.calls[0][0]
      expect(creation.data.participants.create).toEqual([{ userId: 1 }, { userId: 9 }])
    })

    it('ne crée qu’UN SEUL fil pour deux responsables qui attendent le même', async () => {
      /*
       * ⚠️⚠️ LE PIÈGE PROPRE À LA VERSION EN LOT, ET IL EST SILENCIEUX. Deux responsables d'une
       * même équipe attendent le MÊME fil : pour 1, c'est {1, 9} ; pour 9, c'est {9, 1}. La
       * version à une personne relisait la base à chaque appel et retrouvait donc celui que
       * l'appel précédent venait de créer.
       *
       * Ici la liste des fils est lue UNE seule fois. Sans réinjecter le fil créé dans cette liste
       * en mémoire, le second responsable en créerait un DOUBLON — et les deux se retrouveraient
       * chacun dans un fil distinct où l'autre ne lirait jamais rien. Aucune erreur, aucun test
       * d'endpoint ne le verrait.
       */
      responsablesDeLEquipe.mockResolvedValue([1, 9])
      prismaMock.conversation.findMany.mockResolvedValue([])
      prismaMock.conversation.create.mockImplementation(async (appel: any) => ({
        id: 'fil-neuf',
        participants: appel.data.participants.create.map((p: any, index: number) =>
          participant(`n${index}`, p.userId)
        ),
      }))

      await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1, 9])

      const creations = prismaMock.conversation.create.mock.calls.filter(
        (appel: any) => appel[0].data.type === 'TEAM_LEADER_PRIVATE'
      )
      expect(creations).toHaveLength(1)
    })

    it('reconnaît un fil aux participants ACTIFS, en ignorant ceux qui sont partis', async () => {
      // Un tiers qui a quitté le fil ne doit pas empêcher de le reconnaître.
      responsablesDeLEquipe.mockResolvedValue([9])
      prismaMock.conversation.findMany.mockResolvedValue([
        {
          id: 'fil-1',
          participants: [
            participant('a', 1),
            participant('b', 9),
            participant('c', 42, new Date('2026-01-01')),
          ],
        },
      ])

      await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1])

      expect(prismaMock.conversation.create).not.toHaveBeenCalled()
    })

    it('ne cherche aucun fil quand l’équipe n’a pas de responsable', async () => {
      responsablesDeLEquipe.mockResolvedValue([])

      await assurerConversationsEquipeDesMembres(EDITION, EQUIPE, [1, 2])

      expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
    })
  })
})

describe('ensureVolunteerConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    responsablesDeLEquipe.mockResolvedValue([])
    prismaMock.conversation.findFirst.mockResolvedValue({ id: GROUPE })
    prismaMock.conversation.findMany.mockResolvedValue([])
    prismaMock.conversationParticipant.findMany.mockResolvedValue([])
    prismaMock.conversationParticipant.createMany.mockResolvedValue({ count: 1 })
  })

  it('traite UNE personne, en passant par la version en lot', async () => {
    /*
     * L'affectation d'un bénévole et le rattachement d'un organisateur continuent d'appeler cette
     * porte-là. Elle n'a plus d'implémentation propre : deux copies de cette logique divergeraient.
     */
    await ensureVolunteerConversations(EDITION, EQUIPE, 7)

    expect(prismaMock.conversationParticipant.findMany.mock.calls[0][0].where.userId).toEqual({
      in: [7],
    })
    expect(prismaMock.conversationParticipant.createMany.mock.calls[0][0].data).toEqual([
      { conversationId: GROUPE, userId: 7 },
    ])
  })
})
