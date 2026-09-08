import { describe, expect, it } from 'vitest'

import {
  calculerBesoinEnBenevoles,
  heuresDesOrganisateurs,
} from '../../../app/utils/besoin-benevoles'

/**
 * Le calcul de dimensionnement, tel qu'il a été arrêté : seules les heures des organisateurs se
 * retranchent des heures à pourvoir. Celles déjà faites par les bénévoles restent dedans, sans
 * quoi un bénévole déjà affecté à une partie de ses heures serait compté deux fois — une fois
 * dans l'effectif accepté, une fois dans le reste à couvrir.
 */
const creneau = (start: string, end: string, benevoles = 0, organisateurs = 0) => ({
  id: `${start}-${end}`,
  start,
  end,
  assignedVolunteersList: Array.from({ length: benevoles }, (_, i) => ({
    user: { id: 100 + i, pseudo: `benevole${i}` },
  })),
  assignedOrganizersList: Array.from({ length: organisateurs }, (_, i) => ({
    user: { id: 200 + i, pseudo: `orga${i}` },
  })),
})

describe('heuresDesOrganisateurs', () => {
  it('compte les heures de chaque organisateur affecté', () => {
    const creneaux = [
      creneau('2026-10-02T10:00:00Z', '2026-10-02T14:00:00Z', 1, 2), // 4h × 2 organisateurs
      creneau('2026-10-03T09:00:00Z', '2026-10-03T12:00:00Z', 2, 1), // 3h × 1 organisateur
    ]

    expect(heuresDesOrganisateurs(creneaux)).toBe(11)
  })

  it('ignore les heures des bénévoles', () => {
    const creneaux = [creneau('2026-10-02T10:00:00Z', '2026-10-02T14:00:00Z', 3, 0)]

    expect(heuresDesOrganisateurs(creneaux)).toBe(0)
  })

  it('rend zéro sans créneau', () => {
    expect(heuresDesOrganisateurs([])).toBe(0)
  })
})

describe('calculerBesoinEnBenevoles', () => {
  it('annonce ce qui manque', () => {
    // 100 h à pourvoir, dont 10 tenues par des organisateurs : 90 h pour les bénévoles, soit
    // 15 bénévoles à 6 h. Il y en a 10 : il en manque 5.
    const resultat = calculerBesoinEnBenevoles({
      heuresAPourvoir: 100,
      heuresDesOrganisateurs: 10,
      heuresParBenevole: 6,
      benevolesAcceptes: 10,
    })

    expect(resultat).toEqual({ besoin: 15, manque: 5, surplus: 0 })
  })

  it('annonce le surplus quand l’effectif dépasse le besoin', () => {
    const resultat = calculerBesoinEnBenevoles({
      heuresAPourvoir: 60,
      heuresDesOrganisateurs: 0,
      heuresParBenevole: 6,
      benevolesAcceptes: 14,
    })

    expect(resultat).toEqual({ besoin: 10, manque: 0, surplus: 4 })
  })

  it('ne retranche pas les heures déjà faites par les bénévoles', () => {
    // Deux éditions identiques, l'une déjà planifiée et l'autre non : le besoin est le même.
    // C'est tout l'enjeu du calcul retenu — les heures des bénévoles n'y entrent jamais.
    const commun = { heuresAPourvoir: 90, heuresDesOrganisateurs: 0, heuresParBenevole: 6 }

    expect(calculerBesoinEnBenevoles({ ...commun, benevolesAcceptes: 5 })?.besoin).toBe(15)
    expect(calculerBesoinEnBenevoles({ ...commun, benevolesAcceptes: 5 })?.manque).toBe(10)
  })

  it('arrondit au bénévole supérieur', () => {
    // 91 h à 6 h par personne font 15,2 bénévoles : il en faut 16, on ne recrute pas un cinquième
    // de bénévole.
    const resultat = calculerBesoinEnBenevoles({
      heuresAPourvoir: 91,
      heuresDesOrganisateurs: 0,
      heuresParBenevole: 6,
      benevolesAcceptes: 0,
    })

    expect(resultat?.besoin).toBe(16)
  })

  it('ne demande personne quand les organisateurs couvrent tout', () => {
    const resultat = calculerBesoinEnBenevoles({
      heuresAPourvoir: 20,
      heuresDesOrganisateurs: 30,
      heuresParBenevole: 6,
      benevolesAcceptes: 2,
    })

    expect(resultat).toEqual({ besoin: 0, manque: 0, surplus: 2 })
  })

  it('reste sans réponse tant que la contribution attendue est inexploitable', () => {
    // Un zéro affiché laisserait croire qu'il ne manque personne, alors que la question n'a pas
    // encore été posée.
    const commun = { heuresAPourvoir: 90, heuresDesOrganisateurs: 0, benevolesAcceptes: 5 }

    expect(calculerBesoinEnBenevoles({ ...commun, heuresParBenevole: 0 })).toBeNull()
    expect(calculerBesoinEnBenevoles({ ...commun, heuresParBenevole: -3 })).toBeNull()
    expect(calculerBesoinEnBenevoles({ ...commun, heuresParBenevole: Number.NaN })).toBeNull()
  })
})
