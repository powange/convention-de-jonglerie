import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { updateWorkshopSchema } from '../../../server/utils/validation-schemas'

/**
 * Les clés qu'un client envoie pour créer un atelier existent dans le schéma — constat B2.
 *
 * ## ⚠️⚠️ POURQUOI CETTE GARDE, ET POURQUOI AUCUN TEST DE HANDLER NE PEUT LA REMPLACER
 *
 * La modale d'import depuis une affiche envoyait son lieu sous le nom `location`. Le schéma ne
 * déclare que `locationId` et `locationName` : **zod retire une clé inconnue sans rien dire**. Le
 * serveur ne voyait donc aucun lieu, l'atelier était créé sans le sien, et il n'y avait ni erreur,
 * ni avertissement, ni trace. Le lieu lu sur l'affiche — que l'organisateur avait pu corriger dans
 * la modale — était perdu à chaque import.
 *
 * Un test du handler ne peut pas attraper cela : le handler se comporte correctement, c'est
 * **l'appel** qui est faux. Et un test de la modale ne le verrait qu'en montant tout le parcours
 * d'import (dépôt d'image, extraction par l'IA, sélection), pour une seule clé de corps.
 *
 * ## Ce qui est lu, et ce qui ne l'est pas
 *
 * Les clés du schéma viennent de `updateWorkshopSchema` — la version `.partial()` du schéma de
 * base, seule exportée sous une forme dont on peut lire la `shape` : le schéma de création porte
 * des `refine`, qui l'enveloppent. Les deux dérivent du MÊME objet, donc la liste est la bonne, et
 * une clé ajoutée demain y entrera sans qu'on y pense.
 *
 * 📍 La page de gestion des ateliers n'est pas balayée : elle compose son corps en plusieurs
 * étapes (`body.locationName = …`), ce qu'une lecture de source ne suit pas honnêtement. Sa
 * correction est du reste vérifiée par les tests du handler, qui exercent le vrai schéma.
 */
const RACINE = join(process.cwd(), '..', '..')
const MODALE = 'layers/workshops/app/components/workshops/ImportFromImageModal.vue'

/**
 * Les clés de premier niveau du littéral `body: { … }` de la modale.
 *
 * Appariement d'accolades plutôt qu'expression régulière sur tout le bloc : le corps contient des
 * appels de fonction et des commentaires, et compter les accolades est la seule façon de savoir où
 * il s'arrête. Les clés imbriquées ne sont pas remontées — seules celles que zod examine comptent.
 */
function clesDuCorps(source: string): string[] {
  /*
   * ⚠️ L'ANCRE EST L'APPEL À `/workshops`, et non le premier `body:` du fichier : cette modale
   * en poste DEUX — d'abord l'image à l'extraction par l'IA (`image`, `forcedDate`), puis chaque
   * atelier. Mon premier balayage lisait le mauvais, et la garde accusait des clés qui n'ont
   * jamais prétendu décrire un atelier.
   */
  const appel = source.indexOf('/workshops`')
  if (appel === -1) return []
  const depart = source.indexOf('body: {', appel)
  if (depart === -1) return []
  let profondeur = 0
  let fin = -1
  for (let i = source.indexOf('{', depart); i < source.length; i++) {
    if (source[i] === '{') profondeur++
    else if (source[i] === '}') {
      profondeur--
      if (profondeur === 0) {
        fin = i
        break
      }
    }
  }
  if (fin === -1) return []

  const corps = source.slice(source.indexOf('{', depart) + 1, fin)
  // Les commentaires d'abord : ils contiennent des mots suivis de deux-points.
  const sansCommentaires = corps.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  const cles: string[] = []
  let niveau = 0
  for (const ligne of sansCommentaires.split('\n')) {
    const candidat = niveau === 0 ? ligne.match(/^\s*([A-Za-z_$][\w$]*)\s*:/) : null
    if (candidat) cles.push(candidat[1]!)
    // Une ligne peut ouvrir et fermer : on compte, on ne devine pas.
    for (const c of ligne) {
      if (c === '{' || c === '[' || c === '(') niveau++
      else if (c === '}' || c === ']' || c === ')') niveau--
    }
  }
  return cles
}

describe('corps d’un atelier posté par l’import depuis une affiche', () => {
  it('⚠️ CHAQUE CLÉ ENVOYÉE EXISTE DANS LE SCHÉMA — sinon zod la retire en silence', async () => {
    const source = await readFile(join(RACINE, MODALE), 'utf8')
    const connues = new Set(Object.keys(updateWorkshopSchema.shape))

    const inconnues = clesDuCorps(source).filter((c) => !connues.has(c))

    expect(
      inconnues,
      `Ces clés ne sont déclarées nulle part dans le schéma d'un atelier : zod les RETIRE sans ` +
        `lever, et la donnée est perdue sans message. Les renommer d'après le schéma ` +
        `(${[...connues].sort().join(', ')}) :\n${inconnues.join('\n')}`
    ).toEqual([])
  })

  it('le lieu est bien envoyé — la garde ci-dessus est vraie sur un corps VIDE', async () => {
    /*
     * L'interdiction seule serait satisfaite en ne postant plus RIEN, ce qui est exactement le
     * défaut qu'on répare : le lieu absent du corps. On exige donc sa présence, en plus.
     */
    const source = await readFile(join(RACINE, MODALE), 'utf8')
    const cles = clesDuCorps(source)

    expect(cles, 'aucune clé lue : le balayage du corps est cassé').toContain('title')
    expect(cles, "le lieu n'est plus envoyé").toContain('locationName')
  })
})
