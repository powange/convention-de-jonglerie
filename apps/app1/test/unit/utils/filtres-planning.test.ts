import { describe, it, expect } from 'vitest'

import {
  creneauxDesEquipes,
  equipesConnues,
  equipesDepuisUrl,
  granulariteDepuisUrl,
  requeteFiltres,
} from '../../../../../layers/volunteers/app/utils/filtres-planning'

/**
 * Les filtres du planning vivent dans l'URL, pour qu'un rechargement — ou un lien envoyé à
 * quelqu'un d'autre — retrouve la vue filtrée plutôt que « toutes les équipes ».
 *
 * Ce qui peut se tromper tient dans ces quatre fonctions : une valeur inventée dans l'URL, une
 * équipe supprimée depuis, ou un paramètre voisin écrasé au passage.
 */

describe('equipesDepuisUrl', () => {
  it('lit une liste séparée par des virgules', () => {
    expect(equipesDepuisUrl('accueil,bar')).toEqual(['accueil', 'bar'])
  })

  it('rend une liste vide sans paramètre', () => {
    expect(equipesDepuisUrl(undefined)).toEqual([])
    expect(equipesDepuisUrl('')).toEqual([])
  })

  it('ignore un paramètre répété, que le routeur donne en tableau', () => {
    expect(equipesDepuisUrl(['accueil', 'bar'])).toEqual([])
  })

  it('écarte les entrées vides des virgules en trop', () => {
    expect(equipesDepuisUrl('accueil,,bar,')).toEqual(['accueil', 'bar'])
  })
})

describe('granulariteDepuisUrl', () => {
  it('accepte les granularités proposées', () => {
    expect(granulariteDepuisUrl('15')).toBe(15)
    expect(granulariteDepuisUrl('60')).toBe(60)
  })

  it('retombe sur le défaut pour une valeur inventée', () => {
    // Une granularité arbitraire casserait l'affichage du calendrier sans rien signaler.
    expect(granulariteDepuisUrl('7')).toBe(30)
    expect(granulariteDepuisUrl('abc')).toBe(30)
    expect(granulariteDepuisUrl(undefined)).toBe(30)
  })
})

describe('equipesConnues', () => {
  const equipes = [{ id: 'accueil' }, { id: 'bar' }]

  it('écarte une équipe qui n’existe plus', () => {
    expect(equipesConnues(['accueil', 'disparue'], equipes)).toEqual(['accueil'])
  })

  it('garde la sélection tant que les équipes ne sont pas chargées', () => {
    // Les effacer ici perdrait le filtre de l'URL avant même de pouvoir le valider.
    expect(equipesConnues(['accueil'], [])).toEqual(['accueil'])
  })

  it('laisse une sélection entièrement valide intacte', () => {
    expect(equipesConnues(['bar', 'accueil'], equipes)).toEqual(['bar', 'accueil'])
  })
})

describe('requeteFiltres', () => {
  it('écrit les équipes retenues', () => {
    expect(requeteFiltres({}, ['accueil', 'bar'], 30)).toEqual({ teams: 'accueil,bar' })
  })

  it('retire le paramètre quand le filtre revient au défaut', () => {
    // Sinon l'URL gardait `teams=` et `granularity=30`, longs et sans information.
    expect(requeteFiltres({ teams: 'accueil', granularity: '15' }, [], 30)).toEqual({})
  })

  it("n'écrit la granularité que si elle s'écarte du défaut", () => {
    expect(requeteFiltres({}, [], 15)).toEqual({ granularity: '15' })
    expect(requeteFiltres({}, [], 30)).toEqual({})
  })

  it('préserve les autres paramètres déjà dans l’URL', () => {
    // La page en porte d'autres : les écraser renverrait l'utilisateur ailleurs à chaque clic.
    expect(requeteFiltres({ onglet: 'planning' }, ['bar'], 60)).toEqual({
      onglet: 'planning',
      teams: 'bar',
      granularity: '60',
    })
  })
})

describe('creneauxDesEquipes', () => {
  const creneau = (id: string, teamId: string | null) => ({ id, teamId })

  it('ne filtre rien quand aucune équipe n’est retenue', () => {
    // C'est l'état d'arrivée de l'écran : il montre tout.
    const creneaux = [creneau('a', 'bar'), creneau('b', 'accueil')]

    expect(creneauxDesEquipes(creneaux, [])).toEqual(creneaux)
  })

  it('ne garde que les créneaux des équipes retenues', () => {
    const creneaux = [creneau('a', 'bar'), creneau('b', 'accueil'), creneau('c', 'cuisine')]

    expect(creneauxDesEquipes(creneaux, ['bar', 'cuisine']).map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('garde toujours un créneau sans équipe', () => {
    // Il ne relève d'aucune équipe en particulier — accueil général, coup de main ponctuel — et
    // l'écarter le rendrait invisible dès qu'on regarde une équipe, alors qu'il concerne tout
    // le monde.
    const creneaux = [creneau('a', 'bar'), creneau('libre', null), creneau('c', undefined as never)]

    expect(creneauxDesEquipes(creneaux, ['accueil']).map((c) => c.id)).toEqual(['libre', 'c'])
  })

  it('rend une nouvelle liste plutôt que celle reçue', () => {
    // Les appelants la trient sur place pour l'impression : trier la liste d'origine réordonnerait
    // le calendrier par effet de bord.
    const creneaux = [creneau('a', 'bar')]

    expect(creneauxDesEquipes(creneaux, [])).not.toBe(creneaux)
  })

  it('rend une liste vide quand aucune équipe retenue n’a de créneau', () => {
    expect(creneauxDesEquipes([creneau('a', 'bar')], ['cuisine'])).toEqual([])
  })
})
