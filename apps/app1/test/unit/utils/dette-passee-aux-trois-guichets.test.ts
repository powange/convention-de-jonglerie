import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Tout appelant de `montantARembourser` doit lui passer la REMISE.
 *
 * ⚠️ POURQUOI CETTE GARDE. En étendant la règle de la dette aux remises, j'ai trouvé **trois**
 * appelants et aucun ne transmettait les nouveaux champs. L'omission est MUETTE : un champ absent
 * vaut `undefined`, `undefined` se lit « pas de remise », et le guichet n'annonce simplement aucune
 * dette. Personne ne réclame l'argent, et rien à l'écran ne dit qu'il manque quelque chose.
 *
 * 📍 C'est la classe de défaut que ce dépôt a déjà payée : le fichier `nom-du-validateur.ts`
 * raconte la même histoire — une règle corrigée d'un côté, l'autre oublié, et personne ne va
 * regarder le second parce qu'on vient de corriger le premier.
 */

const RACINE = join(import.meta.dirname, '../../../../..')

/** Les trois écrans qui annoncent une dette, et le chemin de leur source. */
const APPELANTS = [
  'apps/app1/server/api/editions/[id]/ticketing/search.post.ts',
  'apps/app1/server/api/editions/[id]/ticketing/verify.post.ts',
  'layers/ticketing/server/api/editions/[id]/ticketing/orders.get.ts',
]

/** La source, commentaires retirés : ils citent nommément les champs qu'on cherche. */
function sansCommentaires(chemin: string): string {
  return readFileSync(join(RACINE, chemin), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('la dette due à une remise atteint les trois écrans', () => {
  it.each(APPELANTS)('%s appelle bien la règle', (chemin) => {
    // Sans cette première assertion, la suivante serait vraie pour la mauvaise raison : un fichier
    // renommé ou un appel retiré passerait au vert.
    expect(sansCommentaires(chemin)).toContain('montantARembourser(')
  })

  it.each(APPELANTS)('%s transmet la remise et son sort', (chemin) => {
    const source = sansCommentaires(chemin)

    expect(source, 'la remise accordée').toMatch(/discountAmount:\s*\w+\.discountAmount/)
    expect(source, 'a-t-elle été rendue').toMatch(/discountPaidBack:\s*\w+\.discountPaidBack/)
  })
})
