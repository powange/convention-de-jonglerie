import { describe, expect, it } from 'vitest'

import {
  desFiltresSontActifs,
  filtresVides,
  nombreDeFiltresActifs,
  requeteDesFiltres,
  type FiltresCommandes,
} from '../../../../../layers/ticketing/app/utils/filtres-commandes'

/** Un état où chaque critère porte quelque chose, pour vérifier qu'aucun n'est oublié. */
const toutRempli = (): FiltresCommandes => ({
  tarifs: [1, 2],
  options: [7],
  statutEntree: 'validated',
  moyensDePaiement: ['cash', 'check'],
  typesDeLigne: ['Registration'],
  champsPersonnalises: [{ name: 'Taille', value: 'M' }],
  modeChampsPersonnalises: 'or',
})

describe('filtresVides', () => {
  it('ne laisse aucun filtre actif', () => {
    // C'est ce sur quoi la réinitialisation retombe : s'il en restait un, le bouton « effacer »
    // mentirait, et rien à l'écran ne le dirait.
    expect(nombreDeFiltresActifs(filtresVides())).toBe(0)
    expect(desFiltresSontActifs(filtresVides())).toBe(false)
  })

  it('rend un état neuf à chaque appel', () => {
    // L'écran écrit dans cet objet. Partagé, une réinitialisation traînerait les listes de la
    // précédente.
    const premier = filtresVides()
    premier.tarifs.push(42)

    expect(filtresVides().tarifs).toEqual([])
  })

  it('ne demande rien à l’API quand rien n’est coché', () => {
    expect(requeteDesFiltres(filtresVides())).toEqual({
      tierIds: undefined,
      optionIds: undefined,
      entryStatus: 'all',
      paymentMethods: undefined,
      itemTypes: undefined,
      customFieldFilters: undefined,
      customFieldFilterMode: 'and',
    })
  })
})

describe('nombreDeFiltresActifs', () => {
  it('compte chaque valeur retenue, pas chaque critère', () => {
    // Deux tarifs cochés valent deux restrictions : c'est ce que l'utilisateur voit dans le
    // panneau, et la pastille doit dire la même chose.
    expect(nombreDeFiltresActifs(toutRempli())).toBe(2 + 1 + 1 + 2 + 1 + 1)
  })

  it('ne compte pas le statut « tous »', () => {
    const filtres = { ...filtresVides(), statutEntree: 'all' as const }

    expect(nombreDeFiltresActifs(filtres)).toBe(0)
  })

  it('compte le statut dès qu’il restreint', () => {
    for (const statut of ['validated', 'not_validated'] as const) {
      expect(nombreDeFiltresActifs({ ...filtresVides(), statutEntree: statut })).toBe(1)
    }
  })

  it('ne compte pas le mode de combinaison des champs personnalisés', () => {
    // Seul, il ne restreint rien : le faire compter afficherait « 1 filtre » sur un écran qui
    // montre toutes les commandes.
    const filtres = { ...filtresVides(), modeChampsPersonnalises: 'or' as const }

    expect(nombreDeFiltresActifs(filtres)).toBe(0)
  })

  it('voit chacun des six critères', () => {
    // Le décompte et l'envoi énuméraient tous deux les filtres à la main, dans deux fonctions
    // différentes. Ce test échouera si l'un des critères disparaît de l'un des deux.
    const criteres: Array<Partial<FiltresCommandes>> = [
      { tarifs: [1] },
      { options: [1] },
      { statutEntree: 'validated' },
      { moyensDePaiement: ['cash'] },
      { typesDeLigne: ['Donation'] },
      { champsPersonnalises: [{ name: 'a', value: 'b' }] },
    ]

    for (const critere of criteres) {
      expect(nombreDeFiltresActifs({ ...filtresVides(), ...critere })).toBe(1)
    }
  })
})

describe('requeteDesFiltres', () => {
  it('transmet chaque critère rempli', () => {
    expect(requeteDesFiltres(toutRempli())).toEqual({
      tierIds: [1, 2],
      optionIds: [7],
      entryStatus: 'validated',
      paymentMethods: ['cash', 'check'],
      itemTypes: ['Registration'],
      customFieldFilters: [{ name: 'Taille', value: 'M' }],
      customFieldFilterMode: 'or',
    })
  })

  it('rend `undefined` plutôt qu’une liste vide', () => {
    // Côté serveur, une absence et un tableau vide ne se valent pas toujours — et `orders.get.ts`
    // teste `length > 0` avant d'appliquer chaque filtre.
    const requete = requeteDesFiltres(filtresVides())

    for (const cle of ['tierIds', 'optionIds', 'paymentMethods', 'itemTypes', 'customFieldFilters'])
      expect(requete[cle as keyof typeof requete]).toBeUndefined()
  })

  it('n’invente pas de filtre de statut quand il vaut « tous »', () => {
    // `entryStatus` part toujours, y compris à `all` : c'est `fetchOrders` qui l'écarte de l'URL.
    // Le transmettre tel quel évite d'avoir deux endroits qui décident de la même chose.
    expect(requeteDesFiltres(filtresVides()).entryStatus).toBe('all')
  })
})

describe('desFiltresSontActifs', () => {
  it('suit le décompte, pour qu’ils ne puissent pas se contredire', () => {
    expect(desFiltresSontActifs(toutRempli())).toBe(true)
    expect(desFiltresSontActifs(filtresVides())).toBe(false)
    expect(desFiltresSontActifs({ ...filtresVides(), options: [3] })).toBe(true)
  })
})
