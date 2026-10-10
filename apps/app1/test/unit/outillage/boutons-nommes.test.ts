import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE_APP = join(process.cwd(), 'app')
const RACINE_LAYERS = join(process.cwd(), '..', '..', 'layers')

/**
 * Un bouton réduit à son icône doit porter un nom accessible.
 *
 * ## ⚠️ Le défaut, mesuré avant d'être corrigé
 *
 * Sur l'ensemble des `<UButton>` de `apps/app1/app` et des `layers/*​/app`, **98** portaient une
 * icône et **aucun** nom — ni `aria-label`, ni `label`, ni `title`, ni texte dans leur slot —,
 * répartis sur **58 fichiers**. Un lecteur d'écran les annonce « bouton », sans dire ce qu'ils
 * font : mettre en favori, fermer le panneau, actualiser, supprimer la ligne. Les plus exposés
 * étaient l'étoile de favori de l'en-tête d'une édition, visible par tout visiteur connecté sur
 * mobile, et les trois boutons du centre de notifications.
 *
 * ## ⚠️⚠️ UNE INFOBULLE NE SUFFIT PAS
 *
 * `UTooltip` affiche un texte au survol et ne pose **aucun** nom sur l'élément : le bouton reste
 * anonyme pour qui n'utilise pas la souris. Quatre des 98 en avaient une, et c'est à eux que ce
 * lot a demandé le plus d'attention — l'`aria-label` doit alors **reprendre le texte de
 * l'infobulle**, sous peine que l'écran et le lecteur d'écran annoncent deux choses différentes.
 * Une exception assumée : là où l'infobulle affiche un résumé calculé (les associations d'un
 * article à remettre), elle informe sans nommer, et l'`aria-label` dit l'action.
 *
 * ## Ce que ce test ne dit pas
 *
 * Il mesure la présence d'un nom, pas sa justesse. Les 98 libellés ont été choisis un par un
 * d'après l'icône **et** le `@click` — l'icône seule ne tranche pas : une croix ferme un panneau,
 * annule une édition en cours, vide un champ ou retire une ligne, et c'est le geste qui le dit.
 * Deux exemples de ce que la seule icône aurait raté : le « + » voisin d'un « − » dans un
 * sélecteur de quantité n'« ajoute » pas, il augmente la quantité ; et les trois boutons bascule
 * (favori, épingle, responsable d'équipe) reçoivent un libellé unique accompagné de
 * `aria-pressed`, qui est la façon correcte d'annoncer deux états — et qui évite six clés de
 * traduction pour trois boutons.
 */
const ATTRS_DE_NOM = ['aria-label', 'label', 'title', 'aria-labelledby']
const ATTRS_DICONE = ['icon', 'leading-icon', 'trailing-icon']

/**
 * La balise ouvrante complète à partir de `<UButton`.
 *
 * ⚠️ On saute les `>` contenus dans une chaîne : un `@click="a > b ? x : y"` couperait la balise
 * au milieu, et tout ce qui suit — l'`aria-label` compris — serait tenu pour absent.
 */
function baliseOuvrante(src: string, depart: number): { fin: number; texte: string } | null {
  let guillemet: string | null = null
  for (let k = depart; k < src.length; k++) {
    const c = src[k]!
    if (guillemet) {
      if (c === guillemet) guillemet = null
      continue
    }
    if (c === '"' || c === "'") guillemet = c
    else if (c === '>') return { fin: k, texte: src.slice(depart, k + 1) }
  }
  return null
}

const aLAttribut = (balise: string, noms: string[]) =>
  noms.some((n) => new RegExp(`[\\s:]${n}(?=[\\s=>/])`).test(balise))

async function fichiersVue(): Promise<string[]> {
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
      else if (entree.name.endsWith('.vue')) sortie.push(complet)
    }
  }
  await parcourir(RACINE_APP)
  // Les layers portent la moitié des écrans : les omettre exempterait la billetterie, le stock,
  // les tâches et les bénévoles — où vivaient 40 des 98 boutons.
  let layers: string[] = []
  try {
    layers = (await readdir(RACINE_LAYERS, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    layers = []
  }
  for (const layer of layers) await parcourir(join(RACINE_LAYERS, layer, 'app'))
  return sortie
}

/** Les `<UButton>` à icône dépourvus de nom accessible. */
async function boutonsSansNom(): Promise<string[]> {
  const sortie: string[] = []
  for (const fichier of await fichiersVue()) {
    const src = await readFile(fichier, 'utf8')
    let i = -1
    while ((i = src.indexOf('<UButton', i + 1)) !== -1) {
      // `<UButtonGroup` n'est pas un bouton.
      if (/[\w-]/.test(src[i + 8] ?? '')) continue
      const balise = baliseOuvrante(src, i)
      if (!balise) continue
      if (!aLAttribut(balise.texte, ATTRS_DICONE)) continue
      if (aLAttribut(balise.texte, ATTRS_DE_NOM)) continue

      // Un bouton qui porte du texte dans son slot est nommé par ce texte.
      if (!/\/>\s*$/.test(balise.texte)) {
        const fermeture = src.indexOf('</UButton>', balise.fin)
        const corps = fermeture < 0 ? '' : src.slice(balise.fin + 1, fermeture)
        const texte = corps
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<[^>]*>/g, '')
          .trim()
        if (texte) continue
      }

      const ligne = src.slice(0, i).split('\n').length
      sortie.push(`${fichier.replace(process.cwd(), 'apps/app1')}:${ligne}`)
    }
  }
  return sortie
}

describe('accessibilité — les boutons à icône seule portent un nom', () => {
  it('⚠️ AUCUN `<UButton>` À ICÔNE N’EST ANONYME', async () => {
    const anonymes = await boutonsSansNom()

    expect(
      anonymes,
      `Ces boutons sont annoncés « bouton » sans rien de plus. Ajouter un ` +
        `:aria-label="$t('…')" en réutilisant une clé de common.json, qui est dans le socle i18n ` +
        `et donc disponible partout :\n${anonymes.join('\n')}`
    ).toEqual([])
  })

  it('le balayage voit bien les boutons — il ne rend pas une liste vide par accident', async () => {
    /*
     * LA GARDE DE LA GARDE, et elle n'est pas de pure forme : ce test ne peut constater « zéro
     * anonyme » que s'il trouve des boutons. Une erreur de chemin, un `readdir` qui échoue en
     * silence, un `node_modules` filtré trop large, et il serait vert en ne lisant rien.
     *
     * ⚠️ Le compte est volontairement un plancher large et non le chiffre exact : une garde
     * calée sur « 1 061 boutons » tomberait au premier écran ajouté, pour une raison qui n'a
     * rien à voir avec l'accessibilité.
     */
    const fichiers = await fichiersVue()
    expect(fichiers.length).toBeGreaterThan(300)

    let boutonsAIcone = 0
    for (const fichier of fichiers) {
      const src = await readFile(fichier, 'utf8')
      let i = -1
      while ((i = src.indexOf('<UButton', i + 1)) !== -1) {
        if (/[\w-]/.test(src[i + 8] ?? '')) continue
        const balise = baliseOuvrante(src, i)
        if (balise && aLAttribut(balise.texte, ATTRS_DICONE)) boutonsAIcone++
      }
    }
    expect(boutonsAIcone).toBeGreaterThan(400)
  })
})
