import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { dedoublonnerAssociations } from '../../../shared/utils/dedoublonnage-associations'

/**
 * Le dédoublonnage des associations, et le fait que les cinq points d'écriture l'appliquent
 * — constat O3.
 *
 * Sous MySQL, deux NULL sont **distincts** dans un index unique : une contrainte
 * `@@unique([customFieldId, handoutItemId, choiceValue])` dont `choiceValue` est nullable
 * n'empêche pas d'empiler deux lignes « tous les choix » identiques. Prouvé en base, dans une
 * transaction annulée ensuite : deux `create` identiques, deux identifiants rendus.
 */
describe('dedoublonnerAssociations', () => {
  it('garde une seule ligne par clé', () => {
    const resultat = dedoublonnerAssociations(
      [
        { quotaId: 1, choiceValue: null },
        { quotaId: 1, choiceValue: null },
        { quotaId: 2, choiceValue: null },
      ],
      (a) => [a.quotaId, a.choiceValue]
    )

    expect(resultat).toHaveLength(2)
  })

  it('⚠️ NE CONFOND PAS « tous les choix » AVEC un choix nommé', () => {
    /*
     * Le témoin : le même quota peut légitimement viser deux réponses différentes, et une ligne
     * « tous les choix » coexiste avec elles. Dédoublonner sur le seul quota en perdrait.
     */
    const resultat = dedoublonnerAssociations(
      [
        { quotaId: 1, choiceValue: null },
        { quotaId: 1, choiceValue: 'Oui' },
        { quotaId: 1, choiceValue: 'Non' },
      ],
      (a) => [a.quotaId, a.choiceValue]
    )

    expect(resultat).toHaveLength(3)
  })

  it('garde la DERNIÈRE occurrence, à la position de la première', () => {
    /*
     * Un formulaire qui envoie deux fois le même article avec deux quantités veut dire la
     * seconde. C'est déjà le comportement de `normalizeHandoutItemSelections` ; garder la
     * première rendrait la saisie imprévisible selon le point d'API touché — et c'est
     * exactement la divergence qui existait entre les deux copies écrites à la main.
     */
    const resultat = dedoublonnerAssociations(
      [
        { id: 1, quantity: 2 },
        { id: 9, quantity: 1 },
        { id: 1, quantity: 7 },
      ],
      (a) => [a.id]
    )

    expect(resultat).toEqual([
      { id: 1, quantity: 7 },
      { id: 9, quantity: 1 },
    ])
  })

  it('⚠️ DISTINGUE LA CHAÎNE VIDE DE `null` — la clé n’est pas une concaténation', () => {
    /*
     * ⚠️⚠️ CE CAS A ATTRAPÉ UN DÉFAUT DE MA PROPRE CORRECTION. La version écrite à la main
     * composait sa clé avec `${quotaId}::${choiceValue ?? ''}`, ce qui confond `''` et `null`.
     * La fonction, elle, les sépare — c'est le comportement juste pour une clé générique.
     *
     * 📍 MAIS LA CONSÉQUENCE EST L'INVERSE DE CE QU'ON CROIT, et c'est le vrai enseignement :
     * aux points d'écriture, `choiceValue` est normalisé (`|| null`) AVANT d'être écrit, donc
     * `''` et `null` y produisent la MÊME ligne. Une clé calculée sur la valeur brute laissait
     * donc passer la paire `['', null]` et créait deux lignes identiques — le défaut qu'on
     * corrige, recréé par la correction. Les cinq appelants calculent leur clé sur la valeur
     * normalisée, et le test de branchement ci-dessous le vérifie.
     */
    const resultat = dedoublonnerAssociations(
      [
        { id: 1, choix: '' },
        { id: 1, choix: null },
      ],
      (a) => [a.id, a.choix]
    )

    expect(resultat).toHaveLength(2)
  })

  it('traite `undefined` et `null` comme la même absence', () => {
    const resultat = dedoublonnerAssociations(
      [
        { id: 1, choix: undefined },
        { id: 1, choix: null },
      ],
      (a) => [a.id, a.choix]
    )

    expect(resultat).toHaveLength(1)
  })

  it('ne confond pas le nombre 1 et la chaîne « 1 »', () => {
    const resultat = dedoublonnerAssociations([{ v: 1 }, { v: '1' }], (a) => [a.v])

    expect(resultat).toHaveLength(2)
  })

  it('rend une liste vide sur une liste vide', () => {
    expect(dedoublonnerAssociations([], () => [])).toEqual([])
  })
})

/** Les cinq écritures des deux tables de liaison d'un champ personnalisé. */
const ECRITURES = [
  'layers/ticketing/server/api/editions/[id]/ticketing/custom-fields.post.ts',
  'layers/ticketing/server/api/editions/[id]/ticketing/custom-fields/[customFieldId].put.ts',
  'layers/ticketing/server/api/editions/[id]/ticketing/custom-fields/[customFieldId]/quotas.put.ts',
  'layers/ticketing/server/api/editions/[id]/ticketing/custom-fields/[customFieldId]/handout-items.put.ts',
  'layers/ticketing/server/api/editions/[id]/ticketing/custom-fields/[customFieldId]/associations.put.ts',
]

const source = (relatif: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../../../..', relatif), 'utf8')

/**
 * Les arguments de chaque appel à `dedoublonnerAssociations`, parenthèses comptées.
 *
 * Pas une expression régulière : un appel peut tenir sur une ligne comme sur six, et un motif
 * qui suppose l'une des deux formes n'examine pas l'autre — c'est l'erreur qu'un sabotage a
 * révélée dans la première version de ce fichier.
 */
function appelsDeDedoublonnage(src: string): string[] {
  const appels: string[] = []
  const NOM = 'dedoublonnerAssociations('
  let depuis = 0
  for (;;) {
    const debut = src.indexOf(NOM, depuis)
    if (debut === -1) return appels
    let profondeur = 0
    let i = debut + NOM.length - 1
    for (; i < src.length; i++) {
      if (src[i] === '(') profondeur++
      else if (src[i] === ')') {
        profondeur--
        if (profondeur === 0) break
      }
    }
    appels.push(src.slice(debut + NOM.length, i))
    depuis = i
  }
}

describe('les cinq écritures dédoublonnent, et sur la valeur normalisée', () => {
  /*
   * LA GARDE DE BRANCHEMENT. Une fonction juste et branchée nulle part ne corrige rien : ce
   * dépôt a payé ce défaut cinq fois, et la couverture du code mort le fait passer pour vivant.
   * Ces cas lisent les fichiers d'écriture eux-mêmes.
   */
  it.each(ECRITURES)('%s appelle le dédoublonnage', (relatif) => {
    expect(source(relatif)).toContain('dedoublonnerAssociations(')
  })

  it('⚠️ AUCUNE CLÉ N’EST CALCULÉE SUR LA VALEUR BRUTE de `choiceValue`', () => {
    /*
     * C'est le défaut que le cas « chaîne vide » ci-dessus explique : une clé sur la valeur brute
     * laisse passer la paire `['', null]`, qui produit deux lignes IDENTIQUES en base puisque
     * l'écriture normalise.
     *
     * ⚠️⚠️ ET LA PREMIÈRE VERSION DE CE CAS N'ATTRAPAIT RIEN, ce qu'un sabotage a montré. Elle
     * extrayait les arguments par une expression régulière finissant sur `\n  ])`, donc elle ne
     * voyait que les appels écrits sur PLUSIEURS lignes : l'appel d'une seule ligne — justement
     * celui qui portait le défaut — n'était jamais examiné, et la garde restait verte. Un motif
     * qui n'attrape pas tout exempte en silence. Les arguments sont désormais extraits en
     * comptant les parenthèses, et leur NOMBRE est comparé à celui des appels.
     */
    const fautifs = ECRITURES.filter((relatif) =>
      appelsDeDedoublonnage(source(relatif)).some(
        (args) => args.includes('choiceValue') && !args.includes('choiceValue || null')
      )
    )

    expect(
      fautifs,
      'la clé de dédoublonnage y est calculée sur `choiceValue` brut : la paire ' +
        "`['', null]` passerait et créerait deux lignes identiques"
    ).toEqual([])
  })

  it('⚠️ TOUS LES APPELS SONT EXAMINÉS — l’extraction ne saute rien', () => {
    /*
     * La garde de la garde. Le cas précédent est une interdiction : un extracteur qui rate un
     * appel le laisse au vert sans l'avoir lu. On compare donc ce qui est EXTRAIT à ce qui est
     * simplement REPÉRÉ par le nom de la fonction.
     */
    for (const relatif of ECRITURES) {
      const src = source(relatif)
      const repERES = (src.match(/dedoublonnerAssociations\(/g) ?? []).length
      expect(appelsDeDedoublonnage(src), `${relatif} : appels non extraits`).toHaveLength(repERES)
    }
  })

  it('le balayage lit bien les cinq fichiers — il ne conclut pas sur le vide', () => {
    // Le cas précédent est une interdiction, donc vert sur une liste vide : une erreur de chemin
    // le laisserait au vert sans plus rien vérifier.
    for (const relatif of ECRITURES) {
      expect(source(relatif).length, `${relatif} est vide ou introuvable`).toBeGreaterThan(500)
    }
  })
})
