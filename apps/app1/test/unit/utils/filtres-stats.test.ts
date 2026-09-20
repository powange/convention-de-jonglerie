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
import { PERIODES_DACHAT } from '../../../../../layers/ticketing/app/utils/periodes-achats'

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
  periodesDachat: [...PERIODES_DACHAT],
  comparaison: null,
}

describe('reglagesDepuisUrl', () => {
  it('rend les défauts sur une URL nue', () => {
    expect(reglagesDepuisUrl({}, TOUS_LES_TYPES)).toEqual(defauts)
  })

  it('lit les neuf réglages', () => {
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
          buyPeriods: 'pendant',
          compare: '21',
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
      periodesDachat: ['pendant'],
      comparaison: 21,
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
      periodesDachat: ['avant', 'apres'],
      comparaison: 21,
    }

    expect(reglagesDepuisUrl(requeteStats({}, reglages, TOUS_LES_TYPES), TOUS_LES_TYPES)).toEqual(
      reglages
    )
  })
})

describe('l’édition de comparaison dans l’URL', () => {
  it('vaut null quand l’URL n’en dit rien', () => {
    expect(reglagesDepuisUrl({}, TOUS_LES_TYPES).comparaison).toBeNull()
  })

  it('lit un identifiant d’édition', () => {
    expect(reglagesDepuisUrl({ compare: '17' }, TOUS_LES_TYPES).comparaison).toBe(17)
  })

  it('traite une valeur absurde comme une absence, pas comme une erreur', () => {
    // Une URL partagée puis tronquée doit rendre un écran normal, pas un écran cassé. Que
    // l'édition existe et soit lisible est vérifié par le serveur, pas ici.
    for (const brut of ['0', '-3', 'abc', '', '1.5', undefined, null]) {
      expect(reglagesDepuisUrl({ compare: brut }, TOUS_LES_TYPES).comparaison).toBeNull()
    }
  })

  it('n’écrit RIEN dans l’URL quand on ne compare pas', () => {
    // Un écran sans comparaison doit avoir exactement l'adresse qu'il avait avant que cette
    // possibilité existe — sans quoi tous les liens déjà partagés changeraient d'aspect.
    const query = requeteStats({}, { ...defauts, comparaison: null }, TOUS_LES_TYPES)
    // `requeteAvec` RETIRE les valeurs vides : la clé disparaît de l'URL au lieu d'y rester à
    // vide. C'est ce qui garantit qu'une adresse sans comparaison est identique à celle d'avant.
    expect(query.compare).toBeUndefined()
    expect(Object.keys(query)).not.toContain('compare')
  })

  it('écrit l’identifiant quand on compare', () => {
    const query = requeteStats({}, { ...defauts, comparaison: 17 }, TOUS_LES_TYPES)
    expect(query.compare).toBe('17')
  })

  it('fait l’aller-retour sur la seule comparaison', () => {
    const query = requeteStats({}, { ...defauts, comparaison: 42 }, TOUS_LES_TYPES)
    expect(reglagesDepuisUrl(query, TOUS_LES_TYPES).comparaison).toBe(42)
  })
})
