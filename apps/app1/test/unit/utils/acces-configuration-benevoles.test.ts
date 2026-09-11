import { describe, expect, it } from 'vitest'

import {
  droitsSurLaConfiguration,
  type ContexteDeLecture,
} from '../../../../../layers/volunteers/server/utils/acces-configuration-benevoles'

/**
 * L'endpoint de configuration bénévole n'avait aucun contrôle : il rendait les réglages complets
 * ET le décompte des candidatures à tout compte connecté, même sur une édition dont la page de
 * bénévolat n'est pas publique. Les compteurs sont le vrai sujet — une convention qui prépare son
 * recrutement sans l'avoir annoncé laissait lire combien de gens avaient postulé et combien avaient
 * été écartés.
 */
const contexte = (champs: Partial<ContexteDeLecture> = {}): ContexteDeLecture => ({
  pagePublic: false,
  estGestionnaire: false,
  aUneCandidature: false,
  ...champs,
})

describe('droitsSurLaConfiguration', () => {
  it('ne montre rien à un simple curieux sur une édition fermée', () => {
    expect(droitsSurLaConfiguration(contexte())).toEqual({ reglages: false, compteurs: false })
  })

  it('montre les réglages à tous quand la page est publique', () => {
    expect(droitsSurLaConfiguration(contexte({ pagePublic: true })).reglages).toBe(true)
  })

  it('ne publie pas les compteurs au seul motif que la page est publique', () => {
    // Rendre la page visible n'est pas publier ses statistiques de recrutement. C'est la
    // distinction qui manquait, et la raison d'être de ce module.
    expect(droitsSurLaConfiguration(contexte({ pagePublic: true })).compteurs).toBe(false)
  })

  it('donne tout au gestionnaire, page publique ou non', () => {
    expect(droitsSurLaConfiguration(contexte({ estGestionnaire: true }))).toEqual({
      reglages: true,
      compteurs: true,
    })
    expect(droitsSurLaConfiguration(contexte({ estGestionnaire: true, pagePublic: true }))).toEqual(
      { reglages: true, compteurs: true }
    )
  })

  it('donne les réglages à qui a déposé une candidature, sans les compteurs', () => {
    // Quel que soit son statut — en attente ou refusée comprises : sans les questions posées,
    // l'écran « mes candidatures » ne sait plus afficher les réponses que la personne a données.
    expect(droitsSurLaConfiguration(contexte({ aUneCandidature: true }))).toEqual({
      reglages: true,
      compteurs: false,
    })
  })

  it('ne fait pas d’un candidat un gestionnaire', () => {
    const droits = droitsSurLaConfiguration(contexte({ aUneCandidature: true, pagePublic: true }))

    expect(droits.compteurs).toBe(false)
  })

  it('ne réserve les compteurs qu’à la gestion, dans toutes les combinaisons', () => {
    // Balayage exhaustif des huit situations : les compteurs suivent `estGestionnaire` et rien
    // d'autre. Une condition ajoutée par mégarde à cette règle ferait tomber ce test.
    for (const pagePublic of [false, true]) {
      for (const estGestionnaire of [false, true]) {
        for (const aUneCandidature of [false, true]) {
          const droits = droitsSurLaConfiguration({ pagePublic, estGestionnaire, aUneCandidature })

          expect(droits.compteurs).toBe(estGestionnaire)
          expect(droits.reglages).toBe(pagePublic || estGestionnaire || aUneCandidature)
        }
      }
    }
  })
})
