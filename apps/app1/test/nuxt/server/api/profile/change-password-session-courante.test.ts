import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSuivreGeneration = vi.hoisted(() => vi.fn())
const mockOublier = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/session-helpers', () => ({
  suivreLaGenerationDeSession: mockSuivreGeneration,
}))
vi.mock('#server/utils/cache-session', () => ({
  oublierSessionDuCompte: mockOublier,
}))
/*
 * ⚠️⚠️ ON SIMULE `nuxt-auth-utils`, PAS `#imports` — et les deux erreurs ont été commises ici.
 *
 * 1. `vi.mock('#imports', …)` : `test/setup.ts` le remplace déjà globalement. Un second bouchon
 *    local l'ÉCRASE au lieu de s'y ajouter, et le handler recevait `undefined` —
 *    « clearUserSession is not a function », donc un 500 sur un correctif qui fonctionne. Un
 *    fichier de tests a déjà été perdu ainsi dans ce dépôt.
 * 2. importer `clearUserSession` de `#imports` sans le simuler : l'espion du `setup` n'est pas
 *    résolu par cet import, et `vi.mocked(…)` rendait « undefined is not a spy ».
 *
 * Le point de simulation que le dépôt emploie est le module que `#imports` réexporte — cf.
 * `profile/delete-account.test.ts` et `auth/reset-password.test.ts`.
 */
vi.mock('nuxt-auth-utils', () => ({
  clearUserSession: vi.fn(),
}))

import { clearUserSession } from 'nuxt-auth-utils'
import bcrypt from 'bcryptjs'

import handler from '../../../../../server/api/profile/change-password.post'
import { global } from '../../../globales-nitro'

/**
 * Après un changement de mot de passe, l'appareil courant garde sa session — constat F1.
 *
 * ## ⚠️⚠️ POURQUOI UN NOUVEAU FICHIER, alors que `change-password.post.test.ts` existe
 *
 * **Celui-là n'exerce pas le handler.** Il en contient une COPIE réécrite à la main — un
 * `mockHandler` de cinquante lignes qui refait la validation, la comparaison bcrypt et l'écriture
 * Prisma à sa façon, et qui ne touche ni `sessionVersion`, ni la session, ni le cache. Il resterait
 * donc vert quoi qu'on fasse au vrai point d'API : c'est le motif « un bouchon sur l'appel cassé
 * aveugle le test », déjà payé dans ce dépôt.
 *
 * Ce fichier-ci importe le handler réel.
 *
 * ## Le défaut
 *
 * Le serveur incrémentait `sessionVersion` — ce qui ferme toutes les sessions, et c'est voulu —
 * puis appelait `clearUserSession` : l'appareil courant tombait avec les autres. L'écran, lui,
 * affichait « Mot de passe mis à jour », vidait le formulaire et restait là. Le magasin gardait
 * `user` et `sessionVerifiee`, donc le middleware laissait passer les navigations suivantes, et
 * chaque appel d'API répondait 401 — traduit en « identifiants invalides » sur des écrans sans
 * rapport, jusqu'à un rechargement.
 */
const MOI = 7
const evenement = () => ({ context: { user: { id: MOI, email: 'camille@exemple.test' } } })

const prismaMock = (globalThis as any).prisma

describe('POST /api/profile/change-password — la session courante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody.mockReset()
    global.readBody.mockResolvedValue({
      currentPassword: 'AncienMotDePasse1',
      newPassword: 'NouveauMotDePasse1',
      confirmPassword: 'NouveauMotDePasse1',
    })
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$12$hache' as never)
    prismaMock.user.findUnique.mockResolvedValue({
      id: MOI,
      password: '$2a$12$ancien',
      sessionVersion: 3,
    })
    prismaMock.user.update.mockResolvedValue({ sessionVersion: 4 })
    mockSuivreGeneration.mockResolvedValue(true)
  })

  it('⚠️ NE FERME PLUS la session courante', async () => {
    // 📍 LE CŒUR DU CONSTAT. C'est cette assertion-ci qui échouait avant le correctif.
    await handler(evenement() as any)
    expect(vi.mocked(clearUserSession)).not.toHaveBeenCalled()
  })

  it('fait suivre à cette session la génération rendue par la base', async () => {
    // Et non une valeur recalculée : `increment` est résolu par la base, et un `3 + 1` écrit ici
    // tomberait à côté si deux changements se croisaient.
    await handler(evenement() as any)
    expect(mockSuivreGeneration).toHaveBeenCalledTimes(1)
    expect(mockSuivreGeneration.mock.calls[0]![1]).toBe(4)
  })

  it('incrémente bien la génération du compte, qui ferme les AUTRES appareils', async () => {
    // Le reste du geste doit rester intact : sans cette incrémentation, changer son mot de passe
    // ne déconnecterait plus personne, et le correctif aurait détruit la fonctionnalité.
    await handler(evenement() as any)
    const appel = prismaMock.user.update.mock.calls[0]![0]
    expect(appel.data.sessionVersion).toEqual({ increment: 1 })
    expect(appel.data.password).toBe('$2a$12$hache')
    // La nouvelle génération doit être LUE, sans quoi le cas précédent n'aurait rien à transmettre.
    expect(appel.select).toEqual({ sessionVersion: true })
  })

  it('purge le cache de session du compte', async () => {
    // Sans cela, les sessions ouvertes ailleurs resteraient acceptées le temps de l'expiration du
    // cache : les autres appareils ne seraient pas réellement déconnectés.
    await handler(evenement() as any)
    expect(mockOublier).toHaveBeenCalledWith(MOI)
  })

  it('ferme la session si elle n’a pas pu suivre', async () => {
    // 📍 Le repli n'est pas décoratif : laisser vivre une session à l'ANCIENNE génération
    // reproduirait exactement le défaut d'avant — acceptée par le cookie, refusée par le
    // middleware, et l'écran n'en saurait rien.
    mockSuivreGeneration.mockResolvedValue(false)
    await handler(evenement() as any)
    expect(vi.mocked(clearUserSession)).toHaveBeenCalledTimes(1)
  })

  it('ne touche à rien si le compte est introuvable', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    await expect(handler(evenement() as any)).rejects.toThrow()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(mockSuivreGeneration).not.toHaveBeenCalled()
  })

  it('ne touche à rien si le corps ne passe pas la validation', async () => {
    global.readBody.mockResolvedValue({ newPassword: 'court' })
    await expect(handler(evenement() as any)).rejects.toThrow()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(mockSuivreGeneration).not.toHaveBeenCalled()
  })

  it('ne touche à rien si le mot de passe actuel est faux', async () => {
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)
    await expect(handler(evenement() as any)).rejects.toThrow()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(mockSuivreGeneration).not.toHaveBeenCalled()
    expect(vi.mocked(clearUserSession)).not.toHaveBeenCalled()
  })
})
