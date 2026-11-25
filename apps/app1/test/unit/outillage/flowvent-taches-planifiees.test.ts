import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { creerVerrouDeTaches } from '../../../../../layers/core/server/socle/planificateur'

/**
 * Les tâches planifiées de Flowvent : celles du layer bénévoles (rappels de créneau, échanges
 * expirés), lancées par `apps/app2/server/plugins/planificateur.ts`.
 *
 * Un nom de tâche erroné dans le catalogue ne fait rien échouer au démarrage : `runTask` lève à
 * chaque passage, l'erreur est journalisée (c'est voulu, pour ne pas arrêter les autres), et les
 * rappels ne partent jamais — en silence. Le premier cas le ferme.
 *
 * ⚠️ Le catalogue et la configuration d'app2 sont LUS COMME DU TEXTE, pas importés : un fichier
 * TypeScript d'app2 ne se transforme qu'avec `apps/app2/.nuxt/tsconfig.json`, que la CI ne génère
 * pas (elle ne prépare qu'app1). Un import passait en local et faisait tomber la CI.
 */
const DEPOT = resolve(process.cwd(), '..', '..')
const lire = (chemin: string) => readFileSync(join(DEPOT, chemin), 'utf8')

describe('Flowvent — tâches planifiées', () => {
  it('chaque tâche du catalogue existe dans le layer bénévoles', () => {
    const noms = [
      ...lire('apps/app2/server/utils/taches-planifiees.ts').matchAll(/name:\s*'([^']+)'/g),
    ].map((m) => m[1]!)
    expect(noms.length).toBeGreaterThan(0)
    const absentes = noms.filter(
      (nom) => !existsSync(join(DEPOT, 'layers/volunteers/server/tasks', `${nom}.ts`))
    )
    expect(absentes).toEqual([])
  })

  it('les tâches Nitro sont activées dans la configuration de Flowvent', () => {
    // Sans `experimental.tasks`, Nitro n'enregistre pas les tâches et `runTask` lève à chaque fois.
    expect(lire('apps/app2/nuxt.config.ts')).toMatch(/experimental:\s*\{\s*tasks:\s*true\s*\}/)
  })

  it('le plugin lance les tâches derrière le verrou partagé', () => {
    const plugin = lire('apps/app2/server/plugins/planificateur.ts')
    expect(plugin).toContain('creerVerrouDeTaches')
    expect(plugin).toMatch(/onTick:\s*\(\)\s*=>\s*lancerSansRecouvrement\(/)
  })
})

describe('le verrou de tâches (layers/core)', () => {
  const lancer = vi.fn()
  let verrou: ReturnType<typeof creerVerrouDeTaches>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    verrou = creerVerrouDeTaches(lancer)
  })

  it('ignore un passage quand le précédent n’est pas fini', async () => {
    let libererLePremier!: () => void
    lancer.mockImplementation(() => new Promise<void>((resoudre) => (libererLePremier = resoudre)))

    const premier = verrou.lancerSansRecouvrement('volunteer-reminders')
    await vi.waitFor(() => expect(lancer).toHaveBeenCalledTimes(1))

    await verrou.lancerSansRecouvrement('volunteer-reminders')
    expect(lancer).toHaveBeenCalledTimes(1)

    libererLePremier()
    await premier
  })

  it('une tâche qui lève ne bloque pas la suivante', async () => {
    lancer.mockRejectedValueOnce(new Error('panne')).mockResolvedValueOnce(undefined)

    await verrou.lancerSansRecouvrement('volunteer-reminders')
    await verrou.lancerSansRecouvrement('volunteer-reminders')

    expect(lancer).toHaveBeenCalledTimes(2)
    expect(verrou.enCours.size).toBe(0)
  })
})
