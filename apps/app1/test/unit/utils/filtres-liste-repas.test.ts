import { describe, expect, it } from 'vitest'

import {
  dateConnue,
  filtresDepuisUrl,
  requeteListeDeRepas,
  SANS_FILTRE,
} from '../../../../../layers/meals/app/utils/filtres-liste-repas'

/**
 * Les filtres de la liste des repas dans l'URL.
 *
 * C'est le tableau le plus long de la gestion et celui qu'on filtre le plus finement. Sans ces
 * filtres dans l'URL, un rechargement repartait de « tout » et il fallait reposer les quatre
 * sélecteurs à la main.
 */
const defauts = {
  recherche: '',
  phase: SANS_FILTRE,
  typeDePersonne: SANS_FILTRE,
  typeDeRepas: SANS_FILTRE,
  date: SANS_FILTRE,
  page: 1,
}

describe('filtresDepuisUrl', () => {
  it('rend les défauts sur une URL nue', () => {
    expect(filtresDepuisUrl({})).toEqual(defauts)
  })

  it('lit les cinq filtres et la page', () => {
    expect(
      filtresDepuisUrl({
        search: 'marie',
        phase: 'EVENT',
        type: 'artist',
        meal: 'DINNER',
        date: '2026-09-18',
        page: '3',
      })
    ).toEqual({
      recherche: 'marie',
      phase: 'EVENT',
      typeDePersonne: 'artist',
      typeDeRepas: 'DINNER',
      date: '2026-09-18',
      page: 3,
    })
  })

  it('REFUSE une phase, un type ou un repas inconnus', () => {
    // Une URL vieillie ou bricolée ne doit pas produire un tableau vide sans cause visible : le
    // sélecteur ne pourrait même pas afficher la valeur qui filtre.
    const filtres = filtresDepuisUrl({ phase: 'MONTAGE', type: 'benevole', meal: 'GOUTER' })

    expect(filtres.phase).toBe(SANS_FILTRE)
    expect(filtres.typeDePersonne).toBe(SANS_FILTRE)
    expect(filtres.typeDeRepas).toBe(SANS_FILTRE)
  })

  it('retombe sur la première page pour une page absurde', () => {
    expect(filtresDepuisUrl({ page: '0' }).page).toBe(1)
    expect(filtresDepuisUrl({ page: 'deux' }).page).toBe(1)
  })
})

/**
 * La date est le seul filtre sans liste fermée : elle dépend des jours que le serveur rend.
 */
describe('dateConnue', () => {
  it('retient une date que le serveur a rendue', () => {
    expect(dateConnue('2026-09-18', ['2026-09-17', '2026-09-18'])).toBe('2026-09-18')
  })

  it('ÉCARTE une date absente des jours de l’édition', () => {
    // Le cas réel : une URL gardée d'une édition précédente, ou un jour retiré depuis.
    expect(dateConnue('2025-01-01', ['2026-09-17', '2026-09-18'])).toBe(SANS_FILTRE)
  })

  it('laisse « tous les jours » tel quel', () => {
    expect(dateConnue(SANS_FILTRE, [])).toBe(SANS_FILTRE)
  })
})

describe('requeteListeDeRepas', () => {
  it('n’écrit rien quand tout est au défaut', () => {
    expect(requeteListeDeRepas({}, defauts)).toEqual({})
  })

  it('écrit ce qui s’écarte du défaut, et cela seulement', () => {
    expect(
      requeteListeDeRepas({}, { ...defauts, phase: 'EVENT', recherche: 'marie', page: 4 })
    ).toEqual({ phase: 'EVENT', search: 'marie', page: '4' })
  })

  it('n’écrit PAS la première page', () => {
    expect(requeteListeDeRepas({}, { ...defauts, page: 1 })).toEqual({})
  })

  it('retire de l’URL un filtre remis à « tous »', () => {
    expect(requeteListeDeRepas({ phase: 'EVENT' }, defauts)).toEqual({})
  })

  it('préserve les paramètres qu’il ne gère pas', () => {
    expect(requeteListeDeRepas({ autre: 'x' }, { ...defauts, typeDeRepas: 'LUNCH' })).toEqual({
      autre: 'x',
      meal: 'LUNCH',
    })
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const filtres = {
      recherche: 'dupont',
      phase: 'TEARDOWN',
      typeDePersonne: 'volunteer',
      typeDeRepas: 'BREAKFAST',
      date: '2026-09-19',
      page: 2,
    }

    expect(filtresDepuisUrl(requeteListeDeRepas({}, filtres))).toEqual(filtres)
  })
})
