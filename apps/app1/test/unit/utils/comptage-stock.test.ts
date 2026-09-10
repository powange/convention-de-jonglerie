import { describe, expect, it } from 'vitest'

import {
  comptagesAEnvoyer,
  compteRetenu,
  ecartComptage,
  nombreEnAttente,
  resumeComptage,
} from '../../../../../layers/stock/app/utils/comptage-stock'

/**
 * La distinction la plus facile à perdre, et la plus coûteuse : « pas encore compté » n'est pas
 * « compté à zéro ». Une caisse oubliée qui passerait pour une caisse vide, c'est du matériel
 * qu'on croit perdu et qu'on rachète.
 */
const ligne = (champs: Partial<Parameters<typeof ecartComptage>[0]> = {}) => ({
  id: 1,
  quantity: 10,
  finalQuantity: null as number | null,
  ...champs,
})

describe('compteRetenu', () => {
  it('retient la saisie du jour quand il y en a une', () => {
    expect(compteRetenu(ligne({ finalQuantity: 8, saisie: 6 }))).toBe(6)
  })

  it('retient l’enregistré quand la ligne n’a pas été touchée', () => {
    expect(compteRetenu(ligne({ finalQuantity: 8 }))).toBe(8)
  })

  it('rend null quand rien n’a jamais été compté', () => {
    // Et non zéro : « personne n'y a encore regardé » n'est pas « la caisse est vide ».
    expect(compteRetenu(ligne())).toBeNull()
  })

  it('distingue une case vidée d’une ligne non touchée', () => {
    // Vider la case est le geste qui efface un comptage enregistré par erreur.
    expect(compteRetenu(ligne({ finalQuantity: 8, saisie: null }))).toBeNull()
    expect(compteRetenu(ligne({ finalQuantity: 8 }))).toBe(8)
  })
})

describe('ecartComptage', () => {
  it('compte ce qui manque en négatif', () => {
    expect(ecartComptage(ligne({ quantity: 12, saisie: 10 }))).toBe(-2)
  })

  it('compte le surplus en positif', () => {
    // On retrouve parfois plus que prévu : un objet rangé dans la mauvaise caisse.
    expect(ecartComptage(ligne({ quantity: 2, saisie: 5 }))).toBe(3)
  })

  it('rend zéro quand le compte tombe juste', () => {
    expect(ecartComptage(ligne({ quantity: 4, saisie: 4 }))).toBe(0)
  })

  it('rend null tant que la ligne n’est pas comptée', () => {
    // L'écran n'affiche alors rien, plutôt qu'un zéro qui ferait croire à un compte exact.
    expect(ecartComptage(ligne())).toBeNull()
  })

  it('distingue un compte à zéro d’une absence de compte', () => {
    expect(ecartComptage(ligne({ quantity: 3, saisie: 0 }))).toBe(-3)
    expect(ecartComptage(ligne({ quantity: 3 }))).toBeNull()
  })
})

describe('resumeComptage', () => {
  it('compte l’avancement', () => {
    const resume = resumeComptage([
      ligne({ id: 1, saisie: 10 }),
      ligne({ id: 2, finalQuantity: 4 }),
      ligne({ id: 3 }),
    ])

    expect(resume.comptes).toBe(2)
    expect(resume.total).toBe(3)
  })

  it('ne compense pas les manquants par le surplus', () => {
    // Deux enceintes perdues et trois praticables en trop ne font pas « +1 » : ce sont deux
    // nouvelles différentes, l'une inquiétante et l'autre curieuse.
    const resume = resumeComptage([
      ligne({ id: 1, quantity: 10, saisie: 8 }),
      ligne({ id: 2, quantity: 2, saisie: 5 }),
    ])

    expect(resume.manquants).toBe(2)
    expect(resume.surplus).toBe(3)
  })

  it('ignore ce qui n’est pas compté', () => {
    const resume = resumeComptage([ligne({ id: 1 }), ligne({ id: 2 })])

    expect(resume).toEqual({ comptes: 0, total: 2, manquants: 0, surplus: 0 })
  })

  it('tient compte de la saisie du jour plutôt que de l’enregistré', () => {
    const resume = resumeComptage([ligne({ quantity: 10, finalQuantity: 10, saisie: 7 })])

    expect(resume.manquants).toBe(3)
  })
})

describe('comptagesAEnvoyer', () => {
  it('ne retient que les lignes touchées', () => {
    const aEnvoyer = comptagesAEnvoyer([
      ligne({ id: 1, saisie: 8 }),
      ligne({ id: 2, finalQuantity: 4 }),
    ])

    expect(aEnvoyer).toEqual([{ id: 1, finalQuantity: 8 }])
  })

  it('écarte une saisie identique à ce qui est déjà écrit', () => {
    // Réécrire trente valeurs identiques ferait passer une relecture pour un comptage, et
    // gonflerait la transaction sans raison.
    expect(comptagesAEnvoyer([ligne({ finalQuantity: 6, saisie: 6 })])).toEqual([])
  })

  it('fait voyager l’effacement', () => {
    // C'est ainsi qu'on défait un comptage enregistré par erreur : l'absence de valeur doit
    // atteindre le serveur, pas rester à l'écran.
    expect(comptagesAEnvoyer([ligne({ finalQuantity: 6, saisie: null })])).toEqual([
      { id: 1, finalQuantity: null },
    ])
  })

  it('n’envoie pas un effacement sur une ligne jamais comptée', () => {
    // Vider une case déjà vide ne change rien.
    expect(comptagesAEnvoyer([ligne({ finalQuantity: null, saisie: null })])).toEqual([])
  })

  it('accepte un comptage à zéro', () => {
    // Zéro est une nouvelle, pas une absence : tout a disparu, et il faut pouvoir l'écrire.
    expect(comptagesAEnvoyer([ligne({ finalQuantity: null, saisie: 0 })])).toEqual([
      { id: 1, finalQuantity: 0 },
    ])
  })
})

describe('nombreEnAttente', () => {
  it('annonce ce qui reste à enregistrer', () => {
    const lignes = [
      ligne({ id: 1, saisie: 8 }),
      ligne({ id: 2, finalQuantity: 3, saisie: 3 }),
      ligne({ id: 3, saisie: 0 }),
    ]

    expect(nombreEnAttente(lignes)).toBe(2)
  })

  it('rend zéro quand rien n’a bougé', () => {
    expect(nombreEnAttente([ligne({ finalQuantity: 5 })])).toBe(0)
  })
})
