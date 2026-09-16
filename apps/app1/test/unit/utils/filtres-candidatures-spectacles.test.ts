import { describe, expect, it } from 'vitest'

import {
  filtresDeSpectaclesDepuisUrl,
  requeteCandidaturesDeSpectacles,
} from '../../../app/utils/filtres-candidatures-spectacles'

/**
 * Les filtres des candidatures à un appel à spectacles.
 *
 * C'est l'écran où l'absence coûtait le plus cher : on en sort pour lire une candidature, on y
 * revient, et statut, recherche et page étaient perdus à chaque aller-retour.
 */
const defauts = { statut: null, recherche: '', page: 1 }

describe('filtresDeSpectaclesDepuisUrl', () => {
  it('rend les défauts sur une URL nue', () => {
    expect(filtresDeSpectaclesDepuisUrl({})).toEqual(defauts)
  })

  it('lit le statut, la recherche et la page', () => {
    expect(filtresDeSpectaclesDepuisUrl({ status: 'ACCEPTED', search: 'trio', page: '2' })).toEqual(
      { statut: 'ACCEPTED', recherche: 'trio', page: 2 }
    )
  })

  it('REFUSE un statut inconnu', () => {
    // Le sélecteur ne pourrait même pas afficher la valeur qui filtre : l'écran paraîtrait
    // simplement vide, sans cause visible.
    expect(filtresDeSpectaclesDepuisUrl({ status: 'EN_ATTENTE' }).statut).toBeNull()
  })

  it('retombe sur la première page pour une page absurde', () => {
    expect(filtresDeSpectaclesDepuisUrl({ page: '0' }).page).toBe(1)
  })
})

describe('requeteCandidaturesDeSpectacles', () => {
  it('n’écrit rien quand tout est au défaut', () => {
    expect(requeteCandidaturesDeSpectacles({}, defauts)).toEqual({})
  })

  it('n’écrit PAS la première page', () => {
    expect(requeteCandidaturesDeSpectacles({}, { ...defauts, statut: 'PENDING' })).toEqual({
      status: 'PENDING',
    })
  })

  it('écrit la page dès qu’on quitte la première', () => {
    expect(requeteCandidaturesDeSpectacles({}, { ...defauts, page: 3 })).toEqual({ page: '3' })
  })

  it('retire le statut de l’URL quand on revient à « tous »', () => {
    expect(requeteCandidaturesDeSpectacles({ status: 'PENDING' }, defauts)).toEqual({})
  })

  it('préserve les paramètres qu’il ne gère pas', () => {
    expect(requeteCandidaturesDeSpectacles({ autre: 'x' }, defauts)).toEqual({ autre: 'x' })
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const filtres = { statut: 'REJECTED', recherche: 'jonglerie', page: 5 }

    expect(filtresDeSpectaclesDepuisUrl(requeteCandidaturesDeSpectacles({}, filtres))).toEqual(
      filtres
    )
  })
})
