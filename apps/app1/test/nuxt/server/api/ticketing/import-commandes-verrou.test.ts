import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

const mockRecuperer = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/editions/ticketing/helloasso', () => ({
  fetchOrdersFromHelloAsso: mockRecuperer,
}))

vi.mock('#server/utils/encryption', () => ({
  decrypt: () => 'secret-en-clair',
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/helloasso/import.post'
import { synchronisationsEnCours } from '../../../../../../../layers/ticketing/server/utils/synchronisation-unique'

const prismaMock = (globalThis as any).prisma

/**
 * L'import des commandes passe par le verrou anti-concurrence — constat B6.
 *
 * ## ⚠️ POURQUOI CE VERROU EXISTE, et pourquoi son absence ici était grave
 *
 * Il a été posé après la **panne du 23 août 2026** — « Lock wait timeout exceeded », pool de
 * connexions épuisé — mais sur la synchronisation des **tarifs seulement**. L'import des commandes,
 * qui est **la transaction la plus lourde du module** (une boucle d'upserts sur toutes les
 * commandes), restait dehors.
 *
 * Or c'est lui que déclenche le bouton « Synchroniser HelloAsso » de l'écran de contrôle d'accès,
 * **ouvert simultanément sur plusieurs téléphones à l'entrée**. Deux agents qui cliquent à la même
 * minute reproduisaient exactement le scénario de la panne : chaque requête bloquée retient une
 * connexion cinquante secondes durant, et quelques rechargements suffisent à épuiser le pool. Ce
 * n'est alors plus le guichet qui tombe, **mais toute l'application**.
 *
 * ## Ce que ces tests mesurent
 *
 * `synchronisationUnique` n'est **pas** remplacé par un bouchon ici — c'est la vraie
 * implémentation qui tourne, sinon on éprouverait le bouchon. On lance donc **deux appels
 * réellement simultanés** et l'on compte les appels à l'API HelloAsso.
 */
const evenement = { context: { params: { id: '22' }, user: { id: 5 } } } as never
const autreEdition = { context: { params: { id: '23' }, user: { id: 5 } } } as never

/** Un appel à HelloAsso qui ne résout qu'à la demande : sans cela il n'y a pas de simultanéité. */
function appelSuspendu() {
  let liberer: (valeur: unknown) => void = () => {}
  const promesse = new Promise((resoudre) => {
    liberer = resoudre
  })
  return {
    liberer: () => liberer({ data: [], pagination: { totalCount: 0 } }),
    attendre: () => promesse,
  }
}

describe('import des commandes — une seule synchronisation à la fois', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.externalTicketing.findUnique.mockResolvedValue({
      id: 'ext-1',
      editionId: 22,
      helloAssoConfig: {
        clientId: 'cid',
        clientSecret: 'chiffre',
        organizationSlug: 'org',
        formType: 'Event',
        formSlug: 'form',
      },
    })
    prismaMock.$transaction.mockImplementation(async (travail: any) => travail(prismaMock))
    prismaMock.ticketingTier.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItem.count.mockResolvedValue(0)
    prismaMock.ticketingOrder.count.mockResolvedValue(0)
    prismaMock.externalTicketing.update.mockResolvedValue({})
  })

  it('⚠️ DEUX APPELS SIMULTANÉS N’INTERROGENT HELLOASSO QU’UNE FOIS', async () => {
    const appel = appelSuspendu()
    mockRecuperer.mockImplementation(() => appel.attendre())

    // Les deux partent AVANT toute résolution : c'est la seule façon de reproduire deux
    // téléphones qui cliquent à la même minute.
    const premier = handler(evenement)
    const second = handler(evenement)
    appel.liberer()
    const [a, b] = await Promise.all([premier, second])

    expect(mockRecuperer).toHaveBeenCalledTimes(1)
    // Le second reçoit le résultat du premier — pas un refus, pas une réponse vide.
    expect(b).toEqual(a)
  })

  it('⚠️ DEUX ÉDITIONS DIFFÉRENTES NE SE BLOQUENT PAS', async () => {
    /*
     * LE TÉMOIN NÉGATIF, sans lequel un verrou GLOBAL satisferait le cas précédent — et
     * sérialiserait alors les synchronisations de toutes les conventions entre elles, ce qui
     * transformerait la protection en goulot. La clé porte l'identifiant de l'édition ; ce cas
     * le fige.
     */
    const appel = appelSuspendu()
    mockRecuperer.mockImplementation(() => appel.attendre())

    const a = handler(evenement)
    const b = handler(autreEdition)
    // Les deux doivent avoir ATTEINT l'appel à HelloAsso, donc ne pas s'attendre l'un l'autre.
    await vi.waitFor(() => expect(mockRecuperer).toHaveBeenCalledTimes(2))
    appel.liberer()
    await Promise.all([a, b])
  })

  it('le verrou est relâché après coup — une seconde synchronisation reste possible', async () => {
    /*
     * Un verrou qui ne se relâche pas transformerait la protection en blocage définitif : plus
     * aucune synchronisation jusqu'au redémarrage du processus. `synchronisationsEnCours` est
     * exporté pour cela, et c'est la seule prise sur l'état interne.
     */
    mockRecuperer.mockResolvedValue({ data: [], pagination: { totalCount: 0 } })

    await handler(evenement)
    expect(synchronisationsEnCours()).toBe(0)

    await handler(evenement)
    expect(mockRecuperer).toHaveBeenCalledTimes(2)
  })

  it('⚠️ UN APPEL SANS DROIT EST REFUSÉ TOUT DE SUITE, sans attendre le verrou', async () => {
    /*
     * Le verrou est posé APRÈS les contrôles de droits, et ce n'est pas un détail d'ordre : un
     * appel sans droit n'a pas à attendre la fin d'une synchronisation à laquelle il n'a pas
     * accès. Placé avant, il aurait fait patienter un intrus — et, plus gênant, un simple
     * rechargement non autorisé aurait allongé la file.
     */
    const appel = appelSuspendu()
    mockRecuperer.mockImplementation(() => appel.attendre())
    const legitime = handler(evenement)

    mockCanManage.mockResolvedValue(false)
    await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 403 })

    appel.liberer()
    await legitime
  })
})
