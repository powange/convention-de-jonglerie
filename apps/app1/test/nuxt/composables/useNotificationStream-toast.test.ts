import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useNotificationStream } from '../../../app/composables/useNotificationStream'

/**
 * Le toast d'une notification temps réel parle l'API de Nuxt UI v4.
 *
 * ⚠️ CE QUI NE MARCHAIT PAS, et pourquoi rien ne le signalait. L'appel employait encore l'API de la
 * v2 : `timeout` au lieu de `duration`, et `click` au lieu de `onClick` sur l'action. Nuxt UI
 * IGNORE les champs qu'il ne connaît pas — pas d'avertissement, pas d'erreur de typage.
 *
 * Deux conséquences, très inégales :
 *
 * 1. `timeout` ignoré → le toast durait 5 s par HASARD, la valeur par défaut coïncidant. Invisible.
 * 2. `click` ignoré → LE BOUTON D'ACTION NE FAISAIT RIEN. On cliquait « Voir » sur une notification
 *    et la page ne bougeait pas. Aucune trace, aucune erreur en console : le bouton s'affichait,
 *    se survolait, s'enfonçait, et n'allait nulle part.
 *
 * 🔬 LE FLUX EST EXERCÉ POUR DE VRAI. `EventSource` est remplacé par un double qui retient ses
 * écouteurs : on peut alors déclencher l'événement `notification` exactement comme le serveur le
 * ferait, et observer la charge réellement passée à `toast.add`. C'est le seul moyen de mesurer le
 * NOM des champs — une assertion sur le comportement du toast mesurerait Nuxt UI, pas notre appel.
 */

/*
 * ⚠️ `mockNuxtImport` ET NON `vi.mock('#imports')`. Deux raisons, l'une et l'autre vérifiées ici :
 * `test/setup.ts` remplace déjà `#imports` en entier et un second mock efface ses stubs ; et
 * `useToast` est l'auto-import de Nuxt UI, qui ne passe pas par `#imports` — mon premier essai
 * n'interceptait donc RIEN, le vrai toast s'ajoutait ailleurs, et les cinq tests lisaient un
 * tableau vide. Un mock qui ne s'applique pas ne se signale pas.
 */
const toastsAjoutes = vi.hoisted(() => [] as any[])

mockNuxtImport('useToast', () => () => ({
  add: (charge: any) => {
    toastsAjoutes.push(charge)
    return charge
  },
  remove: () => {},
  update: () => {},
  clear: () => {},
  toasts: [],
}))

/** Double d'`EventSource` qui retient ses écouteurs au lieu d'ouvrir une connexion. */
class FluxFactice {
  static dernier: FluxFactice | null = null
  readyState = 1
  private ecouteurs = new Map<string, ((e: any) => void)[]>()

  constructor(public url: string) {
    FluxFactice.dernier = this
  }

  addEventListener(nom: string, fn: (e: any) => void) {
    const liste = this.ecouteurs.get(nom) ?? []
    liste.push(fn)
    this.ecouteurs.set(nom, liste)
  }

  removeEventListener() {}
  close() {}

  /** Déclenche un événement nommé, comme le ferait le serveur. */
  emettre(nom: string, donnees: unknown) {
    for (const fn of this.ecouteurs.get(nom) ?? []) {
      fn({ data: JSON.stringify(donnees) })
    }
  }
}

const notification = {
  id: 1,
  type: 'WARNING',
  title: 'Votre place a été retirée',
  message: 'Camille a retiré votre place sur le trajet depuis Lyon',
  actionUrl: '/editions/7/carpool',
  actionText: 'Chercher un autre trajet',
  isRead: false,
  createdAt: new Date().toISOString(),
}

describe('useNotificationStream — le toast d’une notification', () => {
  let montes: { unmount: () => void }[] = []
  let derniereApi: ReturnType<typeof useNotificationStream> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    toastsAjoutes.length = 0
    FluxFactice.dernier = null
    montes = []
    vi.stubGlobal('EventSource', FluxFactice as any)
    /*
     * Le toast n'apparaît que HORS de la page des notifications — sur celle-ci, la liste se met à
     * jour d'elle-même et un toast ferait doublon. On se place donc ailleurs.
     */
    window.history.replaceState({}, '', '/editions/7')
  })

  afterEach(() => {
    /*
     * ⚠️ `useNotificationStream` garde son état AU NIVEAU DU MODULE : `eventSource` et
     * `connectionStats` survivent au démontage. Sans cette déconnexion, le deuxième test trouvait
     * `isConnecting` encore à `true` — la connexion du premier n'ayant jamais reçu son événement
     * `connected` — et `connect()` sortait aussitôt : aucun flux créé, un `TypeError` sur `null`,
     * et quatre tests rouges pour une raison qui n'était pas la leur.
     */
    derniereApi?.disconnect()
    derniereApi = null
    while (montes.length) montes.pop()?.unmount()
    vi.unstubAllGlobals()
  })

  /** Monte un composant qui se connecte au flux, et rend son API. */
  const connecter = async () => {
    let api: ReturnType<typeof useNotificationStream> | null = null
    const composant = await mountSuspended(
      defineComponent({
        setup() {
          api = useNotificationStream()
          return () => h('div')
        },
      })
    )
    montes.push(composant)

    const authStore = useAuthStore()
    authStore.user = { id: 1, email: 'a@b.c', pseudo: 'test' } as any

    derniereApi = api!
    await api!.connect()
    return api!
  }

  it('passe `duration`, et non `timeout`', async () => {
    /*
     * `timeout` était ignoré, donc le toast durait 5 s par coïncidence. Le jour où l'on voudra
     * qu'un avertissement reste plus longtemps, le champ ignoré ne changerait rien — et le défaut
     * se découvrirait à ce moment-là, sur un autre sujet.
     */
    await connecter()
    FluxFactice.dernier!.emettre('notification', notification)

    expect(toastsAjoutes).toHaveLength(1)
    expect(toastsAjoutes[0].duration).toBe(5000)
    expect(toastsAjoutes[0]).not.toHaveProperty('timeout')
  })

  it('l’action porte `onClick`, et non `click`', async () => {
    // LE défaut visible : le bouton « Voir » ne faisait rien du tout.
    await connecter()
    FluxFactice.dernier!.emettre('notification', notification)

    const action = toastsAjoutes[0].actions[0]
    expect(typeof action.onClick).toBe('function')
    expect(action).not.toHaveProperty('click')
  })

  it('la couleur est SÉMANTIQUE, jamais un nom de teinte', async () => {
    /*
     * `red`, `amber`, `green` étaient ignorés en v4 : le toast s'affichait dans la couleur
     * PRIMAIRE, la même qu'un succès. Un avertissement avait l'aspect d'une bonne nouvelle.
     */
    await connecter()
    FluxFactice.dernier!.emettre('notification', notification)

    expect(toastsAjoutes[0].color).toBe('warning')
    expect(['error', 'warning', 'success', 'info', 'primary', 'secondary', 'neutral']).toContain(
      toastsAjoutes[0].color
    )
  })

  it('n’ajoute aucune action quand la notification n’a pas d’URL', async () => {
    // Un bouton sans destination serait le défaut d'origine sous une autre forme.
    await connecter()
    FluxFactice.dernier!.emettre('notification', { ...notification, actionUrl: null })

    expect(toastsAjoutes[0].actions).toBeUndefined()
  })

  it('n’affiche pas de toast SUR la page des notifications', async () => {
    // La liste s'y met à jour d'elle-même : un toast ferait doublon.
    window.history.replaceState({}, '', '/notifications')

    await connecter()
    FluxFactice.dernier!.emettre('notification', notification)

    expect(toastsAjoutes).toHaveLength(0)
  })
})
