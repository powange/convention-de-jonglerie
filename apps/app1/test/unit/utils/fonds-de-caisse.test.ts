import { describe, expect, it } from 'vitest'

import {
  etatDuFondsDeCaisse,
  type ApportDeFondsDeCaisse,
} from '../../../shared/utils/fonds-de-caisse'

const apport = (p: Partial<ApportDeFondsDeCaisse> & { id: number; amount: number }) => ({
  lentById: null,
  lentByName: null,
  restitutedAt: null,
  ...p,
})

describe('etatDuFondsDeCaisse', () => {
  it('rend un état vide sans apport', () => {
    const etat = etatDuFondsDeCaisse([], null)

    expect(etat).toEqual({
      totalApporte: 0,
      totalRestitue: 0,
      resteARestituer: 0,
      compte: null,
      disponibleApresRestitutions: null,
      preteurs: [],
    })
  })

  it('somme les apports et distingue ce qui est restitué', () => {
    const etat = etatDuFondsDeCaisse(
      [
        apport({ id: 1, amount: 30000, lentById: 7 }),
        apport({ id: 2, amount: 20000, lentById: 9, restitutedAt: new Date('2026-06-16') }),
      ],
      null
    )

    expect(etat.totalApporte).toBe(50000)
    expect(etat.totalRestitue).toBe(20000)
    expect(etat.resteARestituer).toBe(30000)
  })

  /*
   * ⚠️ LE CAS QUI DISCRIMINE, et le piège que la fonction existe pour éviter.
   *
   * Deux prêts de 300 et 200, l'un déjà rendu avant le comptage. La caisse contient 1 130 €.
   * La soustraction naïve `compté − apporté` donnerait 1 130 − 500 = 630 € — elle compte les
   * 300 € rendus comme s'ils étaient encore là. La bonne quantité est `compté − reste à
   * restituer` : 1 130 − 300 = 830 €, ce que la caisse contient au-delà de ce qu'on doit.
   */
  it('mesure le disponible sur le RESTE à restituer, pas sur le total apporté', () => {
    const etat = etatDuFondsDeCaisse(
      [
        apport({ id: 1, amount: 30000, lentById: 7, restitutedAt: new Date('2026-06-16') }),
        apport({ id: 2, amount: 20000, lentById: 9 }),
      ],
      113000
    )

    expect(etat.resteARestituer).toBe(20000)
    expect(etat.disponibleApresRestitutions).toBe(93000)
    // Ce que la formule naïve aurait rendu, et qu'on ne doit PAS lire ici.
    expect(etat.disponibleApresRestitutions).not.toBe(113000 - etat.totalApporte)
  })

  // Une caisse qui ne couvre plus les prêts est une alerte : le chiffre doit pouvoir être négatif.
  it('rend un disponible négatif quand la caisse ne couvre plus les prêts', () => {
    const etat = etatDuFondsDeCaisse([apport({ id: 1, amount: 50000, lentById: 7 })], 12000)

    expect(etat.disponibleApresRestitutions).toBe(-38000)
  })

  it('laisse le disponible à null tant que rien n’est compté', () => {
    const etat = etatDuFondsDeCaisse([apport({ id: 1, amount: 50000, lentById: 7 })], null)

    expect(etat.compte).toBeNull()
    expect(etat.disponibleApresRestitutions).toBeNull()
  })

  // Un comptage à ZÉRO est une valeur : la caisse a été vidée, et c'est une information.
  it('traite un comptage à zéro comme un comptage, pas comme une absence', () => {
    const etat = etatDuFondsDeCaisse([apport({ id: 1, amount: 50000, lentById: 7 })], 0)

    expect(etat.compte).toBe(0)
    expect(etat.disponibleApresRestitutions).toBe(-50000)
  })

  describe('regroupement par prêteur', () => {
    it('réunit les apports d’un même compte', () => {
      const etat = etatDuFondsDeCaisse(
        [
          apport({ id: 1, amount: 10000, lentById: 7 }),
          apport({ id: 2, amount: 5000, lentById: 7 }),
        ],
        null
      )

      expect(etat.preteurs).toHaveLength(1)
      expect(etat.preteurs[0]).toMatchObject({ cle: 'u:7', total: 15000, apportIds: [1, 2] })
    })

    /*
     * La même règle que les avances, et par les mêmes fonctions : « Jean-Luc » et « jean-luc  »
     * sont une seule dette. Sans ce regroupement, le panneau afficherait deux lignes pour la même
     * personne et une restitution n'en solderait qu'une.
     */
    it('réunit deux écritures du même nom libre, casse et espaces mis à part', () => {
      const etat = etatDuFondsDeCaisse(
        [
          apport({ id: 1, amount: 10000, lentByName: 'Jean-Luc' }),
          apport({ id: 2, amount: 5000, lentByName: 'jean-luc  ' }),
        ],
        null
      )

      expect(etat.preteurs).toHaveLength(1)
      expect(etat.preteurs[0]!.total).toBe(15000)
      // Le nom AFFICHÉ est celui qui a été tapé, pas la clé normalisée.
      expect(etat.preteurs[0]!.nomLibre).toBe('Jean-Luc')
    })

    it('ne confond pas un compte et un nom libre', () => {
      const etat = etatDuFondsDeCaisse(
        [
          apport({ id: 1, amount: 10000, lentById: 7 }),
          apport({ id: 2, amount: 5000, lentByName: 'Jean-Luc' }),
        ],
        null
      )

      expect(etat.preteurs.map((p) => p.cle).sort()).toEqual(['n:jean-luc', 'u:7'])
    })

    /*
     * Deux apports sans prêteur identifié ne sont PAS fusionnés : rien ne dit qu'il s'agit de la
     * même personne, et les réunir inventerait une dette envers quelqu'un qu'on ne sait pas nommer.
     */
    it('ne fusionne pas les apports sans prêteur identifié', () => {
      const etat = etatDuFondsDeCaisse(
        [apport({ id: 1, amount: 10000 }), apport({ id: 2, amount: 5000 })],
        null
      )

      expect(etat.preteurs).toHaveLength(2)
      expect(etat.totalApporte).toBe(15000)
    })

    it('range les prêteurs du plus gros reste à restituer au plus petit', () => {
      const etat = etatDuFondsDeCaisse(
        [
          apport({ id: 1, amount: 10000, lentById: 7 }),
          apport({ id: 2, amount: 50000, lentById: 8 }),
          apport({ id: 3, amount: 30000, lentById: 9, restitutedAt: new Date('2026-06-16') }),
        ],
        null
      )

      // 8 doit 50 000, 7 doit 10 000, 9 ne doit plus rien mais a prêté le plus après 8.
      expect(etat.preteurs.map((p) => p.cle)).toEqual(['u:8', 'u:7', 'u:9'])
    })
  })
})
