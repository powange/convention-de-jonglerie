import { describe, expect, it } from 'vitest'

import {
  normaliserPhases,
  phasesDuBenevole,
  phasesSeRencontrent,
} from '../../../shared/utils/phases-edition'

/**
 * À quelles PHASES d'une édition un article à remettre s'applique.
 *
 * ⚠️ DEMANDÉ PAR L'UTILISATEUR : « on devrait pouvoir remettre des articles aux bénévoles qui sont
 * seulement à l'événement et pas de montage ou inversement ».
 *
 * 📍 Le vocabulaire est celui des repas (`VolunteerMeal.phases`), pas un nouveau : les deux
 * réglages répondent à la même question, et deux vocabulaires finiraient par diverger.
 */

describe('normaliserPhases', () => {
  it('garde les phases connues, dans un ordre fixe', () => {
    // L'ordre vient de la constante, pas de la saisie : deux associations identiques ne doivent
    // pas s'afficher différemment selon l'ordre où on a coché les cases.
    expect(normaliserPhases(['TEARDOWN', 'SETUP'])).toEqual(['SETUP', 'TEARDOWN'])
  })

  it('écarte l’inconnu, les doublons et ce qui n’est pas un tableau', () => {
    expect(normaliserPhases(['SETUP', 'SETUP', 'PIQUE_NIQUE', 42, null])).toEqual(['SETUP'])
    expect(normaliserPhases(null)).toEqual([])
    expect(normaliserPhases('SETUP')).toEqual([])
    /*
     * ⚠️ LE CAS QUI A FAILLI PASSER EN PRODUCTION. La migration de Prisma a rempli les lignes
     * existantes avec le JSON `null` — pas `[]`. Une seconde migration les a rattrapées, mais la
     * lecture doit tenir debout si une ligne y échappait : `null` se lit comme « aucune
     * restriction », jamais comme « aucune phase ».
     */
    expect(normaliserPhases(undefined)).toEqual([])
  })
})

describe('phasesDuBenevole', () => {
  it('🔬 traduit les disponibilités déclarées', () => {
    expect(
      phasesDuBenevole({
        eventAvailability: false,
        setupAvailability: true,
        teardownAvailability: false,
      })
    ).toEqual(['SETUP'])
    expect(
      phasesDuBenevole({
        eventAvailability: true,
        setupAvailability: false,
        teardownAvailability: true,
      })
    ).toEqual(['EVENT', 'TEARDOWN'])
  })

  it('🔬 compte `null` comme présent à l’événement', () => {
    /*
     * ⚠️ MÊME DISTINCTION QUE `benevolePresentSurPlace` : `null` veut dire « on ne lui a pas posé
     * la question » — la colonne est postérieure à ces candidatures —, `false` veut dire « il a
     * répondu non ». Les confondre priverait d'articles des bénévoles historiques.
     */
    expect(phasesDuBenevole({ eventAvailability: null })).toEqual(['EVENT'])
    expect(phasesDuBenevole({})).toEqual(['EVENT'])
  })

  it('ne rend rien sans candidature', () => {
    expect(phasesDuBenevole(null)).toEqual([])
    expect(phasesDuBenevole(undefined)).toEqual([])
  })
})

describe('phasesSeRencontrent', () => {
  it('🔬 une sélection VIDE ne restreint rien', () => {
    /*
     * ⚠️ L'ASSERTION QUI PROTÈGE L'EXISTANT. Toutes les associations créées avant ce lot ont une
     * liste vide. Si « vide » voulait dire « aucune phase », elles cesseraient toutes d'être
     * remises — sur toutes les éditions, sans erreur et sans trace.
     */
    expect(phasesSeRencontrent([], ['EVENT'])).toBe(true)
    expect(phasesSeRencontrent([], [])).toBe(true)
  })

  it('🔬 un seul chevauchement suffit', () => {
    /*
     * 📍 LE CHOIX QUI PORTE LA FONCTIONNALITÉ. Un article réservé au montage est remis à quelqu'un
     * présent au montage ET à l'événement. Exiger la présence à TOUTES les phases de l'article
     * serait surprenant : on choisit des phases pour viser une population, pas pour ajouter une
     * condition d'exclusion.
     */
    expect(phasesSeRencontrent(['SETUP'], ['SETUP', 'EVENT'])).toBe(true)
    expect(phasesSeRencontrent(['SETUP', 'TEARDOWN'], ['EVENT', 'TEARDOWN'])).toBe(true)
  })

  it('🔬 sans chevauchement, l’article n’est pas remis', () => {
    // Le cas de la demande : un article « événement seulement » ne va pas à qui ne vient qu'au
    // montage.
    expect(phasesSeRencontrent(['EVENT'], ['SETUP'])).toBe(false)
    expect(phasesSeRencontrent(['SETUP'], ['EVENT'])).toBe(false)
    // Un bénévole sans aucune phase ne reçoit rien d'un article qui en exige une.
    expect(phasesSeRencontrent(['EVENT'], [])).toBe(false)
  })
})
