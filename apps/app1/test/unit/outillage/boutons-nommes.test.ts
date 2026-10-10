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
 * Sur l'ensemble des `<UButton>` de `apps/app1/app` et des layers, **94** portaient une
 * icône et **aucun** nom — ni `aria-label`, ni `label`, ni `title`, ni texte dans leur slot —,
 * répartis sur **58 fichiers**. Le premier balayage en annonçait 98 : quatre affichaient en
 * réalité un texte que le détecteur ne voyait pas, et c'est l'objet du troisième cas plus bas. Un lecteur d'écran les annonce « bouton », sans dire ce qu'ils
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
        /*
         * ⚠️ `</UButton\s*>` ET NON LA FORME LITTÉRALE. Prettier coupe la balise fermante avant le
         * `>` quand la ligne est longue :
         *
         *     >{{ $t('components.edition_form.next') }}</UButton
         *     >
         *
         * Chercher `'</UButton>'` ne la trouve pas, le slot passe pour VIDE, et le bouton est
         * déclaré anonyme alors qu'il affiche « Suivant ». C'est ce qui s'est produit : quatre
         * boutons porteurs de texte ont reçu un `aria-label` — et comme `aria-label` ÉCRASE le
         * contenu, le bouton « Créer l'édition » s'est mis à s'annoncer « Valider ». Un parcours
         * Playwright qui le visait par son nom ne le trouvait plus, et l'accessibilité y perdait
         * au lieu d'y gagner.
         */
        const fermeture = src.slice(balise.fin).search(/<\/UButton\s*>/)
        const corps = fermeture < 0 ? '' : src.slice(balise.fin + 1, balise.fin + fermeture)
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

/**
 * Les quatre boutons dont l'`aria-label` dit volontairement autre chose que leur texte.
 *
 * Chacun affiche un ÉTAT et déclenche une ACTION, et c'est l'action qu'il faut annoncer :
 *
 * - `edition/Header.vue` : affiche l'onglet courant, ouvre la liste des onglets.
 * - `shows/ShowActsEditor.vue` : affiche le titre d'un numéro, ouvre son édition.
 * - `lost-found/index.vue` : affiche « perdu » ou « rendu », bascule l'état.
 * - `volunteers/SwapSlotPicker.vue` : affiche le créneau choisi, ouvre le choix.
 *
 * ⚠️ Repérés PAR FICHIER et non par ligne : une liste de `fichier:ligne` se périme au premier
 * ajout de ligne au-dessus, et la garde se mettrait à signaler des cas qu'elle a déjà examinés.
 */
const ARIA_DELIBEREMENT_DIFFERENT = [
  'app/components/edition/Header.vue',
  'app/components/shows/ShowActsEditor.vue',
  'lost-found/app/pages/editions/[id]/lost-found/index.vue',
  'volunteers/app/components/volunteers/SwapSlotPicker.vue',
]

/** Les `<UButton>` dont l'`aria-label` masque un texte visible. */
async function ariaQuiEcraseUnTexte(): Promise<string[]> {
  const sortie: string[] = []
  for (const fichier of await fichiersVue()) {
    if (ARIA_DELIBEREMENT_DIFFERENT.some((f) => fichier.endsWith(f))) continue
    const src = await readFile(fichier, 'utf8')
    let i = -1
    while ((i = src.indexOf('<UButton', i + 1)) !== -1) {
      if (/[\w-]/.test(src[i + 8] ?? '')) continue
      const balise = baliseOuvrante(src, i)
      if (!balise) continue
      if (!/[\s:]aria-label(?=[\s=>/])/.test(balise.texte)) continue
      if (/\/>\s*$/.test(balise.texte)) continue

      const fermeture = src.slice(balise.fin).search(/<\/UButton\s*>/)
      if (fermeture < 0) continue
      const texte = src
        .slice(balise.fin + 1, balise.fin + fermeture)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]*>/g, '')
        .trim()
      if (texte) {
        const ligne = src.slice(0, i).split('\n').length
        sortie.push(
          `${fichier.replace(process.cwd(), 'apps/app1')}:${ligne} — affiche « ${texte.slice(0, 40)} »`
        )
      }
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

  it('⚠️ AUCUN `aria-label` N’ÉCRASE UN TEXTE VISIBLE', async () => {
    /*
     * ⚠️ CE CAS EXISTE PARCE QUE L'ERREUR A ÉTÉ COMMISE. `aria-label` ne complète pas le contenu
     * du bouton, il le REMPLACE : le lecteur d'écran annonce l'attribut et ignore le texte
     * affiché. Quatre boutons porteurs de texte en ont reçu un dans ce lot — le détecteur
     * cherchait `</UButton>` et ne voyait pas la forme coupée par Prettier, `</UButton\n>` — et le
     * bouton « Créer l'édition » s'est mis à s'annoncer « Valider ». Un parcours Playwright qui le
     * visait par son nom ne le trouvait plus : c'est la CI qui l'a dit, pas la relecture.
     *
     * Le détecteur est corrigé, mais ce cas garde le résultat : un `aria-label` sur un bouton qui
     * parle déjà n'améliore rien et fait perdre le libellé visible.
     */
    const ecrasements = await ariaQuiEcraseUnTexte()

    expect(
      ecrasements,
      `Ces boutons affichent un texte que leur \`aria-label\` remplace. Retirer l'attribut : le ` +
        `texte visible est un meilleur nom accessible, et un lecteur d'écran ne doit pas annoncer ` +
        `autre chose que ce qui est écrit :\n${ecrasements.join('\n')}`
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
