import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  compterNonLusParConversation,
  messengerUnreadService,
} from '#server/utils/messenger-unread-service'

const prismaMock = (globalThis as any).prisma

/**
 * Le comptage des messages non lus.
 *
 * Il se faisait par un `message.count` PAR conversation, et le même code vivait en trois endroits :
 * le service, `GET /api/messenger/unread-count`, et la liste des conversations. Il est de plus
 * rejoué pour chaque destinataire à chaque envoi de message.
 *
 * ⚠️ CE QUE CES TESTS NE PROUVENT PAS. La requête est du SQL écrit à la main : un mock de
 * `$queryRaw` rend ce qu'on lui donne, il ne l'exécute pas. Ces cas vérifient la plomberie autour
 * — conversion des `BigInt`, somme, compte séparé des conversations. La JUSTESSE du SQL lui-même se
 * vérifie sur une vraie base, dans `test/integration/messenger-non-lus.db.test.ts`.
 */
describe('compterNonLusParConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('indexe les non-lus par conversation', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { conversationId: 'conv-a', nonLus: 3 },
      { conversationId: 'conv-b', nonLus: 1 },
    ])

    const carte = await compterNonLusParConversation(42)

    expect(carte.get('conv-a')).toBe(3)
    expect(carte.get('conv-b')).toBe(1)
  })

  it('convertit les BigInt que MySQL rend pour un COUNT', async () => {
    // Sans cette conversion, la valeur casse la sérialisation JSON de la réponse : « Do not know
    // how to serialize a BigInt ». Le défaut n'apparaît qu'à l'exécution, sur une vraie base.
    prismaMock.$queryRaw.mockResolvedValue([{ conversationId: 'conv-a', nonLus: 7n }])

    const carte = await compterNonLusParConversation(42)

    expect(carte.get('conv-a')).toBe(7)
    expect(typeof carte.get('conv-a')).toBe('number')
  })

  it('rend une carte vide quand rien n’est non lu', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    const carte = await compterNonLusParConversation(42)

    expect(carte.size).toBe(0)
    // Une conversation absente vaut zéro, ce qui est le comportement attendu des appelants.
    expect(carte.get('conv-a')).toBeUndefined()
  })

  it('n’interroge la base qu’une seule fois', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await compterNonLusParConversation(42)

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    // Et surtout : plus aucun `message.count`, qui était joué une fois par conversation.
    expect(prismaMock.message.count).not.toHaveBeenCalled()
  })
})

describe('messengerUnreadService.getUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('somme les non-lus et compte les conversations à part', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { conversationId: 'conv-a', nonLus: 3 },
      { conversationId: 'conv-b', nonLus: 2 },
    ])
    // Cinq participations actives, dont trois sans aucun message non lu.
    prismaMock.conversationParticipant.count.mockResolvedValue(5)

    const resultat = await messengerUnreadService.getUnreadCount(42)

    expect(resultat).toEqual({ unreadCount: 5, conversationCount: 5 })
  })

  it('compte les conversations même quand aucune n’a de non-lu', async () => {
    /*
     * Le piège de ce remaniement. La requête est une JOINTURE : une conversation sans message non lu
     * n'apparaît pas dans son résultat. Déduire `conversationCount` de la taille de la carte
     * donnerait donc zéro conversation à quelqu'un qui en a quatre, toutes lues — et l'écran
     * afficherait « aucune conversation ».
     */
    prismaMock.$queryRaw.mockResolvedValue([])
    prismaMock.conversationParticipant.count.mockResolvedValue(4)

    const resultat = await messengerUnreadService.getUnreadCount(42)

    expect(resultat).toEqual({ unreadCount: 0, conversationCount: 4 })
  })

  it('ne compte que les participations actives', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])
    prismaMock.conversationParticipant.count.mockResolvedValue(0)

    await messengerUnreadService.getUnreadCount(42)

    expect(prismaMock.conversationParticipant.count).toHaveBeenCalledWith({
      where: { userId: 42, leftAt: null },
    })
  })

  it('tient en deux requêtes, quel que soit le nombre de conversations', async () => {
    prismaMock.$queryRaw.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ conversationId: `conv-${i}`, nonLus: 1 }))
    )
    prismaMock.conversationParticipant.count.mockResolvedValue(30)

    const resultat = await messengerUnreadService.getUnreadCount(42)

    expect(resultat.unreadCount).toBe(30)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prismaMock.conversationParticipant.count).toHaveBeenCalledTimes(1)
    expect(prismaMock.message.count).not.toHaveBeenCalled()
    // Et la liste des participations n'est plus chargée du tout : seul leur nombre importe.
    expect(prismaMock.conversationParticipant.findMany).not.toHaveBeenCalled()
  })
})
