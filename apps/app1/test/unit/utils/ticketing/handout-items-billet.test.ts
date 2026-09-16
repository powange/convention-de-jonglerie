import { describe, expect, it } from 'vitest'

import { calculateHandoutItemsForTicket } from '../../../../server/utils/ticketing/handout-items'

/**
 * Les articles à remettre d'un billet.
 *
 * TROIS sources s'y rejoignent : le tarif acheté, les options souscrites, les champs
 * personnalisés renseignés. Les options manquaient — l'écran de guichet les agrégeait de son
 * côté, sans connaître le drapeau `cumulative`, et un article attaché au tarif ET à une option
 * ressortait en deux lignes à cocher.
 *
 * La fonction n'avait aucun test : c'est elle qui décide de ce qu'on remet au guichet.
 */

/** Un article tel que Prisma le rend sur une association de tarif ou de champ personnalisé. */
const article = (id: number, name: string, cumulative = false) => ({
  id,
  name,
  cumulative,
})

const tarif = (
  associations: Array<{ handoutItem: ReturnType<typeof article>; quantity?: number }>
) => ({
  id: 1,
  name: 'Pass week-end',
  handoutItems: associations,
  customFields: [],
})

const option = (
  nom: string,
  associations: Array<{ handoutItem: ReturnType<typeof article>; quantity?: number }>
) => ({
  id: 10,
  amount: 500,
  option: { id: 10, name: nom, handoutItems: associations },
})

describe('calculateHandoutItemsForTicket', () => {
  it('rend les articles du tarif', () => {
    const resultat = calculateHandoutItemsForTicket({
      tier: tarif([{ handoutItem: article(1, 'Bracelet') }]),
    })

    expect(resultat).toHaveLength(1)
    expect(resultat[0]).toMatchObject({ quantity: 1, source: 'tier' })
    expect(resultat[0].handoutItem.name).toBe('Bracelet')
  })

  it('rend les articles des OPTIONS souscrites', () => {
    // Le cœur du défaut : ils n'entraient pas du tout dans le calcul.
    const resultat = calculateHandoutItemsForTicket({
      tier: tarif([]),
      selectedOptions: [
        option('Camping', [{ handoutItem: article(2, 'Jeton douche'), quantity: 2 }]),
      ],
    })

    expect(resultat).toHaveLength(1)
    expect(resultat[0]).toMatchObject({ quantity: 2, source: 'option', optionName: 'Camping' })
  })

  it('ne remet QU’UNE FOIS un article non cumulable venu du tarif ET d’une option', () => {
    // C'est le cas qui produisait deux lignes à cocher pour un seul bracelet.
    const bracelet = article(1, 'Bracelet')
    const resultat = calculateHandoutItemsForTicket({
      tier: tarif([{ handoutItem: bracelet }]),
      selectedOptions: [option('Camping', [{ handoutItem: bracelet }])],
    })

    expect(resultat).toHaveLength(1)
    expect(resultat[0].quantity).toBe(1)
  })

  it('retient la plus grande quantité pour un article non cumulable', () => {
    const bracelet = article(1, 'Bracelet')
    const resultat = calculateHandoutItemsForTicket({
      tier: tarif([{ handoutItem: bracelet, quantity: 1 }]),
      selectedOptions: [option('Camping', [{ handoutItem: bracelet, quantity: 3 }])],
    })

    expect(resultat[0].quantity).toBe(3)
  })

  it('ADDITIONNE un article cumulable venu du tarif et d’une option', () => {
    const jeton = article(2, 'Ticket boisson', true)
    const resultat = calculateHandoutItemsForTicket({
      tier: tarif([{ handoutItem: jeton, quantity: 2 }]),
      selectedOptions: [option('Repas', [{ handoutItem: jeton, quantity: 3 }])],
    })

    expect(resultat).toHaveLength(1)
    expect(resultat[0].quantity).toBe(5)
  })

  it('rend les articles d’une option même SANS tarif', () => {
    // Une option s'achète indépendamment. Rendre une liste vide priverait la personne d'un
    // article qu'on lui a pourtant vendu.
    const resultat = calculateHandoutItemsForTicket({
      tier: null,
      selectedOptions: [option('Camping', [{ handoutItem: article(2, 'Jeton douche') }])],
    })

    expect(resultat).toHaveLength(1)
    expect(resultat[0].handoutItem.name).toBe('Jeton douche')
  })

  it('rend une liste vide quand il n’y a rien à remettre', () => {
    expect(calculateHandoutItemsForTicket({ tier: null })).toEqual([])
    expect(calculateHandoutItemsForTicket({ tier: tarif([]) })).toEqual([])
  })

  it('supporte un billet sans options du tout', () => {
    // `selectedOptions` est absent des réponses qui ne le chargent pas : la fonction ne doit
    // pas tomber pour autant.
    expect(() => calculateHandoutItemsForTicket({ tier: tarif([]) })).not.toThrow()
  })
})

describe('calculateHandoutItemsForTicket et les champs personnalisés', () => {
  const tarifAvecChamp = (
    choiceValue: string | null,
    articleAssocie = article(3, 'Tee-shirt')
  ) => ({
    id: 1,
    name: 'Pass week-end',
    handoutItems: [],
    customFields: [
      {
        customField: {
          label: 'Taille du tee-shirt',
          handoutItems: [{ handoutItem: articleAssocie, quantity: 1, choiceValue }],
        },
      },
    ],
  })

  it('remet l’article quand la réponse correspond au choix', () => {
    const resultat = calculateHandoutItemsForTicket({
      tier: tarifAvecChamp('L'),
      customFields: [{ name: 'Taille du tee-shirt', answer: 'L' }],
    })

    expect(resultat).toHaveLength(1)
    expect(resultat[0]).toMatchObject({
      source: 'customField',
      customFieldName: 'Taille du tee-shirt',
    })
  })

  it('ne remet PAS l’article quand la réponse ne correspond pas', () => {
    const resultat = calculateHandoutItemsForTicket({
      tier: tarifAvecChamp('L'),
      customFields: [{ name: 'Taille du tee-shirt', answer: 'M' }],
    })

    expect(resultat).toEqual([])
  })

  it('remet l’article quel que soit le choix quand aucun n’est exigé', () => {
    const resultat = calculateHandoutItemsForTicket({
      tier: tarifAvecChamp(null),
      customFields: [{ name: 'Taille du tee-shirt', answer: 'XL' }],
    })

    expect(resultat).toHaveLength(1)
  })
})
