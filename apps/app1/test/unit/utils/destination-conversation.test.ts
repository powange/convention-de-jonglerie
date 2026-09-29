import { describe, expect, it } from 'vitest'

import {
  destinationDeConversation,
  type DroitsDuLecteur,
  type TypeDeConversation,
} from '../../../shared/utils/destination-conversation'

/**
 * Le bouton à côté du titre d'une conversation : la page qu'il ouvre, selon le sujet de la
 * conversation et les droits de celui qui lit. Ces cas reprennent, ligne à ligne, le tableau
 * validé avec l'utilisateur.
 */
const AUCUN: DroitsDuLecteur = { gereBenevoles: false, gereArtistes: false }
const BENEVOLES: DroitsDuLecteur = { gereBenevoles: true, gereArtistes: false }
const ARTISTES: DroitsDuLecteur = { gereBenevoles: false, gereArtistes: true }
const TOUT: DroitsDuLecteur = { gereBenevoles: true, gereArtistes: true }

const vers = (type: TypeDeConversation, droits: DroitsDuLecteur, extra = {}) =>
  destinationDeConversation({ type, editionId: 7, ...extra }, droits)?.to ?? null

describe('destinationDeConversation', () => {
  describe.each(['TEAM_GROUP', 'TEAM_LEADER_PRIVATE', 'VOLUNTEER_TO_ORGANIZERS'] as const)(
    'conversation de bénévoles (%s)',
    (type) => {
      it('mène le bénévole, ou le responsable d’équipe, à sa page publique bénévolat', () => {
        expect(vers(type, AUCUN)).toBe('/editions/7/volunteers')
      })

      it('mène celui qui gère les bénévoles aux candidatures, en gestion', () => {
        expect(vers(type, BENEVOLES)).toBe('/editions/7/gestion/volunteers/applications')
      })

      it('ne mène pas en gestion qui ne gère que les artistes', () => {
        // Un organisateur rattaché à une équipe sans le droit sur les bénévoles : la page des
        // candidatures lui serait refusée.
        expect(vers(type, ARTISTES)).toBe('/editions/7/volunteers')
      })
    }
  )

  it('groupe des organisateurs : l’accueil de la gestion, quels que soient les droits', () => {
    expect(vers('ORGANIZERS_GROUP', AUCUN)).toBe('/editions/7/gestion')
    expect(vers('ORGANIZERS_GROUP', TOUT)).toBe('/editions/7/gestion')
  })

  describe('candidature d’artiste', () => {
    const candidature = { appelASpectaclesId: 3, candidatureArtisteId: 42 }

    it('mène l’artiste à la page de l’appel à spectacles', () => {
      expect(vers('ARTIST_APPLICATION', AUCUN, candidature)).toBe('/editions/7/shows-call/3')
    })

    it('mène le responsable artistes à la candidature, en gestion', () => {
      expect(vers('ARTIST_APPLICATION', ARTISTES, candidature)).toBe(
        '/editions/7/gestion/shows-call/3/applications/42'
      )
    })

    it('n’affiche pas de bouton sans appel connu', () => {
      expect(vers('ARTIST_APPLICATION', ARTISTES, { appelASpectaclesId: null })).toBeNull()
      expect(vers('ARTIST_APPLICATION', AUCUN, {})).toBeNull()
    })
  })

  describe('groupe d’un spectacle', () => {
    it('mène l’artiste à son espace artiste', () => {
      expect(vers('SHOW_GROUP', AUCUN)).toBe('/editions/7/artist-space')
    })

    it('mène le responsable artistes à la liste des spectacles, en gestion', () => {
      expect(vers('SHOW_GROUP', ARTISTES)).toBe('/editions/7/gestion/artists/shows')
    })

    it('ne mène pas en gestion qui ne gère que les bénévoles', () => {
      expect(vers('SHOW_GROUP', BENEVOLES)).toBe('/editions/7/artist-space')
    })
  })

  it('conversation privée : pas de bouton', () => {
    expect(vers('PRIVATE', TOUT)).toBeNull()
  })

  it('nomme la page visée, pour le libellé du bouton', () => {
    expect(destinationDeConversation({ type: 'SHOW_GROUP', editionId: 7 }, ARTISTES)?.cible).toBe(
      'gestion-spectacles'
    )
  })
})
