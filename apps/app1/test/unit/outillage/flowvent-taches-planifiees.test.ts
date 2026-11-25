import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TACHES_PLANIFIEES } from '../../../../app2/server/utils/taches-planifiees'

const taches = vi.hoisted(() => ({ runTask: vi.fn() }))

// `runTask` et `defineNitroPlugin` sont des globales de Nitro (cf. le test du planificateur
// d'app1) : sans elles, l'import échoue, ou le verrou lancerait les vraies tâches.
vi.stubGlobal('runTask', taches.runTask)
vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)

const { _pourLesTests } = await import('../../../../app2/server/plugins/planificateur')

/**
 * Les tâches planifiées de Flowvent : celles du layer bénévoles (rappels de créneau, échanges
 * expirés), lancées par `apps/app2/server/plugins/planificateur.ts`.
 *
 * Un nom de tâche erroné dans le catalogue ne fait rien échouer au démarrage : `runTask` lève à
 * chaque passage, l'erreur est journalisée (c'est voulu, pour ne pas arrêter les autres), et les
 * rappels ne partent jamais — en silence. Le premier cas le ferme.
 */
const DEPOT = resolve(process.cwd(), '..', '..')

describe('Flowvent — tâches planifiées', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    _pourLesTests.enCours.clear()
  })

  it('chaque tâche du catalogue existe dans le layer bénévoles', () => {
    expect(TACHES_PLANIFIEES.length).toBeGreaterThan(0)
    const absentes = TACHES_PLANIFIEES.map((t) => t.name).filter(
      (nom) => !existsSync(join(DEPOT, 'layers/volunteers/server/tasks', `${nom}.ts`))
    )
    expect(absentes).toEqual([])
  })

  it('les tâches Nitro sont activées dans la configuration de Flowvent', () => {
    // Sans `experimental.tasks`, Nitro n'enregistre pas les tâches et `runTask` lève à chaque fois.
    const config = readFileSync(join(DEPOT, 'apps/app2/nuxt.config.ts'), 'utf8')
    expect(config).toMatch(/experimental:\s*\{\s*tasks:\s*true\s*\}/)
  })

  it('ignore un passage quand le précédent n’est pas fini', async () => {
    let libererLePremier!: () => void
    taches.runTask.mockImplementation(
      () => new Promise<void>((resoudre) => (libererLePremier = resoudre))
    )

    const premier = _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
    await vi.waitFor(() => expect(taches.runTask).toHaveBeenCalledTimes(1))

    await _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
    expect(taches.runTask).toHaveBeenCalledTimes(1)

    libererLePremier()
    await premier
  })

  it('une tâche qui lève ne bloque pas la suivante', async () => {
    taches.runTask.mockRejectedValueOnce(new Error('panne')).mockResolvedValueOnce(undefined)

    await _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
    await _pourLesTests.lancerSansRecouvrement('volunteer-reminders')

    expect(taches.runTask).toHaveBeenCalledTimes(2)
    expect(_pourLesTests.enCours.size).toBe(0)
  })
})
