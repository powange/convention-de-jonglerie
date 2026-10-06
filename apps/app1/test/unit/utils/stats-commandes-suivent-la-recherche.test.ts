import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Les statistiques de la page des commandes doivent suivre la sélection AFFICHÉE.
 *
 * ⚠️ POURQUOI UNE GARDE SUR LA SOURCE, ET POURQUOI CE DÉFAUT ÉTAIT INVISIBLE. Le serveur sautait le
 * calcul dès qu'une recherche était active et renvoyait `null` ; le client, lui, fait
 * `if (response.stats)` et GARDAIT donc les chiffres précédents. On ne voyait pas des statistiques
 * vides — on voyait celles de la sélection d'avant, c'est-à-dire des montants plausibles et faux.
 * Il a fallu qu'un utilisateur cherche un nom et trouve les totaux inchangés.
 *
 * 📍 Un test de rendu ne l'attraperait pas davantage : il faudrait monter la page entière,
 * authentifiée, et comparer deux états successifs. Cette garde-ci coûte une lecture de fichier.
 */

const CHEMIN = join(
  import.meta.dirname,
  '../../../../../layers/ticketing/server/api/editions/[id]/ticketing/orders.get.ts'
)

/** La source, COMMENTAIRES RETIRÉS : ils citent nommément ce qu'on cherche. */
function sourceSansCommentaires(): string {
  return readFileSync(CHEMIN, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('les statistiques des commandes', () => {
  it('⚠️ ne sont JAMAIS sautées quand une recherche est active', () => {
    /*
     * `if (!search)` était la condition fautive. Toute forme équivalente le serait aussi : ce test
     * cherche donc l'absence d'une garde sur `search` autour du calcul, pas une chaîne précise.
     */
    const source = sourceSansCommentaires()

    expect(source).not.toMatch(/if\s*\(\s*!\s*search\s*\)/)
  })

  it('portent sur le filtre COMPLET, recherche comprise', () => {
    /*
     * Le piège suivant : calculer les statistiques, mais sur un filtre dont la recherche a été
     * retirée. L'écran afficherait alors trois commandes et des totaux portant sur deux cents, ce
     * qui est pire que pas de chiffre du tout.
     */
    const source = sourceSansCommentaires()

    // Le filtre amputé a été supprimé : son retour signalerait exactement cette rechute.
    expect(source).not.toContain('filtresSansRecherche')
    expect(source).toContain('where: filtreDesCommandes')
  })

  it('le filtre complet porte bien les clauses de recherche', () => {
    // Sans cette assertion, les deux précédentes seraient vraies pour la mauvaise raison : un
    // `filtreDesCommandes` qui aurait cessé d'inclure la recherche les passerait toutes les deux.
    const source = sourceSansCommentaires()

    expect(source).toMatch(
      /const filtreDesCommandes = avecCriteres\(\[\.\.\.criteres, \.\.\.clausesDeRecherche\]\)/
    )
  })
})
