import { describe, it, expect, beforeEach, vi } from 'vitest'

const droitAccorde = vi.hoisted(() => vi.fn(async () => false))
vi.mock('../../../../../server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: droitAccorde,
}))

import zones from '../../../../../server/api/editions/[id]/zones/index.get'
import markers from '../../../../../server/api/editions/[id]/markers/index.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Une carte non publique ne se lit pas par son adresse.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. L'interrupteur « Rendre la carte publique » n'était respecté que par
 * l'en-tête, qui masquait l'onglet. Les deux points d'API sont PUBLICS et ne lisaient ni
 * `siteMapEnabled` ni `mapPublic` : un visiteur qui connaissait l'adresse voyait une carte en cours
 * de préparation — ses repères de service, ses zones « espace interdit ».
 *
 * Masquer un onglet n'a jamais protégé une donnée.
 *
 * ⚠️⚠️ LA GARDE N'EST PAS « PEUT ÉDITER L'ÉDITION », contrairement à ce que l'analogie avec le
 * programme suggérait. Ces deux points d'API servent aussi au STOCK (placer du matériel), aux
 * ATELIERS (choisir une salle) et au sélecteur de lieu partagé. Les personnes qui tiennent ces
 * écrans ont `canManageStock` ou `canManageWorkshops`, PAS forcément le droit d'éditer l'édition :
 * une garde sur `canEditEditionById` aurait fermé trois écrans de gestion pour refermer une fuite.
 *
 * `canAccessEditionData` pose la bonne question — « fait-elle partie de l'organisation ? » — et
 * c'est déjà elle qui décide qu'on voit l'espace de gestion.
 */

const EDITION = 42

/** Un événement anonyme : pas de session. */
const anonyme = () => ({ context: { params: { id: String(EDITION) } } }) as any

/** Un événement porteur d'une session. */
const connecte = () => ({ context: { params: { id: String(EDITION) }, user: { id: 7 } } }) as any

const carte = (siteMapEnabled: boolean, mapPublic: boolean) => ({
  id: EDITION,
  siteMapEnabled,
  mapPublic,
})

describe.each([
  ['zones', zones, 'editionZone', 'zones'],
  ['markers', markers, 'editionMarker', 'markers'],
])('GET /api/editions/[id]/%s', (_nom, handler, modele, cle) => {
  beforeEach(() => {
    vi.clearAllMocks()
    droitAccorde.mockResolvedValue(false)
    global.validateEditionId = vi.fn(() => EDITION) as any
    prismaMock[modele].findMany.mockResolvedValue([])
  })

  it('REFUSE un anonyme quand la carte n’est pas publique', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(carte(true, false))

    await expect(handler(anonyme())).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock[modele].findMany).not.toHaveBeenCalled()
  })

  it('REFUSE un anonyme quand le module carte est éteint', async () => {
    // Publique mais désactivée : les deux drapeaux comptent, et l'un sans l'autre ne suffit pas.
    prismaMock.edition.findUnique.mockResolvedValue(carte(false, true))

    await expect(handler(anonyme())).rejects.toMatchObject({ statusCode: 404 })
  })

  it('ACCEPTE un anonyme quand la carte est publique', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(carte(true, true))

    const reponse: any = await handler(anonyme())

    expect(reponse.data[cle]).toEqual([])
    // Personne à interroger : la garde n'a pas eu à demander de droit.
    expect(droitAccorde).not.toHaveBeenCalled()
  })

  it('ACCEPTE quelqu’un de l’ORGANISATION sur une carte non publique', async () => {
    /*
     * 🔬 LE TEST QUI PROTÈGE LES ÉCRANS DE GESTION. C'est le cas normal pendant la préparation :
     * la carte n'est pas publique, et le stock doit quand même pouvoir y placer du matériel.
     */
    prismaMock.edition.findUnique.mockResolvedValue(carte(true, false))
    droitAccorde.mockResolvedValue(true)

    const reponse: any = await handler(connecte())

    expect(reponse.data[cle]).toEqual([])
    expect(droitAccorde).toHaveBeenCalledWith(EDITION, 7, expect.anything())
  })

  it('REFUSE quelqu’un de connecté mais ÉTRANGER à l’édition', async () => {
    // Une session ne vaut pas un droit : c'est `canAccessEditionData` qui tranche.
    prismaMock.edition.findUnique.mockResolvedValue(carte(true, false))
    droitAccorde.mockResolvedValue(false)

    await expect(handler(connecte())).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rend 404 et non 403, pour ne rien révéler', async () => {
    /*
     * ⚠️ Distinguer les deux dirait à un visiteur qu'il EXISTE une carte à voir — ce qui n'est pas
     * son affaire tant qu'elle n'est pas publiée. C'est déjà le choix du programme, et les deux
     * pages doivent se comporter pareil.
     */
    prismaMock.edition.findUnique.mockResolvedValue(carte(true, false))

    await expect(handler(anonyme())).rejects.not.toMatchObject({ statusCode: 403 })
  })

  it('rend 404 pour une édition inexistante, sans demander de droit', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(handler(anonyme())).rejects.toMatchObject({ statusCode: 404 })
    expect(droitAccorde).not.toHaveBeenCalled()
  })
})
