import { describe, it, expect } from 'vitest'

import {
  VUE_PAR_DEFAUT,
  creneauxDesEquipes,
  dateDepuisUrl,
  equipesConnues,
  equipesDepuisUrl,
  granulariteDepuisUrl,
  requeteFiltres,
  vueDepuisUrl,
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

/**
 * La vue et la date du calendrier, elles aussi dans l'URL.
 *
 * Sans elles, passer en vue « jour » puis naviguer jusqu'au vendredi était perdu au moindre
 * rechargement — et impossible à transmettre à quelqu'un d'autre, alors que c'est justement la
 * vue qu'on veut montrer.
 */
describe('vue et date du calendrier', () => {
  it('reprend une vue connue', () => {
    expect(vueDepuisUrl('resourceTimelineDay')).toBe('resourceTimelineDay')
  })

  it('retombe sur la semaine devant une vue inventée', () => {
    // Une vue inconnue ferait planter FullCalendar au démarrage, sans rien expliquer.
    expect(vueDepuisUrl('resourceTimelineCentury')).toBe(VUE_PAR_DEFAUT)
    expect(vueDepuisUrl(undefined)).toBe(VUE_PAR_DEFAUT)
  })

  it('reprend une date bien formée', () => {
    expect(dateDepuisUrl('2026-09-25')).toBe('2026-09-25')
  })

  it('ignore une date illisible plutôt que d’ouvrir un planning vide', () => {
    // `new Date('vendredi')` rend une date invalide, et le calendrier s'affichait vide sans rien
    // dire. Sans date exploitable, on repart du premier jour de l'édition.
    expect(dateDepuisUrl('vendredi')).toBeNull()
    expect(dateDepuisUrl('2026-13-45')).toBeNull()
    expect(dateDepuisUrl(undefined)).toBeNull()
  })

  it('écrit la vue et la date dans la query', () => {
    expect(requeteFiltres({}, [], 30, 'resourceTimelineDay', '2026-09-25')).toEqual({
      view: 'resourceTimelineDay',
      date: '2026-09-25',
    })
  })

  it('n’écrit pas la vue par défaut', () => {
    // Même règle que pour les équipes et la granularité : l'URL ne porte que ce qui s'écarte de
    // l'état d'arrivée, sans quoi elle devient illisible.
    expect(requeteFiltres({}, [], 30, VUE_PAR_DEFAUT, null)).toEqual({})
  })

  it('retire une vue devenue le défaut', () => {
    expect(requeteFiltres({ view: 'resourceTimelineDay' }, [], 30, VUE_PAR_DEFAUT, null)).toEqual(
      {}
    )
  })

  it('laisse la vue intacte quand on ne la précise pas', () => {
    // Un changement de filtre d'équipe ne doit pas effacer la vue qu'on regardait.
    expect(requeteFiltres({ view: 'resourceTimelineDay', date: '2026-09-25' }, ['a'], 30)).toEqual({
      view: 'resourceTimelineDay',
      date: '2026-09-25',
      teams: 'a',
    })
  })
})
