import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { H3Event } from 'h3'

const envoyerMessage = vi.hoisted(() => vi.fn(async () => true))
const envoyerModification = vi.hoisted(() => vi.fn(async () => true))
const envoyerLecture = vi.hoisted(() => vi.fn(async () => true))

vi.mock('../../../../../../server/utils/notification-stream-manager', () => ({
  notificationStreamManager: {
    sendMessengerMessage: envoyerMessage,
    sendMessengerMessageUpdated: envoyerModification,
    sendMessengerRead: envoyerLecture,
    sendMessengerNewMessage: vi.fn(async () => true),
    sendMessengerUnreadCount: vi.fn(async () => true),
  },
}))

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, pseudo: 'TestUser' })),
}))

vi.mock('../../../../../../server/utils/push-notification-service', () => ({
  pushNotificationService: { sendToUser: vi.fn() },
}))

vi.mock('../../../../../../server/utils/unified-push-service', () => ({
  unifiedPushService: { sendToUser: vi.fn() },
}))

import envoyer from '../../../../../../server/api/messenger/conversations/[conversationId]/messages/index.post'
import modifier from '../../../../../../server/api/messenger/conversations/[conversationId]/messages/[messageId].patch'
import marquerLu from '../../../../../../server/api/messenger/conversations/[conversationId]/mark-read.patch'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * La messagerie en DIFFUSION, à la place du sondage.
 *
 * ⚠️ CE QUE CES TESTS REMPLACENT. Le flux par conversation interrogeait la base toutes les cinq
 * secondes, PAR CONNEXION OUVERTE : les nouveaux messages, ceux modifiés ou supprimés, puis le
 * `lastReadMessageId` de chaque autre participant. Trois requêtes, pour trouver le plus souvent
 * rien — et dix personnes sur une conversation, c'était trente requêtes toutes les cinq secondes.
 *
 * Or les trois informations sont connues de celui qui les écrit. Ces tests vérifient qu'elles
 * partent bien, à CHAQUE participant actif, et à la forme que le client attend.
 *
 * ⚠️ Ils portent sur les APPELS au gestionnaire de flux, et non sur ce qu'un navigateur affiche.
 * C'est la limite de ce lot, et elle est réelle : prouver que l'écran se met à jour demanderait
 * deux navigateurs authentifiés sur la même conversation, ce que la suite ne sait pas faire.
 */

const CONVERSATION = 'conv-1'

const conversation = {
  id: CONVERSATION,
  type: 'TEAM_GROUP',
  teamId: 'team-1',
  editionId: 1,
  team: { name: 'Équipe Test' },
  edition: { id: 1, name: 'Édition', convention: { name: 'Convention' } },
  participants: [{ userId: 2 }, { userId: 3 }],
}

const participant = {
  id: 'participant-1',
  userId: 1,
  conversationId: CONVERSATION,
  conversation,
}

const message = {
  id: 'msg-1',
  conversationId: CONVERSATION,
  participantId: 'participant-1',
  content: 'Bonjour',
  replyToId: null,
  /*
   * ⚠️ RELATIVE À MAINTENANT, et ce n'est pas un détail de confort. La date était figée au
   * 30 septembre 2026 à 10 h 00 UTC : la modification d'un message n'étant permise que pendant
   * quinze minutes, les deux tests du PATCH ont passé jusqu'à 10 h 15 ce jour-là, puis ont échoué
   * définitivement — sur un « Un message ne peut plus être modifié » qui ressemble à une
   * régression du code alors que c'est la fixture qui a vieilli.
   *
   * Une date d'envoi figée dans une règle qui compare à l'instant présent est une bombe à
   * retardement : elle part verte, et le jour où elle explose, elle accuse le lot en cours.
   */
  createdAt: new Date(),
  editedAt: null,
  deletedAt: null,
  participant: { id: 'participant-1', user: { id: 1, pseudo: 'TestUser' } },
  replyTo: null,
}

describe('POST messages — diffuse le message complet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => CONVERSATION)
    global.readBody = vi.fn().mockResolvedValue({ content: 'Bonjour' })
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([])
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([])
    prismaMock.conversationParticipant.findFirst.mockResolvedValue(participant)
    prismaMock.message.create.mockResolvedValue(message)
    prismaMock.conversation.update.mockResolvedValue({})
    prismaMock.message.findMany.mockResolvedValue([{ id: 'msg-1', createdAt: new Date() }])
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      { userId: 2, lastReadMessageId: null },
      { userId: 3, lastReadMessageId: null },
    ])
  })

  it('pousse le message à CHAQUE autre participant', async () => {
    await envoyer({} as H3Event)
    // La diffusion part sans bloquer la réponse : laisser tourner la microfile.
    await Promise.resolve()
    await Promise.resolve()

    expect(envoyerMessage).toHaveBeenCalledTimes(2)
    expect(envoyerMessage).toHaveBeenCalledWith(2, expect.objectContaining({ id: 'msg-1' }))
    expect(envoyerMessage).toHaveBeenCalledWith(3, expect.objectContaining({ id: 'msg-1' }))
  })

  it('ne se pousse PAS le message à soi-même', async () => {
    // L'auteur le reçoit par la réponse de l'envoi. Se le pousser en plus l'afficherait deux fois,
    // ou obligerait le client à dédoublonner ce que le serveur n'aurait pas dû envoyer.
    await envoyer({} as H3Event)
    await Promise.resolve()

    expect(envoyerMessage).not.toHaveBeenCalledWith(1, expect.anything())
  })

  it('diffuse EXACTEMENT la forme rendue par la réponse', async () => {
    /*
     * L'invariant qui compte. Le client insère l'objet diffusé tel quel dans sa liste ; s'il
     * différait de ce que rend le GET, le message affiché en direct ne ressemblerait pas à celui
     * qu'un rechargement montre — et la différence se verrait sur la citation ou l'auteur.
     */
    const reponse: any = await envoyer({} as H3Event)
    await Promise.resolve()

    const diffuse = envoyerMessage.mock.calls[0]?.[1]
    expect(diffuse).toEqual(reponse.data)
    // Et `participantId` n'y est pas : il ne sert qu'à la jointure.
    expect(diffuse).not.toHaveProperty('participantId')
  })
})

describe('PATCH message — diffuse la modification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn((_e: unknown, nom: string) =>
      nom === 'conversationId' ? CONVERSATION : 'msg-1'
    )
    global.readBody = vi.fn().mockResolvedValue({ content: 'Corrigé' })
    prismaMock.message.findFirst.mockResolvedValue({ ...message, deletedAt: null })
    prismaMock.message.update.mockResolvedValue({ ...message, content: 'Corrigé' })
    prismaMock.conversationParticipant.findMany.mockResolvedValue([{ userId: 2 }, { userId: 3 }])
  })

  it('pousse la modification aux autres participants', async () => {
    await modifier({} as H3Event)
    await Promise.resolve()

    expect(envoyerModification).toHaveBeenCalledTimes(2)
    expect(envoyerModification).toHaveBeenCalledWith(2, expect.objectContaining({ id: 'msg-1' }))
  })

  it('ne demande que les participants ACTIFS', async () => {
    /*
     * `leftAt: null`, comme les points d'API de lecture. Sans cette condition, quelqu'un qui a
     * quitté la conversation continuerait d'en recevoir les messages par le flux — un accès que la
     * liste lui refuse, rouvert par une porte de derrière. C'est exactement le défaut que le lot
     * sur les candidatures refusées a fermé ailleurs.
     */
    await modifier({} as H3Event)

    expect(prismaMock.conversationParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: CONVERSATION, leftAt: null, userId: { not: 1 } },
      })
    )
  })

  it('diffuse la même forme que la réponse, message supprimé compris', async () => {
    // Un message supprimé est masqué par `masquerMessageSupprime` : le diffuser en clair
    // montrerait aux autres le texte qu'on vient justement de retirer.
    global.readBody = vi.fn().mockResolvedValue({ deleted: true })
    prismaMock.message.update.mockResolvedValue({
      ...message,
      deletedAt: new Date('2026-09-30T11:00:00Z'),
    })

    const reponse: any = await modifier({} as H3Event)
    await Promise.resolve()

    const diffuse: any = envoyerModification.mock.calls[0]?.[1]
    expect(diffuse).toEqual(reponse.data)
    // Chaîne vide côté serveur ; le libellé se traduit chez le client. L'invariant du lot 8
    // reste entier : le GET et le flux passent par la MÊME fonction et rendent la même forme.
    expect(diffuse.content).toBe('')
  })
})

describe('PATCH mark-read — diffuse l’avancée de lecture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => CONVERSATION)
    global.readBody = vi.fn().mockResolvedValue({ messageId: 'msg-1' })
    prismaMock.conversationParticipant.findFirst.mockResolvedValue({
      id: 'participant-1',
      userId: 1,
    })
    prismaMock.message.findFirst.mockResolvedValue({ id: 'msg-1', conversationId: CONVERSATION })
    prismaMock.conversationParticipant.update.mockResolvedValue({})
    prismaMock.conversationParticipant.findMany.mockResolvedValue([{ userId: 2 }, { userId: 3 }])
  })

  it('prévient les autres participants, en nommant le lecteur', async () => {
    await marquerLu({} as H3Event)
    await Promise.resolve()

    expect(envoyerLecture).toHaveBeenCalledTimes(2)
    // `readerId` et non `userId` : le premier argument est DÉJÀ le destinataire de l'événement, et
    // deux champs nommés pareil pour des personnes différentes sont une confusion en attente.
    expect(envoyerLecture).toHaveBeenCalledWith(2, {
      conversationId: CONVERSATION,
      readerId: 1,
      lastReadMessageId: 'msg-1',
    })
  })

  it('ne prévient personne quand on est seul', async () => {
    prismaMock.conversationParticipant.findMany.mockResolvedValue([])

    await marquerLu({} as H3Event)
    await Promise.resolve()

    expect(envoyerLecture).not.toHaveBeenCalled()
  })
})
