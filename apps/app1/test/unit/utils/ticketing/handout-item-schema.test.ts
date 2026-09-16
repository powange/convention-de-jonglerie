import { describe, expect, it } from 'vitest'

import {
  handoutItemSchema,
  NOM_ARTICLE_MAX,
} from '../../../../server/utils/editions/ticketing/handout-items'

/**
 * Ce qu'un article à remettre exige de son nom.
 *
 * Le schéma ne bornait pas la longueur. La colonne, elle, est bornée — `VARCHAR(191)` depuis la
 * migration initiale. Un nom trop long remontait donc en erreur Prisma, que le `catch` du point
 * d'API transformait en 500 : l'utilisateur recevait une panne là où il devait recevoir la
 * phrase qui lui dit quoi corriger.
 *
 * Le schéma était par ailleurs recopié à l'identique dans la création et la mise à jour — deux
 * endroits où ajouter la même borne, donc un endroit où l'oublier.
 */
describe('handoutItemSchema', () => {
  it('accepte un nom ordinaire', () => {
    expect(handoutItemSchema.parse({ name: 'Bracelet' })).toEqual({ name: 'Bracelet' })
  })

  it('ROGNE les espaces autour du nom', () => {
    // L'interface le fait déjà, mais l'interface n'est pas le contrat : « Bracelet » avec une
    // espace de trop est un autre article pour l'œil comme pour un index d'unicité.
    expect(handoutItemSchema.parse({ name: '  Bracelet  ' }).name).toBe('Bracelet')
  })

  it('refuse un nom vide, espaces compris', () => {
    expect(handoutItemSchema.safeParse({ name: '' }).success).toBe(false)
    expect(handoutItemSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('REFUSE un nom plus long que la colonne', () => {
    // C'est tout l'objet du correctif : refuser ici, avec un message, plutôt que de laisser
    // Prisma échouer et l'endpoint rendre 500.
    const tropLong = 'a'.repeat(NOM_ARTICLE_MAX + 1)
    const resultat = handoutItemSchema.safeParse({ name: tropLong })

    expect(resultat.success).toBe(false)
    expect(resultat.error?.issues[0]?.message).toContain(String(NOM_ARTICLE_MAX))
  })

  it('accepte un nom exactement à la longueur de la colonne', () => {
    expect(handoutItemSchema.safeParse({ name: 'a'.repeat(NOM_ARTICLE_MAX) }).success).toBe(true)
  })

  it('compte la longueur APRÈS avoir rogné', () => {
    // Sans quoi des espaces de bordure feraient refuser un nom qui, une fois rogné, tient.
    const avecEspaces = `  ${'a'.repeat(NOM_ARTICLE_MAX)}  `

    expect(handoutItemSchema.safeParse({ name: avecEspaces }).success).toBe(true)
  })

  it('laisse `cumulative` facultatif', () => {
    expect(handoutItemSchema.parse({ name: 'Bracelet', cumulative: true }).cumulative).toBe(true)
    expect(handoutItemSchema.parse({ name: 'Bracelet' }).cumulative).toBeUndefined()
  })
})
