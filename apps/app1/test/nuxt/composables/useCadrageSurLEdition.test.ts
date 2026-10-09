import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'

import { useCadrageSurLEdition } from '../../../app/composables/useCadrageSurLEdition'

/**
 * Recentrer sur le lieu de l'édition — sans jamais passer devant le contenu.
 *
 * ## Le défaut corrigé
 *
 * Les deux pages de carte lisaient leur centre une seule fois, au `setup` (`computed(…).value`),
 * alors que l'édition n'arrive qu'en `onMounted`. À froid — rechargement, arrivée par URL — la
 * carte s'ouvrait sur **[46.60, 1.89] au zoom 6**, c'est-à-dire la France entière, au moment même
 * où l'organisateur venait dessiner sa première zone.
 */
const monter = async (etat: {
  map?: unknown
  latitude?: number | null
  longitude?: number | null
  nombreDElements?: number
  cadrageDejaFait?: boolean
}) => {
  const refs = {
    map: ref<unknown>(etat.map ?? null),
    latitude: ref<number | null | undefined>(etat.latitude ?? undefined),
    longitude: ref<number | null | undefined>(etat.longitude ?? undefined),
    nombreDElements: ref(etat.nombreDElements ?? 0),
    cadrageDejaFait: ref(etat.cadrageDejaFait ?? false),
  }
  const setView = vi.fn()
  await mountSuspended(
    defineComponent({
      setup() {
        useCadrageSurLEdition({ ...refs, setView })
        return () => h('div')
      },
    })
  )
  return { ...refs, setView }
}

describe('useCadrageSurLEdition', () => {
  it('recentre dès que la carte ET le lieu sont connus', async () => {
    const { map, latitude, longitude, setView } = await monter({})

    // Rien tant qu'il manque l'un des deux : c'est exactement la fenêtre du défaut.
    expect(setView).not.toHaveBeenCalled()

    map.value = { nom: 'carte' }
    await nextTick()
    expect(setView, 'une carte sans lieu ne doit pas bouger').not.toHaveBeenCalled()

    latitude.value = 45.764
    longitude.value = 4.8357
    await nextTick()

    expect(setView).toHaveBeenCalledWith([45.764, 4.8357], 15)
  })

  it('NE RECENTRE PAS quand la carte porte déjà des éléments', async () => {
    /*
     * La règle qui compte : le contenu gagne sur l'adresse. `fitBoundsToItems` cadre sur ce qui
     * est dessiné, ce qui est toujours mieux qu'un point et un zoom devinés.
     */
    const { setView } = await monter({
      map: {},
      latitude: 45.764,
      longitude: 4.8357,
      nombreDElements: 3,
    })

    expect(setView).not.toHaveBeenCalled()
  })

  it('ne touche à rien si le cadrage a déjà eu lieu', async () => {
    const { setView } = await monter({
      map: {},
      latitude: 45.764,
      longitude: 4.8357,
      cadrageDejaFait: true,
    })

    expect(setView).not.toHaveBeenCalled()
  })

  it('⚠️ NE CONSOMME PAS le drapeau : un contenu tardif doit encore être cadré', async () => {
    /*
     * Le piège de ce correctif, et la raison d'être de ce test. Si le recentrage posait
     * `cadrageDejaFait = true`, les zones — qui arrivent TOUJOURS après, puisqu'elles viennent
     * d'une requête — ne seraient jamais recadrées. On aurait troqué « la France au zoom 6 »
     * contre « le bon terrain, mais sans voir les zones qu'on vient d'y dessiner ».
     */
    const { cadrageDejaFait, setView } = await monter({
      map: {},
      latitude: 45.764,
      longitude: 4.8357,
    })

    expect(setView).toHaveBeenCalledTimes(1)
    expect(cadrageDejaFait.value, 'le drapeau appartient aux pages, pas à ce composable').toBe(
      false
    )
  })

  it('ignore une latitude absente ou non numérique', async () => {
    // `null` est ce que rend la base pour une édition sans adresse géocodée.
    for (const latitude of [null, undefined, Number.NaN] as never[]) {
      const { setView } = await monter({ map: {}, latitude, longitude: 4.8357 })
      expect(setView).not.toHaveBeenCalled()
    }
  })
})
