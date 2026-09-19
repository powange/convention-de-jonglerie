import { describe, expect, it } from 'vitest'

import {
  aDroitAuPlanning,
  type EtatDuVisiteur,
} from '../../../../../layers/volunteers/app/utils/droit-au-planning'

/**
 * La page publique de bénévolat demandait les créneaux du planning à tout visiteur connecté, y
 * compris à qui n'avait jamais candidaté : l'API répondait 403, et l'erreur atterrissait dans les
 * logs de production. L'appel venait du `setup`, qu'aucun `v-if` ne gouverne.
 *
 * C'est ce prédicat qui décide désormais si l'identifiant d'édition est transmis au composable.
 */

const BENEVOLE_ACCEPTE: EtatDuVisiteur = {
  authentifie: true,
  planningVisible: true,
  statutCandidature: 'ACCEPTED',
  responsableDEquipe: false,
  equipesOrganisateur: 0,
}

const avec = (modifications: Partial<EtatDuVisiteur>) => ({ ...BENEVOLE_ACCEPTE, ...modifications })

describe('aDroitAuPlanning', () => {
  it('laisse passer un bénévole accepté', () => {
    expect(aDroitAuPlanning(BENEVOLE_ACCEPTE)).toBe(true)
  })

  it("refuse quelqu'un qui n'a jamais candidaté", () => {
    // LE cas du défaut : connecté, mais sans candidature. C'est lui qui produisait le 403.
    expect(aDroitAuPlanning(avec({ statutCandidature: null }))).toBe(false)
    expect(aDroitAuPlanning(avec({ statutCandidature: undefined }))).toBe(false)
  })

  it('refuse une candidature en attente ou refusée', () => {
    // Une candidature déposée ne donne pas le planning : seule son acceptation le donne.
    expect(aDroitAuPlanning(avec({ statutCandidature: 'PENDING' }))).toBe(false)
    expect(aDroitAuPlanning(avec({ statutCandidature: 'REJECTED' }))).toBe(false)
  })

  it('refuse un visiteur non connecté', () => {
    expect(aDroitAuPlanning(avec({ authentifie: false }))).toBe(false)
  })

  it("refuse tant que le planning n'est pas montrable, même à un bénévole accepté", () => {
    // Sinon l'API répondrait 403 avec « planning pas encore publié » — un autre appel pour rien.
    expect(aDroitAuPlanning(avec({ planningVisible: false }))).toBe(false)
  })

  it('laisse passer un responsable d’équipe sans candidature acceptée', () => {
    // Il relit le planning en avance : c'est ce que le serveur lui accorde déjà.
    expect(aDroitAuPlanning(avec({ statutCandidature: null, responsableDEquipe: true }))).toBe(true)
  })

  it('laisse passer un organisateur affecté à une équipe', () => {
    // C'est la condition de « mes créneaux » : il en a, donc il peut en ouvrir le détail.
    expect(aDroitAuPlanning(avec({ statutCandidature: null, equipesOrganisateur: 2 }))).toBe(true)
  })

  it('ne se contente pas d’un droit quand le planning reste caché', () => {
    // La visibilité du planning commande, quel que soit le titre : les deux surfaces l'exigent.
    expect(
      aDroitAuPlanning(
        avec({ planningVisible: false, statutCandidature: null, equipesOrganisateur: 2 })
      )
    ).toBe(false)
  })
})
