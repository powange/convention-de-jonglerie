import { describe, it, expect, vi, beforeEach } from 'vitest'

const canAccessEditionData = vi.hoisted(() => vi.fn(async () => false))

vi.mock('../../../../../server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData,
}))

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event?.context?.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

import lire from '../../../../../server/api/editions/[id]/posts/index.get'
import publier from '../../../../../server/api/editions/[id]/posts/index.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Les publications d'une édition RETIRÉE de la vue du public.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. `GET /api/editions/:id/posts` est une route PUBLIQUE, et elle ne
 * vérifiait que l'EXISTENCE de l'édition — jamais son statut. Les publications et les commentaires
 * d'une édition `OFFLINE`, PSEUDOS ET AVATARS DES AUTEURS COMPRIS, restaient donc lisibles à qui
 * connaissait son numéro, alors que la fiche de cette même édition répond 404. Et le POST acceptait
 * d'y publier.
 *
 * 📍 POURQUOI ICI ET PAS AILLEURS : les publications n'ont PAS de drapeau de publication propre,
 * contrairement au programme (`programPagePublic`) ou à la carte (`mapPublic`). Le statut de
 * l'édition est donc leur SEUL verrou, et c'est ce qui rend son absence coûteuse. Les deux autres
 * surfaces exigent, elles, un geste explicite de l'organisateur.
 *
 * ⚠️ 404 ET NON 403, comme la fiche et le programme : distinguer les deux dirait à un visiteur
 * qu'il existe quelque chose à voir derrière ce numéro.
 */

const EDITION = 7
const anonyme = { context: {} } as any
const connecte = { context: { user: { id: 3 } } } as any

const edition = (status: string, extra: Record<string, unknown> = {}) => ({
  id: EDITION,
  status,
  creatorId: 1,
  convention: { authorId: 2 },
  ...extra,
})

describe('GET /api/editions/[id]/posts — visibilité de l’édition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue(String(EDITION))
    canAccessEditionData.mockResolvedValue(false as never)
    prismaMock.editionPost.findMany.mockResolvedValue([])
  })

  it('REFUSE un anonyme sur une édition hors ligne', async () => {
    /*
     * 🔬 L'assertion qui porte le lot. Et la seconde compte autant : il ne faut pas seulement
     * refuser, il faut refuser AVANT de lire les publications — sinon la requête part, la charge
     * est composée, et seul le code de réponse change.
     */
    prismaMock.edition.findUnique.mockResolvedValue(edition('OFFLINE'))

    await expect(lire(anonyme)).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.editionPost.findMany).not.toHaveBeenCalled()
  })

  it('REFUSE un simple connecté, étranger à l’organisation', async () => {
    // Être connecté ne donne aucun droit sur une édition qu'on n'organise pas.
    prismaMock.edition.findUnique.mockResolvedValue(edition('OFFLINE'))

    await expect(lire(connecte)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('ACCEPTE qui fait partie de l’organisation', async () => {
    /*
     * La route est publique mais porte `hydrateSession: true` dans `public-routes.ts` : la session
     * est donc disponible, et un organisateur voit bien les publications de son édition hors
     * ligne. Sans cette hydratation, la garde aurait fermé la porte à tout le monde.
     */
    prismaMock.edition.findUnique.mockResolvedValue(edition('OFFLINE'))
    canAccessEditionData.mockResolvedValue(true as never)

    await expect(lire(connecte)).resolves.toBeDefined()
    expect(canAccessEditionData).toHaveBeenCalledWith(EDITION, 3, connecte)
  })

  it('n’interroge PAS les droits pour un anonyme', async () => {
    // Inutile, et `canAccessEditionData` attend un identifiant : l'appeler sans session
    // interrogerait la base pour rien.
    prismaMock.edition.findUnique.mockResolvedValue(edition('OFFLINE'))

    await expect(lire(anonyme)).rejects.toMatchObject({ statusCode: 404 })
    expect(canAccessEditionData).not.toHaveBeenCalled()
  })

  it.each(['PUBLISHED', 'PLANNED', 'CANCELLED'])(
    'laisse passer un anonyme sur une édition %s',
    async (status) => {
      /*
       * ⚠️ `CANCELLED` EST PUBLIC, et ce n'est pas un oubli : une annulation doit rester lisible
       * par ceux qui avaient prévu de venir — c'est même là que les publications comptent le plus.
       * La règle vit dans `shared/utils/visibilite-edition.ts`.
       */
      prismaMock.edition.findUnique.mockResolvedValue(edition(status))

      await expect(lire(anonyme)).resolves.toBeDefined()
      expect(canAccessEditionData).not.toHaveBeenCalled()
    }
  )

  it('laisse passer une édition ORPHELINE, même hors ligne', async () => {
    /*
     * 📍 Comportement REPRIS de la fiche d'une édition, pas inventé ici : une édition importée que
     * personne n'a revendiquée n'a ni créateur ni auteur de convention. Personne ne pourrait donc
     * jamais la lire, et la cacher à tout le monde reviendrait à la perdre.
     */
    prismaMock.edition.findUnique.mockResolvedValue(
      edition('OFFLINE', { creatorId: null, convention: { authorId: null } })
    )

    await expect(lire(anonyme)).resolves.toBeDefined()
  })

  it('rend 404 pour une édition inexistante', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(lire(anonyme)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('demande le STATUT dans sa requête', async () => {
    /*
     * ⚠️ On mesure la FORME de la requête, et ce n'est pas redondant : le mock de Prisma ignore le
     * `select`, donc tous les tests ci-dessus resteraient VERTS si `status` disparaissait du
     * `select` — c'est le mock qui décide de le rendre. En vrai, Prisma rendrait `undefined`, que
     * `editionVisiblePubliquement` lit comme « pas visible »… et la garde fermerait alors la porte
     * à TOUT LE MONDE, y compris sur une édition publiée.
     */
    prismaMock.edition.findUnique.mockResolvedValue(edition('PUBLISHED'))

    await lire(anonyme)

    const select = prismaMock.edition.findUnique.mock.calls[0][0].select
    expect(select.status).toBe(true)
    expect(select.creatorId).toBe(true)
    expect(select.convention.select.authorId).toBe(true)
  })
})

describe('POST /api/editions/[id]/posts — visibilité de l’édition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue(String(EDITION))
    global.readBody = vi.fn().mockResolvedValue({ content: 'Bonjour à tous' })
    canAccessEditionData.mockResolvedValue(false as never)
    prismaMock.editionPost.create.mockResolvedValue({ id: 1, content: 'Bonjour à tous' })
  })

  it('REFUSE de publier sur une édition hors ligne', async () => {
    /*
     * 🔬 Le message y restait — invisible de tous, y compris de son auteur dès qu'il quittait la
     * page. Écrire dans le vide est un défaut plus sournois qu'un refus : rien ne dit que c'est
     * arrivé.
     */
    prismaMock.edition.findUnique.mockResolvedValue(edition('OFFLINE'))

    await expect(publier(connecte)).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.editionPost.create).not.toHaveBeenCalled()
  })

  it('ACCEPTE un organisateur sur son édition hors ligne', async () => {
    // Un organisateur prépare parfois ses publications avant de publier l'édition.
    prismaMock.edition.findUnique.mockResolvedValue(edition('OFFLINE'))
    canAccessEditionData.mockResolvedValue(true as never)

    await expect(publier(connecte)).resolves.toBeTruthy()
  })

  it('ACCEPTE n’importe quel connecté sur une édition publiée', async () => {
    /*
     * ⚠️ L'espace de discussion reste OUVERT à toute personne connectée : ce lot ne change QUE la
     * visibilité de l'édition, pas qui peut y écrire. Le resserrer serait une autre décision.
     */
    prismaMock.edition.findUnique.mockResolvedValue(edition('PUBLISHED'))

    await expect(publier(connecte)).resolves.toBeTruthy()
    expect(canAccessEditionData).not.toHaveBeenCalled()
  })

  it('refuse un anonyme, avant même la question du statut', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(edition('PUBLISHED'))

    await expect(publier(anonyme)).rejects.toMatchObject({ statusCode: 401 })
  })
})
