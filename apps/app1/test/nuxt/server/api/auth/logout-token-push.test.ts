import { describe, it, expect, vi, beforeEach } from 'vitest'

/*
 * ⚠️ ON REMPLACE `nuxt-auth-utils`, PAS `#imports`, et c'est le motif déjà employé par
 * `reset-password.test.ts`. Deux tentatives ont échoué avant d'y venir :
 *
 * 1. `vi.mock('#imports', …)` local — `test/setup.ts` remplace DÉJÀ ce module en entier, et un
 *    second mock efface ses autres stubs. `getUserSession` devenait indéfini, le handler levait un
 *    `TypeError`, et les sept tests tombaient sur une erreur sans rapport avec ce qu'ils éprouvent.
 * 2. Piloter le stub de `test/setup.ts` en important `clearUserSession` depuis `#imports` — le nom
 *    importé est indéfini dans le contexte d'un fichier de test, et `vi.mocked(...)` rendait
 *    `undefined`.
 *
 * Remplacer le paquet sous-jacent marche dans les deux contextes, et ne touche à rien d'autre.
 */
const sessionEffacee = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('nuxt-auth-utils', () => ({ clearUserSession: sessionEffacee }))

import handler from '../../../../../../../layers/auth/server/api/auth/logout.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Se déconnecter coupe les notifications push de CET appareil.
 *
 * ⚠️ CE QUI N'ARRIVAIT PAS, et ce que ça donnait. La déconnexion effaçait la session et laissait
 * le token FCM ACTIF. Sur un poste partagé — une médiathèque, l'ordinateur du guichet d'une
 * convention —, les notifications du compte qui venait de partir continuaient d'arriver, et la
 * personne suivante les lisait. Le titre, le message et le nom de l'édition s'affichent dans la
 * notification SYSTÈME : il n'est pas besoin d'être connecté pour les voir, ni même d'avoir le
 * site ouvert.
 *
 * ⚠️ L'ORDRE EST LA MOITIÉ DU CORRECTIF. La session se lit AVANT d'être effacée : après
 * `clearUserSession` il n'y a plus de compte à qui rattacher le token, et désactiver « au mieux »
 * sans identifiant d'utilisateur toucherait la ligne de n'importe qui partage cet appareil.
 */

const UTILISATEUR = 7
const APPAREIL = 'appareil-partage-guichet'

const evenement = { context: { user: { id: UTILISATEUR } }, node: { req: {} } }

describe('POST /api/auth/logout — token push de l’appareil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ deviceId: APPAREIL })
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 1 })
  })

  it('désactive les tokens de CET appareil, pour CE compte', async () => {
    await handler(evenement as any)

    expect(prismaMock.fcmToken.updateMany).toHaveBeenCalledWith({
      where: { userId: UTILISATEUR, deviceId: APPAREIL },
      data: { isActive: false },
    })
  })

  it('désactive le token AVANT d’effacer la session', async () => {
    /*
     * Mesuré sur l'ordre réel des appels, et non supposé. L'inverse ne lèverait aucune erreur : le
     * `updateMany` partirait simplement avec un `userId` indéfini, donc sans toucher personne — ou,
     * pire, en touchant la mauvaise ligne si le filtre venait à changer.
     */
    const ordre: string[] = []
    prismaMock.fcmToken.updateMany.mockImplementation(async () => {
      ordre.push('desactivation-token')
      return { count: 1 }
    })
    sessionEffacee.mockImplementation(async () => {
      ordre.push('effacement-session')
    })

    await handler(evenement as any)

    expect(ordre).toEqual(['desactivation-token', 'effacement-session'])
  })

  it('efface la session même sans identifiant d’appareil', async () => {
    /*
     * `localStorage` peut être inaccessible. Se déconnecter est un geste qu'on ne refuse à
     * personne : le corps part vide, aucun token n'est désactivé, et la session s'efface.
     */
    global.readBody = vi.fn().mockResolvedValue({})

    await handler(evenement as any)

    expect(prismaMock.fcmToken.updateMany).not.toHaveBeenCalled()
    expect(sessionEffacee).toHaveBeenCalled()
  })

  it('efface la session même si le corps est ILLISIBLE', async () => {
    // Un corps mal formé ne peut pas retenir quelqu'un dans sa session.
    global.readBody = vi.fn().mockRejectedValue(new Error('Parse error'))

    await handler(evenement as any)

    expect(sessionEffacee).toHaveBeenCalled()
  })

  it('efface la session même si le corps porte n’importe quoi', async () => {
    // Un `deviceId` numérique, une clé inattendue : refusé par le schéma, sans conséquence.
    global.readBody = vi.fn().mockResolvedValue({ deviceId: 42, autre: true })

    await handler(evenement as any)

    expect(prismaMock.fcmToken.updateMany).not.toHaveBeenCalled()
    expect(sessionEffacee).toHaveBeenCalled()
  })

  it('efface la session même si la désactivation du token ÉCHOUE', async () => {
    /*
     * L'invariant qui protège l'essentiel. Une déconnexion qui échouerait parce qu'un token n'a pas
     * pu être désactivé serait bien plus grave que le token resté actif : la personne croirait
     * être partie, ou resterait bloquée dans une session qu'elle veut quitter.
     */
    prismaMock.fcmToken.updateMany.mockRejectedValue(new Error('base indisponible'))

    const reponse: any = await handler(evenement as any)

    expect(sessionEffacee).toHaveBeenCalled()
    expect(reponse.success).toBe(true)
  })

  it('ne touche à aucun token sans session', async () => {
    // Sans compte identifié, il n'y a pas de ligne à désactiver — et en désigner une « au mieux »
    // toucherait celle de quelqu'un d'autre sur le même appareil.
    await handler({ context: {}, node: { req: {} } } as any)

    expect(prismaMock.fcmToken.updateMany).not.toHaveBeenCalled()
    expect(sessionEffacee).toHaveBeenCalled()
  })
})
