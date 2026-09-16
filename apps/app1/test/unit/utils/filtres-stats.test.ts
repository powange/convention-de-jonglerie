import { describe, expect, it } from 'vitest'

import {
  GRANULARITE_ACHATS_PAR_DEFAUT,
  GRANULARITE_STATS_PAR_DEFAUT,
  PERIODES_DE_STATS,
  reglagesDepuisUrl,
  requeteStats,
  TYPES_DACHAT_STATS,
  VUES_DE_PROVENANCE,
} from '../../../../../layers/ticketing/app/utils/filtres-stats'

/**
 * Les réglages des graphiques de statistiques dans l'URL.
 *
 * C'est l'écran qu'on partage le plus volontiers par lien, et c'est précisément ce que le lien ne
 * transportait pas : il rendait les sept réglages à leur état d'arrivée.
 */
const TOUS_LES_TYPES = ['participants', 'volunteers', 'artists', 'organizers', 'others']
const SANS_ARTISTES = ['participants', 'volunteers', 'organizers', 'others']

const defauts = {
  types: TOUS_LES_TYPES,
  periodes: [...PERIODES_DE_STATS],
  granularite: GRANULARITE_STATS_PAR_DEFAUT,
  typesDachat: [...TYPES_DACHAT_STATS],
  granulariteDesAchats: GRANULARITE_ACHATS_PAR_DEFAUT,
  tarifs: [],
  vue: VUES_DE_PROVENANCE[0],
}

describe('reglagesDepuisUrl', () => {
  it('rend les défauts sur une URL nue', () => {
    expect(reglagesDepuisUrl({}, TOUS_LES_TYPES)).toEqual(defauts)
  })

  it('lit les sept réglages', () => {
    expect(
      reglagesDepuisUrl(
        {
          types: 'volunteers,artists',
          periods: 'event',
          grain: '30',
          buyTypes: 'others',
          buyGrain: '10080',
          tiers: '3,7',
          view: 'orders',
        },
        TOUS_LES_TYPES
      )
    ).toEqual({
      types: ['volunteers', 'artists'],
      periodes: ['event'],
      granularite: 30,
      typesDachat: ['others'],
      granulariteDesAchats: 10080,
      tarifs: [3, 7],
      vue: 'orders',
    })
  })

  it('suit le défaut que l’édition impose aux types', () => {
    // Les artistes ne sont pas toujours activés : le défaut n'est pas constant, et le figer
    // cocherait une série que l'écran ne sait même pas tracer.
    expect(reglagesDepuisUrl({}, SANS_ARTISTES).types).toEqual(SANS_ARTISTES)
  })

  it('REFUSE une granularité hors de la liste proposée', () => {
    // Une valeur libre passerait au graphique, qui la découperait en tranches qu'aucun sélecteur
    // ne peut ensuite afficher ni corriger.
    expect(reglagesDepuisUrl({ grain: '45' }, TOUS_LES_TYPES).granularite).toBe(
      GRANULARITE_STATS_PAR_DEFAUT
    )
    expect(reglagesDepuisUrl({ grain: 'beaucoup' }, TOUS_LES_TYPES).granularite).toBe(
      GRANULARITE_STATS_PAR_DEFAUT
    )
  })

  it('REFUSE une vue inconnue', () => {
    expect(reglagesDepuisUrl({ view: 'camembert' }, TOUS_LES_TYPES).vue).toBe(VUES_DE_PROVENANCE[0])
  })

  it('écarte un identifiant de tarif qui n’est pas un entier', () => {
    expect(reglagesDepuisUrl({ tiers: '3,abc' }, TOUS_LES_TYPES).tarifs).toEqual([3])
  })
})

describe('requeteStats', () => {
  it('n’écrit rien quand tout est au défaut', () => {
    expect(requeteStats({}, defauts, TOUS_LES_TYPES)).toEqual({})
  })

  it('écrit ce qui s’écarte du défaut, et cela seulement', () => {
    expect(
      requeteStats({}, { ...defauts, granularite: 30, vue: 'orders' }, TOUS_LES_TYPES)
    ).toEqual({ grain: '30', view: 'orders' })
  })

  it('retient une sélection de types VIDÉE de tout', () => {
    // Décocher toutes les séries est un réglage comme un autre. Sans marqueur, il s'écrirait
    // comme une clé absente — donc comme « tout coché », son exact contraire.
    const query = requeteStats({}, { ...defauts, types: [] }, TOUS_LES_TYPES)

    expect(reglagesDepuisUrl(query, TOUS_LES_TYPES).types).toEqual([])
  })

  it('préserve les paramètres qu’il ne gère pas', () => {
    expect(requeteStats({ autre: 'x' }, defauts, TOUS_LES_TYPES)).toEqual({ autre: 'x' })
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const reglages = {
      types: ['volunteers'],
      periodes: ['setup', 'teardown'],
      granularite: 720,
      typesDachat: ['participants'],
      granulariteDesAchats: 43200,
      tarifs: [2, 5],
      vue: 'orders',
    }

    expect(reglagesDepuisUrl(requeteStats({}, reglages, TOUS_LES_TYPES), TOUS_LES_TYPES)).toEqual(
      reglages
    )
  })
})
