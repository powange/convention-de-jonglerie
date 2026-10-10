import { describe, it, expect } from 'vitest'
import { z } from 'zod'

import {
  decalageDePagination,
  limiteDePagination,
} from '../../../../server/utils/validation-schemas'

/**
 * Les bornes d'une pagination lue dans l'URL — constat A3.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * `limit` et `offset` étaient transformés par un `parseInt` nu, sans `min`, sans `max`, sans garde
 * sur `NaN`. Deux conséquences, et aucune ne demandait d'effort à produire :
 *
 * - `?limit=abc` donnait `take: NaN`, que Prisma refuse : une **panne 500** sur une saisie d'URL ;
 * - `?limit=100000` chargeait tout — une conversation entière avec ses auteurs et ses citations,
 *   ou toutes les notifications d'un compte.
 *
 * ## ⚠️⚠️ LE PIÈGE QUE CES CAS GARDENT FERMÉ
 *
 * `z.coerce.number()` convertit la **chaîne vide en zéro**. `?limit=` — que produit n'importe quel
 * formulaire dont le champ est vide — serait donc refusé par `min(1)`, là où l'ancien code retombait
 * sur son défaut. Durcir une entrée ne doit pas transformer en erreur ce qui marchait : deux cas
 * figent cette tolérance.
 *
 * C'est aussi pourquoi la règle est un schéma partagé et non deux `z.object` recopiés : écrite deux
 * fois, cette tolérance aurait fini par ne valoir que d'un côté.
 */
describe('les bornes de pagination', () => {
  const schema = z.object({ limit: limiteDePagination(), offset: decalageDePagination() })

  it('⚠️ REFUSE CE QUI N’EST PAS UN NOMBRE, au lieu de rendre NaN', () => {
    // C'est ce `NaN` qui atteignait Prisma en `take` et faisait répondre 500.
    expect(() => schema.parse({ limit: 'abc' })).toThrow()
  })

  it('⚠️ PLAFONNE LA LIMITE', () => {
    expect(() => schema.parse({ limit: '100000' })).toThrow()
    expect(schema.parse({ limit: '100' }).limit).toBe(100)
  })

  it('accepte une limite ordinaire, écrite en chaîne', () => {
    /*
     * LE TÉMOIN. Sans lui, un schéma qui refuserait TOUT satisferait les deux cas ci-dessus — et la
     * messagerie ne chargerait plus un seul message. Les paramètres d'URL arrivent toujours en
     * chaînes : c'est la forme réelle, pas une commodité de test.
     */
    expect(schema.parse({ limit: '50', offset: '20' })).toEqual({ limit: 50, offset: 20 })
  })

  it('⚠️ TRAITE UNE VALEUR VIDE COMME UNE ABSENCE', () => {
    /*
     * `?limit=` arrive comme la chaîne vide, que `z.coerce.number` convertit en ZÉRO — donc refusé
     * par `min(1)`. L'ancien code, lui, retombait sur son défaut. Sans ce prétraitement, le
     * durcissement transformerait en 400 une requête qui fonctionnait.
     */
    expect(schema.parse({ limit: '', offset: '' })).toEqual({ limit: undefined, offset: undefined })
  })

  it('laisse l’appelant décider du défaut quand rien n’est demandé', () => {
    // Le schéma ne choisit pas à sa place : les deux points d'API qui l'emploient n'ont pas la même
    // valeur d'arrivée, et c'est à eux de la poser.
    expect(schema.parse({})).toEqual({ limit: undefined, offset: undefined })
  })

  it('refuse un décalage négatif mais accepte zéro', () => {
    // Zéro est la première page : le refuser casserait tous les premiers chargements.
    expect(schema.parse({ offset: '0' }).offset).toBe(0)
    expect(() => schema.parse({ offset: '-1' })).toThrow()
  })

  it('refuse une limite nulle ou fractionnaire', () => {
    // `limit=0` ne rendrait rien tout en répondant 200 : plus trompeur qu'un refus.
    expect(() => schema.parse({ limit: '0' })).toThrow()
    expect(() => schema.parse({ limit: '2.5' })).toThrow()
  })

  it('accepte un plafond choisi par l’appelant', () => {
    const serre = z.object({ limit: limiteDePagination(10) })

    expect(serre.parse({ limit: '10' }).limit).toBe(10)
    expect(() => serre.parse({ limit: '11' })).toThrow()
  })
})
