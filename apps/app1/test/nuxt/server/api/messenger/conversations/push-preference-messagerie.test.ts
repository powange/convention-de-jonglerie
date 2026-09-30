import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { H3Event } from 'h3'

const pousserAuCompte = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('../../../../../../server/utils/notification-stream-manager', () => ({
  notificationStreamManager: {
    sendMessengerMessage: vi.fn(async () => true),
    sendMessengerMessageUpdated: vi.fn(async () => true),
    sendMessengerRead: vi.fn(async () => true),
    sendMessengerNewMessage: vi.fn(async () => true),
    sendMessengerUnreadCount: vi.fn(async () => true),
  },
}))

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, pseudo: 'Camille' })),
}))

vi.mock('../../../../../../server/utils/push-notification-service', () => ({
  pushNotificationService: { sendToUser: vi.fn() },
}))

vi.mock('../../../../../../server/utils/unified-push-service', () => ({
  unifiedPushService: { sendToUser: pousserAuCompte },
}))

import envoyer from '../../../../../../server/api/messenger/conversations/[conversationId]/messages/index.post'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Couper les notifications de la messagerie, et que ce soit respecté.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. Les messages de la messagerie n'appellent PAS
 * `NotificationService.create` : ils poussent directement par `unifiedPushService`, donc sans
 * jamais passer par `isNotificationAllowed`. Aucune des six préférences existantes (bénévolat,
 * candidatures, conventions, système, covoiturage, artistes) ne les couvrait, et la page des
 * préférences ne proposait rien pour la messagerie.
 *
 * Conséquence concrète : un membre d'une équipe de quarante personnes actives recevait un push par
 * message de groupe, sans autre issue que de couper TOUT le push de son compte — donc aussi les
 * rappels de ses propres créneaux.
 *
 * 🔬 CES TESTS MESURENT QUI REÇOIT, pas ce que la fonction rend. Un contrôle posé au mauvais
 * endroit — après la composition du titre, ou sur les préférences de l'EXPÉDITEUR — laisserait
 * une fonction correcte et un push tout de même envoyé.
 */

const CONVERSATION = 'conv-1'
const COUPE = 2
const ACTIF = 3

const conversation = {
  id: CONVERSATION,
  type: 'TEAM_GROUP',
  teamId: 'team-1',
  editionId: 1,
  team: { name: 'Accueil' },
  edition: { id: 1, name: 'Édition 2026', convention: { name: 'Convention' } },
  participants: [{ userId: COUPE }, { userId: ACTIF }],
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
  createdAt: new Date(),
  editedAt: null,
  deletedAt: null,
  participant: { id: 'participant-1', user: { id: 1, pseudo: 'Camille' } },
  replyTo: null,
}

const comptesPousses = () => pousserAuCompte.mock.calls.map((appel: any) => appel[0] as number)

describe('POST messages — la préférence de messagerie', () => {
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
  })

  it('n’envoie RIEN à qui a coupé la messagerie, et pousse aux autres', async () => {
    /*
     * 🔬 L'ASSERTION QUI PORTE LE LOT. Les deux destinataires sont dans la même conversation : un
     * contrôle qui court-circuiterait la boucle entière, ou qui lirait la préférence de
     * l'expéditeur, se verrait ici — le second ne recevrait rien non plus.
     */
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      {
        userId: COUPE,
        lastReadMessageId: null,
        user: { preferredLanguage: 'fr', notificationPreferences: { messengerMessages: false } },
      },
      {
        userId: ACTIF,
        lastReadMessageId: null,
        user: { preferredLanguage: 'fr', notificationPreferences: { messengerMessages: true } },
      },
    ])

    await envoyer({} as H3Event)

    expect(comptesPousses()).toEqual([ACTIF])
  })

  it('pousse par DÉFAUT à un compte qui n’a jamais réglé ses préférences', async () => {
    /*
     * Le défaut est `true` : ce lot ne doit pas couper les notifications de tout le monde au
     * passage. La colonne est `null` pour la grande majorité des comptes.
     */
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      { userId: COUPE, lastReadMessageId: null, user: { notificationPreferences: null } },
      { userId: ACTIF, lastReadMessageId: null, user: {} },
    ])

    await envoyer({} as H3Event)

    expect(comptesPousses().sort()).toEqual([COUPE, ACTIF].sort())
  })

  it('pousse à qui a coupé une AUTRE catégorie', async () => {
    /*
     * ⚠️ Le contrôle doit viser `messengerMessages` et lui seul. Un `!preferences.systemNotifications`
     * — la clé voisine — passerait les deux tests précédents et couperait la messagerie de qui a
     * seulement refusé les nouvelles du système.
     */
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      {
        userId: ACTIF,
        lastReadMessageId: null,
        user: {
          notificationPreferences: {
            messengerMessages: true,
            systemNotifications: false,
            carpoolUpdates: false,
            volunteerReminders: false,
          },
        },
      },
    ])

    await envoyer({} as H3Event)

    expect(comptesPousses()).toEqual([ACTIF])
  })

  it('lit la préférence dans le MÊME select que les participants', async () => {
    /*
     * ⚠️ L'autre moitié du constat : interroger la base par destinataire ajouterait une requête
     * par personne à chaque message. Une équipe de quarante personnes paierait quarante
     * allers-retours pour décider d'envoyer un push.
     *
     * On mesure la FORME de la requête, que le mock de Prisma ignore par ailleurs. Sans cette
     * assertion, un retour à `isNotificationAllowed` dans la boucle laisserait tous les tests
     * ci-dessus au vert.
     */
    prismaMock.conversationParticipant.findMany.mockResolvedValue([])

    await envoyer({} as H3Event)

    const appel = prismaMock.conversationParticipant.findMany.mock.calls[0][0]
    expect(appel.select.user.select.notificationPreferences).toBe(true)
  })
})
