import { describe, it, expect, vi } from 'vitest'

import {
  synchronisationUnique,
  synchronisationsEnCours,
} from '../../../../../layers/ticketing/server/utils/synchronisation-unique'

/** Une tâche qu'on déclenche à la main, pour observer ce qui se passe pendant son exécution. */
const tacheControlee = <T>(valeur: T) => {
  let terminer!: () => void
  const promesse = new Promise<void>((r) => {
    terminer = r
  })
  const travail = vi.fn(async () => {
    await promesse
    return valeur
  })
  return { travail, terminer }
}

describe('synchronisationUnique', () => {
  // Le cœur du correctif : deux appels concurrents écrivaient les mêmes lignes en parallèle et
  // se bloquaient jusqu'au « Lock wait timeout exceeded » de MySQL.
  it('n’exécute qu’une fois pour des appels concurrents sur la même clé', async () => {
    const { travail, terminer } = tacheControlee('résultat')

    const premier = synchronisationUnique('edition-1', travail)
    const second = synchronisationUnique('edition-1', travail)

    terminer()
    expect(await premier).toBe('résultat')
    expect(await second).toBe('résultat')
    expect(travail).toHaveBeenCalledTimes(1)
  })

  it('laisse deux éditions différentes travailler en parallèle', async () => {
    const a = tacheControlee('a')
    const b = tacheControlee('b')

    const pa = synchronisationUnique('edition-1', a.travail)
    const pb = synchronisationUnique('edition-2', b.travail)

    a.terminer()
    b.terminer()
    expect(await pa).toBe('a')
    expect(await pb).toBe('b')
    expect(a.travail).toHaveBeenCalledTimes(1)
    expect(b.travail).toHaveBeenCalledTimes(1)
  })

  it('relance une synchronisation une fois la précédente terminée', async () => {
    const premier = tacheControlee('un')
    const p1 = synchronisationUnique('edition-1', premier.travail)
    premier.terminer()
    await p1

    const second = tacheControlee('deux')
    const p2 = synchronisationUnique('edition-1', second.travail)
    second.terminer()

    expect(await p2).toBe('deux')
    expect(second.travail).toHaveBeenCalledTimes(1)
  })

  // Sans libération en cas d'échec, une seule erreur condamnerait la synchronisation de cette
  // édition jusqu'au redémarrage du serveur.
  it('libère la clé même quand la synchronisation échoue', async () => {
    await expect(
      synchronisationUnique('edition-1', async () => {
        throw new Error('HelloAsso injoignable')
      })
    ).rejects.toThrow('HelloAsso injoignable')

    expect(synchronisationsEnCours()).toBe(0)

    const apres = await synchronisationUnique('edition-1', async () => 'ça repart')
    expect(apres).toBe('ça repart')
  })

  it('propage l’échec aux appels concurrents', async () => {
    const travail = vi.fn(async () => {
      throw new Error('boum')
    })

    const premier = synchronisationUnique('edition-1', travail)
    const second = synchronisationUnique('edition-1', travail)

    await expect(premier).rejects.toThrow('boum')
    await expect(second).rejects.toThrow('boum')
    expect(travail).toHaveBeenCalledTimes(1)
  })
})
