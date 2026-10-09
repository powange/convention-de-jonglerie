import { mountSuspended, registerEndpoint, mockNuxtImport } from '@nuxt/test-utils/runtime'
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

/**
 * Les toasts émis, observés par le mock Nuxt de `useToast`.
 *
 * ⚠️ Patcher `.add` sur un `useToast()` obtenu dans le composant de test NE MARCHE PAS :
 * `useToast` rend une instance par appel, donc celle du composable n'est pas celle qu'on patche.
 * Les trois premiers essais ont rendu `undefined` pour cette seule raison. `mockNuxtImport` est le
 * motif employé partout ailleurs dans le dépôt.
 */
const toasts: { title?: string; description?: string }[] = []
mockNuxtImport('useToast', () => () => ({
  add: (o: any) => {
    toasts.push({ title: o?.title, description: o?.description })
  },
}))

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

/**
 * Le message de succès, quand il DÉPEND du résultat ou de l'état au moment de l'appel.
 *
 * ## ⚠️ Pourquoi la forme objet ne suffisait pas
 *
 * `successMessage` était un objet, déstructuré une seule fois au `setup`. Un titre conditionnel
 * écrit sous cette forme se figeait donc sur la valeur qu'il avait au montage — et comme c'est
 * indétectable à la lecture, sept écrans de gestion gardaient leur `toast.add` à la main plutôt
 * que de risquer un message faux : « marqué comme rendu » / « marqué comme non rendu »,
 * « responsable ajouté » / « responsable retiré ». En gardant le toast, ils gardaient aussi le
 * `try/catch` et le booléen de chargement — c'est-à-dire tout ce que le composable devait leur
 * épargner.
 *
 * La forme fonction est résolue À L'APPEL. C'est ce que ces tests figent.
 */
describe('useApiAction — message de succès dynamique', () => {
  const monterAvecMessage = async (successMessage: any) => {
    let expose: ReturnType<typeof useApiAction> | undefined
    await mountSuspended(
      defineComponent({
        setup() {
          expose = useApiAction('/api/test/avec-corps', { method: 'POST', successMessage })
          return () => h('div')
        },
      })
    )
    return expose!
  }

  beforeEach(() => {
    toasts.length = 0
  })

  it('accepte encore la forme objet', async () => {
    const { execute } = await monterAvecMessage({ title: 'Fixe' })

    await execute()

    expect(toasts.at(-1)?.title).toBe('Fixe')
  })

  it('résout la forme fonction à l’appel, et lui passe la charge utile', async () => {
    const { execute } = await monterAvecMessage((r: any) => ({
      title: `Objet ${r.id}`,
      description: 'déballé',
    }))

    await execute()

    // La charge utile est DÉBALLÉE : `{ id: 7 }` et non `{ success, data, message }`.
    expect(toasts.at(-1)).toEqual({ title: 'Objet 7', description: 'déballé' })
  })

  it('rend un titre DIFFÉRENT à deux appels quand l’état a changé entre-temps', async () => {
    /*
     * Le test qui compte, et que la forme objet ne pouvait pas passer. Sans lui, un
     * `successMessage` figé au montage serait vert sur les deux tests ci-dessus : le premier
     * appel donnerait le bon titre, et c'est le SECOND qui mentirait.
     */
    let rendu = false
    const { execute } = await monterAvecMessage(() => ({
      title: rendu ? 'marqué comme rendu' : 'marqué comme non rendu',
    }))

    await execute()
    expect(toasts.at(-1)?.title).toBe('marqué comme non rendu')

    rendu = true
    await execute()
    expect(toasts.at(-1)?.title).toBe('marqué comme rendu')
  })
})
