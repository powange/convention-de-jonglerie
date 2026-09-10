import { describe, expect, it } from 'vitest'

import {
  actionsOnglet,
  compterEmpruntsEnRetard,
  filtrerParEtape,
  grouperEmpruntsParEtat,
  lignesEmprunts,
  lignesOnglet,
  ongletDepuisUrl,
  ongletParDefaut,
  ONGLETS_EMPRUNTS,
  ordonnerEmprunts,
  personnesDEtape,
  valeursDEtape,
} from '../../../../../layers/stock/app/utils/tableau-emprunts'

/**
 * Le tableau de bord répond à « qu'est-ce qui me tombe dessus en premier ? ». L'ordre est donc la
 * réponse, pas une commodité — et il ne peut pas se décider côté base, où l'état d'un emprunt
 * n'est pas une colonne mais un calcul.
 */
const LE_1 = '2026-10-01T10:00:00.000Z'
const LE_5 = '2026-10-05T10:00:00.000Z'
const LE_9 = '2026-10-09T10:00:00.000Z'
const MAINTENANT = new Date('2026-10-06T12:00:00.000Z')

const emprunt = (nom: string, champs: Record<string, unknown> = {}) => ({
  name: nom,
  isExternalLoan: true,
  pickedUpAt: null as string | null,
  returnedAt: null as string | null,
  returnDueAt: null as string | null,
  ...champs,
})

describe('ordonnerEmprunts', () => {
  it("place l'échéance la plus proche en tête", () => {
    const ordonnes = ordonnerEmprunts([
      emprunt('Enceinte', { returnDueAt: LE_9 }),
      emprunt('Câble', { returnDueAt: LE_1 }),
      emprunt('Praticable', { returnDueAt: LE_5 }),
    ])

    expect(ordonnes.map((e) => e.name)).toEqual(['Câble', 'Praticable', 'Enceinte'])
  })

  it('renvoie les emprunts sans échéance en fin de liste', () => {
    // C'est précisément ce que MySQL ferait à l'envers : l'absence de valeur y passe avant tout
    // le reste, et la liste s'ouvrirait sur ce qui n'attend rien.
    const ordonnes = ordonnerEmprunts([
      emprunt('Sans date'),
      emprunt('Câble', { returnDueAt: LE_5 }),
    ])

    expect(ordonnes.map((e) => e.name)).toEqual(['Câble', 'Sans date'])
  })

  it('traite une date illisible comme une absence de date', () => {
    const ordonnes = ordonnerEmprunts([
      emprunt('Cassée', { returnDueAt: 'pas une date' }),
      emprunt('Câble', { returnDueAt: LE_5 }),
    ])

    expect(ordonnes.map((e) => e.name)).toEqual(['Câble', 'Cassée'])
  })

  it('départage par le nom à échéance égale', () => {
    // Sans quoi un rechargement rebat les cartes, et l'on ne retrouve plus la ligne qu'on lisait.
    const ordonnes = ordonnerEmprunts([
      emprunt('Zèbre', { returnDueAt: LE_5 }),
      emprunt('Âne', { returnDueAt: LE_5 }),
    ])

    expect(ordonnes.map((e) => e.name)).toEqual(['Âne', 'Zèbre'])
  })

  it('ne modifie pas la liste reçue', () => {
    const liste = [emprunt('B', { returnDueAt: LE_9 }), emprunt('A', { returnDueAt: LE_1 })]
    ordonnerEmprunts(liste)

    expect(liste.map((e) => e.name)).toEqual(['B', 'A'])
  })
})

describe('grouperEmpruntsParEtat', () => {
  const RETARD = emprunt('En retard', { pickedUpAt: LE_1, returnDueAt: LE_5 })
  const A_RECUPERER = emprunt('À récupérer', { returnDueAt: LE_9 })
  const A_RENDRE = emprunt('À rendre', { pickedUpAt: LE_1, returnDueAt: LE_9 })
  const RENDU = emprunt('Rendu', { pickedUpAt: LE_1, returnedAt: LE_5 })

  it('met le retard en premier', () => {
    // C'est ce qui coûte, et la seule raison d'ouvrir cette page en urgence.
    const groupes = grouperEmpruntsParEtat([A_RENDRE, A_RECUPERER, RETARD], MAINTENANT)

    expect(groupes.map((g) => g.etat)).toEqual(['en_retard', 'a_recuperer', 'a_rendre'])
  })

  it('place le matériel rendu en dernier', () => {
    // Il n'attend plus rien, mais il reste consultable : une fausse manœuvre se corrige.
    const groupes = grouperEmpruntsParEtat([RENDU, RETARD], MAINTENANT)

    expect(groupes.map((g) => g.etat)).toEqual(['en_retard', 'rendu'])
  })

  it('écarte le matériel qui n’est pas emprunté', () => {
    const groupes = grouperEmpruntsParEtat(
      [emprunt('Matériel de la convention', { isExternalLoan: false })],
      MAINTENANT
    )

    expect(groupes).toEqual([])
  })

  it('n’ouvre pas de groupe vide', () => {
    // Un titre suivi de rien donne à croire qu'on a manqué quelque chose.
    const groupes = grouperEmpruntsParEtat([A_RECUPERER], MAINTENANT)

    expect(groupes).toHaveLength(1)
    expect(groupes[0]?.etat).toBe('a_recuperer')
  })

  it('ordonne chaque groupe par urgence', () => {
    const tot = emprunt('Tôt', { pickedUpAt: LE_1, returnDueAt: LE_9 })
    const tard = emprunt('Tard', { pickedUpAt: LE_1, returnDueAt: '2026-12-01T10:00:00.000Z' })
    const groupes = grouperEmpruntsParEtat([tard, tot], MAINTENANT)

    expect(groupes[0]?.emprunts.map((e) => e.name)).toEqual(['Tôt', 'Tard'])
  })

  it('ne compte pas en retard ce qu’on n’est jamais allé chercher', () => {
    // La subtilité de `etatEmprunt`, qui doit survivre au regroupement : un emprunt qui n'a pas
    // commencé ne peut pas être en retard, même échéance dépassée.
    const jamaisRecupere = emprunt('Jamais récupéré', { returnDueAt: LE_1 })
    const groupes = grouperEmpruntsParEtat([jamaisRecupere], MAINTENANT)

    expect(groupes[0]?.etat).toBe('a_recuperer')
  })
})

describe('compterEmpruntsEnRetard', () => {
  it('ne compte que le retard', () => {
    // C'est le nombre que porte la pastille. Compter aussi ce qui est à récupérer l'allumerait
    // dès le premier emprunt convenu, et elle cesserait de vouloir dire quelque chose.
    const compte = compterEmpruntsEnRetard(
      [
        emprunt('Retard', { pickedUpAt: LE_1, returnDueAt: LE_5 }),
        emprunt('À récupérer', { returnDueAt: LE_1 }),
        emprunt('À rendre', { pickedUpAt: LE_1, returnDueAt: LE_9 }),
        emprunt('Rendu', { pickedUpAt: LE_1, returnedAt: LE_5 }),
      ],
      MAINTENANT
    )

    expect(compte).toBe(1)
  })

  it('rend zéro quand rien ne traîne', () => {
    expect(compterEmpruntsEnRetard([], MAINTENANT)).toBe(0)
  })
})

describe('lignesEmprunts', () => {
  const RETARD = emprunt('En retard', { pickedUpAt: LE_1, returnDueAt: LE_5 })
  const A_RECUPERER = emprunt('À récupérer', { returnDueAt: LE_9 })
  const A_RENDRE = emprunt('À rendre', { pickedUpAt: LE_1, returnDueAt: LE_9 })

  it('aplatit en gardant l’ordre de priorité', () => {
    // Un tableau se lit d'un bloc : trois tableaux séparés interdiraient de trier sur une
    // colonne, qui est justement ce qu'on vient y faire.
    const lignes = lignesEmprunts([A_RENDRE, A_RECUPERER, RETARD], MAINTENANT)

    expect(lignes.map((l) => l.name)).toEqual(['En retard', 'À récupérer', 'À rendre'])
  })

  it('porte l’état sur chaque ligne', () => {
    const lignes = lignesEmprunts([RETARD, A_RENDRE], MAINTENANT)

    expect(lignes.map((l) => l.etatTableau)).toEqual(['en_retard', 'a_rendre'])
  })

  it('inclut le matériel rendu, en queue', () => {
    const rendu = emprunt('Rendu', { pickedUpAt: LE_1, returnedAt: LE_5 })
    const lignes = lignesEmprunts([rendu, RETARD], MAINTENANT)

    expect(lignes.map((l) => l.etatTableau)).toEqual(['en_retard', 'rendu'])
  })
})

describe('lignesOnglet', () => {
  const RETARD = emprunt('En retard', { pickedUpAt: LE_1, returnDueAt: LE_5 })
  const A_RECUPERER = emprunt('À récupérer', { returnDueAt: LE_9 })
  const A_RENDRE = emprunt('À rendre', { pickedUpAt: LE_1, returnDueAt: LE_9 })

  const TOUS = [A_RENDRE, A_RECUPERER, RETARD]

  it('range le retard avec ce qui est à rendre', () => {
    // « En retard » n'est pas un troisième moment : c'est un « à rendre » dont l'échéance est
    // passée. Les séparer obligerait à regarder à deux endroits pour savoir ce qu'on doit
    // rapporter.
    const lignes = lignesOnglet(TOUS, 'a_rendre', MAINTENANT)

    expect(lignes.map((l) => l.name)).toEqual(['En retard', 'À rendre'])
  })

  it('ne met dans « à récupérer » que ce qu’on n’est pas allé chercher', () => {
    const lignes = lignesOnglet(TOUS, 'a_recuperer', MAINTENANT)

    expect(lignes.map((l) => l.name)).toEqual(['À récupérer'])
  })

  it('garde la priorité à l’intérieur d’un onglet', () => {
    // Le retard passe devant, puis l'échéance la plus proche.
    const lignes = lignesOnglet(TOUS, 'a_rendre', MAINTENANT)

    expect(lignes[0]?.etatTableau).toBe('en_retard')
  })

  it('n’expose le matériel rendu que dans son propre onglet', () => {
    const rendu = emprunt('Rendu', { pickedUpAt: LE_1, returnedAt: LE_5 })

    expect(lignesOnglet([rendu], 'a_rendre', MAINTENANT)).toEqual([])
    expect(lignesOnglet([rendu], 'a_recuperer', MAINTENANT)).toEqual([])
    expect(lignesOnglet([rendu], 'rendu', MAINTENANT).map((l) => l.name)).toEqual(['Rendu'])
  })
})

describe('ongletParDefaut', () => {
  it('ouvre sur les retours quand il y a du retard', () => {
    // La seule chose qui justifie d'ouvrir cette page en urgence doit se voir sans qu'on cherche.
    const enRetard = emprunt('Retard', { pickedUpAt: LE_1, returnDueAt: LE_5 })

    expect(ongletParDefaut([enRetard], MAINTENANT)).toBe('a_rendre')
  })

  it('ouvre sur les récupérations à défaut', () => {
    // Sans quoi rien ne commence.
    const aRecuperer = emprunt('À récupérer', { returnDueAt: LE_9 })

    expect(ongletParDefaut([aRecuperer], MAINTENANT)).toBe('a_recuperer')
  })

  it('ouvre sur les récupérations quand il n’y a rien du tout', () => {
    expect(ongletParDefaut([], MAINTENANT)).toBe('a_recuperer')
  })
})

/**
 * Un onglet ne propose que les gestes de son moment. C'est ce qui empêche de marquer rendu du
 * matériel qu'on n'est jamais allé chercher — et ce qui rend chaque bouton lisible sans qu'on ait
 * à réfléchir à ce qu'il va faire.
 */
describe('actionsOnglet', () => {
  it('ne propose que la récupération depuis « à récupérer »', () => {
    const actions = actionsOnglet('a_recuperer')

    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ champ: 'pickedUpAt', pose: true })
  })

  it('propose le retour et l’annulation de la récupération depuis « à rendre »', () => {
    // Le geste inverse doit être là : une case se coche de travers, et sans lui il faudrait
    // rouvrir chaque fiche pour défaire une manipulation faite en lot.
    const actions = actionsOnglet('a_rendre')

    expect(actions.map((a) => `${a.champ}:${a.pose}`)).toEqual([
      'returnedAt:true',
      'pickedUpAt:false',
    ])
  })

  it('ne propose que l’annulation du retour depuis « rendu »', () => {
    const actions = actionsOnglet('rendu')

    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ champ: 'returnedAt', pose: false })
  })

  it('désigne une seule action principale par onglet', () => {
    // Deux boutons de même poids ne diraient pas lequel est le geste courant.
    for (const onglet of ONGLETS_EMPRUNTS) {
      expect(actionsOnglet(onglet).filter((a) => a.principale)).toHaveLength(1)
    }
  })

  it('n’efface jamais la récupération depuis « rendu »', () => {
    // Ce serait rendre un matériel jamais récupéré : l'état interdit par `erreurOrdreEmprunt`.
    expect(actionsOnglet('rendu').some((a) => a.champ === 'pickedUpAt')).toBe(false)
  })
})

/**
 * Une liste fermée et non une recherche par mot-clé : lieux et personnes sont saisis à la main, et
 * l'on ne retrouve pas « chez Marie » en tapant « marie ». Proposer ce qui existe évite d'avoir à
 * deviner l'orthographe de quelqu'un d'autre.
 */
describe('valeursDEtape', () => {
  it('rend les lieux de l’étape en cours, sans doublon et triés', () => {
    const lieux = valeursDEtape(
      [
        emprunt('A', { pickupLocation: 'Zénith' }),
        emprunt('B', { pickupLocation: 'Chez Marie' }),
        emprunt('C', { pickupLocation: 'Zénith' }),
      ],
      'lieu'
    )

    expect(lieux).toEqual(['Chez Marie', 'Zénith'])
  })

  it('mêle comptes et texte libre dans la liste des personnes', () => {
    // Pour qui organise une tournée, Marie inscrite sur le site et « Marc, le voisin » sont deux
    // personnes, pas deux natures de données.
    const personnes = valeursDEtape(
      [
        emprunt('A', { pickupResponsible: { pseudo: 'marie' } }),
        emprunt('B', { pickupContact: 'Marc, le voisin' }),
      ],
      'qui'
    )

    // Triés comme le lecteur les lira : « Marc » précède « marie » en collation française.
    expect(personnes).toEqual(['Marc, le voisin', 'marie'])
  })

  it('suit l’étape : le lieu de retour une fois le matériel récupéré', () => {
    // La liste change donc d'un onglet à l'autre — proposer un lieu de retour dans l'onglet des
    // récupérations ne rendrait rien.
    const recupere = emprunt('A', {
      pickedUpAt: LE_1,
      pickupLocation: 'Chez Marie',
      returnLocation: 'Local',
    })

    expect(valeursDEtape([recupere], 'lieu')).toEqual(['Local'])
  })

  it('ignore les valeurs vides', () => {
    expect(valeursDEtape([emprunt('A'), emprunt('B', { pickupLocation: '   ' })], 'lieu')).toEqual(
      []
    )
  })
})

describe('filtrerParEtape', () => {
  const A = emprunt('A', { pickupLocation: 'Zénith', pickupContact: 'Marc' })
  const B = emprunt('B', { pickupLocation: 'Chez Marie', pickupContact: 'Julie' })

  it('ne garde que le lieu choisi', () => {
    expect(filtrerParEtape([A, B], 'lieu', 'Zénith').map((e) => e.name)).toEqual(['A'])
  })

  it('ne garde que la personne choisie', () => {
    expect(filtrerParEtape([A, B], 'qui', 'Julie').map((e) => e.name)).toEqual(['B'])
  })

  it('ne filtre rien sans valeur choisie', () => {
    // Un filtre vide ne doit pas vider l'écran.
    expect(filtrerParEtape([A, B], 'lieu', null)).toHaveLength(2)
    expect(filtrerParEtape([A, B], 'qui', '')).toHaveLength(2)
  })
})

describe('ongletDepuisUrl', () => {
  it('reconnaît un onglet valable', () => {
    expect(ongletDepuisUrl('a_rendre')).toBe('a_rendre')
    expect(ongletDepuisUrl('rendu')).toBe('rendu')
  })

  it('écarte ce qui ne désigne aucun onglet', () => {
    // Lien d'une version antérieure, adresse tapée à la main : mieux vaut retomber sur l'onglet
    // par défaut qu'afficher un tableau vide sans expliquer pourquoi.
    expect(ongletDepuisUrl('inconnu')).toBeNull()
    expect(ongletDepuisUrl('')).toBeNull()
    expect(ongletDepuisUrl(undefined)).toBeNull()
    expect(ongletDepuisUrl(['a_rendre'])).toBeNull()
  })
})

/**
 * Le filtre ne travaille que sur le nom, mais l'écran a besoin de savoir si la personne est
 * inscrite pour afficher son visage plutôt qu'une icône générique.
 */
describe('personnesDEtape', () => {
  const MARIE = { id: 3, pseudo: 'marie', profilePicture: 'marie.jpg' }

  it('distingue un compte d’un nom écrit à la main', () => {
    const personnes = personnesDEtape([
      emprunt('A', { pickupResponsible: MARIE }),
      emprunt('B', { pickupContact: 'Marc, le voisin' }),
    ])

    expect(personnes).toEqual([
      { valeur: 'Marc, le voisin', compte: null },
      { valeur: 'marie', compte: MARIE },
    ])
  })

  it('ne rend qu’une entrée par personne', () => {
    const personnes = personnesDEtape([
      emprunt('A', { pickupResponsible: MARIE }),
      emprunt('B', { pickupResponsible: MARIE }),
    ])

    expect(personnes).toHaveLength(1)
  })

  it('préfère le compte en cas d’homonymie', () => {
    // C'est la donnée la plus sûre des deux, et la seule qui porte un visage.
    const personnes = personnesDEtape([
      emprunt('A', { pickupContact: 'marie' }),
      emprunt('B', { pickupResponsible: MARIE }),
    ])

    expect(personnes).toEqual([{ valeur: 'marie', compte: MARIE }])
  })

  it('ignore les emprunts sans personne désignée', () => {
    expect(personnesDEtape([emprunt('A', { pickupLocation: 'Zénith' })])).toEqual([])
  })
})
