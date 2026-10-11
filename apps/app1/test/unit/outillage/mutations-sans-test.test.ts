import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const API_APP1 = join(RACINE, 'server', 'api')
const RACINE_LAYERS = join(RACINE, '..', '..', 'layers')
const TESTS_APP1 = join(RACINE, 'test')

/**
 * Combien de points d'API qui ÉCRIVENT n'ont aucun test qui les importe ? — constat A2.
 *
 * ## Ce que ce test fait, et ce qu'il ne fait pas
 *
 * Il n'écrit aucun test métier. Il **empêche la dette de croître** : un nouveau handler de mutation
 * livré sans test fait rougir la CI, et le compte est lisible à chaque run. C'est le premier lot
 * d'un chantier de 145 tests, dont les suivants abaisseront ce plafond.
 *
 * ## ⚠️ UN PLAFOND, PAS UN COMPTE EXACT
 *
 * `toBeLessThanOrEqual` et non `toBe`. Une garde calée sur « exactement 145 » tomberait le jour où
 * quelqu'un écrit un test de plus — il faudrait corriger la garde **pour avoir bien travaillé**,
 * et ce dépôt a déjà payé cette erreur une fois. Ici, faire mieux ne casse rien ; seul faire pire
 * arrête.
 *
 * ## ⚠️⚠️ CE QUI REND LA MESURE JUSTE : LE CHEMIN, JAMAIS LE NOM DE FICHIER
 *
 * Une première version cherchait le nom du handler dans le texte des tests. Or **41 handlers
 * s'appellent `index.post.ts`**, 19 `index.delete.ts`, 13 `index.put.ts` : un unique test citant
 * « index.post » les faisait tous passer pour couverts, et la mesure annonçait **73 %** de
 * couverture au lieu de 58 %. On compare donc les chemins depuis `server/api`, qui sont uniques.
 *
 * Et « nommer » ne suffit pas : le test doit **importer** le handler. Un fichier qui cite un point
 * d'API en recréant un faux handler local, ou en vérifiant des objets littéraux, ne prouve rien
 * sur le code livré — la fiche A2 en relevait dix de cette sorte.
 */

/** Le plafond, abaissé à chaque lot qui ajoute des tests. Mesuré le 11/10/2026. */
const PLAFOND = 145

/** Les mutations : ce sont elles qui changent l'état, donc celles dont l'absence de test coûte. */
const MUTATION = /\.(post|put|patch|delete)\.ts$/

async function fichiers(racine: string, garde: (nom: string) => boolean): Promise<string[]> {
  const sortie: string[] = []
  const parcourir = async (chemin: string) => {
    let entrees
    try {
      entrees = await readdir(chemin, { withFileTypes: true })
    } catch {
      return
    }
    for (const entree of entrees) {
      if (entree.name === 'node_modules') continue
      const complet = join(chemin, entree.name)
      if (entree.isDirectory()) await parcourir(complet)
      else if (garde(entree.name)) sortie.push(complet)
    }
  }
  await parcourir(racine)
  return sortie
}

/** Tous les chemins importés par les fichiers de test, sans extension. */
async function cheminsImportes(): Promise<Set<string>> {
  const sortie = new Set<string>()
  const layers = await readdir(RACINE_LAYERS, { withFileTypes: true }).catch(() => [])
  const racines = [
    TESTS_APP1,
    ...layers.filter((e) => e.isDirectory()).map((e) => join(RACINE_LAYERS, e.name, 'test')),
  ]
  for (const racine of racines) {
    for (const t of await fichiers(racine, (n) => n.endsWith('.test.ts'))) {
      const src = await readFile(t, 'utf8')
      const specs = [
        ...src.matchAll(/from\s+['"]([^'"]+)['"]/g),
        ...src.matchAll(/import\(\s*['"]([^'"]+)['"]/g),
      ]
      for (const m of specs) sortie.add(m[1]!.replace(/\.ts$/, ''))
    }
  }
  return sortie
}

async function handlersDeMutation(): Promise<string[]> {
  const layers = await readdir(RACINE_LAYERS, { withFileTypes: true }).catch(() => [])
  const racines = [
    API_APP1,
    ...layers
      .filter((e) => e.isDirectory())
      .map((e) => join(RACINE_LAYERS, e.name, 'server', 'api')),
  ]
  const sortie: string[] = []
  for (const racine of racines) sortie.push(...(await fichiers(racine, (n) => MUTATION.test(n))))
  return sortie
}

/** Le chemin depuis `server/api`, qui identifie un handler de façon unique. */
const identite = (h: string) => h.slice(h.indexOf(join('server', 'api'))).replace(/\.ts$/, '')

/**
 * La zone à laquelle un handler appartient, pour le compte rendu.
 *
 * ⚠️ LE LAYER DOIT ÊTRE NOMMÉ. Un premier regroupement prenait le segment qui suit `server/api/`,
 * ce qui rangeait `layers/ticketing/server/api/editions/…` sous « editions » avec les handlers
 * d'app1 : le message annonçait `editions=94` au lieu de répartir entre app1 et quatre layers. Le
 * compte total était juste, mais le relevé ne servait plus à choisir le lot suivant — et c'est
 * précisément à cela qu'il existe.
 */
function zoneDe(chemin: string): string {
  const normalise = chemin.split('\\').join('/')
  const layer = normalise.match(/\/layers\/([^/]+)\//)?.[1]
  if (layer) return `layers/${layer}`
  const apres = identite(normalise).replace('server/api/', '')
  return `app1/${apres.split('/')[0] ?? '(racine)'}`
}

/** Les handlers sans test, rendus avec leur zone pour que le relevé soit utilisable. */
async function mutationsSansTest(): Promise<{ id: string; zone: string }[]> {
  const importes = await cheminsImportes()
  const sortie: { id: string; zone: string }[] = []
  for (const h of await handlersDeMutation()) {
    const id = identite(h).split('\\').join('/')
    // Les tests importent par chemin relatif : on accepte toute spécification qui s'y termine.
    const sansPrefixe = id.replace(/^server\//, '')
    const couvert = [...importes].some((s) => s.endsWith(sansPrefixe) || s.endsWith(id))
    if (!couvert) sortie.push({ id, zone: zoneDe(h) })
  }
  return sortie
}

describe('points d’API qui écrivent sans test qui les importe', () => {
  it(`⚠️ AU PLUS ${PLAFOND} MUTATIONS SANS TEST — le plafond ne remonte pas`, async () => {
    const sansTest = await mutationsSansTest()

    // Le compte par zone : c'est ce qu'on vient lire pour choisir le lot suivant.
    const zones: Record<string, number> = {}
    for (const { zone } of sansTest) zones[zone] = (zones[zone] ?? 0) + 1
    const parZone = Object.entries(zones)
      .sort((a, b) => b[1] - a[1])
      .map(([z, n]) => `${z}=${n}`)
      .join(', ')

    expect(
      sansTest.length,
      `${sansTest.length} mutations sans test qui les importe (plafond ${PLAFOND}).\nPar zone : ${parZone}\n` +
        `Si ce nombre a BAISSÉ, abaissez PLAFOND — la garde ne s'en plaindra pas. S'il a monté, ` +
        `c'est qu'un point d'API qui écrit a été livré sans filet.`
    ).toBeLessThanOrEqual(PLAFOND)
  })

  it('le relevé porte sur de vrais fichiers — il ne conclut pas sur le vide', async () => {
    /*
     * LA GARDE DE LA GARDE, et ici elle est double. Le cas ci-dessus compare un compte à un
     * plafond : il serait vert si le balayage des handlers ne trouvait rien (zéro ≤ 145), **et**
     * il serait vert si le relevé des imports était si large que tout paraisse couvert.
     *
     * ⚠️ Les deux planchers sont larges à dessein : le nombre de handlers monte à chaque
     * fonctionnalité, et celui des imports à chaque test. Ils mesurent que le balayage fonctionne,
     * pas la taille du dépôt.
     */
    const handlers = await handlersDeMutation()
    expect(
      handlers.length,
      'aucun handler de mutation trouvé : le balayage est cassé'
    ).toBeGreaterThan(200)

    const importes = await cheminsImportes()
    expect(importes.size, 'aucun import relevé : le balayage des tests est cassé').toBeGreaterThan(
      500
    )

    // Et un témoin positif : au moins une mutation EST couverte, sinon le critère refuse tout.
    const sansTest = await mutationsSansTest()
    expect(sansTest.length).toBeLessThan(handlers.length)
  })
})
