import { describe, it, expect, vi } from 'vitest'

import { appelerAvecSchemaJsonOuSansLui } from '../../../server/utils/appel-avec-schema-json'
import { ERREUR_EXPIRATION } from '../../../server/utils/fetch-helpers'

const FORMAT = { type: 'json_schema', json_schema: { name: 'import_edition' } }

/** La fabrique de corps, telle que le point d'API l'écrit. */
const corps = (serveur: { base: string }, format: unknown) => ({
  method: 'POST',
  body: JSON.stringify({ model: serveur.base, ...(format ? { response_format: format } : {}) }),
})

/** Ce que l'appelant a reçu, en rejouant sa fabrique. */
const corpsRecu = (appeler: ReturnType<typeof vi.fn>, essai: number) =>
  JSON.parse(appeler.mock.calls[essai][0]({ base: 'm' }).body)

describe('appelerAvecSchemaJsonOuSansLui', () => {
  it('impose le schéma au PREMIER essai', async () => {
    const appeler = vi.fn().mockResolvedValue('ok')

    await appelerAvecSchemaJsonOuSansLui(appeler, corps, FORMAT, () => {})

    expect(appeler).toHaveBeenCalledTimes(1)
    // L'assertion qui prouve le câblage : sans elle, un `response_format` oublié passerait.
    expect(corpsRecu(appeler, 0).response_format).toEqual(FORMAT)
  })

  it('réessaie SANS le schéma quand le serveur le refuse', async () => {
    const appeler = vi
      .fn()
      .mockRejectedValueOnce(new Error('HTTP 400 : unsupported response_format'))
      .mockResolvedValueOnce('secours')

    const resultat = await appelerAvecSchemaJsonOuSansLui(appeler, corps, FORMAT, () => {})

    expect(resultat).toBe('secours')
    expect(appeler).toHaveBeenCalledTimes(2)
    // Le second essai est la requête d'avant ce dispositif : aucune contrainte.
    expect(corpsRecu(appeler, 1)).not.toHaveProperty('response_format')
    expect(corpsRecu(appeler, 1).model).toBe('m')
  })

  it('dit pourquoi il se replie', async () => {
    // Sans journal, un repli permanent serait invisible : on croirait le schéma appliqué.
    const journal = vi.fn()
    const appeler = vi.fn().mockRejectedValueOnce(new Error('refus')).mockResolvedValueOnce('ok')

    await appelerAvecSchemaJsonOuSansLui(appeler, corps, FORMAT, journal)

    expect(journal).toHaveBeenCalledTimes(1)
    expect(journal.mock.calls[0][0]).toContain('refus')
  })

  it('NE réessaie PAS sur une expiration', async () => {
    /*
     * Une expiration n'est pas un refus du schéma : le serveur a répondu, trop lentement.
     * Réessayer doublerait l'attente pour le même verdict.
     */
    const appeler = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('expiré'), { [ERREUR_EXPIRATION]: true }))

    await expect(appelerAvecSchemaJsonOuSansLui(appeler, corps, FORMAT, () => {})).rejects.toThrow(
      'expiré'
    )
    expect(appeler).toHaveBeenCalledTimes(1)
  })

  it('laisse remonter l’échec quand le second essai échoue aussi', async () => {
    // Sans quoi l'appelant croirait à un succès là où rien n'a abouti.
    const appeler = vi.fn().mockRejectedValue(new Error('injoignable'))

    await expect(appelerAvecSchemaJsonOuSansLui(appeler, corps, FORMAT, () => {})).rejects.toThrow(
      'injoignable'
    )
    expect(appeler).toHaveBeenCalledTimes(2)
  })
})
