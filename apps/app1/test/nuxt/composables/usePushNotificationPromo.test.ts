import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'

import { usePushNotificationPromo } from '../../../app/composables/usePushNotificationPromo'

/**
 * La session est hydratée de façon ASYNCHRONE : le plugin auth.client lance `/api/session/me`
 * sans l'attendre. Au montage d'un composant, l'utilisateur n'est donc pas encore authentifié.
 *
 * La vérification d'abonnement était lancée à ce moment précis : elle sortait aussitôt faute de
 * session, `isSubscribed` restait à false et n'était plus jamais réévalué. Des utilisateurs
 * pourtant abonnés se voyaient proposer d'activer les notifications — et comme `markAsEnabled()`
 * ne posait pas `lastDismissed`, ceux qui venaient d'ACCEPTER étaient relancés à chaque session,
 * là où ceux qui refusaient bénéficiaient d'une trêve de 7 jours.
 *
 * Ces tests verrouillent les deux moitiés du correctif.
 */

// Store d'authentification simulé : son état bascule APRÈS le montage, comme en conditions
// réelles où la session arrive au terme d'un aller-retour réseau.
const authState = reactive({ connecte: false })
vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return authState.connecte
    },
  }),
}))

// Compte les interrogations réelles de l'endpoint : c'est le seul moyen fiable de vérifier
// QUAND la vérification a lieu, `$fetch` étant auto-importé et non stubbable globalement.
const appels = { nombre: 0 }
registerEndpoint('/api/notifications/fcm/check', () => {
  appels.nombre++
  return { data: { hasActiveToken: true, tokenCount: 1 } }
})

// Les composants montés doivent être démontés entre les tests : leur watcher sur le store
// d'authentification, partagé au niveau module, réagirait sinon aux tests suivants.
const montes: { unmount: () => void }[] = []

/** Monte un composant minimal qui se contente d'utiliser le composable. */
async function monter() {
  let api: ReturnType<typeof usePushNotificationPromo> | null = null
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        api = usePushNotificationPromo()
        return () => h('div')
      },
    })
  )
  montes.push(wrapper)
  return api!
}

describe('usePushNotificationPromo', () => {
  afterEach(() => {
    for (const wrapper of montes.splice(0)) wrapper.unmount()
  })

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    authState.connecte = false
    appels.nombre = 0
    // L'environnement de test n'expose pas l'API Notification du navigateur.
    vi.stubGlobal('Notification', { permission: 'default' })
  })

  it("n'interroge pas le serveur tant que la session n'est pas hydratée", async () => {
    await monter()
    await nextTick()

    // Sans session, la question n'a pas de sens : la réponse serait un faux négatif.
    expect(appels.nombre).toBe(0)
  })

  it("vérifie l'abonnement dès que la session arrive, et pas seulement au montage", async () => {
    const api = await monter()
    await nextTick()

    // La session arrive après coup, comme en production.
    authState.connecte = true
    await nextTick()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(appels.nombre, "l'abonnement doit être vérifié une fois la session disponible").toBe(1)

    // L'utilisateur est abonné : il ne doit pas être candidat à la promo.
    expect(api.isSubscribed.value).toBe(true)
    expect(api.checkShouldShow()).toBe(false)
  })

  it('accorde une trêve à qui vient d’activer les notifications', async () => {
    const api = await monter()

    api.markAsEnabled()

    // Sans `lastDismissed`, seuls ceux qui REFUSENT étaient tranquilles 7 jours ; ceux qui
    // acceptaient revoyaient la modale à chaque session dès que la détection échouait.
    const saved = JSON.parse(localStorage.getItem('push-notification-promo') || '{}')
    expect(saved.lastDismissed, 'markAsEnabled() doit poser lastDismissed').toEqual(
      expect.any(Number)
    )
  })

  it('accorde la même trêve à qui refuse', async () => {
    const api = await monter()

    api.dismiss()

    const saved = JSON.parse(localStorage.getItem('push-notification-promo') || '{}')
    expect(saved.lastDismissed).toEqual(expect.any(Number))
  })
})
