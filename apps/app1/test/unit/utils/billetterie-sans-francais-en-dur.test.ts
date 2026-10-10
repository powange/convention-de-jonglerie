import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Plus de français littéral dans les gabarits de la billetterie.
 *
 * ## ⚠️ POURQUOI CE TEST EXISTE : `check-i18n` EN VOIT MOINS DE LA MOITIÉ
 *
 * La fiche d'audit annonçait « seize fichiers », et le disait elle-même comme un **plancher** — « le
 * même détecteur en avait compté huit là où il y en avait vingt-deux ». Mesuré autrement le
 * 10/10/2026 : **18 fichiers, 169 littéraux**. `check-i18n` n'en signalait que 64, parce qu'il ne
 * regarde qu'une partie des attributs et ignore les nœuds de texte.
 *
 * Un libellé en dur ne casse rien et ne lève rien : il s'affiche simplement en français à un
 * lecteur qui a choisi l'anglais. Rien, dans la chaîne de vérification, ne le signale — d'où ce
 * test, qui fige la dette fichier par fichier et refuse toute addition.
 *
 * ## Ce qu'il ne compte pas, et pourquoi
 *
 * - les **commentaires**, retirés avant de compter : plusieurs gabarits *citent* en commentaire le
 *   libellé qu'ils ont remplacé. Les compter ferait de ces explications des infractions ;
 * - les attributs **liés** (`:label="…"`), qui sont des expressions : leur contenu français vit
 *   dans une condition (`x ? 'Sur place' : …`) et relève d'un autre travail ;
 * - `HelloAsso` et `Infomaniak`, qui sont des **noms de marque** — un `alt` ne se traduit pas.
 *
 * ## Le découpage, et pourquoi il y en a un
 *
 * 169 littéraux dans un seul lot donneraient un diff de dix-huit fichiers qu'on ne relit pas — et
 * une clé mal tapée s'affiche **brute** sans qu'aucun test ne la voie. Trois lots, tous livrés : écrans de
 * paramétrage (67), parcours du guichet (37), commandes et billetterie externe (63).
 */

/** Attributs dont la valeur est lue par un humain. */
const ATTRIBUTS =
  'label|placeholder|title|description|alt|confirm-label|cancel-label|aria-label|empty-label|help|hint'

/**
 * Un littéral français : une majuscule accentuée ou non, suivie d'une minuscule.
 *
 * Volontairement grossier. Un motif plus fin laisserait passer des cas, et le but n'est pas de
 * décider ce qui est du français mais d'empêcher qu'un libellé neuf entre sans clé.
 */
const FRANCAIS = /[A-ZÉÈÀÇÙÔÎ][a-zéèàçùêôîïœ']/

const MARQUES = new Set(['HelloAsso', 'Infomaniak'])

/**
 * La dette : **vide** depuis le 10/10/2026.
 *
 * Les 169 littéraux ont été traités en trois lots — écrans de paramétrage (67), parcours du guichet
 * (37), commandes et billetterie externe (63, dont deux noms de marque écartés). Ce test est donc
 * devenu une **interdiction**.
 *
 * ⚠️ Toute entrée ajoutée ici serait une REMONTÉE, c'est-à-dire l'autorisation d'un libellé non
 * traduit de plus. Poser une clé dans l'écran, pas une ligne dans cette liste.
 */
const DETTE: Record<string, number> = {}

const RACINE = path.resolve(__dirname, '../../../../../layers/ticketing/app')

/** Combien de gabarits ont réellement été lus — voir la garde de la garde plus bas. */
let gabaritsLus = 0

function sansCommentaires(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, (bloc) => '\n'.repeat((bloc.match(/\n/g) ?? []).length))
}

function litterauxParFichier(): Record<string, number> {
  gabaritsLus = 0
  const trouves: Record<string, number> = {}

  const parcours = (dossier: string) => {
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) {
        parcours(complet)
      } else if (entree.name.endsWith('.vue')) {
        gabaritsLus += 1
        // Le gabarit seulement : le `<script>` porte des messages qui passent déjà par `t()`.
        const gabarit = sansCommentaires(fs.readFileSync(complet, 'utf8')).split('<script')[0]!
        let n = 0
        for (const ligne of gabarit.split('\n')) {
          // ⚠️ `(?<=\s)` : sans lui, `:label="…"` serait compté comme `label="…"` — or c'est une
          // expression, pas un littéral.
          for (const m of ligne.matchAll(new RegExp(`(?<=\\s)(?:${ATTRIBUTS})="([^"{}]+)"`, 'g'))) {
            const valeur = m[1]!.trim()
            if (FRANCAIS.test(valeur) && !MARQUES.has(valeur)) n += 1
          }
          for (const m of ligne.matchAll(/>\s*([^<>{}\n]{3,}?)\s*</g)) {
            const valeur = m[1]!.trim()
            // ⚠️ `MARQUES` vaut aussi ici : `<span>HelloAsso</span>` n'est pas à traduire, et la
            // première version de ce test ne l'excluait que dans les attributs — deux faux positifs.
            if (FRANCAIS.test(valeur) && !valeur.startsWith('$t') && !MARQUES.has(valeur)) n += 1
          }
        }
        if (n > 0) {
          trouves[path.relative(RACINE, complet).split(path.sep).join('/')] = n
        }
      }
    }
  }
  parcours(RACINE)
  return trouves
}

describe('billetterie — le français en dur ne doit que descendre', () => {
  const reels = litterauxParFichier()

  it('le parcours lit bien les gabarits de la billetterie', () => {
    /*
     * La garde de la garde : un parcours qui ne rendrait rien laisserait tout le reste vert en ne
     * vérifiant rien — le piège de la mesure satisfaite par des zéros.
     *
     * ⚠️ Elle porte sur les fichiers LUS, et non sur le nombre d'infractions trouvées. Un
     * garde-fou calé sur la dette se saborde en réussissant : il tombe le jour où elle atteint
     * zéro, et l'on supprime alors la protection en croyant qu'elle est périmée. C'est arrivé le
     * 09/10 sur la garde des `confirm()` natifs.
     */
    expect(gabaritsLus).toBeGreaterThan(40)
  })

  it('aucun gabarit ne porte de français littéral hors de la dette recensée', () => {
    const nouveaux = Object.keys(reels).filter((f) => !(f in DETTE))
    expect(
      nouveaux,
      'employer une clé i18n. ⚠️ Et la poser dans un domaine CHARGÉ par la route : /gestion/ticketing ne charge que `ticketing` en plus du socle (common, components, app, public, notifications, feedback). Une clé de `gestion.*` ou `admin.*` s’afficherait BRUTE.'
    ).toEqual([])
  })

  it('aucun gabarit n’en ajoute', () => {
    const aggraves = Object.entries(reels)
      .filter(([f, n]) => f in DETTE && n > DETTE[f]!)
      .map(([f, n]) => `${f} : ${n} au lieu de ${DETTE[f]}`)
    expect(aggraves).toEqual([])
  })

  it('aucune entrée de la dette n’est périmée', () => {
    // Une entrée qui ne correspond plus à rien exempterait un fichier revenu en arrière.
    const perimees = Object.entries(DETTE)
      .filter(([f, n]) => (reels[f] ?? 0) !== n)
      .map(([f, n]) => `${f} : ${reels[f] ?? 0} mesurés, ${n} inscrits`)
    expect(perimees).toEqual([])
  })
})
