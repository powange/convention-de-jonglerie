import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ICONE_DE_MODULE } from '~/utils/couleurs-de-module'
import { moduleDeGestion } from '~/utils/modules-de-gestion'

/**
 * Aucune page de gestion ne doit afficher son icône DEUX FOIS.
 *
 * ⚠️ POURQUOI CE DÉFAUT REVIENT. `ManagementPageHeader` lit l'icône et sa couleur dans le registre
 * des modules, d'après la route — il a été écrit pour cela, après avoir mesuré que treize pages
 * n'affichaient aucune icône, cinq en affichaient une autre et huit se trompaient de couleur.
 * Mais en l'adoptant, une page qui portait déjà son `<UIcon>` à la main se retrouve avec les deux :
 * celle du registre, et la sienne.
 *
 * Rien ne le signale. L'écran reste lisible, simplement orné d'un doublon — et, trois fois sur
 * cinq au moment d'écrire ce test, la copie manuelle portait en plus la MAUVAISE couleur : les
 * prêts en ambre au lieu de sarcelle, les manquants en `primary` au lieu de rose, les renforts en
 * `info` au lieu de vert. C'est exactement la dérive que le composant devait supprimer.
 *
 * 📍 Un test de rendu ne l'attraperait pas à ce prix : il faudrait monter 55 pages authentifiées.
 * Cette garde-ci lit les fichiers.
 */

const RACINES = ['layers', 'apps/app1/app']
const DEPOT = join(import.meta.dirname, '../../../../..')

/** Toutes les pages `.vue` qui emploient l'en-tête partagé. */
function pagesAvecEntete(): string[] {
  const trouvees: string[] = []

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      if (entree === 'node_modules' || entree === '.nuxt') continue
      const chemin = join(dossier, entree)
      if (statSync(chemin).isDirectory()) parcourir(chemin)
      else if (
        entree.endsWith('.vue') &&
        readFileSync(chemin, 'utf8').includes('ManagementPageHeader')
      )
        trouvees.push(chemin)
    }
  }

  for (const racine of RACINES) parcourir(join(DEPOT, racine))
  return trouvees
}

/**
 * Jusqu'où remonter avant l'en-tête.
 *
 * ⚠️ 400 NE SUFFISAIT PAS, et ma première mesure a donc manqué TROIS doublons — dont les deux
 * fiches du stock. Un commentaire explicatif intercalé entre l'icône et l'en-tête suffit à les
 * éloigner de plus de 400 caractères. Le compte se stabilise à 800 : au-delà, on ne trouve rien de
 * plus, ce qui dit que la fenêtre couvre désormais le bloc d'en-tête entier.
 *
 * 📍 La leçon vaut au-delà de ce test : une détection qui rend « zéro » n'a pas prouvé qu'il n'y a
 * rien — elle a prouvé qu'elle n'a rien vu. Faire varier le paramètre jusqu'à ce que le résultat
 * cesse de bouger est ce qui distingue les deux.
 */
const FENETRE = 800

/**
 * Le chemin d'URL que servirait ce fichier, pour interroger le registre comme le fait la page.
 *
 * `moduleDeGestion` retombe sur le module parent, et ignore les segments numériques. Un segment
 * dynamique comme `[groupId]` ne correspond à aucune clé et déclenche donc le même repli :
 * `editions/[id]/gestion/stock/[groupId]` rend bien le module du stock.
 */
function cheminServi(cheminFichier: string): string {
  const apres = cheminFichier.split('/app/pages/')[1]
  return apres ? `/${apres.replace(/\.vue$/, '')}` : cheminFichier
}

/**
 * Ce qui distingue un doublon d'une icône légitime : **être l'icône du module de cette page**.
 *
 * ⚠️ UNE LISTE DE MOTIFS NE SUFFISAIT PAS, et la première version de ce test en exemptait deux
 * qui sont de VRAIES icônes de module : `/question-mark/` couvrait la FAQ
 * (`i-heroicons-question-mark-circle`) et `/arrow-/` couvrait les échanges de créneaux
 * (`i-lucide-arrow-left-right`). Sur ces deux pages, le doublon exact que l'on traque passait au
 * vert. C'est le défaut typique d'une garde par liste d'exceptions : elle s'élargit pour taire les
 * faux positifs, et finit par taire aussi les vrais.
 *
 * 📍 Le registre, lui, tranche sans liste. Un chevron de fil d'Ariane, un indicateur de
 * chargement, un gros point d'interrogation d'état vide : aucun n'est l'icône du module de SA
 * page, donc aucun n'est signalé — et le point d'interrogation de la FAQ, lui, l'est.
 *
 * Trou résiduel assumé : une page qui afficherait à la main l'icône d'un AUTRE module passerait.
 * Aucun des huit doublons mesurés n'était dans ce cas, et ce défaut-là se voit à l'œil — ce n'est
 * pas deux fois la même icône, c'est une icône étrangère.
 */

/**
 * Les classes de couleur dont seul un module se réclame : `text-amber-600`, `text-rose-600`…
 *
 * Tirées de la même table que celle employée par l'en-tête et par les cartes de l'accueil. Seul le
 * jeton CLAIR est retenu : la variante sombre de `gray` est `text-gray-400`, précisément la couleur
 * des icônes d'état vide et des indicateurs de chargement, qu'on ne veut pas signaler.
 */
const CLASSES_DE_COULEUR_DE_MODULE = new Set(
  Object.values(ICONE_DE_MODULE).map((classes) => classes.split(' ')[0]!)
)

/**
 * Deux discriminants, parce qu'AUCUN DES DEUX NE SUFFIT — mesuré, pas supposé.
 *
 * Rejoués tous les deux sur l'état d'avant le lot, où huit doublons étaient connus :
 *
 * - **l'icône du module seule en trouve 7.** Elle manque la fiche d'un objet de stock, qui
 *   affichait un `cube` là où l'en-tête dessine l'`archive-box` du stock : deux icônes
 *   différentes, donc un doublon bien réel, mais pas celui du registre ;
 * - **la couleur de module seule** attrape celle-là, et c'est pour cela qu'elle est ici.
 *
 * Ensemble : 8 sur 8 avant le lot, 0 après.
 */
function estUnDoublon(balise: string, icone: string, cheminFichier: string): boolean {
  if (moduleDeGestion(cheminServi(cheminFichier))?.icone === icone) return true

  const classe = balise.match(/class="([^"]+)"/)?.[1]
  return (classe?.split(/\s+/) ?? []).some((jeton) => CLASSES_DE_COULEUR_DE_MODULE.has(jeton))
}

describe('l’en-tête des pages de gestion', () => {
  const pages = pagesAvecEntete()

  it('est employé par un nombre plausible de pages', () => {
    // Témoin du test suivant : si la recherche cessait de trouver les pages, il passerait au vert
    // en n'ayant rien examiné.
    expect(pages.length).toBeGreaterThan(50)
  })

  it('⚠️ n’est précédé d’AUCUNE icône de module écrite à la main', () => {
    const doublons: string[] = []

    for (const chemin of pages) {
      const source = readFileSync(chemin, 'utf8')
      // Chaque en-tête du fichier, et dans chacun TOUTES les icônes de la fenêtre. Ne regarder
      // que le premier en-tête, ou que l'icône la plus proche, laissait passer un doublon placé
      // avant un chevron de fil d'Ariane — deux pages des candidatures en portent un.
      for (const position of source.matchAll(/<ManagementPageHeader/g)) {
        const avant = source.slice(Math.max(0, position.index - FENETRE), position.index)
        for (const balise of avant.matchAll(/<UIcon[^>]*?name="([^"]+)"[^>]*>/g)) {
          if (estUnDoublon(balise[0], balise[1]!, chemin)) {
            doublons.push(`${chemin.replace(DEPOT, '')} → ${balise[1]}`)
          }
        }
      }
    }

    expect(
      doublons,
      `Ces pages affichent leur icône deux fois. L'en-tête la tire déjà du registre des modules :\n  ${doublons.join('\n  ')}`
    ).toEqual([])
  })
})
