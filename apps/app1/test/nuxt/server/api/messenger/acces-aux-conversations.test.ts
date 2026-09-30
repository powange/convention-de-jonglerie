import { describe, it, expect, beforeEach, vi } from 'vitest'

const envoyerCompteur = vi.hoisted(() => vi.fn(async () => undefined))
const diffuserLecture = vi.hoisted(() => vi.fn(async () => undefined))
const compterNonLus = vi.hoisted(() => vi.fn(async () => ({ total: 0, parConversation: {} })))

vi.mock('../../../../../server/utils/messenger-unread-service', () => ({
  messengerUnreadService: {
    sendUnreadCountToUser: envoyerCompteur,
    getUnreadCount: compterNonLus,
  },
  messengerStreamService: { sendReadToUsers: diffuserLecture },
  compterNonLusParConversation: vi.fn(async () => ({})),
}))

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event?.context?.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

import marquerLu from '../../../../../server/api/messenger/conversations/[conversationId]/mark-read.patch'
import prive from '../../../../../server/api/messenger/private.post'
import compteurNonLus from '../../../../../server/api/messenger/unread-count.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Qui peut lire, marquer, et à qui l'on parle : trois points d'API de la messagerie sans test.
 *
 * ⚠️ CE QU'ILS DÉCIDENT est un droit d'ACCÈS, pas une commodité. Marquer un message comme lu dans
 * une conversation dont on n'est pas participant écrirait dans une ligne qui n'est pas la sienne ;
 * accepter un `messageId` venu d'une AUTRE conversation déplacerait le curseur de lecture sur un
 * message que l'on n'a jamais vu, et masquerait donc comme « lus » des messages non lus.
 *
 * Un refus manquant ne se voit pas : l'appel réussit, et rien ne signale qu'il n'aurait pas dû.
 *
 * ⚠️ `leftAt: null` EST LA RÈGLE DU DÉPÔT, et elle est facile à perdre. Qui a quitté une
 * conversation n'en reçoit plus rien — un participant retiré de son équipe n'est pas supprimé mais
 * marqué parti, pour que l'historique reste lisible. Oublier ce filtre rend la lecture à qui l'a
 * perdue, et la mesure porte donc sur la FORME de la requête, que le mock de Prisma ignore.
 */

const MOI = 7
const AUTRE = 8
const CONVERSATION = 'conv-1'

const evenement = { context: { user: { id: MOI, pseudo: 'Alex' } } } as any
const anonyme = { context: {} } as any

describe('PATCH /api/messenger/conversations/[id]/mark-read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => CONVERSATION)
    global.readBody = vi.fn().mockResolvedValue({ messageId: 'msg-1' })
    prismaMock.conversationParticipant.findFirst.mockResolvedValue({ id: 'part-1', userId: MOI })
    prismaMock.message.findFirst.mockResolvedValue({ id: 'msg-1', conversationId: CONVERSATION })
    prismaMock.conversationParticipant.update.mockResolvedValue({})
    prismaMock.conversationParticipant.findMany.mockResolvedValue([{ userId: AUTRE }])
  })

  it('marque le message comme lu pour le participant', async () => {
    await marquerLu(evenement)

    const ecriture = prismaMock.conversationParticipant.update.mock.calls[0][0]
    expect(ecriture.where.id).toBe('part-1')
    expect(ecriture.data.lastReadMessageId).toBe('msg-1')
  })

  it('REFUSE qui n’est pas participant', async () => {
    prismaMock.conversationParticipant.findFirst.mockResolvedValue(null)

    await expect(marquerLu(evenement)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.conversationParticipant.update).not.toHaveBeenCalled()
  })

  it('REFUSE qui a QUITTÉ la conversation', async () => {
    /*
     * 🔬 Le filtre `leftAt: null` est dans le `where`, pas dans une condition qui suit : on mesure
     * donc la forme de la requête. Sans lui, un bénévole retiré de son équipe continuerait de
     * marquer comme lus les messages du fil qu'il n'a plus le droit de lire.
     */
    await marquerLu(evenement)

    const where = prismaMock.conversationParticipant.findFirst.mock.calls[0][0].where
    expect(where.leftAt).toBeNull()
    expect(where.userId).toBe(MOI)
    expect(where.conversationId).toBe(CONVERSATION)
  })

  it('REFUSE un message d’une AUTRE conversation', async () => {
    /*
     * ⚠️ Le défaut serait silencieux et FAUSSERAIT LES COMPTEURS : le curseur de lecture avancerait
     * sur un message jamais affiché, et tout ce qui précède passerait pour lu.
     */
    prismaMock.message.findFirst.mockResolvedValue(null)

    await expect(marquerLu(evenement)).rejects.toMatchObject({ statusCode: 404 })

    const where = prismaMock.message.findFirst.mock.calls[0][0].where
    expect(where.conversationId).toBe(CONVERSATION)
    expect(where.id).toBe('msg-1')
  })

  it('met à jour le compteur ET prévient les AUTRES participants', async () => {
    await marquerLu(evenement)

    expect(envoyerCompteur).toHaveBeenCalledWith(MOI)
    expect(diffuserLecture).toHaveBeenCalledWith([AUTRE], {
      conversationId: CONVERSATION,
      readerId: MOI,
      lastReadMessageId: 'msg-1',
    })
  })

  it('ne diffuse la lecture qu’aux participants ACTIFS, jamais à soi-même', async () => {
    await marquerLu(evenement)

    const where = prismaMock.conversationParticipant.findMany.mock.calls[0][0].where
    expect(where.leftAt).toBeNull()
    expect(where.userId).toEqual({ not: MOI })
  })

  it('un échec de diffusion ne fait PAS échouer l’appel', async () => {
    // La lecture est déjà écrite : faire échouer l'appel ferait réessayer le client en boucle.
    diffuserLecture.mockRejectedValueOnce(new Error('flux fermé'))

    await expect(marquerLu(evenement)).resolves.toBeTruthy()
  })

  it('refuse un corps sans messageId', async () => {
    global.readBody = vi.fn().mockResolvedValue({})

    await expect(marquerLu(evenement)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuse un anonyme', async () => {
    await expect(marquerLu(anonyme)).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/messenger/private', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ userId: AUTRE })
    prismaMock.user.findUnique.mockResolvedValue({ id: AUTRE, pseudo: 'Dominique' })
    prismaMock.$queryRaw.mockResolvedValue([])
    prismaMock.conversation.findFirst.mockResolvedValue(null)
    prismaMock.conversation.create.mockResolvedValue({ id: 'conv-neuve' })
  })

  it('crée la conversation au premier appel', async () => {
    const reponse: any = await prive(evenement)

    expect(reponse.data).toEqual({ conversationId: 'conv-neuve', created: true })
    expect(prismaMock.conversation.create.mock.calls[0][0].data.participants.create).toEqual([
      { userId: MOI },
      { userId: AUTRE },
    ])
  })

  it('REND LA MÊME au second appel, sans en créer une seconde', async () => {
    /*
     * 🔬 Le cœur de ce point d'API. Sans le dédoublonnage, deux personnes qui s'écrivent
     * simultanément ouvriraient deux fils : chacun écrirait dans le sien, et chacun verrait l'autre
     * muet. Aucune erreur, aucun message perdu — deux conversations parallèles.
     */
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-existante',
      participants: [{ userId: MOI }, { userId: AUTRE }],
    })

    const reponse: any = await prive(evenement)

    expect(reponse.data).toEqual({ conversationId: 'conv-existante', created: false })
    expect(prismaMock.conversation.create).not.toHaveBeenCalled()
  })

  it('verrouille les DEUX comptes, en ordre croissant', async () => {
    /*
     * ⚠️ L'ordre n'est pas une coquetterie : deux appels croisés qui verrouilleraient dans l'ordre
     * inverse se bloqueraient mutuellement (interblocage), et MySQL en tuerait un. L'ordre
     * croissant garantit que tout le monde prend les verrous dans le même sens.
     */
    await prive(evenement)

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
    const valeurs = prismaMock.$queryRaw.mock.calls.map((appel: any) => appel[1])
    expect(valeurs).toEqual([MOI, AUTRE])
  })

  it('ne rend PAS un fil de groupe où les deux se trouvent', async () => {
    /*
     * ⚠️ La requête cherche deux participants « parmi », donc un fil à trois où l'on est tous les
     * deux correspondrait aussi. Le contrôle sur le NOMBRE exact de participants actifs est ce qui
     * l'écarte — sans lui, écrire à quelqu'un en privé publierait dans la discussion d'équipe.
     */
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-a-trois',
      participants: [{ userId: MOI }, { userId: AUTRE }, { userId: 99 }],
    })

    const reponse: any = await prive(evenement)

    expect(reponse.data.created).toBe(true)
    expect(reponse.data.conversationId).toBe('conv-neuve')
  })

  it('REFUSE une conversation avec soi-même', async () => {
    global.readBody = vi.fn().mockResolvedValue({ userId: MOI })

    await expect(prive(evenement)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rend 404 pour un compte inexistant', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(prive(evenement)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuse un identifiant qui n’est pas un entier positif', async () => {
    global.readBody = vi.fn().mockResolvedValue({ userId: -3 })

    await expect(prive(evenement)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuse un anonyme', async () => {
    await expect(prive(anonyme)).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/messenger/unread-count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compterNonLus.mockResolvedValue({ total: 3, parConversation: { [CONVERSATION]: 3 } } as never)
  })

  it('compte pour l’utilisateur connecté, et pour lui seul', async () => {
    // Le paramètre est le seul garde-fou : un identifiant pris ailleurs que dans la session
    // rendrait les compteurs de quelqu'un d'autre.
    const reponse: any = await compteurNonLus(evenement)

    expect(compterNonLus).toHaveBeenCalledWith(MOI)
    expect(reponse.data.total).toBe(3)
  })

  it('refuse un anonyme', async () => {
    await expect(compteurNonLus(anonyme)).rejects.toMatchObject({ statusCode: 401 })
  })
})
