import { describe, expect, it } from 'vitest'

import {
  filtresDepuisUrl,
  requeteArtistes,
  SPECTACLE_PAR_DEFAUT,
} from '../../../../../layers/artists/app/utils/filtres-artistes-url'

/**
 * Les filtres d'artistes dans l'URL.
 *
 * Sans eux, un rechargement repartait de « tous les spectacles, aucune recherche » — et il était
 * impossible d'envoyer à quelqu'un la vue filtrée qu'on venait d'obtenir.
 */
const defauts = { spectacle: SPECTACLE_PAR_DEFAUT, recherche: '' }

describe('filtresDepuisUrl', () => {
  it('rend les défauts sur une URL nue', () => {
    expect(filtresDepuisUrl({})).toEqual(defauts)
  })

  it('reprend les filtres portés par l’URL', () => {
    expect(filtresDepuisUrl({ show: '12', search: 'dupont' })).toEqual({
      spectacle: '12',
      recherche: 'dupont',
    })
  })

  it('ignore une valeur vide plutôt que de filtrer sur rien', () => {
    // `?show=` filtrerait sur un identifiant vide, qui ne correspond à aucun spectacle, et
    // viderait le tableau sans rien expliquer.
    expect(filtresDepuisUrl({ show: '', search: '' })).toEqual(defauts)
  })
})

describe('requeteArtistes', () => {
  it('n’écrit rien quand tout est au défaut', () => {
    // L'URL ne porte que ce qui s'écarte de l'état d'arrivée, sinon elle devient illisible.
    expect(requeteArtistes({}, defauts)).toEqual({})
  })

  it('écrit les filtres actifs', () => {
    expect(requeteArtistes({}, { spectacle: '12', recherche: 'martin' })).toEqual({
      show: '12',
      search: 'martin',
    })
  })

  it('retire un filtre qu’on vient de relâcher', () => {
    // Le cas qui laisserait l'URL mentir : on remet « tous les spectacles », et le paramètre
    // resterait collé.
    expect(requeteArtistes({ show: '12', search: 'martin' }, defauts)).toEqual({})
  })

  it('préserve les paramètres étrangers', () => {
    expect(requeteArtistes({ tab: 'meals' }, { spectacle: '12', recherche: '' })).toEqual({
      tab: 'meals',
      show: '12',
    })
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const filtres = { spectacle: '7', recherche: 'compagnie du fil' }

    expect(filtresDepuisUrl(requeteArtistes({}, filtres))).toEqual(filtres)
  })
})
