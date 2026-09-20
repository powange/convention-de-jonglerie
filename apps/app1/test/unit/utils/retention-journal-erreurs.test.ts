import { describe, expect, it } from 'vitest'

import {
  criteresDePurge,
  RETENTION_PAR_DEFAUT,
  type FenetresDeRetention,
} from '../../../shared/utils/retention-journal-erreurs'

/**
 * La rétention du journal d'erreurs.
 *
 * Ce que ces tests protègent est une suppression **définitive**. La règle était écrite deux fois
 * — le bouton de l'écran d'administration et la tâche de nuit — et n'avait aucun test : une
 * erreur de signe ou une fenêtre inversée aurait effacé en silence ce qu'elle devait garder, et
 * personne ne l'aurait su, puisque ce qui disparaît ne laisse par définition aucune trace.
 */

const MIDI = new Date('2026-09-20T12:00:00Z')
const JOUR = 24 * 60 * 60 * 1000

describe('criteresDePurge', () => {
  it('garde plus longtemps ce que personne n’a regardé', () => {
    // Le cœur de la règle. Une erreur résolue a été lue, comprise, corrigée ; une erreur non
    // résolue est celle qu'on voudra retrouver le jour où la panne revient.
    expect(RETENTION_PAR_DEFAUT.nonResolues).toBeGreaterThan(RETENTION_PAR_DEFAUT.resolues)
  })

  it('date les résolues depuis leur RÉSOLUTION', () => {
    // Et non depuis leur apparition : ce qui date une erreur traitée, c'est le moment où
    // quelqu'un s'en est occupé. La dater autrement supprimerait une erreur résolue hier au
    // motif qu'elle était survenue il y a deux mois.
    const { resolues } = criteresDePurge(MIDI)
    expect(resolues.resolved).toBe(true)
    expect(resolues.resolvedAt.lt.toISOString()).toBe(
      new Date(MIDI.getTime() - RETENTION_PAR_DEFAUT.resolues * JOUR).toISOString()
    )
    expect(resolues).not.toHaveProperty('createdAt')
  })

  it('date les non résolues depuis leur APPARITION', () => {
    // Elles n'ont pas de résolution à dater.
    const { nonResolues } = criteresDePurge(MIDI)
    expect(nonResolues.resolved).toBe(false)
    expect(nonResolues.createdAt.lt.toISOString()).toBe(
      new Date(MIDI.getTime() - RETENTION_PAR_DEFAUT.nonResolues * JOUR).toISOString()
    )
    expect(nonResolues).not.toHaveProperty('resolvedAt')
  })

  it('sépare strictement les deux familles', () => {
    // Un critère qui ne porterait pas `resolved` emporterait les deux d'un coup, à la fenêtre la
    // plus courte. C'est l'erreur la plus coûteuse possible ici, et la plus facile à commettre.
    const { resolues, nonResolues } = criteresDePurge(MIDI)
    expect(resolues.resolved).not.toBe(nonResolues.resolved)
  })

  it('recule dans le passé, jamais dans le futur', () => {
    // Une erreur de signe purgerait tout ce qui est plus ancien que dans trente jours — donc la
    // table entière, du premier coup.
    const { resolues, nonResolues } = criteresDePurge(MIDI)
    expect(resolues.resolvedAt.lt.getTime()).toBeLessThan(MIDI.getTime())
    expect(nonResolues.createdAt.lt.getTime()).toBeLessThan(MIDI.getTime())
  })

  it('accepte des fenêtres différentes sans que rien ne soit codé en dur', () => {
    const fenetres: FenetresDeRetention = { resolues: 7, nonResolues: 365 }
    const criteres = criteresDePurge(MIDI, fenetres)
    expect(criteres.resolues.resolvedAt.lt.toISOString()).toBe('2026-09-13T12:00:00.000Z')
    expect(criteres.nonResolues.createdAt.lt.toISOString()).toBe('2025-09-20T12:00:00.000Z')
  })

  it('suit l’instant qu’on lui donne', () => {
    // L'instant est un paramètre, et non `new Date()` lu à l'intérieur : un test qui dépendrait
    // de l'heure courante ne prouverait rien.
    const plusTard = new Date(MIDI.getTime() + 10 * JOUR)
    const a = criteresDePurge(MIDI).resolues.resolvedAt.lt.getTime()
    const b = criteresDePurge(plusTard).resolues.resolvedAt.lt.getTime()
    expect(b - a).toBe(10 * JOUR)
  })

  it('ne rend pas de date invalide', () => {
    const criteres = criteresDePurge(MIDI)
    expect(Number.isNaN(criteres.resolues.resolvedAt.lt.getTime())).toBe(false)
    expect(Number.isNaN(criteres.nonResolues.createdAt.lt.getTime())).toBe(false)
  })
})
