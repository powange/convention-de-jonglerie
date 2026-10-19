import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * La page des favoris : ce qu'elle montre, dans quel ordre, et ce qu'elle masque.
 *
 * ## Pourquoi ce fichier existe
 *
 * Elle n'avait **aucun test**, alors que `favorites.test.ts` en comptait dix-neuf dont treize
 * n'éprouvaient rien — l'illusion de couverture était double (#875). Les deux points d'API sont
 * désormais couverts ; voici l'écran.
 *
 * Et il porte de la vraie logique, qu'aucun test d'API n'atteint : le tri par date de début, le
 * masquage des éditions terminées, la pagination, et le filtrage sur ce que le magasin des favoris
 * déclare. Ce sont quatre règles écrites dans le `<script>` de la page, nulle part ailleurs.
 *
 * ## ⚠️ COMMENT CE TEST POURRAIT ÊTRE VERT SANS RIEN PROUVER
 *
 * Deux précautions, parce que les deux pièges sont réels dans ce dépôt :
 *
 * 1. **L'heure est FIGÉE.** La page masque les éditions dont `endDate` est passée : sans heure
 *    fixe, les cas seraient verts aujourd'hui et rouges dans un an. Seul `Date` est simulé, les
 *    minuteries restent réelles — le montage a besoin d'attendre.
 * 2. **UN TÉMOIN VÉRIFIE QUE LA PAGE CHARGE VRAIMENT.** Comme on sème l'état des magasins
 *    soi-même, une page qui n'appellerait plus rien au montage afficherait quand même les bonnes
 *    cartes, et tous les autres cas resteraient verts. Le premier cas assère donc que les DEUX
 *    actions de chargement ont été appelées. C'est exactement le piège du bouchon qui aveugle le
 *    test, et la raison pour laquelle on ne bouchonne pas `$fetch` ici : la page lit des magasins,
 *    on sème donc des magasins, et sa logique à elle reste réellement exercée.
 */
const MAINTENANT = new Date('2026-06-15T12:00:00Z')

/** Une édition réduite à ce que la page et la carte lisent. */
const edition = (id: number, nom: string, debut: string, fin: string) => ({
  id,
  name: nom,
  startDate: debut,
  endDate: fin,
  city: 'Paris',
  country: 'France',
  imageUrl: null,
  status: 'PUBLISHED',
  convention: { id: 1, name: 'Convention témoin' },
})

/*
 * Volontairement DANS LE DÉSORDRE, et mêlant favoris et non-favoris, passé et futur : un jeu déjà
 * trié ou tout favori laisserait le tri et le filtre indémontrables.
 */
const PASSEE = edition(1, 'Favorite terminée', '2026-01-10T10:00:00Z', '2026-01-12T18:00:00Z')
const TARDIVE = edition(2, 'Favorite en septembre', '2026-09-01T10:00:00Z', '2026-09-03T18:00:00Z')
const PROCHE = edition(3, 'Favorite en juillet', '2026-07-01T10:00:00Z', '2026-07-03T18:00:00Z')
const NON_FAVORITE = edition(4, 'Pas favorite', '2026-08-01T10:00:00Z', '2026-08-03T18:00:00Z')

const FAVORIS = [PASSEE.id, TARDIVE.id, PROCHE.id]

const magasin = vi.hoisted(() => ({
  editions: [] as Record<string, unknown>[],
  favoris: [] as number[],
  fetchEditions: vi.fn(),
  ensureInitialized: vi.fn(),
  toggleFavorite: vi.fn(),
}))

mockNuxtImport('useRoute', () => () => ({ query: {} as Record<string, unknown>, params: {} }))
/*
 * ⚠️ Les trois crochets de navigation sont INDISPENSABLES, même inutilisés par la page : un greffon
 * interne de Nuxt (`navigation-repaint.client`) appelle `router.beforeResolve` au montage, et son
 * absence fait échouer le fichier entier sur une exception non capturée — pas sur un cas.
 */
mockNuxtImport('useRouter', () => () => ({
  push: () => {},
  replace: () => {},
  beforeResolve: () => () => {},
  beforeEach: () => () => {},
  afterEach: () => () => {},
}))

vi.mock('~/stores/editions', () => ({
  useEditionStore: () => ({
    get editions() {
      return magasin.editions
    },
    fetchEditions: magasin.fetchEditions,
  }),
}))
vi.mock('~/stores/favoritesEditions', () => ({
  useFavoritesEditionsStore: () => ({
    isFavorite: (id: number) => magasin.favoris.includes(id),
    ensureInitialized: magasin.ensureInitialized,
    toggleFavorite: magasin.toggleFavorite,
  }),
}))

const monter = async (editions: Record<string, unknown>[], favoris: number[] = FAVORIS) => {
  magasin.editions = editions
  magasin.favoris = favoris
  magasin.fetchEditions.mockClear()
  magasin.ensureInitialized.mockClear()
  const Page = (await import('../../../app/pages/favorites.vue')).default
  return mountSuspended(Page)
}

/** Les noms d'édition effectivement rendus, dans l'ordre où ils apparaissent. */
const nomsRendus = (texte: string, noms: string[]) =>
  noms
    .map((nom) => ({ nom, position: texte.indexOf(nom) }))
    .filter((e) => e.position !== -1)
    .sort((a, b) => a.position - b.position)
    .map((e) => e.nom)

const TOUS = [PASSEE, TARDIVE, PROCHE, NON_FAVORITE]
const NOMS = TOUS.map((e) => e.name)

describe('Page des favoris', () => {
  beforeAll(() => {
    // Seul `Date` est simulé : les minuteries restent réelles, le montage devant pouvoir attendre.
    vi.useFakeTimers({ now: MAINTENANT, toFake: ['Date'] })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('⚠️ le témoin : la page charge RÉELLEMENT les éditions et les favoris', async () => {
    /*
     * Sans ce cas, tous les suivants seraient verts sur une page qui n'appellerait plus rien au
     * montage — puisque c'est nous qui semons l'état des magasins. Les deux actions sont lancées
     * ensemble dans `onMounted`, et leur absence ne laisserait aucune trace à l'écran.
     */
    const composant = await monter(TOUS)

    expect(magasin.fetchEditions, 'la page ne charge plus les éditions').toHaveBeenCalled()
    expect(magasin.ensureInitialized, 'la page n’initialise plus les favoris').toHaveBeenCalled()
    // Et le chargement est bien terminé : sinon on mesurerait l'écran d'attente.
    expect(composant.text()).toContain(PROCHE.name)
  })

  it('ne montre QUE les éditions déclarées favorites', async () => {
    const composant = await monter(TOUS)

    expect(composant.text()).toContain(PROCHE.name)
    expect(composant.text()).toContain(TARDIVE.name)
    expect(composant.text(), 'une édition non favorite est affichée').not.toContain(
      NON_FAVORITE.name
    )
  })

  it('⚠️ masque les éditions TERMINÉES, même si elles sont favorites', async () => {
    /*
     * « Favorite terminée » s'achève cinq mois avant l'instant figé. La page ne la montre pas sans
     * que l'interrupteur « éditions passées » soit activé — c'est la règle que l'heure figée rend
     * éprouvable.
     */
    const composant = await monter(TOUS)

    expect(composant.text(), 'une édition terminée est affichée par défaut').not.toContain(
      PASSEE.name
    )
  })

  it('trie par date de début, la plus proche en premier', async () => {
    /*
     * Le jeu est semé dans le désordre (terminée, septembre, juillet) : un rendu qui suivrait
     * l'ordre du magasin donnerait septembre avant juillet.
     */
    const composant = await monter(TOUS)

    expect(nomsRendus(composant.text(), NOMS)).toEqual([PROCHE.name, TARDIVE.name])
  })

  it('pagine à douze par page', async () => {
    /*
     * Treize favoris à venir : la première page en montre douze. Sans ce cas, une page qui aurait
     * perdu sa pagination afficherait tout sans que rien ne le signale.
     */
    const beaucoup = Array.from({ length: 13 }, (_, i) =>
      edition(
        100 + i,
        `Favorite n${100 + i}`,
        `2026-07-${String(1 + i).padStart(2, '0')}T10:00:00Z`,
        `2026-07-${String(2 + i).padStart(2, '0')}T18:00:00Z`
      )
    )
    const composant = await monter(
      beaucoup,
      beaucoup.map((e) => e.id)
    )

    const rendus = beaucoup.map((e) => e.name).filter((nom) => composant.text().includes(nom))
    expect(rendus).toHaveLength(12)
    // Et c'est bien la DERNIÈRE qui manque, pas une du milieu.
    expect(composant.text()).not.toContain(beaucoup[12]!.name)
  })
})
