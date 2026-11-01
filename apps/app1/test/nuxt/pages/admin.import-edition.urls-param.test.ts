import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La page d'import lit-elle les URL passées en paramètre de route ?
 *
 * ## ⚠️ LE TEST CREUX QU'IL FAUT ÉVITER ICI
 *
 * Vérifier que `?urls=…` est présent dans la route ne prouve **rien** : un paramètre survit au
 * montage même si personne ne le lit. Ces cas assèrent donc le **contenu du champ rendu** — le
 * `<textarea>` que l'opérateur a sous les yeux —, parce que c'est la seule chose qui dise que la
 * lecture a eu lieu.
 *
 * Sans cela, le bouton « importer » de l'écran de veille serait une promesse que rien ne tient :
 * on arriverait sur un formulaire vide, et il faudrait copier-coller l'URL, exactement ce que le
 * bouton était censé épargner.
 *
 * ## Et le témoin inverse
 *
 * Le second cas monte la page SANS paramètre et exige un champ vide. Sans lui, une page qui
 * remplirait le champ en toutes circonstances passerait le premier cas.
 */
const route = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))

mockNuxtImport('useRoute', () => () => ({
  query: route.query,
  path: '/admin/import-edition',
  params: {},
  name: 'admin-import-edition',
  fullPath: '/admin/import-edition',
  hash: '',
  meta: {},
  matched: [],
  redirectedFrom: undefined,
}))

/*
 * La page interroge `/api/admin/conventions` à son montage. Le bouchon porte `create` et `raw`
 * parce que Nuxt DÉRIVE son client du `$fetch` global au démarrage : sans eux, `setupNuxt` échoue
 * et les cas sortent SAUTÉS, pas rouges.
 */
const fetchBouchon = vi.hoisted(() => {
  const bouchon: any = vi.fn(async (url: string) => {
    /*
     * ⚠️ Chaque appel doit rendre SA forme, et pas une forme générique. `loadProviders` fait
     * `availableProviders.value = response.providers` sans garde : une réponse sans `providers`
     * met `undefined` dans le ref, et le gabarit plante sur `availableProviders.length` — au
     * montage, donc TOUS les cas tombent, y compris ceux qui n'ont rien à voir avec les providers.
     */
    if (String(url).includes('/ai-providers')) return { providers: [], defaultProvider: null }
    if (String(url).includes('/conventions')) return { conventions: [] }
    return {}
  })
  bouchon.create = () => bouchon
  bouchon.raw = bouchon
  return bouchon
})
vi.stubGlobal('$fetch', fetchBouchon)

const page = () => import('../../../app/pages/admin/import-edition.vue').then((m) => m.default)

/**
 * Le contenu de chaque `<textarea>` de la page.
 *
 * ⚠️ Lu sur la PROPRIÉTÉ DOM `value`, et non dans `wrapper.html()`. Vue lie la valeur d'un
 * `<textarea>` par propriété, pas comme contenu de balise : le HTML sérialisé montre
 * `<textarea></textarea>` quoi qu'il contienne. Chercher l'URL dans le HTML rendait donc « champ
 * vide » dans tous les cas — un faux négatif qui m'a d'abord fait croire que la page ne lisait pas
 * le paramètre, et qui aurait fait corriger la page au lieu du test.
 */
const contenusDesChamps = (wrapper: { findAll: (s: string) => { element: unknown }[] }) =>
  wrapper.findAll('textarea').map((noeud) => (noeud.element as HTMLTextAreaElement).value ?? '')

describe('Page /admin/import-edition — les URL passées en paramètre', () => {
  beforeEach(() => {
    route.query = {}
    fetchBouchon.mockClear()
  })

  it('⚠️ REMPLIT le champ avec les URL du paramètre, jointes par un retour à la ligne', async () => {
    route.query = {
      urls: [
        'https://jugglingedge.com/event.php?EventID=6485',
        'https://jugglingedge.com/event.php?EventID=7000',
      ],
    }

    const wrapper = await mountSuspended(await page())

    const contenus = contenusDesChamps(wrapper)
    const rempli = contenus.find((contenu) => contenu.includes('EventID=6485'))
    expect(rempli, 'aucun <textarea> ne contient la première URL du paramètre').toBeDefined()
    // Le retour à la ligne est le séparateur que `parseAndValidateUrls` attend, et le seul.
    expect(rempli).toContain('EventID=7000')
    expect(rempli!.split('\n').filter((ligne) => ligne.trim()).length).toBe(2)
  })

  it('📍 accepte un paramètre SEUL, pas seulement un tableau', async () => {
    // `?urls=…` une seule fois donne une chaîne, pas un tableau : les deux formes arrivent
    // réellement selon le nombre de candidats envoyés depuis la veille.
    route.query = { urls: 'https://jugglingedge.com/event.php?EventID=6485' }

    const wrapper = await mountSuspended(await page())

    expect(contenusDesChamps(wrapper).some((c) => c.includes('EventID=6485'))).toBe(true)
  })

  it('le témoin inverse : sans paramètre, le champ reste VIDE', async () => {
    /*
     * Sans ce cas, une page qui remplirait le champ en toutes circonstances — avec n'importe
     * quoi — passerait les deux précédents.
     */
    const wrapper = await mountSuspended(await page())

    expect(contenusDesChamps(wrapper).some((c) => c.includes('jugglingedge'))).toBe(false)
  })
})
