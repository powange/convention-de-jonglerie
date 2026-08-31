import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'

import { useApiAction, SUCCES_SANS_CONTENU } from '../../../app/composables/useApiAction'

/**
 * Le contrat que ces tests figent : **`execute` rend `null` en cas d'échec, et uniquement là**.
 *
 * Il ne l'a pas toujours tenu. `useApiAction` déballe les réponses `{ success, data, message }` et
 * rend `data` ; les 46 endpoints répondant `createSuccessResponse(null, …)` faisaient donc rendre
 * `null` à un appel parfaitement réussi — indiscernable d'un échec. Le défaut s'est vu sur la carte
 * du site : le toast annonçait la suppression d'un point de repère, mais l'appelant, croyant à un
 * échec, ne retirait jamais le calque.
 */

const etat = { echoue: false }

registerEndpoint('/api/test/corps-vide', {
  method: 'POST',
  handler: () => {
    if (etat.echoue) throw new Error('boum')
    return { success: true, data: null, message: 'Fait' }
  },
})

registerEndpoint('/api/test/avec-corps', {
  method: 'POST',
  handler: () => ({ success: true, data: { id: 7 }, message: 'Fait' }),
})

const monter = async (endpoint: string) => {
  let expose: ReturnType<typeof useApiAction> | undefined
  await mountSuspended(
    defineComponent({
      setup() {
        expose = useApiAction(endpoint, { method: 'POST', silent: true })
        return () => h('div')
      },
    })
  )
  return expose!
}

beforeEach(() => {
  etat.echoue = false
})

describe('useApiAction — succès sans contenu', () => {
  it('ne rend pas `null` quand le serveur a réussi sans rien renvoyer', async () => {
    const { execute, data } = await monter('/api/test/corps-vide')

    const resultat = await execute()

    expect(resultat).toBe(SUCCES_SANS_CONTENU)
    // La charge utile, elle, reste vide : c'est le retour qui porte le verdict, pas `data`.
    expect(data.value).toBeNull()
  })

  it('rend `null` quand le serveur a refusé', async () => {
    etat.echoue = true
    const { execute, error } = await monter('/api/test/corps-vide')

    expect(await execute()).toBeNull()
    expect(error.value).not.toBeNull()
  })

  it('rend la charge utile intacte quand il y en a une', async () => {
    const { execute } = await monter('/api/test/avec-corps')

    expect(await execute()).toEqual({ id: 7 })
  })
})
