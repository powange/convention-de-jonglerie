import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { counterStreamManager } from '../../../../server/utils/ticketing-counter-sse'

import type { TicketingCounter } from '#server/types/prisma'

/**
 * Le flux des compteurs de billetterie, et la connexion morte qu'il gardait — constat A2, 2ᵉ site.
 *
 * ## ⚠️ LE MÊME DÉFAUT, ET IL SE VOIT DAVANTAGE ICI
 *
 * Le constat ne nommait que le flux des notifications. Le flux des **compteurs** portait le même
 * défaut, ligne pour ligne : son `push` attrapait l'erreur d'`enqueue` et retournait sans rien
 * dire, donc le `try/catch` de `broadcastUpdate` ne pouvait jamais se déclencher.
 *
 * Et la conséquence est visible à l'écran : la page du compteur affiche le **nombre de personnes
 * connectées**, tiré de `getConnectionCount`. Une connexion morte y restait comptée — au guichet,
 * c'est le chiffre qui dit si un collègue tient l'autre entrée.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * On mesure `getConnectionCount`, c'est-à-dire **le chiffre affiché**. Un test qui vérifierait que
 * `push` a été appelé serait vert avant comme après : le défaut n'était pas dans l'appel, mais dans
 * ce qu'on faisait de sa réponse.
 */
describe('counterStreamManager — une connexion qui n’accepte plus rien', () => {
  const EDITION = 77
  const COMPTEUR = 9

  const COMPTEUR_RENDU = {
    id: COMPTEUR,
    name: 'Entrée principale',
    value: 12,
    updatedAt: new Date('2026-06-15T10:00:00Z'),
  } as unknown as TicketingCounter

  /** Un flux dont on choisit la réponse. */
  const flux = (reponse: boolean | undefined) => {
    const objet = {
      envois: 0,
      push: () => {
        objet.envois += 1
        return reponse
      },
      close: () => {},
    }
    return objet
  }

  let ouvertes: string[] = []

  const ouvrir = (reponse: boolean | undefined) => {
    const objet = flux(reponse)
    ouvertes.push(counterStreamManager.addConnection(EDITION, COMPTEUR, objet))
    return objet
  }

  const connectees = () => counterStreamManager.getConnectionCount(EDITION, COMPTEUR)

  beforeEach(() => {
    ouvertes = []
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Le gestionnaire est un singleton : sans ce nettoyage, le compte d'un cas décide du suivant.
    for (const id of ouvertes) counterStreamManager.removeConnection(id, EDITION, COMPTEUR)
    ouvertes = []
    vi.restoreAllMocks()
  })

  it('⚠️ N’EST PLUS COMPTÉE PARMI LES PERSONNES CONNECTÉES', () => {
    const mort = ouvrir(false)
    expect(connectees()).toBe(1)

    counterStreamManager.broadcastUpdate(EDITION, COMPTEUR, COMPTEUR_RENDU, 'Alice')

    expect(mort.envois).toBe(1)
    expect(connectees()).toBe(0)
  })

  it('tandis qu’une connexion vivante reste comptée', () => {
    /*
     * LE TÉMOIN. Sans lui, un gestionnaire qui retirerait la connexion à chaque diffusion
     * satisferait le cas ci-dessus — et l'écran annoncerait « 0 connecté » juste après chaque
     * comptage, c'est-à-dire exactement quand on le regarde.
     */
    ouvrir(true)

    counterStreamManager.broadcastUpdate(EDITION, COMPTEUR, COMPTEUR_RENDU, 'Alice')

    expect(connectees()).toBe(1)
  })

  it('garde un flux qui ne répond pas', () => {
    // Traiter l'absence de réponse comme un refus couperait des connexions vivantes dès qu'un
    // appelant n'a pas été mis à jour : une correction qui casse ce qu'elle protège.
    ouvrir(undefined)

    counterStreamManager.broadcastUpdate(EDITION, COMPTEUR, COMPTEUR_RENDU, 'Alice')

    expect(connectees()).toBe(1)
  })

  it('ne retire que la connexion fautive', () => {
    /*
     * Le cas qui compte vraiment au guichet : deux appareils, un seul mort. Retirer les deux —
     * ou n'en retirer aucun — fausse le chiffre dans les deux sens.
     */
    ouvrir(false)
    ouvrir(true)
    expect(connectees()).toBe(2)

    counterStreamManager.broadcastUpdate(EDITION, COMPTEUR, COMPTEUR_RENDU, 'Alice')

    expect(connectees()).toBe(1)
  })
})
