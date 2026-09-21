import { describe, expect, it } from 'vitest'

import {
  associationsDunArtiste,
  associationsDunBenevole,
  associationsDunOrganisateur,
  cumulerParArticle,
  personneComptee,
} from '../../../../server/utils/ticketing/volumes-des-articles'

/**
 * Les volumes d'articles à remettre, pour l'édition entière.
 *
 * Deux erreurs coûtent ici, et aucune ne se voit à l'écran.
 *
 * **Compter trop** : sommer les associations plutôt que d'agréger par personne. Un bracelet
 * attaché au tarif ET à une option donnerait deux bracelets. Le chiffre reste plausible, et on
 * commande le double.
 *
 * **Compter trop peu** : oublier qu'un article cumulable s'additionne bel et bien. L'artiste qui
 * joue dans deux spectacles repart avec un seul ticket boisson au lieu de deux, et c'est au
 * comptoir qu'on s'en aperçoit.
 */

// Une association telle que Prisma la rend : l'article, et la quantité de CETTE association.
const assoc = (id: number, name: string, cumulative = false, quantity?: number | null) => ({
  handoutItem: { id, name, cumulative },
  quantity,
})

const BRACELET = () => assoc(1, 'Bracelet')
const TICKET = (q = 1) => assoc(2, 'Ticket boisson', true, q)

// Une personne, réduite à ce que le calcul lit d'elle : sa population, et si elle est entrée.
let numero = 0
const qui = (
  population: Parameters<typeof personneComptee>[0]['population'],
  entreeValidee: boolean,
  associations: Parameters<typeof personneComptee>[1],
  nom = `Personne ${++numero}`
) => personneComptee({ id: ++numero, nom, population, entreeValidee }, associations)

describe('associationsDunBenevole', () => {
  it('remplace les articles globaux dès qu’une équipe en porte un', () => {
    // La surcharge est la règle du code existant, et elle surprend : ailleurs, global et
    // nominatif se cumulent. La reproduire à l'identique est tout l'objet de cette fonction.
    const resultat = associationsDunBenevole({
      globales: [BRACELET()],
      parEquipe: new Map([['cuisine', [TICKET(3)]]]),
      equipes: ['cuisine'],
    })
    expect(resultat).toEqual([TICKET(3)])
  })

  it('retombe sur les articles globaux quand aucune équipe n’en porte', () => {
    const resultat = associationsDunBenevole({
      globales: [BRACELET()],
      parEquipe: new Map([['cuisine', []]]),
      equipes: ['cuisine', 'accueil'],
    })
    expect(resultat).toEqual([BRACELET()])
  })

  it('retombe sur les articles globaux pour un bénévole sans équipe', () => {
    const resultat = associationsDunBenevole({
      globales: [BRACELET()],
      parEquipe: new Map(),
      equipes: [],
    })
    expect(resultat).toEqual([BRACELET()])
  })

  it('réunit les articles de toutes les équipes du bénévole', () => {
    const resultat = associationsDunBenevole({
      globales: [BRACELET()],
      parEquipe: new Map([
        ['cuisine', [TICKET(3)]],
        ['accueil', [assoc(3, 'Badge')]],
      ]),
      equipes: ['cuisine', 'accueil'],
    })
    expect(resultat.map((a) => a.handoutItem.id)).toEqual([2, 3])
  })

  it('ajoute les repas quelle que soit la branche retenue', () => {
    // Un ticket de cantine ne dépend pas de l'équipe : il s'ajoute aux deux branches, sans quoi
    // un bénévole d'équipe le perdrait et un bénévole sans équipe le garderait.
    const avecEquipe = associationsDunBenevole({
      globales: [BRACELET()],
      parEquipe: new Map([['cuisine', [assoc(3, 'Badge')]]]),
      equipes: ['cuisine'],
      repas: [TICKET(1)],
    })
    const sansEquipe = associationsDunBenevole({
      globales: [BRACELET()],
      parEquipe: new Map(),
      equipes: [],
      repas: [TICKET(1)],
    })
    expect(avecEquipe.map((a) => a.handoutItem.id)).toEqual([3, 2])
    expect(sansEquipe.map((a) => a.handoutItem.id)).toEqual([1, 2])
  })
})

describe('associationsDunOrganisateur', () => {
  it('cumule le global, le nominatif et les repas', () => {
    const resultat = associationsDunOrganisateur({
      globales: [BRACELET()],
      nommees: [assoc(3, 'Badge')],
      repas: [TICKET(2)],
    })
    expect(resultat.map((a) => a.handoutItem.id)).toEqual([1, 3, 2])
  })

  it('n’exige que les associations globales', () => {
    expect(associationsDunOrganisateur({ globales: [BRACELET()] })).toEqual([BRACELET()])
  })
})

describe('associationsDunArtiste', () => {
  it('cumule les quatre sources', () => {
    const resultat = associationsDunArtiste({
      globales: [BRACELET()],
      nommees: [assoc(3, 'Badge')],
      spectacles: [TICKET(3), TICKET(3)],
      repas: [assoc(4, 'Repas')],
    })
    expect(resultat.map((a) => a.handoutItem.id)).toEqual([1, 3, 2, 2, 4])
  })
})

describe('personneComptee', () => {
  it('N’ADDITIONNE PAS un article non cumulable venu de deux sources', () => {
    // Le défaut que le guichet a déjà commis : un bracelet attaché au tarif ET à une option
    // apparaissait deux fois. C'est la raison d'être de tout ce module.
    const personne = qui('participants', false, [BRACELET(), BRACELET()])
    expect(personne.articles).toEqual([{ id: 1, name: 'Bracelet', quantity: 1 }])
  })

  it('additionne bien un article cumulable', () => {
    const personne = qui('artistes', false, [TICKET(3), TICKET(3)])
    expect(personne.articles).toEqual([{ id: 2, name: 'Ticket boisson', quantity: 6 }])
  })

  it('reporte l’identité, la population et la validation d’entrée', () => {
    expect(
      personneComptee({ id: 7, nom: 'Alice', population: 'benevoles', entreeValidee: true }, [])
    ).toEqual({
      id: 7,
      nom: 'Alice',
      population: 'benevoles',
      entreeValidee: true,
      articles: [],
    })
  })
})

describe('cumulerParArticle', () => {
  it('somme les personnes, une fois leurs articles agrégés', () => {
    const volumes = cumulerParArticle([
      qui('participants', false, [BRACELET()]),
      qui('participants', false, [BRACELET()]),
      qui('benevoles', false, [BRACELET()]),
    ])
    expect(volumes).toHaveLength(1)
    expect(volumes[0]).toMatchObject({ id: 1, name: 'Bracelet', attendu: 3, sorti: 0, reste: 3 })
  })

  it('compte comme SORTI ce qui revient à une entrée validée', () => {
    // La décision du 21/09/2026 : la validation d'entrée vaut remise.
    const volumes = cumulerParArticle([
      qui('participants', true, [BRACELET()]),
      qui('participants', false, [BRACELET()]),
    ])
    expect(volumes[0]).toMatchObject({ attendu: 2, sorti: 1, reste: 1 })
  })

  it('décompose par population', () => {
    const volumes = cumulerParArticle([
      qui('participants', true, [BRACELET()]),
      qui('benevoles', false, [BRACELET()]),
      qui('artistes', true, [BRACELET()]),
    ])
    expect(volumes[0]?.parPopulation).toEqual({
      participants: { attendu: 1, sorti: 1 },
      benevoles: { attendu: 1, sorti: 0 },
      artistes: { attendu: 1, sorti: 1 },
      organisateurs: { attendu: 0, sorti: 0 },
    })
  })

  it('reporte la quantité de chaque personne, pas un exemplaire par tête', () => {
    const volumes = cumulerParArticle([
      qui('artistes', true, [TICKET(3)]),
      qui('artistes', false, [TICKET(3), TICKET(3)]),
    ])
    expect(volumes[0]).toMatchObject({ attendu: 9, sorti: 3, reste: 6 })
  })

  it('fait apparaître à zéro un article que personne ne reçoit', () => {
    // Un article défini mais associé à rien est presque toujours un paramétrage incomplet : le
    // taire ici le ferait découvrir au comptoir.
    const volumes = cumulerParArticle(
      [qui('participants', false, [BRACELET()])],
      [
        { id: 1, name: 'Bracelet' },
        { id: 9, name: 'Sweat' },
      ]
    )
    expect(volumes.map((v) => v.name)).toEqual(['Bracelet', 'Sweat'])
    expect(volumes.find((v) => v.id === 9)).toMatchObject({ attendu: 0, sorti: 0, reste: 0 })
  })

  it('classe les articles par nom, sans tenir compte de la casse ni des accents', () => {
    const volumes = cumulerParArticle(
      [],
      [
        { id: 1, name: 'Écharpe' },
        { id: 2, name: 'bracelet' },
        { id: 3, name: 'Sweat' },
      ]
    )
    expect(volumes.map((v) => v.name)).toEqual(['bracelet', 'Écharpe', 'Sweat'])
  })

  it('ne rend jamais un reste négatif', () => {
    // Le cas ne devrait pas se produire — « sorti » est un sous-ensemble d'« attendu » — mais un
    // reste négatif à l'écran ferait douter de tout le tableau.
    const volumes = cumulerParArticle([qui('participants', true, [BRACELET()])])
    expect(volumes[0]?.reste).toBe(0)
  })

  it('rend une liste vide quand il n’y a ni personne ni catalogue', () => {
    expect(cumulerParArticle([])).toEqual([])
  })
})

describe('cumulerParArticle — qui n’a pas encore récupéré', () => {
  it('ne nomme que les personnes dont l’entrée n’est pas validée', () => {
    const volumes = cumulerParArticle([
      personneComptee({ id: 1, nom: 'Alice', population: 'participants', entreeValidee: true }, [
        BRACELET(),
      ]),
      personneComptee({ id: 2, nom: 'Bob', population: 'benevoles', entreeValidee: false }, [
        BRACELET(),
      ]),
    ])
    expect(volumes[0]?.enAttente).toEqual([
      { cle: 'benevoles:2', id: 2, nom: 'Bob', population: 'benevoles', quantity: 1 },
    ])
  })

  it('distingue deux personnes de populations différentes portant le même identifiant', () => {
    // Une ligne de commande et un artiste peuvent porter le même entier : sans la clé composite,
    // l'un des deux disparaîtrait du rendu Vue sans la moindre erreur.
    const volumes = cumulerParArticle([
      personneComptee({ id: 5, nom: 'Chloé', population: 'participants', entreeValidee: false }, [
        BRACELET(),
      ]),
      personneComptee({ id: 5, nom: 'David', population: 'artistes', entreeValidee: false }, [
        BRACELET(),
      ]),
    ])
    expect(volumes[0]?.enAttente.map((p) => p.cle)).toEqual(['participants:5', 'artistes:5'])
  })

  it('porte la quantité due à chacun, et leur somme vaut le reste', () => {
    const volumes = cumulerParArticle([
      personneComptee({ id: 1, nom: 'Alice', population: 'artistes', entreeValidee: false }, [
        TICKET(3),
        TICKET(3),
      ]),
      personneComptee({ id: 2, nom: 'Bob', population: 'artistes', entreeValidee: false }, [
        TICKET(2),
      ]),
    ])
    const volume = volumes[0]!
    expect(volume.enAttente.map((p) => p.quantity)).toEqual([6, 2])
    expect(volume.enAttente.reduce((t, p) => t + p.quantity, 0)).toBe(volume.reste)
  })

  it('classe les personnes par nom', () => {
    const volumes = cumulerParArticle([
      personneComptee({ id: 1, nom: 'Zoé', population: 'participants', entreeValidee: false }, [
        BRACELET(),
      ]),
      personneComptee({ id: 2, nom: 'alice', population: 'participants', entreeValidee: false }, [
        BRACELET(),
      ]),
      personneComptee({ id: 3, nom: 'Émile', population: 'participants', entreeValidee: false }, [
        BRACELET(),
      ]),
    ])
    expect(volumes[0]?.enAttente.map((p) => p.nom)).toEqual(['alice', 'Émile', 'Zoé'])
  })

  it('laisse la liste vide quand tout est sorti', () => {
    const volumes = cumulerParArticle([
      personneComptee({ id: 1, nom: 'Alice', population: 'participants', entreeValidee: true }, [
        BRACELET(),
      ]),
    ])
    expect(volumes[0]).toMatchObject({ attendu: 1, sorti: 1, reste: 0, enAttente: [] })
  })
})
