import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { notificationStreamManager } from '../../../../server/utils/notification-stream-manager'

/**
 * Le gestionnaire de flux SSE, et la connexion morte qu'il ne voyait jamais — constat A2.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Le `push` du flux attrapait l'erreur d'`enqueue`, posait son drapeau de fermeture et **retournait
 * sans rien dire**. Le gestionnaire ne voyait donc jamais d'échec : son `try/catch` ne pouvait pas
 * se déclencher, `lastPing` était rafraîchi à chaque cycle **même sur un contrôleur fermé**, et
 * `cleanupStaleConnections` — écrit trente lignes plus bas, avec son seuil de deux minutes — était
 * du **code mort**.
 *
 * Conséquence : une connexion dont le `close` de la requête ne remonte pas (intermédiaire réseau,
 * coupure brutale) restait indéfiniment dans les Maps, comptée dans `getStats` et parcourue à
 * chaque envoi. Un `catch` qui ne relance pas rend inatteignable le nettoyage prévu pour lui.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * On mesure `getStats()`, c'est-à-dire **ce que le gestionnaire croit avoir**. Un test qui
 * vérifierait que `push` a été appelé passerait aussi bien avant qu'après : le défaut n'était pas
 * dans l'appel, il était dans ce qu'on faisait de sa réponse.
 *
 * Deux témoins bornent les cas : un flux qui répond `true` doit **rester**, et un flux qui ne rend
 * rien du tout — forme ancienne — doit rester aussi, sinon la correction retirerait des connexions
 * vivantes dès qu'un appelant n'a pas été mis à jour.
 */
describe('notificationStreamManager', () => {
  const UTILISATEUR = 4242

  /** Un flux dont on choisit la réponse, et qui retient ce qu'on lui a demandé. */
  const flux = (reponse: boolean | undefined) => {
    const objet = {
      envois: 0,
      fermetures: 0,
      push: () => {
        objet.envois += 1
        return reponse
      },
      close: () => {
        objet.fermetures += 1
      },
      onClosed: () => {},
    }
    return objet
  }

  const connexionsDe = (userId: number) =>
    notificationStreamManager.getStats().connectionsByUser.find((u) => u.userId === userId)
      ?.connections ?? 0

  /** Les connexions ouvertes par le cas en cours, à refermer après lui. */
  let ouvertes: string[] = []

  const ouvrir = (reponse: boolean | undefined) => {
    const objet = flux(reponse)
    ouvertes.push(notificationStreamManager.addConnection(UTILISATEUR, objet))
    return objet
  }

  beforeEach(() => {
    ouvertes = []
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    /*
     * ⚠️ LE GESTIONNAIRE EST UN SINGLETON : ses Maps survivent d'un cas à l'autre. Sans ce
     * nettoyage, le compte d'un cas précédent décide du suivant — et les témoins, qui comptent des
     * connexions vivantes, deviendraient faux pour une raison qui n'est pas la leur.
     */
    for (const id of ouvertes) notificationStreamManager.removeConnection(id)
    ouvertes = []
    vi.restoreAllMocks()
  })

  it('⚠️ RETIRE UNE CONNEXION QUI N’ACCEPTE PLUS RIEN', async () => {
    /*
     * LE CŒUR DU CONSTAT. Le flux dit « non » ; avant, cette réponse n'existait pas et la connexion
     * restait pour toujours, comptée et parcourue à chaque envoi.
     */
    const mort = ouvrir(false)
    expect(connexionsDe(UTILISATEUR)).toBe(1)

    await notificationStreamManager.sendMessengerTyping(UTILISATEUR, {
      conversationId: 'c1',
      typingUserId: 7,
      isTyping: true,
    })

    expect(mort.envois).toBe(1)
    expect(connexionsDe(UTILISATEUR)).toBe(0)
  })

  it('garde une connexion qui accepte', async () => {
    /*
     * LE TÉMOIN. Sans lui, un gestionnaire qui retirerait la connexion à CHAQUE envoi satisferait
     * le cas ci-dessus — et le flux serait coupé au premier message, pour tout le monde.
     */
    ouvrir(true)

    await notificationStreamManager.sendMessengerTyping(UTILISATEUR, {
      conversationId: 'c1',
      typingUserId: 7,
      isTyping: true,
    })

    expect(connexionsDe(UTILISATEUR)).toBe(1)
  })

  it('garde un flux qui ne répond pas', async () => {
    /*
     * SECOND TÉMOIN. `push` rendait `void`. Traiter l'absence de réponse comme un refus retirerait
     * des connexions vivantes dès qu'un appelant n'a pas été mis à jour — une correction qui coupe
     * ce qu'elle prétend protéger.
     */
    ouvrir(undefined)

    await notificationStreamManager.sendMessengerTyping(UTILISATEUR, {
      conversationId: 'c1',
      typingUserId: 7,
      isTyping: true,
    })

    expect(connexionsDe(UTILISATEUR)).toBe(1)
  })

  it('⚠️ RETIRE AUSSI AU PING, et c’est là que le nettoyage reprend vie', async () => {
    /*
     * `pingConnections` tourne toutes les trente secondes. C'est lui qui aurait dû repérer les
     * connexions mortes : il posait `lastPing = new Date()` juste après le `push`, quoi qu'il
     * advienne — c'est précisément ce qui rendait `cleanupStaleConnections` et son seuil de deux
     * minutes inatteignables, puisque l'horodatage d'une connexion morte se rafraîchissait sans
     * cesse.
     */
    ouvrir(false)

    await notificationStreamManager.pingConnections()

    expect(connexionsDe(UTILISATEUR)).toBe(0)
  })

  it('ne retire pas une connexion vivante au ping', async () => {
    // Le témoin du cas ci-dessus : le ping ne doit pas devenir une purge.
    ouvrir(true)

    await notificationStreamManager.pingConnections()

    expect(connexionsDe(UTILISATEUR)).toBe(1)
  })

  it('⚠️ FERME LE FLUX QUAND IL RETIRE LA CONNEXION', () => {
    /*
     * Retirer la connexion de ses Maps sans fermer le contrôleur laissait le client avec une
     * connexion que plus rien n'alimentait : il attendait son délai de ping avant de se
     * reconnecter, alors qu'une fermeture propre l'y envoie tout de suite.
     */
    const vivant = ouvrir(true)

    notificationStreamManager.removeConnection(ouvertes[0]!)

    expect(vivant.fermetures).toBe(1)
  })

  it('survit à un flux dont la fermeture lève', () => {
    /*
     * Un contrôleur déjà fermé peut lever. Le retrait ne doit pas s'interrompre pour autant : la
     * connexion resterait dans les Maps pour la seule raison qu'on n'a pas pu la fermer, ce qui est
     * exactement le défaut qu'on vient de corriger.
     */
    const recalcitrant = {
      push: () => true,
      close: () => {
        throw new Error('déjà fermé')
      },
      onClosed: () => {},
    }
    const id = notificationStreamManager.addConnection(UTILISATEUR, recalcitrant)
    ouvertes.push(id)

    expect(() => notificationStreamManager.removeConnection(id)).not.toThrow()
    expect(connexionsDe(UTILISATEUR)).toBe(0)
  })
})
