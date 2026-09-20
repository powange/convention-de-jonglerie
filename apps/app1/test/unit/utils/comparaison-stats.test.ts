import { describe, expect, it } from 'vitest'

import {
  comparerSeries,
  libelleDEdition,
} from '../../../../../layers/ticketing/app/utils/comparaison-stats'

/**
 * La superposition de deux éditions sur un axe commun.
 *
 * Ce que ces tests protègent est une lecture qui décide d'achats : « vendons-nous mieux que
 * l'an dernier au même stade ? ». Une série décalée d'un cran, ou un trou rempli de zéros, et la
 * réponse change sans que rien ne le signale.
 */

const OUVERTURE_2026 = '2026-05-15T00:00:00Z'
const OUVERTURE_2025 = '2025-04-10T00:00:00Z'

/** Une journée entière, en minutes : la granularité des tests qui ne s'intéressent qu'aux jours. */
const UNE_JOURNEE = 1440
/** Douze heures, pour éprouver deux colonnes par jour. */
const DOUZE_HEURES = 720

/** Un instant décalé de N jours par rapport à une ouverture. */
const jour = (ouverture: string, decalage: number) =>
  new Date(Date.parse(ouverture) + decalage * 24 * 3600 * 1000).toISOString()

describe('comparerSeries', () => {
  it('recale chaque édition sur SA PROPRE ouverture', () => {
    // Le cœur de l'exercice : deux éditions à un mois d'écart dans le calendrier se retrouvent
    // face à face sur l'axe, parce que chacune compte depuis son premier jour.
    const resultat = comparerSeries(
      {
        timestamps: [jour(OUVERTURE_2026, -1), jour(OUVERTURE_2026, 0)],
        series: { billets: [10, 40] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: [jour(OUVERTURE_2025, -1), jour(OUVERTURE_2025, 0)],
        series: { billets: [8, 30] },
        ouverture: OUVERTURE_2025,
      },
      UNE_JOURNEE
    )

    expect(resultat.etiquettes).toEqual(['J-1', 'J1'])
    expect(resultat.courante.billets).toEqual([10, 40])
    expect(resultat.comparee.billets).toEqual([8, 30])
  })

  it('montre qu’une édition a démarré plus tôt, au lieu de l’effacer', () => {
    // L'union et non l'intersection. C'est l'information qu'on vient chercher : l'an dernier, la
    // vente avait commencé trente jours plus tôt.
    const resultat = comparerSeries(
      {
        timestamps: [jour(OUVERTURE_2026, -5)],
        series: { billets: [100] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: [jour(OUVERTURE_2025, -35), jour(OUVERTURE_2025, -5)],
        series: { billets: [3, 90] },
        ouverture: OUVERTURE_2025,
      },
      UNE_JOURNEE
    )

    expect(resultat.etiquettes).toEqual(['J-35', 'J-5'])
    // L'édition courante n'existait pas encore à J-35 : un TROU, pas un zéro.
    expect(resultat.courante.billets).toEqual([null, 100])
    expect(resultat.comparee.billets).toEqual([3, 90])
  })

  it('distingue « pas de vente ce jour-là » de « pas encore de données »', () => {
    const resultat = comparerSeries(
      {
        timestamps: [jour(OUVERTURE_2026, -1), jour(OUVERTURE_2026, 0)],
        series: { billets: [0, 5] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: [jour(OUVERTURE_2025, 0)],
        series: { billets: [7] },
        ouverture: OUVERTURE_2025,
      },
      UNE_JOURNEE
    )

    // Zéro à J-1 pour la courante : la journée a eu lieu, personne n'a acheté.
    // Trou à J-1 pour la comparée : cette journée n'est pas dans ses données.
    expect(resultat.courante.billets).toEqual([0, 5])
    expect(resultat.comparee.billets).toEqual([null, 7])
  })

  it('garde les mêmes clés des deux côtés, même série absente', () => {
    // Un appelant qui boucle sur les séries ne doit pas avoir à vérifier chaque entrée.
    const resultat = comparerSeries(
      {
        timestamps: [jour(OUVERTURE_2026, 0)],
        series: { billets: [5], benevoles: [2] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: [jour(OUVERTURE_2025, 0)],
        series: { billets: [4] },
        ouverture: OUVERTURE_2025,
      },
      UNE_JOURNEE
    )

    expect(Object.keys(resultat.courante).sort()).toEqual(['benevoles', 'billets'])
    expect(Object.keys(resultat.comparee).sort()).toEqual(['benevoles', 'billets'])
    // La série que l'édition passée ne porte pas est vide, pas absente.
    expect(resultat.comparee.benevoles).toEqual([null])
  })

  it('retient les séries de l’édition COURANTE', () => {
    // C'est elle qu'on regarde ; une série que seule l'édition passée porterait n'aurait rien à
    // quoi se comparer, et encombrerait la légende.
    const resultat = comparerSeries(
      {
        timestamps: [jour(OUVERTURE_2026, 0)],
        series: { billets: [5] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: [jour(OUVERTURE_2025, 0)],
        series: { billets: [4], disparue: [9] },
        ouverture: OUVERTURE_2025,
      },
      UNE_JOURNEE
    )

    expect(Object.keys(resultat.courante)).toEqual(['billets'])
    expect(Object.keys(resultat.comparee)).toEqual(['billets'])
  })

  it('rend des séries toujours aussi longues que l’axe', () => {
    // Une série plus courte décalerait tous les points du graphique vers la gauche.
    const resultat = comparerSeries(
      {
        timestamps: [jour(OUVERTURE_2026, -2), jour(OUVERTURE_2026, 3)],
        series: { billets: [1, 2] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: [jour(OUVERTURE_2025, -10), jour(OUVERTURE_2025, 0)],
        series: { billets: [3, 4] },
        ouverture: OUVERTURE_2025,
      },
      UNE_JOURNEE
    )

    const n = resultat.etiquettes.length
    expect(resultat.courante.billets).toHaveLength(n)
    expect(resultat.comparee.billets).toHaveLength(n)
  })

  it('replie plusieurs tranches d’un même jour sur un seul point', () => {
    // Les statistiques se découpent à l'heure ; la comparaison se lit au jour.
    const resultat = comparerSeries(
      {
        timestamps: ['2026-05-15T08:00:00Z', '2026-05-15T20:00:00Z'],
        series: { billets: [3, 4] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: ['2025-04-10T09:00:00Z'],
        series: { billets: [10] },
        ouverture: OUVERTURE_2025,
      },
      UNE_JOURNEE
    )

    expect(resultat.etiquettes).toEqual(['J1'])
    expect(resultat.courante.billets).toEqual([7])
  })

  it('ne plante pas sur une édition sans ouverture connue', () => {
    const resultat = comparerSeries(
      {
        timestamps: [jour(OUVERTURE_2026, 0)],
        series: { billets: [5] },
        ouverture: null,
      },
      {
        timestamps: [jour(OUVERTURE_2025, 0)],
        series: { billets: [4] },
        ouverture: OUVERTURE_2025,
      },
      UNE_JOURNEE
    )

    // Sans origine, la courante n'a aucun repère : son axe se réduit à celui de la comparée.
    expect(resultat.etiquettes).toEqual(['J1'])
    expect(resultat.courante.billets).toEqual([null])
    expect(resultat.comparee.billets).toEqual([4])
  })
})

describe('libelleDEdition', () => {
  it('préfère le nom propre', () => {
    expect(libelleDEdition('Noyaburn 2025', '2025-04-10')).toBe('Noyaburn 2025')
  })

  it('retombe sur l’année quand l’édition n’a pas de nom', () => {
    // Deux éditions d'une convention s'appellent souvent pareil : c'est l'année qu'on lit.
    expect(libelleDEdition(null, '2025-04-10')).toBe('2025')
    expect(libelleDEdition('   ', '2025-04-10')).toBe('2025')
  })

  it('rend une chaîne vide plutôt que « Invalid Date »', () => {
    expect(libelleDEdition(null, null)).toBe('')
    expect(libelleDEdition(null, 'pas une date')).toBe('')
  })
})

describe('la granularité', () => {
  it('ne replie plus une journée sur un seul point', () => {
    // Le défaut signalé : à douze heures de granularité, l'écran affichait quand même un point
    // par jour. Les deux tranches doivent rester distinctes.
    const resultat = comparerSeries(
      {
        timestamps: ['2026-05-15T00:00:00Z', '2026-05-15T12:00:00Z'],
        series: { billets: [3, 4] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: ['2025-04-10T00:00:00Z', '2025-04-10T12:00:00Z'],
        series: { billets: [10, 20] },
        ouverture: OUVERTURE_2025,
      },
      DOUZE_HEURES
    )

    expect(resultat.courante.billets).toEqual([3, 4])
    expect(resultat.comparee.billets).toEqual([10, 20])
  })

  it('n’écrit le jour qu’une fois par journée', () => {
    // « J1 » couvre ses deux colonnes ; répéter l'étiquette sous chacune encombrerait l'axe.
    const resultat = comparerSeries(
      {
        timestamps: [
          '2026-05-15T00:00:00Z',
          '2026-05-15T12:00:00Z',
          '2026-05-16T00:00:00Z',
          '2026-05-16T12:00:00Z',
        ],
        series: { billets: [1, 2, 3, 4] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: ['2025-04-10T00:00:00Z'],
        series: { billets: [9] },
        ouverture: OUVERTURE_2025,
      },
      DOUZE_HEURES
    )

    expect(resultat.etiquettes).toEqual(['J1', '', 'J2', ''])
  })

  it('aligne la SECONDE moitié de journée sur la seconde moitié de l’autre édition', () => {
    // Ce que le recalage doit garantir à cette finesse : l'après-midi du premier jour de 2026
    // se lit en face de l'après-midi du premier jour de 2025, pas en face de son matin.
    const resultat = comparerSeries(
      {
        timestamps: ['2026-05-15T12:00:00Z'],
        series: { billets: [7] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: ['2025-04-10T12:00:00Z'],
        series: { billets: [11] },
        ouverture: OUVERTURE_2025,
      },
      DOUZE_HEURES
    )

    expect(resultat.etiquettes).toHaveLength(1)
    expect(resultat.courante.billets).toEqual([7])
    expect(resultat.comparee.billets).toEqual([11])
  })

  it('garde le tout premier créneau du jour d’ouverture', () => {
    // Le créneau zéro est réel — c'est la première tranche de J1. Une version antérieure
    // l'écartait comme on écarte « J0 », et perdait le début de la journée d'ouverture.
    const resultat = comparerSeries(
      {
        timestamps: ['2026-05-15T00:00:00Z'],
        series: { billets: [5] },
        ouverture: OUVERTURE_2026,
      },
      {
        timestamps: ['2025-04-10T00:00:00Z'],
        series: { billets: [6] },
        ouverture: OUVERTURE_2025,
      },
      DOUZE_HEURES
    )

    expect(resultat.etiquettes).toEqual(['J1'])
    expect(resultat.courante.billets).toEqual([5])
    expect(resultat.comparee.billets).toEqual([6])
  })
})
