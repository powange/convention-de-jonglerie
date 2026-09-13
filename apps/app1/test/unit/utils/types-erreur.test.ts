import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  codesDeLaFamille,
  codesDuFiltreDeType,
  libelleDuType,
  optionsDuFiltreDeType,
  PREFIXE_FAMILLE,
  TYPES_D_ERREUR,
} from '../../../shared/utils/types-erreur'

/**
 * Le serveur produisait dix-sept types d'erreur, l'écran en proposait huit, et les deux listes
 * étaient tenues séparément. La divergence ne se voyait sur aucun écran — elle se payait au
 * diagnostic : « Base de données » filtrait sur le repli générique `DatabaseError` et excluait donc
 * les interblocages, les dépassements de verrou et les contraintes d'unicité.
 *
 * Ces tests tiennent les deux bouts : que la description soit cohérente avec elle-même, et surtout
 * qu'aucun type produit par la classification n'échappe au filtre.
 */
describe('les types d’erreur', () => {
  it('n’a pas deux fois le même code', () => {
    const codes = TYPES_D_ERREUR.map((type) => type.code)

    expect(new Set(codes).size).toBe(codes.length)
  })

  it('propose chaque type au filtre', () => {
    const proposees = new Set(optionsDuFiltreDeType().map((option) => option.value))

    for (const type of TYPES_D_ERREUR) expect(proposees).toContain(type.code)
  })

  it('nomme un code inconnu plutôt que de rendre du vide', () => {
    // Un type retiré de la liste mais encore présent en base doit rester lisible à l'écran.
    expect(libelleDuType('TypeDisparu')).toBe('TypeDisparu')
    expect(libelleDuType('DatabaseDeadlockError')).toBe('Interblocage')
    expect(libelleDuType(null)).toBe('Non classée')
  })
})

describe('codesDuFiltreDeType', () => {
  it('résout une famille en tous ses types', () => {
    // C'est le correctif lui-même : « Base de données » désignait le seul repli générique.
    const codes = codesDuFiltreDeType(`${PREFIXE_FAMILLE}base-de-donnees`)

    expect(codes).toContain('DatabaseDeadlockError')
    expect(codes).toContain('DatabaseUniqueConstraintError')
    expect(codes).toContain('DatabaseLockTimeoutError')
    // Le repli en fait partie, mais il n'est plus le seul.
    expect(codes).toContain('DatabaseError')
    expect(codes).toHaveLength(codesDeLaFamille('base-de-donnees').length)
  })

  it('résout un type précis en lui seul', () => {
    expect(codesDuFiltreDeType('DatabaseDeadlockError')).toEqual(['DatabaseDeadlockError'])
  })

  it('ne filtre rien plutôt que de ne rien rendre', () => {
    // `null` veut dire « aucune restriction ». Une valeur fabriquée à la main dans l'URL, ou une
    // famille vide, ne doit pas produire une liste vide sans rien expliquer : un écran vide se lit
    // comme « aucune erreur », ce qui est le contraire de l'information recherchée.
    for (const valeur of [null, undefined, '', 'all', 'TypeInventé', `${PREFIXE_FAMILLE}chimère`])
      expect(codesDuFiltreDeType(valeur)).toBeNull()
  })
})

/**
 * La garantie qui compte, et la raison d'être de ce fichier.
 *
 * Le typage de `getErrorType` empêche déjà de RENDRE un code absent de la liste. Il n'empêche pas
 * d'ajouter un code à la liste sans jamais le produire, ni — et c'est le cas dangereux — d'ajouter
 * une branche dont le code n'aurait pas d'option de filtre si le typage venait à être relâché.
 *
 * On relit donc la fonction elle-même. C'est inhabituel pour un test, et assumé : c'est exactement
 * la divergence qu'aucune autre forme de vérification n'avait attrapée pendant des mois.
 */
describe('la classification du serveur', () => {
  // Résolu depuis le dossier de travail (`apps/app1`) et non depuis `import.meta.url` : Vitest
  // transforme les modules, et l'URL du test n'a alors pas le schéma `file:`.
  const chemin = resolve(process.cwd(), 'server/utils/error-logger.ts')
  expect(existsSync(chemin), `Fichier introuvable : ${chemin}`).toBe(true)
  const source = readFileSync(chemin, { encoding: 'utf8' })

  /** Les littéraux rendus par `getErrorType`, extraits du fichier. */
  const codesProduits = (() => {
    const debut = source.indexOf('export function getErrorType')
    expect(debut, 'getErrorType doit rester exportée pour être relue').toBeGreaterThan(-1)

    // La fonction se termine à la première accolade fermante en début de ligne.
    const fin = source.indexOf('\n}', debut)
    const corps = source.slice(debut, fin)

    return [...corps.matchAll(/return '([A-Za-z0-9]+)'/g)].map((occurrence) => occurrence[1]!)
  })()

  it('a bien été relue', () => {
    // Sans ce garde-fou, un changement de forme du fichier rendrait une liste vide, et les tests
    // suivants passeraient au vert sans rien vérifier — le pire des faux négatifs.
    expect(codesProduits.length).toBeGreaterThanOrEqual(15)
    expect(codesProduits).toContain('UnknownError')
  })

  it('ne produit aucun type que le filtre ne propose pas', () => {
    const filtrables = new Set(TYPES_D_ERREUR.map((type) => type.code))
    const orphelins = [...new Set(codesProduits)].filter((code) => !filtrables.has(code))

    expect(
      orphelins,
      `Ces types sont produits par getErrorType mais absents de types-erreur.ts, donc impossibles à filtrer : ${orphelins.join(', ')}`
    ).toEqual([])
  })

  it('couvre les neuf types de base de données qui manquaient', () => {
    // La liste nominative du constat d'origine : ce sont eux que l'ancien filtre écartait.
    for (const code of [
      'DatabaseUniqueConstraintError',
      'DatabaseForeignKeyError',
      'DatabaseRecordNotFoundError',
      'DatabaseSortMemoryError',
      'DatabaseDeadlockError',
      'DatabaseLockTimeoutError',
      'DatabaseConnectionError',
      'DatabaseValidationError',
      'TimeoutError',
    ]) {
      expect(codesProduits, `${code} doit être produit par getErrorType`).toContain(code)
      expect(codesDuFiltreDeType(code), `${code} doit être filtrable`).toEqual([code])
    }
  })
})
