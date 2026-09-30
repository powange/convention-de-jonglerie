import { describe, it, expect, vi, beforeEach } from 'vitest'

const assurerCarteLisible = vi.hoisted(() => vi.fn(async () => undefined))
const canManageProgram = vi.hoisted(() => vi.fn(async () => false))

vi.mock('../../../../../server/utils/carte-lisible', () => ({ assurerCarteLisible }))
vi.mock('../../../../../server/utils/permissions/program-permissions', () => ({
  canManageProgram,
}))

import exporterKml from '../../../../../server/api/editions/[id]/export.kml.get'
import lireProgramme from '../../../../../server/api/editions/[id]/program.get'
import { trouverRoutePublique } from '../../../../../server/constants/public-routes'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * L'export KML, et les brouillons du programme.
 *
 * ⚠️ DEUX DÉFAUTS DE MÊME FAMILLE : une règle écrite deux fois, qui a divergé.
 *
 * • L'export KML était INATTEIGNABLE. Le handler est écrit pour le public — il vérifie la
 *   publication de la carte, pose un `Content-Disposition` — et son accès public est même testé.
 *   Mais la route n'était pas inscrite dans `public-routes.ts` : le middleware répondait 401 à
 *   tout visiteur AVANT d'atteindre cette vérification. Et aucun écran ne proposait le lien.
 *   Une fonctionnalité complète, éprouvée, et offerte nulle part.
 *
 * • La LECTURE du programme et ses ÉCRITURES ne posaient pas la même question. Les écritures
 *   passent par `canManageProgram`, qui accorde le droit à tout administrateur global —
 *   précisément pour les conventions non revendiquées. La lecture passait par
 *   `canEditEditionById`, qui ne le reconnaît qu'en MODE ADMIN. Un administrateur pouvait donc
 *   créer des éléments (201) et ne pas les voir dans la frise.
 */

const EDITION = 7

describe('GET /api/editions/[id]/export.kml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue(String(EDITION))
    global.setHeader = vi.fn()
    assurerCarteLisible.mockResolvedValue(undefined as never)
    prismaMock.edition.findUnique.mockResolvedValue({
      id: EDITION,
      name: 'Édition 2026',
      siteMapEnabled: true,
      mapPublic: true,
      convention: { name: 'Convention' },
    })
    prismaMock.editionZone.findMany.mockResolvedValue([])
    prismaMock.editionMarker.findMany.mockResolvedValue([])
  })

  it('🔬 est inscrite dans les routes PUBLIQUES, session hydratée', () => {
    /*
     * L'assertion qui ferme le défaut principal : sans cette entrée, le middleware répond 401 et
     * rien du handler ne s'exécute — sa vérification de publication comprise. Aucun test du
     * handler ne pouvait donc révéler l'inaccessibilité.
     *
     * `hydrateSession` compte autant : la garde laisse passer l'organisation, ce qui exige que la
     * session soit lue malgré le caractère public de la route.
     */
    const entree = trouverRoutePublique(`/api/editions/${EDITION}/export.kml`, 'GET')

    expect(entree).toBeDefined()
    expect(entree?.hydrateSession).toBe(true)
  })

  it('n’ouvre pas la route à d’autres chemins', () => {
    // Un motif trop large rendrait publics des points d'API voisins, et une méthode oubliée
    // ouvrirait l'écriture.
    expect(trouverRoutePublique('/api/editions/1/export.kml', 'GET')).toBeDefined()
    expect(trouverRoutePublique('/api/editions/1/export.kml/secret', 'GET')).toBeUndefined()
    expect(trouverRoutePublique('/api/editions/abc/export.kml', 'GET')).toBeUndefined()
    expect(trouverRoutePublique('/api/editions/1/export.kml', 'POST')).toBeUndefined()
  })

  it('passe par la MÊME garde que les zones et les marqueurs', async () => {
    /*
     * ⚠️ Le handler ne regardait que `mapPublic`, PAS `siteMapEnabled`. Rendre la route publique
     * sans corriger cela aurait ouvert l'écart que #644 vient de fermer : une carte dont le
     * MODULE est éteint aurait livré son KML, là que `/zones` et `/markers` le refusent. Un
     * export est une copie complète du plan — le pire endroit pour une exception.
     */
    await exporterKml({ context: {} } as never)

    expect(assurerCarteLisible).toHaveBeenCalledTimes(1)
    const edition = assurerCarteLisible.mock.calls[0][2] as Record<string, unknown>
    expect(edition.siteMapEnabled).toBe(true)
    expect(edition.mapPublic).toBe(true)
  })

  it('demande les DEUX drapeaux dans sa requête', async () => {
    /*
     * On mesure la forme du `select`, et ce n'est pas redondant : le mock de Prisma l'ignore, donc
     * le test précédent resterait VERT si `siteMapEnabled` disparaissait — c'est le mock qui
     * décide de le rendre. En vrai, la garde lirait `undefined` et fermerait la porte à tout le
     * monde.
     */
    await exporterKml({ context: {} } as never)

    const select = prismaMock.edition.findUnique.mock.calls[0][0].select
    expect(select.siteMapEnabled).toBe(true)
    expect(select.mapPublic).toBe(true)
  })

  it('laisse remonter le refus de la garde, sans rien exporter', async () => {
    // 404 et non 403 : distinguer les deux dirait qu'il existe une carte derrière ce numéro.
    assurerCarteLisible.mockRejectedValue(
      createError({
        status: 404,
        message: 'La carte n’est pas publique pour cette édition',
      }) as never
    )

    await expect(exporterKml({ context: {} } as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.editionZone.findMany).not.toHaveBeenCalled()
  })

  it('rend 404 pour une édition inexistante', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(exporterKml({ context: {} } as never)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('GET /api/editions/[id]/program — qui voit les brouillons', () => {
  const administrateur = { id: 3, isGlobalAdmin: true }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue(String(EDITION))
    canManageProgram.mockResolvedValue(false as never)
    prismaMock.edition.findUnique.mockResolvedValue({
      id: EDITION,
      programEnabled: true,
      programPagePublic: false,
      timezone: 'Europe/Paris',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-03'),
    })
    prismaMock.editionProgramItem.findMany.mockResolvedValue([])
    prismaMock.workshop.findMany.mockResolvedValue([])
    prismaMock.showPerformance.findMany.mockResolvedValue([])
  })

  it('🔬 accorde les brouillons à un ADMIN GLOBAL hors mode admin', async () => {
    /*
     * L'assertion qui porte le point. Toutes les écritures du programme passent par
     * `canManageProgram`, qui accepte `isGlobalAdmin` sans mode admin — pour les conventions non
     * revendiquées, où l'administrateur n'est ni créateur ni organisateur. La lecture passait par
     * `canEditEditionById`, qui l'exige. Il créait donc des éléments que la frise ne lui rendait
     * pas, et recevait même 404 tant que la page n'était pas publique.
     */
    canManageProgram.mockResolvedValue(true as never)

    const reponse: any = await lireProgramme({ context: { user: administrateur } } as never)

    expect(reponse.data.inclutBrouillons).toBe(true)
    expect(canManageProgram).toHaveBeenCalledWith(EDITION, administrateur, expect.anything())
  })

  it('passe l’utilisateur COMPLET, et non son seul identifiant', async () => {
    /*
     * ⚠️ `canManageProgram` lit `user.isGlobalAdmin` : lui passer `user.id` comme le faisait
     * `canEditEditionById` perdrait précisément le drapeau qui fait la différence — et le
     * correctif serait sans effet, silencieusement.
     */
    canManageProgram.mockResolvedValue(true as never)

    await lireProgramme({ context: { user: administrateur } } as never)

    expect(canManageProgram.mock.calls[0][1]).toMatchObject({ isGlobalAdmin: true })
  })

  it('REFUSE un visiteur quand la page n’est pas publique', async () => {
    // Le comportement d'avant, conservé : 404 comme si le module était éteint.
    await expect(lireProgramme({ context: {} } as never)).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(canManageProgram).not.toHaveBeenCalled()
  })

  it('ne rend que le PUBLIÉ à qui ne gère pas', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      id: EDITION,
      programEnabled: true,
      programPagePublic: true,
      timezone: 'Europe/Paris',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-03'),
    })

    const reponse: any = await lireProgramme({ context: { user: { id: 9 } } } as never)

    expect(reponse.data.inclutBrouillons).toBe(false)
    // Et la requête filtre bien : c'est elle qui décide, pas l'affichage.
    const where = prismaMock.editionProgramItem.findMany.mock.calls[0][0].where
    expect(where.isPublic).toBe(true)
  })

  it('rend 404 quand le module est éteint', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      id: EDITION,
      programEnabled: false,
      programPagePublic: true,
    })

    await expect(
      lireProgramme({ context: { user: administrateur } } as never)
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
