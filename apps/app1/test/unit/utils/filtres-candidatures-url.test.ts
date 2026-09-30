import { describe, expect, it } from 'vitest'

import {
  COLONNES_TRIABLES,
  filtresDepuisUrl,
  pageDepuisUrl,
  requeteCandidatures,
  SOURCE_PAR_DEFAUT,
  STATUT_PAR_DEFAUT,
  TRI_PAR_DEFAUT,
} from '../../../../../layers/volunteers/app/utils/filtres-candidatures-url'
import { estColonneDeTri } from '../../../../../layers/volunteers/server/utils/tri-candidatures'

/**
 * Les filtres de candidatures dans l'URL.
 *
 * Sans eux, un rechargement repartait de « tous les statuts, toutes les équipes » — et il était
 * impossible d'envoyer à quelqu'un la vue filtrée qu'on venait d'obtenir.
 */
const defauts = {
  statut: STATUT_PAR_DEFAUT,
  source: SOURCE_PAR_DEFAUT,
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
        source: 'MANUAL',
        teams: 'bar,cuisine',
        presence: 'evenement',
        assignedTeams: 'hygiene',
        search: 'dupont',
      })
    ).toEqual({
      statut: 'ACCEPTED',
      source: 'MANUAL',
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
      source: 'APPLICATION',
      equipesSouhaitees: ['bar'],
      presence: ['montage', 'evenement'],
      equipesAssignees: ['hygiene'],
      recherche: 'martin',
    }

    expect(filtresDepuisUrl(requeteCandidatures({}, filtres))).toEqual(filtres)
  })
})

/**
 * La pagination, conservée au même titre que les filtres.
 *
 * Un lien filtré qui ramène à la première page ne règle que la moitié du problème quand la liste
 * en compte dix — et c'est exactement ce qui se passait en revenant d'une candidature.
 */
describe('pageDepuisUrl', () => {
  it('lit une page', () => {
    expect(pageDepuisUrl('4')).toBe(4)
  })

  it('retombe sur la première page pour tout ce qui n’en est pas une', () => {
    expect(pageDepuisUrl(undefined)).toBe(1)
    expect(pageDepuisUrl('0')).toBe(1)
    expect(pageDepuisUrl('-3')).toBe(1)
    expect(pageDepuisUrl('deux')).toBe(1)
  })
})

describe('requeteCandidatures et la page', () => {
  const defauts = {
    statut: STATUT_PAR_DEFAUT,
    source: SOURCE_PAR_DEFAUT,
    equipesSouhaitees: [],
    presence: [],
    equipesAssignees: [],
    recherche: '',
  }

  it('n’écrit PAS la première page', () => {
    expect(requeteCandidatures({}, defauts, 1)).toEqual({})
  })

  it('écrit la page dès qu’on quitte la première', () => {
    expect(requeteCandidatures({}, defauts, 3)).toEqual({ page: '3' })
  })

  it('RETIRE la page de l’URL quand on revient à la première', () => {
    // Sans la clé dans la déstructuration, la page d'avant resterait collée à l'URL.
    expect(requeteCandidatures({ page: '3' }, defauts, 1)).toEqual({})
  })

  it('fait l’aller-retour avec les filtres', () => {
    const query = requeteCandidatures({}, { ...defauts, statut: 'ACCEPTED' }, 2)

    expect(pageDepuisUrl(query.page)).toBe(2)
    expect(filtresDepuisUrl(query).statut).toBe('ACCEPTED')
  })
})

/**
 * Le CLASSEMENT dans l'URL — le seul réglage de cet écran à ne pas y figurer.
 *
 * ⚠️ POURQUOI C'ÉTAIT PLUS QU'UNE COMMODITÉ. Statut, provenance, équipes, présence, recherche,
 * page et colonnes masquées survivaient déjà à un rechargement ; le tri repartait sur « les plus
 * récentes ». Or cette liste est paginée PAR LE SERVEUR : reclasser par nom puis recharger ne
 * remettait pas seulement l'ordre d'avant, cela changeait QUELLES candidatures s'affichent sur la
 * page courante. On croyait revenir à ce qu'on regardait, et l'on regardait autre chose.
 *
 * ⚠️ LA LECTURE ET L'ÉCRITURE DU TRI NE SONT PAS ÉPROUVÉES ICI : elles vivent dans le socle
 * partagé `shared/utils/filtres-url.ts` (`tri=nom` croissant, `tri=-nom` décroissant, une seule
 * clé signée), qui a ses propres tests. Une première version de ce lot les avait RECOPIÉES dans
 * cet util, sur deux clés — et l'homonyme a silencieusement ÉCLIPSÉ celle du socle, si bien que le
 * tableau partait sur la colonne par défaut avec le bon sens. Ce qui reste à éprouver ici, c'est
 * la seule chose propre à cet écran : la liste des colonnes qu'il sait classer.
 */

describe('la liste des colonnes triables', () => {
  it('est D’ACCORD avec celle du serveur, colonne pour colonne', () => {
    /*
     * ⚠️⚠️ LA GARDE QUI COMPTE. `COLONNES_TRIABLES` RECOPIE `COLONNES` de
     * `server/utils/tri-candidatures.ts` : l'util client ne doit rien importer, puisqu'il est
     * chargé hors Nuxt, et le fichier serveur importe un type de Prisma.
     *
     * Deux listes recopiées finissent par diverger. Ce dépôt en a déjà payé le prix sur CE
     * fichier-là : le tri secondaire sur les allergies visait un champ qui n'existe pas sur la
     * candidature, Prisma refusait la requête, et la liste entière partait en erreur — alors que
     * le tri principal sur la même colonne, dix-sept lignes plus haut, était juste.
     *
     * Ici la divergence serait plus discrète : une colonne ajoutée au serveur et pas ici ne
     * pourrait pas se partager ; l'inverse écrirait dans l'URL un champ que le serveur ignore, et
     * la liste s'afficherait dans l'ordre par défaut sous un en-tête fléché.
     */
    for (const colonne of COLONNES_TRIABLES) {
      expect(estColonneDeTri(colonne), `le serveur ne sait pas classer « ${colonne} »`).toBe(true)
    }
  })

  it('contient le champ du classement d’arrivée', () => {
    expect(COLONNES_TRIABLES).toContain(TRI_PAR_DEFAUT.champ)
    expect(estColonneDeTri(TRI_PAR_DEFAUT.champ)).toBe(true)
  })
})
