import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../server/api/countries.get'
import { global } from '../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * `/api/countries` alimente le filtre « pays » de la page d'accueil. Elle est publique — elle
 * figure dans `public-routes.ts`, sans session — et elle honorait `?includeOffline=true` comme sa
 * jumelle `/api/editions` : n'importe quel visiteur anonyme apprenait ainsi dans quels pays se
 * trouvent des éditions volontairement cachées.
 *
 * Elle en dit moins que la liste des éditions, mais c'était le même interrupteur, et il n'avait
 * aucun appelant : le composant `CountryMultiSelect` recopie les filtres de la page, où
 * `includeOffline` n'a jamais figuré.
 */
describe('GET /api/countries', () => {
  const publique = { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getQuery = vi.fn().mockReturnValue({})
    prismaMock.edition.findMany.mockResolvedValue([{ country: 'France' }])
  })

  const clauseDuDernierAppel = () => prismaMock.edition.findMany.mock.calls.at(-1)![0].where

  it('ne retient que les éditions visibles d’un visiteur', async () => {
    await handler({} as any)

    expect(clauseDuDernierAppel().status).toEqual(publique)
  })

  it('ne montre pas les pays des éditions cachées, même si l’URL le demande', async () => {
    global.getQuery.mockReturnValue({ includeOffline: 'true' })

    await handler({} as any)

    expect(clauseDuDernierAppel().status.in).not.toContain('OFFLINE')
    expect(clauseDuDernierAppel().status).toEqual(publique)
  })

  it('rend exactement la même chose avec et sans le paramètre', async () => {
    // Ce n'est pas seulement que OFFLINE a disparu : c'est que le paramètre ne change plus rien.
    global.getQuery.mockReturnValue({})
    await handler({} as any)
    const sansParametre = clauseDuDernierAppel()

    global.getQuery.mockReturnValue({ includeOffline: 'true' })
    await handler({} as any)

    expect(clauseDuDernierAppel()).toEqual(sansParametre)
  })

  it('garde le filtre de statut quand d’autres filtres s’ajoutent', async () => {
    // Le statut est posé sur le même objet `where` que les services : une refonte de la
    // construction de la clause pourrait le perdre sans que les cas nus ci-dessus s'en aperçoivent.
    global.getQuery.mockReturnValue({ hasGala: 'true', includeOffline: 'true' })

    await handler({} as any)

    expect(clauseDuDernierAppel()).toMatchObject({ hasGala: true, status: publique })
  })
})
