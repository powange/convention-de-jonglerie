import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aUneSessionDansLaRequete,
  getAuthSession,
  ouvrirSession,
} from '../../../../server/utils/session-helpers'
import { DUREES_DE_SESSION, PLAFOND_ABSOLU } from '../../../../shared/utils/duree-de-session'

/**
 * La session glissante, au niveau de l'enveloppe serveur.
 *
 * Ces tests décrivent les deux moitiés du défaut S1, et ils ÉCHOUENT avec le code d'avant :
 *
 * 1. l'ancien `getAuthSession` appelait `getUserSession` sans condition, donc posait un cookie
 *    à un visiteur anonyme — et démarrait son horloge des semaines avant sa connexion ;
 * 2. il ne repoussait jamais l'échéance : la session mourait à `createdAt + 30 jours`, quelle
 *    que soit l'assiduité de la personne, et « se souvenir de moi » ne changeait rien.
 */

const JOUR = 24 * 60 * 60 * 1000

/**
 * Les primitives de session sont passées explicitement.
 *
 * ⚠️ Ne PAS poser un `vi.mock('#imports')` ici : `test/setup.ts` en pose déjà un pour tout le
 * projet, et un second le remplacerait au lieu de le compléter — privant le code des fonctions
 * qu'il n'énumère pas. Et le `#imports` que voit un fichier de `server/` n'est de toute façon
 * pas celui que voit un fichier de test. D'où la couture de `session-helpers.ts`.
 */
const mockGetUserSession = vi.fn()
const mockSetUserSession = vi.fn()
const mockClearUserSession = vi.fn()

const primitives = {
  lire: mockGetUserSession,
  ecrire: mockSetUserSession,
  effacer: mockClearUserSession,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUserSession.mockResolvedValue({ user: { id: 1 } })
  mockSetUserSession.mockResolvedValue(undefined)
  mockClearUserSession.mockResolvedValue(undefined)
})

/** Un événement h3 réduit à ce que l'enveloppe consulte : ses en-têtes. */
function requete(cookie?: string) {
  return { node: { req: { headers: cookie ? { cookie } : {} } }, context: {} } as any
}

describe('aUneSessionDansLaRequete', () => {
  it('distingue une requête qui porte un cookie de session d’une qui n’en porte pas', () => {
    expect(aUneSessionDansLaRequete(requete('nuxt-session=abc'))).toBe(true)
    expect(aUneSessionDansLaRequete(requete('autre=1; nuxt-session=abc; encore=2'))).toBe(true)
    expect(aUneSessionDansLaRequete(requete('csrf_token=abc'))).toBe(false)
    expect(aUneSessionDansLaRequete(requete())).toBe(false)
  })
})

describe('getAuthSession — un anonyme ne reçoit plus de session', () => {
  it('n’interroge même pas h3 quand la requête ne porte aucun cookie', async () => {
    // LE défaut mesuré en production : `GET /api/session/me` sans session répondait 401 et
    // posait quand même un cookie `nuxt-session`. C'est `getSession` de h3 qui le fait — il ne
    // lit pas, il CRÉE quand il ne trouve rien. La seule parade est de ne pas l'appeler.
    const session = await getAuthSession(requete(), primitives)

    expect(session).toBeNull()
    expect(mockGetUserSession).not.toHaveBeenCalled()
    expect(mockSetUserSession).not.toHaveBeenCalled()
  })

  it('interroge h3 dès qu’un cookie est présent', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 1 },
      expireAt: Date.now() + 80 * JOUR,
      dureeSecondes: DUREES_DE_SESSION.prolongee,
    })

    const session = await getAuthSession(requete('nuxt-session=abc'), primitives)

    expect(mockGetUserSession).toHaveBeenCalledOnce()
    expect(session?.user.id).toBe(1)
  })
})

describe('getAuthSession — l’échéance glisse', () => {
  const avecSession = (data: Record<string, unknown>) => {
    mockGetUserSession.mockResolvedValue({ user: { id: 1 }, ...data })
    return requete('nuxt-session=abc')
  }

  it('repousse l’échéance d’une session entamée, et réécrit le cookie', async () => {
    // Le cœur du changement. Avant, rien ne repoussait quoi que ce soit : l'échéance valait
    // `createdAt + durée` et h3 ne rajeunit jamais `createdAt`.
    const event = avecSession({
      expireAt: Date.now() + 10 * JOUR,
      dureeSecondes: DUREES_DE_SESSION.prolongee,
      // Persistante : c'est ce cas-là qui porte une date sur le cookie. Sans la case cochée,
      // le cookie reste un cookie de session, et c'est l'objet d'un test plus bas.
      persistant: true,
    })

    await getAuthSession(event, primitives)

    expect(mockSetUserSession).toHaveBeenCalledOnce()
    const [, donnees, config] = mockSetUserSession.mock.calls[0]!
    const attendu = Date.now() + DUREES_DE_SESSION.prolongee * 1000

    // L'échéance repart de la durée PLEINE, pas du reliquat.
    expect(donnees.expireAt).toBeGreaterThan(attendu - 5000)
    expect(donnees.expireAt).toBeLessThanOrEqual(attendu)
    // Et le cookie la porte : sans `maxAge`, h3 ne pose plus d'échéance de lui-même.
    expect(config.cookie.expires).toBeInstanceOf(Date)
    expect(config.cookie.expires.getTime()).toBe(donnees.expireAt)
  })

  it('ne réécrit rien tant que la session est largement valide', async () => {
    // Sans ce frein, chaque requête porterait un Set-Cookie — y compris celles des images.
    const event = avecSession({
      expireAt: Date.now() + 80 * JOUR,
      dureeSecondes: DUREES_DE_SESSION.prolongee,
    })

    await getAuthSession(event, primitives)

    expect(mockSetUserSession).not.toHaveBeenCalled()
  })

  it('efface franchement une session expirée au lieu de la remplacer en silence', async () => {
    // Le comportement de h3 était de créer une session VIDE et de réécrire le cookie, sans
    // rien dire : la personne était déconnectée sans signal, et son cookie de 90 jours perdu.
    const event = avecSession({
      expireAt: Date.now() - 1000,
      dureeSecondes: DUREES_DE_SESSION.prolongee,
    })

    const session = await getAuthSession(event, primitives)

    expect(session).toBeNull()
    expect(mockClearUserSession).toHaveBeenCalledOnce()
    expect(mockSetUserSession).not.toHaveBeenCalled()
  })

  it('adopte une session d’avant la correction plutôt que de la rejeter', async () => {
    // Elles n'ont ni échéance ni durée. Les invalider déconnecterait tout le monde au
    // déploiement — pour corriger un défaut dont le symptôme est d'être déconnecté sans prévenir.
    const event = avecSession({})

    const session = await getAuthSession(event, primitives)

    expect(session).not.toBeNull()
    expect(mockClearUserSession).not.toHaveBeenCalled()
    expect(mockSetUserSession).toHaveBeenCalledOnce()
    const [, donnees] = mockSetUserSession.mock.calls[0]!
    // Durée ordinaire : on ignore si la case avait été cochée.
    const attendu = Date.now() + DUREES_DE_SESSION.ordinaire * 1000
    expect(donnees.expireAt).toBeGreaterThan(attendu - 5000)
  })
})

describe('ouvrirSession', () => {
  it('honore « se souvenir de moi » dans les DONNÉES, pas dans une configuration ponctuelle', async () => {
    // C'est toute la correction : la durée voyage avec la session, donc chaque lecture la
    // connaît. Auparavant elle n'était connue que de l'écriture, et perdue aussitôt après.
    await ouvrirSession(requete(), { user: { id: 1 } }, { seSouvenirDeMoi: true }, primitives)

    const [, donnees, config] = mockSetUserSession.mock.calls[0]!
    expect(donnees.dureeSecondes).toBe(DUREES_DE_SESSION.prolongee)
    expect(donnees.user.id).toBe(1)
    expect(config.cookie.expires.getTime()).toBe(donnees.expireAt)
  })

  it('donne la durée ordinaire quand la case n’est pas cochée', async () => {
    await ouvrirSession(requete(), { user: { id: 1 } }, {}, primitives)

    const [, donnees] = mockSetUserSession.mock.calls[0]!
    expect(donnees.dureeSecondes).toBe(DUREES_DE_SESSION.ordinaire)
  })

  it('compte l’échéance depuis MAINTENANT, jamais depuis une visite antérieure', async () => {
    // Le second défaut : `createdAt` était posé à la première visite, même anonyme, et la
    // connexion ne le rajeunissait pas. Mesuré : une connexion 2 s après une première visite
    // recevait une échéance valant « première visite + durée ».
    const avant = Date.now()
    await ouvrirSession(requete('nuxt-session=vieux-cookie'), { user: { id: 1 } }, {}, primitives)
    const apres = Date.now()

    const [, donnees] = mockSetUserSession.mock.calls[0]!
    expect(donnees.expireAt).toBeGreaterThanOrEqual(avant + DUREES_DE_SESSION.ordinaire * 1000)
    expect(donnees.expireAt).toBeLessThanOrEqual(apres + DUREES_DE_SESSION.ordinaire * 1000)
  })
})

describe('« se souvenir de moi » décochée : un cookie de session', () => {
  it('n’écrit AUCUNE date sur le cookie quand la case n’est pas cochée', async () => {
    // Un cookie sans `expires` est un cookie de session : le navigateur l'efface en se fermant.
    // C'est ce que la case promet littéralement, et ce que fait la plupart des sites.
    await ouvrirSession(requete(), { user: { id: 1 } }, {}, primitives)

    const [, donnees, config] = mockSetUserSession.mock.calls[0]!
    expect(config.cookie.expires).toBeUndefined()
    expect(donnees.persistant).toBe(false)
    // L'échéance côté serveur subsiste : un cookie capturé ne survit pas à sa durée.
    expect(donnees.expireAt).toBeGreaterThan(Date.now())
  })

  it('écrit la date quand la case est cochée', async () => {
    await ouvrirSession(requete(), { user: { id: 1 } }, { seSouvenirDeMoi: true }, primitives)

    const [, donnees, config] = mockSetUserSession.mock.calls[0]!
    expect(donnees.persistant).toBe(true)
    expect(config.cookie.expires.getTime()).toBe(donnees.expireAt)
  })

  it('prolonger ne transforme pas un cookie de session en cookie daté', async () => {
    // Sinon on cocherait la case à la place de la personne, à sa première visite un peu tardive.
    mockGetUserSession.mockResolvedValue({
      user: { id: 1 },
      expireAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
      dureeSecondes: DUREES_DE_SESSION.ordinaire,
      persistant: false,
    })

    await getAuthSession(requete('nuxt-session=abc'), primitives)

    const [, , config] = mockSetUserSession.mock.calls[0]!
    expect(config.cookie.expires).toBeUndefined()
  })
})

describe('le plafond et la génération', () => {
  it('refuse une session trop vieille, même tenue en vie par le glissement', async () => {
    mockGetUserSession.mockResolvedValue({
      user: { id: 1 },
      ouvertureAt: Date.now() - (PLAFOND_ABSOLU * 1000 + 1),
      expireAt: Date.now() + 80 * JOUR,
      dureeSecondes: DUREES_DE_SESSION.prolongee,
    })

    const session = await getAuthSession(requete('nuxt-session=abc'), primitives)

    expect(session).toBeNull()
    expect(mockClearUserSession).toHaveBeenCalledOnce()
  })

  it('emporte la génération du compte, pour que la révocation soit possible', async () => {
    await ouvrirSession(requete(), { user: { id: 1 } }, { sessionVersion: 7 }, primitives)

    const [, donnees] = mockSetUserSession.mock.calls[0]!
    expect(donnees.sessionVersion).toBe(7)
  })

  it('retient la génération zéro quand le compte n’en porte pas', async () => {
    await ouvrirSession(requete(), { user: { id: 1 } }, {}, primitives)

    const [, donnees] = mockSetUserSession.mock.calls[0]!
    expect(donnees.sessionVersion).toBe(0)
  })

  it('garde en mémoire l’instant d’ouverture, qui ne doit jamais bouger', async () => {
    // `expireAt` se repousse ; `ouvertureAt` non — c'est lui qui donne son sens au plafond.
    const avant = Date.now()
    await ouvrirSession(requete(), { user: { id: 1 } }, {}, primitives)
    const [, donnees] = mockSetUserSession.mock.calls[0]!
    expect(donnees.ouvertureAt).toBeGreaterThanOrEqual(avant)
    expect(donnees.ouvertureAt).toBeLessThanOrEqual(Date.now())
  })
})

describe('un cookie illisible ne rouvre pas la brèche', () => {
  it('ne prolonge rien pour une session sans utilisateur', async () => {
    // h3 fabrique une session neuve et vide quand le scellé ne se lit pas. La prolonger
    // reviendrait à poser un cookie daté à un visiteur anonyme — ce que ce lot referme.
    mockGetUserSession.mockResolvedValue({ id: 'neuve' })

    const session = await getAuthSession(requete('nuxt-session=illisible'), primitives)

    expect(session).toBeNull()
    expect(mockSetUserSession).not.toHaveBeenCalled()
  })
})
