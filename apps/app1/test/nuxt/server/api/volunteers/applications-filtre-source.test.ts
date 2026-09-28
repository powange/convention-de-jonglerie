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

vi.mock('#server/utils/organizer-management', () => ({
  canManageEditionVolunteers: async () => true,
}))

vi.mock('#server/utils/infos-personnelles', () => ({
  infosPersonnellesSelect: {},
  infosPersonnelles: () => ({}),
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    eventScope: { getRelatedEventIds: async () => [22] },
  }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/** Les conditions posées sur la dernière requête de candidatures. */
const conditions = () =>
  prismaMock.editionVolunteerApplication.findMany.mock.calls.at(-1)?.[0]?.where?.AND ?? []

/**
 * Le filtre par provenance : candidature spontanée, ou ajout par un organisateur.
 *
 * La colonne « Source » existait dans le tableau sans qu'on puisse s'en servir pour trier la
 * liste. Sur une édition où l'équipe ajoute des bénévoles à la main, c'est pourtant la question
 * qu'on pose le plus souvent : « qui s'est proposé de lui-même ? ».
 *
 * Le point délicat est le dernier test : `source` est un **enum** Prisma. Lui transmettre une
 * valeur venue de l'URL sans la reconnaître ferait échouer la requête entière, et l'écran
 * afficherait une erreur là où il suffit de ne pas filtrer.
 */
describe('GET /api/editions/[id]/volunteers/applications — filtre par provenance', () => {
  const evenement = { context: { params: { id: '22' }, user: { id: 1 } } }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.count.mockResolvedValue(0)
    prismaMock.event.findUnique.mockResolvedValue({ id: 22 })
  })

  const appeler = async (query: Record<string, string>) => {
    global.getQuery.mockReturnValue(query)
    await handler(evenement as any)
  }

  it('retient les candidatures spontanées', async () => {
    await appeler({ source: 'APPLICATION' })

    expect(conditions()).toContainEqual({ source: 'APPLICATION' })
  })

  it('retient les ajouts manuels', async () => {
    await appeler({ source: 'MANUAL' })

    expect(conditions()).toContainEqual({ source: 'MANUAL' })
  })

  it('ne filtre pas quand la provenance n’est pas demandée', async () => {
    await appeler({})

    expect(conditions().some((c: any) => 'source' in c)).toBe(false)
  })

  it('ignore une valeur inconnue plutôt que de faire échouer la requête', async () => {
    // Une URL trafiquée, ou vieillie : elle doit ouvrir un écran utilisable, pas une page en
    // échec. C'est la même règle que pour les autres filtres portés par l'URL.
    await appeler({ source: 'PEU_IMPORTE' })

    expect(conditions().some((c: any) => 'source' in c)).toBe(false)
  })
})
