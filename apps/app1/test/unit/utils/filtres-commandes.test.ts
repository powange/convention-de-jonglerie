import { describe, expect, it } from 'vitest'

import {
  desFiltresSontActifs,
  filtresDepuisUrl,
  filtresVides,
  nombreDeFiltresActifs,
  parametresDUrl,
  requeteDesFiltres,
  type FiltresCommandes,
} from '../../../../../layers/ticketing/app/utils/filtres-commandes'

/** Un état où chaque critère porte quelque chose, pour vérifier qu'aucun n'est oublié. */
const toutRempli = (): FiltresCommandes => ({
  tarifs: [1, 2],
  options: [7],
  statutEntree: 'validated',
  statuts: ['Pending', 'Refunded'],
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
      statuses: undefined,
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
    expect(nombreDeFiltresActifs(toutRempli())).toBe(2 + 1 + 1 + 2 + 2 + 1 + 1)
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

  it('voit chacun des sept critères', () => {
    // Le décompte et l'envoi énuméraient tous deux les filtres à la main, dans deux fonctions
    // différentes. Ce test échouera si l'un des critères disparaît de l'un des deux.
    const criteres: Array<Partial<FiltresCommandes>> = [
      { tarifs: [1] },
      { options: [1] },
      { statutEntree: 'validated' },
      { statuts: ['Refunded'] },
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
      statuses: ['Pending', 'Refunded'],
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

    for (const cle of [
      'tierIds',
      'optionIds',
      'statuses',
      'paymentMethods',
      'itemTypes',
      'customFieldFilters',
    ])
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

describe('le filtre par statut de commande', () => {
  it('ne masque rien tant que rien n’est coché', () => {
    // Décidé : les commandes ANNULÉES restent visibles par défaut. Les masquer d'office ferait
    // disparaître des lignes de l'écran sans que rien ne le signale, et fausserait les totaux de
    // quiconque compte à l'œil.
    expect(requeteDesFiltres(filtresVides()).statuses).toBeUndefined()
  })

  it('transmet les statuts tels que la base les nomme', () => {
    // L'écran affiche « Annulée » ; la base écrit `Refunded`, un nom hérité des prestataires de
    // paiement. C'est la valeur de la base qui part à l'API, jamais le libellé.
    expect(requeteDesFiltres({ ...filtresVides(), statuts: ['Refunded'] }).statuses).toEqual([
      'Refunded',
    ])
  })

  it('compte pour autant de statuts retenus', () => {
    expect(nombreDeFiltresActifs({ ...filtresVides(), statuts: ['Pending', 'Onsite'] })).toBe(2)
  })
})

describe('les filtres dans l’URL', () => {
  it('fait l’aller-retour sans rien perdre', () => {
    // La propriété qui compte : relire ce qu'on a écrit rend exactement le même écran. C'est ce
    // qui permet de rafraîchir la page ou d'envoyer l'adresse à quelqu'un.
    expect(filtresDepuisUrl(parametresDUrl(toutRempli()))).toEqual(toutRempli())
  })

  it('laisse l’URL nue quand aucun filtre n’est actif', () => {
    // Un écran sans filtre a une adresse sans paramètre : c'est ce qui rend visible, d'un coup
    // d'œil, ce qui est réellement actif.
    expect(parametresDUrl(filtresVides())).toEqual({})
  })

  it('n’écrit pas le mode de combinaison sans champ à combiner', () => {
    // Seul, il ne restreint rien. L'écrire encombrerait l'adresse d'un paramètre sans effet et
    // donnerait à croire qu'un filtre est actif.
    const filtres = { ...filtresVides(), modeChampsPersonnalises: 'or' as const }

    expect(parametresDUrl(filtres)).toEqual({})
  })

  it('rend un écran utilisable depuis une adresse vide', () => {
    expect(filtresDepuisUrl({})).toEqual(filtresVides())
  })

  it('écarte ce qu’il ne reconnaît pas plutôt que de le transmettre', () => {
    // L'adresse se tape à la main et se transfère par courriel : ce qu'on y lit n'est pas de la
    // donnée de confiance. Une valeur inventée transmise à l'API rendrait une liste vide sans
    // que rien n'explique pourquoi.
    const filtres = filtresDepuisUrl({
      statuses: 'Pending,Inventé',
      paymentMethods: 'cash,bitcoin',
      itemTypes: 'Registration,Chimère',
      entryStatus: 'peut-être',
      tierIds: '1,abc,-3,0,4',
    })

    expect(filtres.statuts).toEqual(['Pending'])
    expect(filtres.moyensDePaiement).toEqual(['cash'])
    expect(filtres.typesDeLigne).toEqual(['Registration'])
    expect(filtres.statutEntree).toBe('all')
    expect(filtres.tarifs).toEqual([1, 4])
  })

  it('survit à un JSON abîmé', () => {
    // Une adresse tronquée par un client de messagerie doit ouvrir un écran utilisable, pas une
    // page en échec.
    expect(
      filtresDepuisUrl({ customFieldFilters: '[{"name":"Taille"' }).champsPersonnalises
    ).toEqual([])
  })

  it('ne retient que des champs personnalisés bien formés', () => {
    const query = {
      customFieldFilters: JSON.stringify([
        { name: 'Taille', value: 'M' },
        { name: 'Sans valeur' },
        'pas un objet',
        null,
      ]),
    }

    expect(filtresDepuisUrl(query).champsPersonnalises).toEqual([{ name: 'Taille', value: 'M' }])
  })

  it('ignore une valeur qui n’est pas une chaîne', () => {
    // `route.query` rend un tableau quand un paramètre apparaît deux fois dans l'adresse.
    expect(filtresDepuisUrl({ statuses: ['Pending', 'Refunded'] }).statuts).toEqual([])
  })
})
