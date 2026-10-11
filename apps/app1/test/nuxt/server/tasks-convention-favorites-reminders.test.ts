import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnvoyer = vi.hoisted(() => vi.fn())

/*
 * ⚠️ `defineTask` EST UN AUTO-IMPORT DE NITRO, absent des tests : sans ce relais le fichier échoue
 * AU CHARGEMENT sur « defineTask is not defined », avant qu'aucun cas ne s'exécute. Et il faut
 * `vi.hoisted` — les imports sont remontés au-dessus du corps du module, donc une affectation
 * écrite plus bas arriverait trop tard. C'est la raison pour laquelle les tâches planifiées de ce
 * dépôt ont longtemps passé pour « intestables ».
 */
vi.hoisted(() => {
  ;(globalThis as any).defineTask = (definition: any) => definition
})

vi.mock('../../../server/utils/rappels-editions', () => ({
  envoyerLesRappelsDEdition: mockEnvoyer,
}))

import tache from '../../../server/tasks/convention-favorites-reminders'

/**
 * La tâche quotidienne des rappels d'édition — constat B4 de l'administration.
 *
 * ## Ce qui se vérifie ici, et pas dans le test de la règle
 *
 * La règle a ses huit cas à part. Deux choses lui sont propres :
 *
 * 1. **qu'elle l'appelle** — son corps était un `TODO` qui comptait sans rien créer. Un util juste
 *    et branché nulle part ne corrige rien, défaut payé cinq fois dans ce dépôt ;
 * 2. **la FORME de son retour**. Les compteurs étaient enveloppés dans `{ result: {...} }`, là où
 *    toutes les autres tâches les rendent au premier niveau. `getExecutionStats`, dans
 *    `/admin/crons`, parcourt les clés NUMÉRIQUES du premier niveau : il ne trouvait donc aucun
 *    nombre à afficher, et l'écran restait muet sur une tâche qui prétendait avoir travaillé.
 */
describe('tâche convention-favorites-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnvoyer.mockResolvedValue({ editionsProcessed: 2, notificationsSent: 5 })
  })

  it('⚠️ APPELLE VRAIMENT LA RÈGLE — son corps était un TODO', async () => {
    await tache.run({ payload: {}, context: {} } as any)

    expect(mockEnvoyer).toHaveBeenCalledTimes(1)
  })

  it('⚠️ REND SES COMPTEURS À PLAT, et non sous une clé `result`', async () => {
    const res: any = await tache.run({ payload: {}, context: {} } as any)

    expect(res).toMatchObject({
      success: true,
      editionsProcessed: 2,
      notificationsSent: 5,
    })
    // La clé qui empêchait l'écran d'afficher quoi que ce soit.
    expect(res).not.toHaveProperty('result')
    expect(typeof res.timestamp).toBe('string')
  })

  it('laisse remonter une panne au lieu de la maquiller en succès', async () => {
    /*
     * LE TÉMOIN. Un `catch` qui rendrait `success: true` est précisément ce que la tâche faisait
     * dans l'esprit : annoncer un travail qui n'a pas eu lieu. Le planificateur doit voir l'échec.
     */
    mockEnvoyer.mockRejectedValue(new Error('base indisponible'))

    await expect(tache.run({ payload: {}, context: {} } as any)).rejects.toThrow('indisponible')
  })
})
