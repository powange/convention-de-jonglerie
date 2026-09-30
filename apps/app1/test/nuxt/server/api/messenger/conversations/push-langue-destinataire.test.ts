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
 * La notification push d'un message parle la langue de CELUI QUI LA REÇOIT.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, et pourquoi c'était le pire endroit pour du français en dur. Les huit
 * variantes du titre étaient des gabarits écrits dans le code :
 *
 *     notificationTitle = `Nouveau message d'un responsable ${teamName} - ${editionName}`
 *
 * Le corps de l'application est traduit en treize langues depuis longtemps. Mais la notification
 * push est précisément CE QU'ON VOIT QUAND L'APPLICATION N'EST PAS OUVERTE : un bénévole
 * néerlandais recevait « Nouveau message d'un responsable Accueil », sur son écran de verrouillage,
 * sans contexte pour le déchiffrer.
 *
 * 🔬 CES TESTS N'EMPLOIENT PAS DE MOCK DE TRADUCTION, et c'est volontaire : `translateServerSide`
 * lit les VRAIS fichiers de `apps/app1/i18n/locales`. Un mock aurait rendu ce qu'on lui dit de
 * rendre, et n'aurait prouvé ni que la clé existe, ni qu'elle est traduite dans la langue visée.
 * Une clé manquante rend la clé elle-même — c'est donc ce que ces tests attraperaient.
 */

const CONVERSATION = 'conv-1'
const NEERLANDOPHONE = 2
const FRANCOPHONE = 3

const conversation = {
  id: CONVERSATION,
  type: 'TEAM_GROUP',
  teamId: 'team-1',
  editionId: 1,
  team: { name: 'Accueil' },
  edition: { id: 1, name: 'Édition 2026', convention: { name: 'Convention' } },
  participants: [{ userId: NEERLANDOPHONE }, { userId: FRANCOPHONE }],
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
  createdAt: new Date('2026-09-30T10:00:00Z'),
  editedAt: null,
  deletedAt: null,
  participant: { id: 'participant-1', user: { id: 1, pseudo: 'Camille' } },
  replyTo: null,
}

/** Le titre poussé à un compte donné. */
const titrePour = (userId: number) =>
  pousserAuCompte.mock.calls.find((appel: any) => appel[0] === userId)?.[1]?.title as
    | string
    | undefined

const chargePour = (userId: number) =>
  pousserAuCompte.mock.calls.find((appel: any) => appel[0] === userId)?.[1] as any

describe('POST messages — la push dans la langue du destinataire', () => {
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
      { userId: NEERLANDOPHONE, lastReadMessageId: null, user: { preferredLanguage: 'nl' } },
      { userId: FRANCOPHONE, lastReadMessageId: null, user: { preferredLanguage: 'fr' } },
    ])
  })

  it('traduit le titre pour chaque destinataire, dans SA langue', async () => {
    /*
     * Deux destinataires dans la même conversation, deux langues. C'est le cas qui distingue
     * « traduit » de « traduit dans la langue de l'expéditeur » — un titre unique pour les deux
     * passerait un test écrit avec un seul destinataire.
     */
    await envoyer({} as H3Event)

    const nl = titrePour(NEERLANDOPHONE)
    const fr = titrePour(FRANCOPHONE)

    expect(fr).toBe('Nouveau message dans Accueil - Édition 2026')
    expect(nl).toBeTruthy()
    expect(nl).not.toBe(fr)
  })

  it('les paramètres sont bien substitués, jamais laissés en accolades', async () => {
    /*
     * `translateServerSide` remplace `{teamName}` par la valeur. Une clé mal nommée ou un paramètre
     * oublié laisserait les accolades telles quelles dans la notification — lisible, plausible,
     * et faux.
     */
    await envoyer({} as H3Event)

    for (const userId of [NEERLANDOPHONE, FRANCOPHONE]) {
      const titre = titrePour(userId)!
      expect(titre).not.toMatch(/\{[a-zA-Z]+\}/)
      expect(titre).toContain('Accueil')
      expect(titre).toContain('Édition 2026')
    }
  })

  it('ne renvoie JAMAIS la clé brute', async () => {
    /*
     * Le mode d'échec propre à `translateServerSide` : clé absente du fichier, il rend la clé.
     * « messenger.push.team_group » s'afficherait sur l'écran de verrouillage. C'est exactement ce
     * qu'un mock de traduction aurait masqué.
     */
    await envoyer({} as H3Event)

    for (const userId of [NEERLANDOPHONE, FRANCOPHONE]) {
      expect(titrePour(userId)).not.toMatch(/^messenger\.push\./)
    }
  })

  it('l’intitulé du bouton est traduit aussi', async () => {
    // « Voir le message » était en dur à côté du titre. Le corriger à moitié aurait laissé une
    // notification au titre néerlandais et au bouton français.
    await envoyer({} as H3Event)

    const nl = chargePour(NEERLANDOPHONE).actionText
    const fr = chargePour(FRANCOPHONE).actionText

    expect(fr).toBe('Voir le message')
    expect(nl).toBeTruthy()
    expect(nl).not.toMatch(/^messenger\.push\./)
    expect(nl).not.toBe(fr)
  })

  it('retombe sur le français quand le compte n’a pas choisi de langue', async () => {
    // `preferredLanguage` est nullable : un compte ancien, ou créé par OAuth, peut ne rien porter.
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      { userId: NEERLANDOPHONE, lastReadMessageId: null, user: { preferredLanguage: null } },
    ])

    await envoyer({} as H3Event)

    expect(titrePour(NEERLANDOPHONE)).toBe('Nouveau message dans Accueil - Édition 2026')
  })

  it('charge `preferredLanguage` dans la requête des participants', async () => {
    /*
     * Sans ce champ au `select`, Prisma rend `undefined` — que le repli lit comme « pas de langue
     * choisie ». Tout le monde recevrait alors du français, et le lot aurait l'air livré. C'est
     * le genre de défaut qu'aucune assertion sur la sortie ne voit, puisque le français EST le
     * repli attendu dans un autre cas.
     */
    await envoyer({} as H3Event)

    const appel = prismaMock.conversationParticipant.findMany.mock.calls[0][0]
    expect(appel.select.user.select.preferredLanguage).toBe(true)
  })
})
