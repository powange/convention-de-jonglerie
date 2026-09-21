import { describe, expect, it } from 'vitest'

import {
  filtresDepuisUrl,
  requeteArtistes,
} from '../../../../../layers/artists/app/utils/filtres-artistes-url'

/**
 * Les filtres d'artistes dans l'URL.
 *
 * Sans eux, un rechargement repartait de « tous les spectacles, aucune recherche » — et il était
 * impossible d'envoyer à quelqu'un la vue filtrée qu'on venait d'obtenir.
 *
 * Le filtre de spectacle accepte désormais plusieurs valeurs. Une liste vide EST l'absence de
 * filtre : il n'y a plus de valeur sentinelle `ALL` à réserver, ni à distinguer d'un identifiant
 * réel.
 */
const defauts = { spectacles: [], recherche: '' }

describe('filtresDepuisUrl', () => {
  it('rend les défauts sur une URL nue', () => {
    expect(filtresDepuisUrl({})).toEqual(defauts)
  })

  it('reprend les filtres portés par l’URL', () => {
    expect(filtresDepuisUrl({ show: '12', search: 'dupont' })).toEqual({
      spectacles: ['12'],
      recherche: 'dupont',
    })
  })

  it('lit plusieurs spectacles séparés par des virgules', () => {
    expect(filtresDepuisUrl({ show: '3,7,12' }).spectacles).toEqual(['3', '7', '12'])
  })

  it('relit une ancienne URL à un seul spectacle', () => {
    // Les liens déjà partagés portent `?show=3` : ils doivent continuer de fonctionner.
    expect(filtresDepuisUrl({ show: '3' }).spectacles).toEqual(['3'])
  })

  it('accepte aussi la clé répétée, que rend Vue Router', () => {
    // `?show=3&show=7` arrive sous forme de tableau. L'ignorer viderait le filtre en silence.
    expect(filtresDepuisUrl({ show: ['3', '7'] }).spectacles).toEqual(['3', '7'])
  })

  it('ignore une valeur vide plutôt que de filtrer sur rien', () => {
    // `?show=` filtrerait sur un identifiant vide, qui ne correspond à aucun spectacle, et
    // viderait le tableau sans rien expliquer.
    expect(filtresDepuisUrl({ show: '', search: '' })).toEqual(defauts)
  })

  it('écarte les vides d’une liste mal formée', () => {
    expect(filtresDepuisUrl({ show: '3,,7,' }).spectacles).toEqual(['3', '7'])
  })

  it('tolère les espaces autour des identifiants', () => {
    expect(filtresDepuisUrl({ show: '3, 7 ,12' }).spectacles).toEqual(['3', '7', '12'])
  })
})

describe('requeteArtistes', () => {
  it('n’écrit rien quand tout est au défaut', () => {
    // L'URL ne porte que ce qui s'écarte de l'état d'arrivée, sinon elle devient illisible.
    expect(requeteArtistes({}, defauts)).toEqual({})
  })

  it('écrit les filtres actifs', () => {
    expect(requeteArtistes({}, { spectacles: ['12'], recherche: 'martin' })).toEqual({
      show: '12',
      search: 'martin',
    })
  })

  it('joint plusieurs spectacles par des virgules', () => {
    // Même séparateur que `queryList` de `useQueryFilters` : une seule façon d'écrire une liste
    // dans une URL.
    expect(requeteArtistes({}, { spectacles: ['3', '7'], recherche: '' })).toEqual({
      show: '3,7',
    })
  })

  it('retire un filtre qu’on vient de relâcher', () => {
    // Le cas qui laisserait l'URL mentir : on décoche tout, et le paramètre resterait collé.
    expect(requeteArtistes({ show: '12', search: 'martin' }, defauts)).toEqual({})
  })

  it('préserve les paramètres étrangers', () => {
    expect(requeteArtistes({ tab: 'meals' }, { spectacles: ['12'], recherche: '' })).toEqual({
      tab: 'meals',
      show: '12',
    })
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const filtres = { spectacles: ['7', '9'], recherche: 'compagnie du fil' }

    expect(filtresDepuisUrl(requeteArtistes({}, filtres))).toEqual(filtres)
  })
})
