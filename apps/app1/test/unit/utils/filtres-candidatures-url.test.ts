import { describe, expect, it } from 'vitest'

import {
  filtresDepuisUrl,
  requeteCandidatures,
  STATUT_PAR_DEFAUT,
} from '../../../../../layers/volunteers/app/utils/filtres-candidatures-url'

/**
 * Les filtres de candidatures dans l'URL.
 *
 * Sans eux, un rechargement repartait de « tous les statuts, toutes les équipes » — et il était
 * impossible d'envoyer à quelqu'un la vue filtrée qu'on venait d'obtenir.
 */
const defauts = {
  statut: STATUT_PAR_DEFAUT,
  equipesSouhaitees: [],
  presence: [],
  equipesAssignees: [],
  recherche: '',
}

describe('filtresDepuisUrl', () => {
  it('rend les défauts sur une URL nue', () => {
    expect(filtresDepuisUrl({})).toEqual(defauts)
  })

  it('reprend chaque filtre porté par l’URL', () => {
    expect(
      filtresDepuisUrl({
        status: 'ACCEPTED',
        teams: 'bar,cuisine',
        presence: 'evenement',
        assignedTeams: 'hygiene',
        search: 'dupont',
      })
    ).toEqual({
      statut: 'ACCEPTED',
      equipesSouhaitees: ['bar', 'cuisine'],
      presence: ['evenement'],
      equipesAssignees: ['hygiene'],
      recherche: 'dupont',
    })
  })

  it('ignore les valeurs vides plutôt que de filtrer sur rien', () => {
    // Une virgule esseulée donnerait un identifiant vide, qui ne correspond à aucune équipe et
    // viderait le tableau sans rien expliquer.
    expect(filtresDepuisUrl({ teams: ',,', status: '' })).toEqual(defauts)
  })
})

describe('requeteCandidatures', () => {
  it('n’écrit rien quand tout est au défaut', () => {
    // L'URL ne porte que ce qui s'écarte de l'état d'arrivée, sinon elle devient illisible.
    expect(requeteCandidatures({}, defauts)).toEqual({})
  })

  it('écrit les filtres actifs', () => {
    expect(
      requeteCandidatures({}, { ...defauts, statut: 'ACCEPTED', presence: ['evenement'] })
    ).toEqual({ status: 'ACCEPTED', presence: 'evenement' })
  })

  it('retire un filtre qu’on vient de relâcher', () => {
    // Le cas qui laisserait l'URL mentir : on décoche, et le paramètre resterait.
    expect(requeteCandidatures({ status: 'ACCEPTED', teams: 'bar' }, defauts)).toEqual({})
  })

  it('préserve les paramètres étrangers', () => {
    // La page porte aussi son onglet actif : un filtre d'équipe n'a aucune raison de l'effacer.
    expect(requeteCandidatures({ tab: 'teams' }, { ...defauts, statut: 'PENDING' })).toEqual({
      tab: 'teams',
      status: 'PENDING',
    })
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const filtres = {
      statut: 'REJECTED',
      equipesSouhaitees: ['bar'],
      presence: ['montage', 'evenement'],
      equipesAssignees: ['hygiene'],
      recherche: 'martin',
    }

    expect(filtresDepuisUrl(requeteCandidatures({}, filtres))).toEqual(filtres)
  })
})
