import { describe, expect, it } from 'vitest'

import {
  etatEmprunt,
  etatsDepuisUrl,
  filtrerParEtatEmprunt,
  prochaineEtapeEmprunt,
  urlDepuisEtats,
} from '../../../../../layers/stock/app/utils/etat-emprunt'

/**
 * Un emprunt se lit en trois temps : à récupérer, à rendre, rendu. La subtilité qui se perdrait
 * si chaque écran réécrivait la règle : le retard ne concerne que la période où le matériel est
 * chez nous — un prêt qu'on n'est pas allé chercher n'a pas commencé.
 */
const LE_2 = '2026-10-02T10:00:00.000Z'
const LE_5 = '2026-10-05T18:00:00.000Z'
const LE_10 = new Date('2026-10-10T12:00:00.000Z')

describe('etatEmprunt', () => {
  it("ne dit rien d'un matériel qui n'est pas emprunté", () => {
    // Inventer un « rendu » par défaut mentirait sur du matériel de la convention.
    expect(etatEmprunt({ isExternalLoan: false })).toBeNull()
    expect(etatEmprunt({})).toBeNull()
  })

  it('annonce « à récupérer » tant qu’on n’est pas allé le chercher', () => {
    const etat = etatEmprunt({ isExternalLoan: true, returnDueAt: LE_5 }, LE_10)

    expect(etat?.cle).toBe('a_recuperer')
    expect(etat?.couleur).toBe('neutral')
  })

  it('ne déclare pas en retard un emprunt jamais récupéré', () => {
    // La date de retour est dépassée, mais le prêt n'a pas commencé.
    expect(etatEmprunt({ isExternalLoan: true, returnDueAt: LE_2 }, LE_10)?.cle).toBe('a_recuperer')
  })

  it('annonce « à rendre » une fois récupéré, avant l’échéance', () => {
    const etat = etatEmprunt(
      { isExternalLoan: true, pickedUpAt: LE_2, returnDueAt: '2026-10-20T00:00:00.000Z' },
      LE_10
    )

    expect(etat?.cle).toBe('a_rendre')
    expect(etat?.couleur).toBe('warning')
  })

  it('annonce le retard quand l’échéance est passée', () => {
    const etat = etatEmprunt({ isExternalLoan: true, pickedUpAt: LE_2, returnDueAt: LE_5 }, LE_10)

    expect(etat?.cle).toBe('en_retard')
    expect(etat?.couleur).toBe('error')
  })

  it('reste « à rendre » sans échéance connue', () => {
    expect(etatEmprunt({ isExternalLoan: true, pickedUpAt: LE_2 }, LE_10)?.cle).toBe('a_rendre')
  })

  it('annonce « rendu », échéance dépassée ou non', () => {
    const rendu = { isExternalLoan: true, pickedUpAt: LE_2, returnedAt: LE_5, returnDueAt: LE_2 }

    expect(etatEmprunt(rendu, LE_10)?.cle).toBe('rendu')
    expect(etatEmprunt(rendu, LE_10)?.couleur).toBe('success')
  })
})

/**
 * Ce que l'emprunt attend de nous, dit là où on le lit. Seule l'étape du moment : rappeler où
 * récupérer un matériel déjà chez nous encombrerait la liste sans rien apprendre.
 */
describe('prochaineEtapeEmprunt', () => {
  const THOMAS = { id: 4, pseudo: 'thomas', profilePicture: 'thomas.jpg', emailHash: 'abc' }
  const EMPRUNT = {
    isExternalLoan: true,
    pickupLocation: 'Chez Marie, 12 rue des Lilas',
    pickupResponsible: THOMAS,
    returnLocation: 'Local de l’association',
    returnContact: 'Julie — 06 12 34 56 78',
  }

  it('indique la récupération tant qu’on n’y est pas allé', () => {
    expect(prochaineEtapeEmprunt(EMPRUNT)).toEqual({
      lieu: 'Chez Marie, 12 rue des Lilas',
      qui: 'thomas',
      compte: THOMAS,
    })
  })

  it('bascule sur le retour une fois le matériel récupéré', () => {
    // Le retour n'est confié à personne d'inscrit : pas de compte, donc pas d'avatar à afficher.
    expect(prochaineEtapeEmprunt({ ...EMPRUNT, pickedUpAt: LE_2 })).toEqual({
      lieu: 'Local de l’association',
      qui: 'Julie — 06 12 34 56 78',
      compte: null,
    })
  })

  it('retient le compte plutôt que le texte libre, comme à la saisie', () => {
    const etape = prochaineEtapeEmprunt({
      ...EMPRUNT,
      pickupContact: 'quelqu’un d’autre',
    })

    expect(etape?.qui).toBe('thomas')
    expect(etape?.compte).toEqual(THOMAS)
  })

  it('sépare le compte du texte libre, pour que l’écran sache lequel il tient', () => {
    // On ne met pas d'avatar devant « Marc, le voisin » : la liste doit pouvoir distinguer une
    // personne inscrite d'un nom écrit à la main.
    const libre = prochaineEtapeEmprunt({
      isExternalLoan: true,
      pickupContact: 'Marc, le voisin',
    })

    expect(libre?.qui).toBe('Marc, le voisin')
    expect(libre?.compte).toBeNull()
  })

  it('ignore un compte sans pseudo', () => {
    // Un responsable supprimé peut laisser une relation vidée : afficher un avatar sans nom
    // donnerait une ligne muette.
    const etape = prochaineEtapeEmprunt({
      isExternalLoan: true,
      pickupResponsible: { pseudo: '' },
      pickupContact: 'Marc',
    })

    expect(etape?.qui).toBe('Marc')
    expect(etape?.compte).toBeNull()
  })

  it('ne dit plus rien une fois le matériel rendu', () => {
    expect(prochaineEtapeEmprunt({ ...EMPRUNT, pickedUpAt: LE_2, returnedAt: LE_5 })).toBeNull()
  })

  it('ne dit rien du matériel de la convention', () => {
    expect(prochaineEtapeEmprunt({ isExternalLoan: false, pickupLocation: 'X' })).toBeNull()
  })

  it('ne rend pas une étape vide faute d’indications', () => {
    // Sans lieu ni responsable, l'écran afficherait une ligne vide sous l'étiquette.
    expect(prochaineEtapeEmprunt({ isExternalLoan: true })).toBeNull()
  })

  it('se contente du lieu quand personne n’est désigné', () => {
    expect(prochaineEtapeEmprunt({ isExternalLoan: true, pickupLocation: 'Gymnase' })).toEqual({
      lieu: 'Gymnase',
      qui: null,
      compte: null,
    })
  })
})

/**
 * Le filtre par état : « que reste-t-il à aller chercher ? » est la question qu'on se pose la
 * veille du montage, et elle ne se répond pas en ouvrant chaque fiche.
 */
describe('filtrerParEtatEmprunt', () => {
  const STOCK = [
    { nom: 'Sono', isExternalLoan: true },
    { nom: 'Chapiteau', isExternalLoan: true, pickedUpAt: LE_2 },
    { nom: 'Praticable', isExternalLoan: true, pickedUpAt: LE_2, returnDueAt: LE_5 },
    { nom: 'Massues', isExternalLoan: true, pickedUpAt: LE_2, returnedAt: LE_5 },
    { nom: 'Rallonge', isExternalLoan: false },
  ]

  it('rend tout sans état choisi', () => {
    expect(filtrerParEtatEmprunt(STOCK, [], LE_10)).toHaveLength(5)
  })

  it('isole ce qu’il reste à aller chercher', () => {
    expect(filtrerParEtatEmprunt(STOCK, ['a_recuperer'], LE_10).map((o) => o.nom)).toEqual(['Sono'])
  })

  it('cumule les états choisis', () => {
    const noms = filtrerParEtatEmprunt(STOCK, ['a_rendre', 'en_retard'], LE_10).map((o) => o.nom)

    expect(noms).toEqual(['Chapiteau', 'Praticable'])
  })

  it('sait isoler le matériel de la convention', () => {
    // Sans la clé « aucun », le filtre ne saurait pas désigner ce qui n'est pas prêté.
    expect(filtrerParEtatEmprunt(STOCK, ['aucun'], LE_10).map((o) => o.nom)).toEqual(['Rallonge'])
  })
})

describe('etatsDepuisUrl', () => {
  it('lit les états séparés par des virgules', () => {
    expect(etatsDepuisUrl('a_recuperer,rendu')).toEqual(['a_recuperer', 'rendu'])
  })

  it('écarte une valeur inconnue plutôt que de vider l’écran', () => {
    // Un lien d'une version antérieure ne doit pas filtrer sur un état qui n'existe plus.
    expect(etatsDepuisUrl('a_recuperer,n_importe_quoi')).toEqual(['a_recuperer'])
  })

  it('tolère l’absence et les doublons', () => {
    expect(etatsDepuisUrl(undefined)).toEqual([])
    expect(etatsDepuisUrl('rendu, rendu ')).toEqual(['rendu'])
  })

  it('fait l’aller-retour sans rien perdre', () => {
    expect(etatsDepuisUrl(urlDepuisEtats(['a_rendre', 'en_retard']))).toEqual([
      'a_rendre',
      'en_retard',
    ])
    expect(urlDepuisEtats([])).toBeUndefined()
  })
})
