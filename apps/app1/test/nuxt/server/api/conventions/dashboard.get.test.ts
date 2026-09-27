import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => event.context.user),
}))

const mockCheckAdminMode = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/organizer-management', () => ({
  checkAdminMode: mockCheckAdminMode,
}))

import { CONVENTION_RIGHTS, EDITION_RIGHTS } from '../../../../../shared/utils/organizer-rights'
import handler from '../../../../../server/api/conventions/[id]/dashboard.get'

const prismaMock = (globalThis as any).prisma

/**
 * Ce que le tableau de bord d'une convention rend des droits d'un organisateur.
 *
 * Cette réponse n'est pas qu'un affichage : la modale d'édition d'un organisateur de
 * « Mes conventions » la reprend telle quelle et la renvoie en PUT. Tout droit qu'elle omet arrive
 * donc absent dans le formulaire, s'y affiche décoché, et le serveur le réécrit à `false`.
 *
 * Sept droits de convention sur quinze et trois par édition sur onze étaient recopiés à la main.
 * Quelqu'un à qui l'on avait confié la billetterie d'une seule édition la perdait dès qu'un
 * responsable changeait son titre — sans message, et sans trace dans l'historique.
 *
 * D'où ces tests, qui comptent les droits au lieu de vérifier une liste écrite une seconde fois :
 * un droit ajouté à `EDITION_RIGHTS` ou `CONVENTION_RIGHTS` les fait tomber tant que ce point d'API
 * ne le rend pas.
 */
describe('GET /api/conventions/[id]/dashboard — droits des organisateurs', () => {
  const evenement = { context: { params: { id: '7' }, user: { id: 1 } } } as any

  /** Un organisateur à qui TOUT est accordé : un droit omis se verra comme un `false`. */
  const organisateurToutPuissant = {
    id: 3,
    title: 'Responsable',
    addedAt: new Date(),
    user: { id: 9, pseudo: 'camille' },
    ...Object.fromEntries(
      CONVENTION_RIGHTS.map((right) => [
        `can${right.charAt(0).toUpperCase()}${right.slice(1)}`,
        true,
      ])
    ),
    perEditionPermissions: [
      {
        editionId: 42,
        ...Object.fromEntries(EDITION_RIGHTS.map((right) => [right, true])),
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mode admin : évite la première requête de contrôle d'accès, qui n'est pas l'objet du test.
    mockCheckAdminMode.mockResolvedValue(true)
    prismaMock.convention.findUnique.mockResolvedValue({
      id: 7,
      editions: [],
      organizers: [organisateurToutPuissant],
    })
  })

  it('rend les quinze droits de convention', async () => {
    const reponse = (await handler(evenement)) as any
    const rights = reponse.organizers[0].rights

    expect(Object.keys(rights).sort()).toEqual([...CONVENTION_RIGHTS].sort())
    for (const right of CONVENTION_RIGHTS) {
      expect(rights[right], `droit de convention « ${right} »`).toBe(true)
    }
  })

  it('rend les onze droits par édition', async () => {
    const reponse = (await handler(evenement)) as any
    const parEdition = reponse.organizers[0].perEdition[0]

    expect(parEdition.editionId).toBe(42)
    for (const right of EDITION_RIGHTS) {
      expect(parEdition[right], `droit par édition « ${right} »`).toBe(true)
    }
  })

  it('rend `false` et non `undefined` pour un droit non accordé', async () => {
    /*
     * La nuance qui compte pour le formulaire : `undefined` se coche comme `false` à l'écran, mais
     * les deux ne voyagent pas pareil — un `undefined` dans le corps du PUT veut dire « non
     * fourni », et le serveur laisserait alors le droit inchangé. Mieux vaut dire explicitement non.
     */
    prismaMock.convention.findUnique.mockResolvedValue({
      id: 7,
      editions: [],
      organizers: [
        {
          ...organisateurToutPuissant,
          canManageTicketing: false,
          perEditionPermissions: [{ editionId: 42, canEdit: true }],
        },
      ],
    })

    const reponse = (await handler(evenement)) as any

    expect(reponse.organizers[0].rights.manageTicketing).toBe(false)
    expect(reponse.organizers[0].perEdition[0].canManageTicketing).toBe(false)
    expect(reponse.organizers[0].perEdition[0].canEdit).toBe(true)
  })

  it('rend un tableau vide quand l’organisateur n’a aucun droit par édition', async () => {
    prismaMock.convention.findUnique.mockResolvedValue({
      id: 7,
      editions: [],
      organizers: [{ ...organisateurToutPuissant, perEditionPermissions: [] }],
    })

    const reponse = (await handler(evenement)) as any

    expect(reponse.organizers[0].perEdition).toEqual([])
  })
})
