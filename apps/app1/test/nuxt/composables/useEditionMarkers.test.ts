import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { useEditionMarkers } from '../../../app/composables/useEditionMarkers'

/**
 * Ce test tient à une subtilité qui a coûté un bug visible : `useApiAction` déballe les réponses
 * `{ success, data, message }` et rend `data`. Or l'API de suppression répond
 * `createSuccessResponse(null, …)` — son `execute` rend donc `null`, exactement comme un échec.
 *
 * L'appelant qui se fiait à cette valeur croyait à un échec après chaque suppression réussie : le
 * toast annonçait la suppression, mais le calque restait sur la carte. Le composable doit donc
 * rendre un booléen qui, lui, distingue les deux cas.
 *
 * Rien ne l'avait relevé : ni le lint, ni le typecheck, ni la suite de tests.
 */

const etat = { suppressionEchoue: false }

registerEndpoint('/api/editions/1/markers', () => ({
  success: true,
  data: {
    markers: [
      {
        id: 5,
        name: 'Accueil',
        description: null,
        latitude: 47,
        longitude: 2,
        markerTypes: [],
        color: null,
        order: 0,
        zoneId: null,
        createdAt: '',
        updatedAt: '',
      },
    ],
  },
}))

registerEndpoint('/api/editions/1/markers/5', {
  method: 'DELETE',
  handler: () => {
    if (etat.suppressionEchoue) throw new Error('boum')
    // La forme qui piégeait : un succès dont le corps utile est vide.
    return { success: true, data: null, message: 'Point de repère supprimé avec succès' }
  },
})

/** Le composable a besoin d'un contexte de composant : `useToast` et `useI18n` en dépendent. */
const monter = async () => {
  let expose: ReturnType<typeof useEditionMarkers> | undefined
  await mountSuspended(
    defineComponent({
      setup() {
        expose = useEditionMarkers(ref(1))
        return () => h('div')
      },
    })
  )
  return expose!
}

beforeEach(() => {
  etat.suppressionEchoue = false
})

describe('useEditionMarkers — suppression', () => {
  it('rend `true` et retire le point de la liste quand le serveur a supprimé', async () => {
    const { markers, fetchMarkers, deleteMarker } = await monter()
    await fetchMarkers()
    expect(markers.value.map((m) => m.id)).toEqual([5])

    const supprime = await deleteMarker(5)

    // Le cœur du garde-fou : `true`, alors que l'appel sous-jacent, lui, rend `null`.
    expect(supprime).toBe(true)
    expect(markers.value).toHaveLength(0)
  })

  it('rend `false` et garde le point quand le serveur a refusé', async () => {
    const { markers, fetchMarkers, deleteMarker } = await monter()
    await fetchMarkers()
    etat.suppressionEchoue = true

    const supprime = await deleteMarker(5)

    expect(supprime).toBe(false)
    expect(markers.value.map((m) => m.id)).toEqual([5])
  })
})
