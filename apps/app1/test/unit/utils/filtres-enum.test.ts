import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  STATUTS_DE_RETOUR,
  TYPES_DE_NOTIFICATION,
  TYPES_DE_RETOUR,
  valeurDEnumeration,
} from '../../../shared/utils/filtres-enum'

/**
 * La garde d'un filtre d'énumération, et la cohérence de ses listes — constat B8.
 *
 * ## ⚠️ POURQUOI LES LISTES SONT RELUES DANS LE SCHÉMA
 *
 * Trois valeurs écrites à la main se périment en silence, et l'effet est **l'inverse** du défaut
 * corrigé : une valeur AJOUTÉE à l'énumération deviendrait **infiltrable** — la garde la
 * rejetterait comme inconnue, l'écran afficherait tout, et rien ne lèverait. Personne ne
 * chercherait la cause dans une liste de constantes.
 *
 * Ces tests comparent donc deux sources : les listes de l'util et les `enum` du schéma Prisma. Ce
 * n'est pas un décompte de dette qui se satisfait de lui-même — une entrée en trop comme une
 * entrée manquante fait tomber le test, et il nomme laquelle.
 */
const SCHEMA = join(process.cwd(), 'prisma', 'schema', 'misc.prisma')

/** Les valeurs d'un `enum` du schéma, commentaires de fin de ligne retirés. */
async function valeursDuSchema(nom: string): Promise<string[]> {
  const src = await readFile(SCHEMA, 'utf8')
  const bloc = new RegExp(`^enum ${nom} \\{([\\s\\S]*?)^\\}`, 'm').exec(src)
  if (!bloc) throw new Error(`enum ${nom} introuvable dans ${SCHEMA}`)
  return bloc[1]!
    .split('\n')
    .map((ligne) => ligne.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
}

describe('valeurDEnumeration', () => {
  it('rend la valeur quand elle est connue', () => {
    expect(valeurDEnumeration(TYPES_DE_RETOUR, 'BUG')).toBe('BUG')
    expect(valeurDEnumeration(STATUTS_DE_RETOUR, 'RESOLVED')).toBe('RESOLVED')
  })

  it('⚠️ REND `undefined` SUR UNE VALEUR INCONNUE — c’est tout le lot', () => {
    // Recopiée dans un `where`, elle faisait rejeter la requête entière par Prisma.
    expect(valeurDEnumeration(TYPES_DE_RETOUR, 'PIZZA')).toBeUndefined()
  })

  it('refuse ce qui n’est pas une chaîne, tableau compris', () => {
    /*
     * `getQuery` rend un TABLEAU quand le paramètre apparaît deux fois dans l'adresse, et un
     * tableau dans un `where` fait lever Prisma exactement comme une valeur inconnue.
     *
     * 📍 CE CAS NE PROUVE PAS le `typeof` de l'util : un sabotage qui le retire laisse ce test
     * VERT, parce que `includes` compare à l'identique et rejette déjà un tableau. Ce qui est
     * figé ici est le comportement attendu du filtre sur une adresse bricolée, pas la ligne qui
     * l'obtient — et c'est à savoir avant de conclure qu'un garde-fou est couvert.
     */
    expect(valeurDEnumeration(TYPES_DE_RETOUR, ['BUG'])).toBeUndefined()
    expect(valeurDEnumeration(TYPES_DE_RETOUR, undefined)).toBeUndefined()
    expect(valeurDEnumeration(TYPES_DE_RETOUR, null)).toBeUndefined()
    expect(valeurDEnumeration(TYPES_DE_RETOUR, 1)).toBeUndefined()
  })

  it('n’est pas sensible à la casse par accident', () => {
    // `bug` n'est pas une valeur de l'énumération : Prisma lèverait dessus.
    expect(valeurDEnumeration(TYPES_DE_RETOUR, 'bug')).toBeUndefined()
  })
})

describe('les listes suivent le schéma Prisma', () => {
  it('FeedbackType', async () => {
    expect([...TYPES_DE_RETOUR].sort()).toEqual((await valeursDuSchema('FeedbackType')).sort())
  })

  it('FeedbackStatus', async () => {
    expect([...STATUTS_DE_RETOUR].sort()).toEqual((await valeursDuSchema('FeedbackStatus')).sort())
  })

  it('NotificationType', async () => {
    expect([...TYPES_DE_NOTIFICATION].sort()).toEqual(
      (await valeursDuSchema('NotificationType')).sort()
    )
  })

  it('la lecture du schéma trouve bien des valeurs — elle ne conclut pas sur le vide', async () => {
    /*
     * Les trois cas ci-dessus comparent deux listes : une erreur de chemin ou une expression
     * régulière qui ne mord plus rendrait `[]`, et ils tomberaient — mais sur un message qui
     * parlerait des valeurs manquantes, pas du fichier introuvable. Ce cas-là nomme la cause.
     */
    expect(await valeursDuSchema('FeedbackType')).toContain('BUG')
  })
})
