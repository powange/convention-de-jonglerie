import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const RACINE_LAYERS = join(RACINE, '..', '..', 'layers')

/**
 * Les icônes du paquet client — constat O5.
 *
 * ## ⚠️ Le défaut
 *
 * `icon.serverBundle: 'remote'` sans `clientBundle` ne met **aucune** icône dans le paquet : chaque
 * page demande `/api/_nuxt_icon/<collection>.json?icons=…`, et le serveur va les chercher sur
 * api.iconify.design. Mesuré au navigateur, service worker bloqué, avant le lot : **10 icônes
 * demandées sur l'accueil, 5 sur /login, 7 sur la fiche d'une édition, 12 sur sa page d'ateliers**.
 *
 * Après : **5, 1, 1 et 2** — et ce qui reste n'est QUE des drapeaux, c'est-à-dire exactement ce que
 * la configuration exclut volontairement. Le paquet pèse 165 icônes pour 63,4 Ko non compressés,
 * sous le plafond de 256 Ko qui fait échouer le build.
 *
 * ## ⚠️⚠️ CE QUE CE LOT NE FAIT PAS, contrairement à ce que l'audit annonçait
 *
 * Il **ne supprime pas la dépendance de la production à api.iconify.design**. Les 111 icônes de
 * l'accueil sont rendues côté SERVEUR, où `serverBundle: 'remote'` va les chercher — c'est
 * d'ailleurs pourquoi 111 icônes rendues ne provoquaient que 10 requêtes client. Seuls les
 * allers-retours du navigateur disparaissent. Lever la dépendance demanderait d'empaqueter les
 * collections côté serveur, ce que la configuration évite à dessein pour la taille de l'image.
 *
 * ## Ce que ce test garde, et pourquoi pas le reste
 *
 * Il ne relit pas la configuration pour la comparer à elle-même. Il mesure **la réalité du dépôt**
 * — où les icônes sont écrites — et exige que la configuration la couvre. La régression plausible
 * est précise : quelqu'un remplace `globInclude` par le défaut du module, en le croyant suffisant.
 * Il ne l'est pas, pour deux raisons mesurées ici même.
 */
const COLLECTIONS = [
  'heroicons',
  'lucide',
  'material-symbols',
  'material-symbols-light',
  'mdi',
  'simple-icons',
  'cbi',
  'ph',
  'uil',
  'bx',
  'tabler',
  'carbon',
]

/** Les icônes écrites littéralement dans un fichier, sous l'une ou l'autre forme. */
function iconesDe(src: string): Set<string> {
  const trouvees = new Set<string>()
  for (const m of src.matchAll(/['"`](i-)?([a-z0-9-]+):([a-z0-9-]+)['"`]/g)) {
    if (COLLECTIONS.includes(m[2]!)) trouvees.add(`${m[2]}:${m[3]}`)
  }
  for (const m of src.matchAll(/['"`]i-([a-z-]+?)-([a-z0-9-]+)['"`]/g)) {
    if (COLLECTIONS.includes(m[1]!)) trouvees.add(`${m[1]}:${m[2]}`)
  }
  return trouvees
}

async function fichiers(racine: string, extensions: string[]): Promise<string[]> {
  const sortie: string[] = []
  const parcourir = async (chemin: string) => {
    let entrees
    try {
      entrees = await readdir(chemin, { withFileTypes: true })
    } catch {
      return
    }
    for (const entree of entrees) {
      if (entree.name === 'node_modules' || entree.name.startsWith('.')) continue
      const complet = join(chemin, entree.name)
      if (entree.isDirectory()) await parcourir(complet)
      else if (extensions.some((e) => entree.name.endsWith(e))) sortie.push(complet)
    }
  }
  await parcourir(racine)
  return sortie
}

async function iconesSous(racine: string, extensions: string[]): Promise<Set<string>> {
  const toutes = new Set<string>()
  for (const f of await fichiers(racine, extensions)) {
    for (const i of iconesDe(await readFile(f, 'utf8'))) toutes.add(i)
  }
  return toutes
}

describe('paquet client des icônes', () => {
  it('⚠️ LE SCAN COUVRE LES `.ts`, OÙ VIVENT DES DIZAINES D’ICÔNES', async () => {
    /*
     * Le `globInclude` par défaut du module ne retient que `vue,jsx,tsx,md,mdc,mdx,yml,yaml`. Or
     * les couleurs de module, les catégories de gestion et les menus de navigation déclarent leurs
     * icônes dans des `.ts` : s'en tenir au défaut les laisse toutes au serveur, sur des écrans
     * présents partout.
     */
    const dansLesTs = await iconesSous(join(RACINE, 'app'), ['.ts'])
    expect(
      dansLesTs.size,
      'si plus aucune icône n’est écrite dans un .ts, le glob peut être réduit'
    ).toBeGreaterThan(20)

    const config = await readFile(join(RACINE, 'nuxt.config.ts'), 'utf8')
    expect(config).toMatch(/globInclude:[^\]]*app\/\*\*\/\*\.\{vue,ts\}/)
  })

  it('⚠️ LE SCAN COUVRE LES LAYERS, QUI SONT HORS DE LA RACINE DU PROJET', async () => {
    /*
     * ⚠️ LE PIÈGE DE CE RÉGLAGE. Le glob est relatif à la racine du projet Nuxt, soit `apps/app1` ;
     * les layers vivent à `../../layers` et n'y sont donc PAS. Sans le second motif, toute la
     * moitié « gestion » de l'application — billetterie, stock, tâches, bénévoles, ateliers —
     * continuerait à demander ses icônes une par une, et rien ne le signalerait : la configuration
     * paraîtrait complète.
     *
     * Mesuré : la page publique des ateliers, servie par un layer, passe de 12 icônes demandées
     * à 2 (deux drapeaux, volontairement exclus).
     */
    const dansLesLayers = await iconesSous(RACINE_LAYERS, ['.vue', '.ts'])
    expect(
      dansLesLayers.size,
      'les layers ne portent plus d’icônes : le second motif du glob serait inutile'
    ).toBeGreaterThan(50)

    const config = await readFile(join(RACINE, 'nuxt.config.ts'), 'utf8')
    expect(config).toMatch(/globInclude:[^\]]*\.\.\/\.\.\/layers\/\*\/app\/\*\*\/\*\.\{vue,ts\}/)
  })

  it('⚠️ LES DRAPEAUX RESTENT AU SERVEUR, et le plafond reste posé', async () => {
    /*
     * Les quatorze drapeaux écrits littéralement — ceux du sélecteur de langue — pèsent **92 Ko**,
     * soit 44 % du poids de toutes les icônes du dépôt réunies pour 4 % de leur nombre. Et ce sont
     * les seuls statiquement connus : les drapeaux de pays sont nommés à l'exécution depuis la
     * base, et il y en a près de deux cents. Les embarquer coûterait donc le plus gros du paquet
     * sans supprimer une requête pour les autres.
     *
     * Le plafond, lui, fait ÉCHOUER le build quand il est franchi : un paquet qui enfle doit se
     * signaler plutôt que de se glisser dans une livraison.
     */
    const config = await readFile(join(RACINE, 'nuxt.config.ts'), 'utf8')

    expect(config).toMatch(/ignoreCollections:\s*\['flag'\]/)
    expect(config).toMatch(/sizeLimitKb:\s*256/)
    // `serverBundle` reste le repli de tout ce qui est nommé à l'exécution — drapeaux compris.
    expect(config).toMatch(/serverBundle:\s*'remote'/)
  })

  it('le relevé des icônes fonctionne — il ne rend pas un ensemble vide par accident', async () => {
    /*
     * LA GARDE DE LA GARDE : les trois cas ci-dessus comparent des comptes à des planchers. Une
     * erreur de chemin, et chaque compte vaudrait zéro — les `toBeGreaterThan` tomberaient, donc
     * ce cas-ci n'est pas là pour eux. Il l'est pour le relevé lui-même : si `iconesDe` cessait de
     * reconnaître les deux formes d'écriture, les planchers resteraient atteints par la seule forme
     * survivante, et l'on croirait mesurer les deux.
     */
    expect(iconesDe(`icon="i-heroicons-trash"`).has('heroicons:trash')).toBe(true)
    expect(
      iconesDe(`icon="material-symbols:calendar-add-on"`).has('material-symbols:calendar-add-on')
    ).toBe(true)
    // Et une chaîne qui n'est pas une icône ne doit pas être comptée.
    expect(iconesDe(`to="/editions/1/gestion"`).size).toBe(0)
  })
})
