import { describe, expect, it } from 'vitest'

import {
  fenetreDeLArtiste,
  fenetreDeLOrganisateur,
  fenetreDuBenevole,
  fenetreDuBillet,
  type PeriodesEdition,
} from '../../../server/utils/affluence-fenetres'

/**
 * Les fenêtres de présence, et surtout leurs REPLIS.
 *
 * Aucune des quatre populations ne déclare sa présence de la même façon, et trois des quatre sources
 * sont largement vides : les fenêtres de tarif sont neuves (0 sur 72), celles des organisateurs
 * aussi, et 54 artistes sur 89 n'ont pas de dates. Au jour de la mise en ligne, c'est donc par les
 * replis que le graphique dira quelque chose — ils comptent autant que les données.
 *
 * Chaque repli est un choix de l'utilisateur. Ces tests les fixent pour qu'on ne les change pas par
 * accident au détour d'un remaniement.
 */

const H = 3_600_000
const JOUR = 24 * H

/** Montage le jeudi, événement vendredi → dimanche, démontage jusqu'au lundi. */
const periodes: PeriodesEdition = {
  montage: Date.UTC(2026, 6, 9),
  debut: Date.UTC(2026, 6, 10),
  fin: Date.UTC(2026, 6, 12, 23, 59, 59),
  demontage: Date.UTC(2026, 6, 13, 23, 59, 59),
}

const FUSEAU = 'Europe/Paris'

describe('fenetreDuBillet', () => {
  it('retient les dates du tarif quand elles sont renseignées', () => {
    const tarif = {
      presenceFrom: new Date(Date.UTC(2026, 6, 10, 12)),
      presenceUntil: new Date(Date.UTC(2026, 6, 11, 18)),
    }

    expect(fenetreDuBillet(tarif, periodes)).toEqual({
      arrivee: Date.UTC(2026, 6, 10, 12),
      depart: Date.UTC(2026, 6, 11, 18),
    })
  })

  it('retombe sur toute la durée de l’édition sans dates', () => {
    // Le choix de l'utilisateur, et le cas de TOUS les tarifs existants : le graphique doit
    // fonctionner dès la mise en ligne, et se préciser ensuite.
    expect(fenetreDuBillet(null, periodes)).toEqual({
      arrivee: periodes.debut,
      depart: periodes.fin,
    })
  })

  it('accepte une seule des deux dates', () => {
    const tarif = { presenceFrom: null, presenceUntil: new Date(Date.UTC(2026, 6, 11)) }

    expect(fenetreDuBillet(tarif, periodes)).toEqual({
      arrivee: periodes.debut,
      depart: Date.UTC(2026, 6, 11),
    })
  })

  it('ne retombe PAS sur le montage ni le démontage', () => {
    // Un festivalier n'est pas là pour monter le chapiteau : l'y compter gonflerait l'affluence du
    // jeudi de tous les détenteurs de billets d'un coup.
    const fenetre = fenetreDuBillet(undefined, periodes)

    expect(fenetre.arrivee).not.toBe(periodes.montage)
    expect(fenetre.depart).not.toBe(periodes.demontage)
  })
})

describe('fenetreDuBenevole', () => {
  it('retient les dates déclarées, moment de la journée compris', () => {
    // `2026-07-10_noon` vaut midi sur place : c'est la convention de `presence-benevole.ts`, écrite
    // pour le planificateur et réutilisée telle quelle.
    const fenetre = fenetreDuBenevole(
      { arrivalDateTime: '2026-07-10_noon', departureDateTime: '2026-07-12_morning' },
      periodes,
      FUSEAU
    )

    expect(new Date(fenetre.arrivee!).toISOString()).toBe('2026-07-10T10:00:00.000Z')
    expect(new Date(fenetre.depart!).toISOString()).toBe('2026-07-12T10:00:00.000Z')
  })

  it('retombe sur le montage quand il s’y est déclaré disponible', () => {
    const fenetre = fenetreDuBenevole(
      { setupAvailability: true, teardownAvailability: false },
      periodes,
      FUSEAU
    )

    expect(fenetre.arrivee).toBe(periodes.montage)
    expect(fenetre.depart).toBe(periodes.fin)
  })

  it('retombe sur le démontage quand il s’y est déclaré disponible', () => {
    const fenetre = fenetreDuBenevole(
      { setupAvailability: false, teardownAvailability: true },
      periodes,
      FUSEAU
    )

    expect(fenetre.arrivee).toBe(periodes.debut)
    expect(fenetre.depart).toBe(periodes.demontage)
  })

  it('couvre du montage au démontage pour qui est disponible aux deux', () => {
    // Pas d'absence inventée au milieu : disponible aux deux bouts, il est là du début à la fin.
    const fenetre = fenetreDuBenevole(
      { setupAvailability: true, teardownAvailability: true },
      periodes,
      FUSEAU
    )

    expect(fenetre).toEqual({ arrivee: periodes.montage, depart: periodes.demontage })
  })

  it('préfère une date déclarée à la disponibilité', () => {
    // La date est plus précise que la période : elle gagne, même quand les deux existent.
    const fenetre = fenetreDuBenevole(
      { arrivalDateTime: '2026-07-11_morning', setupAvailability: true },
      periodes,
      FUSEAU
    )

    expect(fenetre.arrivee).not.toBe(periodes.montage)
    expect(new Date(fenetre.arrivee!).toISOString()).toBe('2026-07-11T06:00:00.000Z')
  })

  it('retombe sur l’événement quand rien n’est déclaré du tout', () => {
    expect(fenetreDuBenevole({}, periodes, FUSEAU)).toEqual({
      arrivee: periodes.debut,
      depart: periodes.fin,
    })
  })

  it('traite une date illisible comme une absence', () => {
    // Une donnée qu'on ne comprend pas ne doit pas fonder une fenêtre : c'est déjà la règle de
    // `presence-benevole.ts`, on la vérifie ici parce que le repli en dépend.
    const fenetre = fenetreDuBenevole({ arrivalDateTime: 'n’importe quoi' }, periodes, FUSEAU)

    expect(fenetre.arrivee).toBe(periodes.debut)
  })
})

describe('fenetreDeLArtiste', () => {
  it('retient ses instants quand il les a déclarés', () => {
    const artiste = {
      arrivalDateTime: new Date(Date.UTC(2026, 6, 11, 14)),
      departureDateTime: new Date(Date.UTC(2026, 6, 12, 9)),
    }

    expect(fenetreDeLArtiste(artiste, periodes)).toEqual({
      arrivee: Date.UTC(2026, 6, 11, 14),
      depart: Date.UTC(2026, 6, 12, 9),
    })
  })

  it('retombe sur l’événement hors montage et démontage', () => {
    // Le choix de l'utilisateur, et le cas de 54 artistes sur 89 : il vient jouer, pas monter.
    expect(fenetreDeLArtiste({ arrivalDateTime: null, departureDateTime: null }, periodes)).toEqual(
      { arrivee: periodes.debut, depart: periodes.fin }
    )
  })
})

describe('fenetreDeLOrganisateur', () => {
  it('lit le même format que les bénévoles', () => {
    // Choix de l'utilisateur : « comme pour les bénévoles ». Le même util les décode tous les deux.
    const fenetre = fenetreDeLOrganisateur(
      { arrivalDateTime: '2026-07-09_morning', departureDateTime: '2026-07-13_evening' },
      periodes,
      FUSEAU
    )

    expect(new Date(fenetre.arrivee!).toISOString()).toBe('2026-07-09T06:00:00.000Z')
    expect(new Date(fenetre.depart!).toISOString()).toBe('2026-07-13T22:00:00.000Z')
  })

  it('retombe sur l’événement, sans supposer qu’il monte et démonte', () => {
    /*
     * Tentant de le faire commencer au montage — un organisateur y est souvent — mais rien ne le
     * dit, et le supposer gonflerait l'affluence des journées de montage d'un nombre inventé.
     */
    expect(fenetreDeLOrganisateur({}, periodes, FUSEAU)).toEqual({
      arrivee: periodes.debut,
      depart: periodes.fin,
    })
  })
})
