import { describe, expect, it } from 'vitest'

import { createTask, perdueAuRedemarrage } from '../../../server/utils/async-tasks'

/**
 * Les tâches de génération IA vivent en mémoire de processus : un redéploiement les efface.
 *
 * L'écran demandait alors son identifiant et recevait « Tâche non trouvée ou expirée » — le même
 * message que pour un identifiant inventé. L'administrateur croyait s'être trompé, alors que le
 * serveur venait de perdre un travail déjà payé, jusqu'à douze minutes de génération par agent.
 *
 * On ne conserve rien de plus — décision prise le 22/09/2026 : pas de table, pas de migration.
 * Mais on dit désormais POURQUOI, et cela se déduit de l'identifiant lui-même, qui porte son
 * horodatage.
 */
describe('perdueAuRedemarrage', () => {
  it('reconnaît une tâche créée avant le démarrage du processus', () => {
    // Un identifiant daté de l'an dernier ne peut venir que d'un processus précédent.
    const ancienne = `task_${Date.parse('2025-01-01T00:00:00Z')}_abc123def`
    expect(perdueAuRedemarrage(ancienne)).toBe(true)
  })

  it('ne réclame rien pour une tâche de ce processus-ci', () => {
    // Celle-ci vient d'être créée : si elle est introuvable, ce n'est pas un redémarrage.
    const tache = createTask()
    expect(perdueAuRedemarrage(tache.id)).toBe(false)
  })

  it('reste muet sur un identifiant qu’il ne sait pas lire', () => {
    // On ne peut alors rien affirmer, et le message générique vaut mieux qu'une explication
    // inventée. C'est la même règle que le reste du dépôt : ne pas deviner.
    for (const illisible of ['', 'task_', 'task_abc_def', 'n’importe quoi', 'task_-1_x']) {
      expect(perdueAuRedemarrage(illisible), illisible).toBe(false)
    }
  })

  it('lit l’horodatage à la bonne place dans l’identifiant', () => {
    // La forme est `task_<date>_<aléa>` : si elle change, ce test doit tomber plutôt que de
    // laisser le prédicat rendre silencieusement `false` pour tout le monde.
    const tache = createTask()
    const morceaux = tache.id.split('_')
    expect(morceaux[0]).toBe('task')
    expect(Number(morceaux[1])).toBeGreaterThan(0)
    expect(morceaux).toHaveLength(3)
  })
})
