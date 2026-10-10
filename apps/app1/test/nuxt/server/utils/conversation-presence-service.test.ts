import { describe, it, expect, beforeEach, vi } from 'vitest'

import { conversationPresenceService } from '../../../../server/utils/conversation-presence-service'

const prismaMock = (globalThis as any).prisma

const diffusions = vi.hoisted(() => ({ sendPresenceToUsers: vi.fn() }))
vi.mock('../../../../server/utils/messenger-unread-service', () => ({
  messengerStreamService: diffusions,
}))

/**
 * La présence dans une conversation, et ce que fermer un onglet en dit aux autres.
 *
 * ## ⚠️ LE DÉFAUT (constat B6)
 *
 * La présence était un `Set<userId>` par conversation. Chaque flux SSE ouvert appelait
 * `markPresent`, chaque fermeture `markAbsent`, **sans compteur**. Avec deux onglets sur la même
 * conversation — ou un téléphone et un ordinateur —, fermer le premier retirait la personne de
 * l'ensemble et diffusait « absent » aux autres participants, alors que le second lisait toujours.
 * La pastille verte et la liste des présents devenaient fausses jusqu'à une nouvelle connexion.
 *
 * Un simple rechargement de page produisait le même symptôme en plus bref : fermeture puis
 * réouverture, donc un **clignotement absent/présent diffusé à tous**.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * Deux mesures, et non une. L'état interne (`isPresent`, `getPresentUsers`) dit qui est là ; les
 * **diffusions** disent ce que les autres participants ont appris. Un service qui garderait le bon
 * état en diffusant un départ à chaque onglet fermé satisferait la première sans régler le défaut —
 * car c'est la diffusion, et elle seule, qui éteint la pastille chez les autres.
 *
 * Le témoin est la fermeture du DERNIER onglet : sans lui, un service qui ne diffuserait plus
 * jamais de départ passerait tous les autres cas, et la pastille resterait verte pour toujours.
 */
describe('conversationPresenceService', () => {
  const CONVERSATION = 'conv-1'
  const MOI = 7
  const AUTRE = 8

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    diffusions.sendPresenceToUsers.mockResolvedValue(undefined)
    // Les participants de la conversation : c'est à eux que la présence est diffusée.
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      { userId: MOI },
      { userId: AUTRE },
    ])
    // Le service est un singleton : chaque cas repart d'une conversation vide, sans quoi l'état
    // d'un cas précédent déciderait du suivant.
    conversationPresenceService.cleanupUser(MOI)
    conversationPresenceService.cleanupUser(AUTRE)
    conversationPresenceService.invalidateParticipantsCache(CONVERSATION)
    vi.clearAllMocks()
    diffusions.sendPresenceToUsers.mockResolvedValue(undefined)
    prismaMock.conversationParticipant.findMany.mockResolvedValue([
      { userId: MOI },
      { userId: AUTRE },
    ])
  })

  /** Les départs diffusés aux autres participants. */
  const departsDiffuses = () =>
    diffusions.sendPresenceToUsers.mock.calls.filter(([, charge]: [any, any]) => !charge.isPresent)

  /** Les arrivées diffusées aux autres participants. */
  const arriveesDiffusees = () =>
    diffusions.sendPresenceToUsers.mock.calls.filter(([, charge]: [any, any]) => charge.isPresent)

  it('⚠️ RESTE PRÉSENT QUAND UN SEUL DE DEUX ONGLETS SE FERME', async () => {
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markPresent(MOI, CONVERSATION)

    conversationPresenceService.markAbsent(MOI, CONVERSATION)

    expect(conversationPresenceService.isPresent(MOI, CONVERSATION)).toBe(true)
    expect(conversationPresenceService.getPresentUsers(CONVERSATION)).toEqual([MOI])
  })

  it('⚠️ ET N’ANNONCE AUCUN DÉPART AUX AUTRES PARTICIPANTS', async () => {
    /*
     * LE CŒUR DU CONSTAT, et la mesure que l'état interne ne donne pas. C'est cette diffusion qui
     * éteint la pastille verte chez les autres : la retenir est tout ce qui compte pour eux.
     */
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markAbsent(MOI, CONVERSATION)

    await vi.waitFor(() => expect(arriveesDiffusees()).toHaveLength(1))
    expect(departsDiffuses()).toHaveLength(0)
  })

  it('n’annonce qu’UNE arrivée pour deux onglets', async () => {
    // Un deuxième onglet n'est pas une arrivée : l'annoncer ferait clignoter la liste des présents
    // chez tout le monde sans que personne ne soit arrivé.
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markPresent(MOI, CONVERSATION)

    await vi.waitFor(() => expect(arriveesDiffusees()).toHaveLength(1))
  })

  it('annonce bien le départ quand le DERNIER onglet se ferme', async () => {
    /*
     * LE TÉMOIN. Sans lui, un service qui ne diffuserait plus jamais de départ — ou qui ne
     * décrémenterait pas — satisferait tous les cas ci-dessus, et la pastille resterait verte pour
     * une personne partie depuis longtemps.
     */
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markAbsent(MOI, CONVERSATION)
    conversationPresenceService.markAbsent(MOI, CONVERSATION)

    expect(conversationPresenceService.isPresent(MOI, CONVERSATION)).toBe(false)
    await vi.waitFor(() => expect(departsDiffuses()).toHaveLength(1))
  })

  it('ignore une fermeture de trop', () => {
    // Le `cleanup` du flux est gardé par un drapeau, mais un appel en double ne doit pas faire
    // passer le compte sous zéro : la personne deviendrait indéboulonnable à la connexion suivante.
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markAbsent(MOI, CONVERSATION)
    conversationPresenceService.markAbsent(MOI, CONVERSATION)

    conversationPresenceService.markPresent(MOI, CONVERSATION)

    expect(conversationPresenceService.isPresent(MOI, CONVERSATION)).toBe(true)
    conversationPresenceService.markAbsent(MOI, CONVERSATION)
    expect(conversationPresenceService.isPresent(MOI, CONVERSATION)).toBe(false)
  })

  it('une déconnexion globale emporte TOUS les onglets', async () => {
    /*
     * `cleanupUser` décrémentait d'une seule connexion, comme la fermeture d'un onglet. Une
     * personne avec deux onglets y restait donc présente avec un onglet fantôme qui ne se refermera
     * jamais — et plus rien, ensuite, ne viendrait corriger ce compte.
     */
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markPresent(MOI, 'conv-2')

    conversationPresenceService.cleanupUser(MOI)

    expect(conversationPresenceService.isPresent(MOI, CONVERSATION)).toBe(false)
    expect(conversationPresenceService.isPresent(MOI, 'conv-2')).toBe(false)
    expect(conversationPresenceService.getPresenceCount(CONVERSATION)).toBe(0)
  })

  it('compte les personnes, pas les connexions', () => {
    // `getPresenceCount` alimente un affichage : deux onglets d'une même personne ne font pas deux
    // présents, sans quoi la conversation annoncerait plus de monde qu'elle n'en contient.
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markPresent(MOI, CONVERSATION)
    conversationPresenceService.markPresent(AUTRE, CONVERSATION)

    expect(conversationPresenceService.getPresenceCount(CONVERSATION)).toBe(2)
    expect(conversationPresenceService.getStats().conversations[0]).toMatchObject({
      conversationId: CONVERSATION,
      userCount: 2,
    })
  })
})
