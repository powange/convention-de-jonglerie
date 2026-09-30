import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  oublierSessionDuCompte,
  tailleCacheDesSessions,
  versionDeSessionDuCompte,
  viderCacheDesSessions,
} from '../../../../server/utils/cache-session'

const prismaMock = (globalThis as any).prisma

/**
 * Le cache de la génération de session.
 *
 * ⚠️ CE QU'IL AMORTIT : `sessionRecevable` interrogeait `User` à CHAQUE requête authentifiée. Un
 * écran de gestion enchaîne cinq à quinze appels par page, chacun payant cette lecture avant même
 * d'atteindre son handler.
 *
 * ⚠️ CE QU'IL COÛTE, et c'est le compromis explicite de l'énoncé : une session révoquée peut rester
 * acceptée jusqu'à l'expiration. La révocation est IMMÉDIATE sur l'instance qui la déclenche, parce
 * qu'elle oublie l'entrée — c'est cela que ces tests verrouillent, bien plus que le gain.
 *
 * Le temps est simulé (`vi.useFakeTimers`) : mesurer une expiration de trente secondes en attendant
 * trente secondes rendrait la suite inutilisable, et une attente réelle plus courte ne prouverait
 * pas la borne.
 */

const COMPTE = 42

describe('cache de la génération de session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    viderCacheDesSessions()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'))
    prismaMock.user.findUnique.mockResolvedValue({ sessionVersion: 3 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ne lit la base qu’UNE fois pour deux requêtes rapprochées', async () => {
    // Le cœur du lot. Deux appels, une lecture : c'est ce que paie un écran qui enchaîne ses
    // requêtes.
    expect(await versionDeSessionDuCompte(COMPTE)).toBe(3)
    expect(await versionDeSessionDuCompte(COMPTE)).toBe(3)

    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('ne demande que la génération, pas le compte entier', async () => {
    // Un `select` large ferait de ce cache une mémorisation d'objets utilisateur, avec tout ce que
    // cela suppose de données périmées servies ailleurs.
    await versionDeSessionDuCompte(COMPTE)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: COMPTE },
      select: { sessionVersion: true },
    })
  })

  it('relit après un OUBLI explicite — la révocation est immédiate', async () => {
    /*
     * L'assertion qui porte la sécurité de ce lot. Changer son mot de passe, le réinitialiser ou
     * supprimer un compte appellent `oublierSessionDuCompte` : la lecture suivante doit repartir en
     * base, sans quoi la session révoquée resterait acceptée.
     */
    await versionDeSessionDuCompte(COMPTE)
    prismaMock.user.findUnique.mockResolvedValue({ sessionVersion: 4 })

    oublierSessionDuCompte(COMPTE)

    expect(await versionDeSessionDuCompte(COMPTE)).toBe(4)
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2)
  })

  it('n’oublie QUE le compte visé', async () => {
    // Un oubli qui viderait tout ferait relire la base pour tous les comptes actifs à chaque
    // changement de mot de passe de n'importe qui.
    await versionDeSessionDuCompte(COMPTE)
    await versionDeSessionDuCompte(99)
    expect(tailleCacheDesSessions()).toBe(2)

    oublierSessionDuCompte(COMPTE)

    expect(tailleCacheDesSessions()).toBe(1)
  })

  it('relit après expiration, et pas avant', async () => {
    await versionDeSessionDuCompte(COMPTE)

    // Juste avant la borne : toujours le cache.
    vi.advanceTimersByTime(29_000)
    await versionDeSessionDuCompte(COMPTE)
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)

    // Passé la borne : relecture. C'est le « au plus tard après 30 s » du compromis.
    vi.advanceTimersByTime(2_000)
    await versionDeSessionDuCompte(COMPTE)
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2)
  })

  it('mémorise aussi l’ABSENCE de compte', async () => {
    /*
     * `null` est une réponse, pas un échec. Ne pas la mémoriser ferait interroger la base à chaque
     * requête d'une session orpheline — précisément le cas que ce cache doit couvrir, celui d'un
     * compte qui vient d'être supprimé et dont le navigateur garde le cookie.
     */
    prismaMock.user.findUnique.mockResolvedValue(null)

    expect(await versionDeSessionDuCompte(COMPTE)).toBeNull()
    expect(await versionDeSessionDuCompte(COMPTE)).toBeNull()

    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('distingue la génération ZÉRO d’un compte absent', async () => {
    // Le piège du repli : `?? null` sur un `sessionVersion` valant 0 le rendrait `null` si l'on
    // testait la valeur plutôt que le compte. Une session de génération zéro — celle des comptes
    // dont le mot de passe n'a jamais changé — serait alors refusée pour tout le monde.
    prismaMock.user.findUnique.mockResolvedValue({ sessionVersion: 0 })

    expect(await versionDeSessionDuCompte(COMPTE)).toBe(0)
  })

  it('reste borné en taille', async () => {
    // Sans plafond, le cache grandirait avec le nombre de comptes distincts vus depuis le
    // démarrage : une fuite lente, invisible, et d'autant plus grande que le serveur tourne
    // longtemps. Le test ne remplit pas 10 000 entrées — il vérifie que le plafond existe et que
    // rien ne grandit au-delà.
    for (let id = 1; id <= 200; id++) {
      await versionDeSessionDuCompte(id)
    }

    expect(tailleCacheDesSessions()).toBe(200)
    expect(tailleCacheDesSessions()).toBeLessThanOrEqual(10_000)
  })
})
