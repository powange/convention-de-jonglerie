import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

/**
 * Le flux d'une conversation, et ce qu'il fait quand il tombe — constat B7.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Trois tentatives, puis l'abandon définitif. Passé la troisième, le composable posait un message
 * dans `streamStats.error`, que l'écran de la messagerie **ne lit pas** : rien n'était dit, ni à la
 * personne, ni aux autres. Or cette connexion **EST le signal de présence** — elle disparaissait
 * donc de la liste des présents pour le reste de la session. Une perte de wifi de quelques secondes
 * ou un déploiement suffisait.
 *
 * Le flux global des notifications, lui, remonte à cinq tentatives **et** se rétablit au retour de
 * l'onglet au premier plan. Celui-ci n'avait ni l'un ni l'autre.
 *
 * ## ⚠️ CE QUE LA FICHE D'AUDIT DISAIT DE FAUX
 *
 * Elle prescrivait un `?since=` pour rattraper les messages manqués, et parlait d'un
 * `lastMessageTime = new Date()` côté serveur. Ni l'un ni l'autre n'existe : depuis le passage au
 * flux global, ce flux-ci **ne porte aucun message** — il ne porte qu'un ping, et sa connexion vaut
 * présence. Le rattrapage ne peut donc pas passer par lui ; il passe par un rechargement de la
 * première page, déclenché par `reconnexionsApresPerte`.
 *
 * ## ⚠️⚠️ CE QU'IL FAUT POUR QUE CES CAS SOIENT NON CREUX
 *
 * Un faux `EventSource` **pilotable** : c'est lui qui décide quand la connexion s'ouvre et quand
 * elle tombe. Et des minuteurs simulés, parce que la reconnexion attend deux secondes puis double —
 * un test en temps réel durerait une minute, ou mesurerait un hasard.
 */
class FauxEventSource {
  static instances: FauxEventSource[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  fermee = false

  constructor(public url: string) {
    FauxEventSource.instances.push(this)
  }

  close() {
    this.fermee = true
  }

  /** La connexion s'établit, comme le ferait le navigateur. */
  ouvrir() {
    this.onopen?.()
  }

  /** La connexion tombe — réseau coupé, serveur redéployé. */
  tomber() {
    this.onerror?.(new Event('error'))
  }
}

vi.stubGlobal('EventSource', FauxEventSource as unknown as typeof EventSource)

import { useMessengerStream } from '../../../app/composables/useMessengerStream'

/** L'état de visibilité du document, pilotable comme un onglet qu'on quitte. */
let visibilite = 'visible'

describe('useMessengerStream — la reconnexion', () => {
  let montes: { unmount: () => void }[] = []

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    FauxEventSource.instances = []
    visibilite = 'visible'
    montes = []
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilite as never)
  })

  afterEach(() => {
    // Démonter retire l'écouteur de visibilité et ferme le flux : sans cela, le composable d'un cas
    // précédent continuerait de réagir et compterait des connexions pour le suivant.
    while (montes.length) montes.pop()?.unmount()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /**
   * Un flux ouvert sur une conversation, comme après l'ouverture de l'écran.
   *
   * ⚠️ LE COMPOSABLE EST INSTANCIÉ DANS UN COMPOSANT MONTÉ, et c'est obligatoire : il appelle
   * `useNotificationStream`, qui appelle `useI18n` — lequel exige d'être appelé au sommet d'un
   * `setup`. Hors composant, les huit cas échouaient sur un `SyntaxError 26` de vue-i18n, à mille
   * lieues de ce qu'ils mesurent.
   */
  const ouvrir = async () => {
    const conversation = ref<string | null>(null)
    let flux!: ReturnType<typeof useMessengerStream>
    const composant = await mountSuspended(
      defineComponent({
        setup() {
          flux = useMessengerStream(conversation)
          return () => h('div')
        },
      })
    )
    montes.push(composant)

    // C'est le CHANGEMENT de conversation qui connecte : le `watch` n'est pas `immediate`.
    conversation.value = 'conv-1'
    await vi.waitFor(() => expect(FauxEventSource.instances).toHaveLength(1))
    FauxEventSource.instances[0]!.ouvrir()
    expect(flux.isConnected.value).toBe(true)
    return { flux, conversation }
  }

  /** La dernière connexion tentée. */
  const derniere = () => FauxEventSource.instances[FauxEventSource.instances.length - 1]!

  it('⚠️ RÉESSAIE AU-DELÀ DE TROIS FOIS', async () => {
    /*
     * LE CŒUR DU CONSTAT. Quatre chutes de suite : avec l'ancienne limite, la quatrième tentative
     * n'existait pas et la personne restait invisible pour le reste de la session.
     */
    const { flux } = await ouvrir()

    for (let i = 0; i < 4; i += 1) {
      derniere().tomber()
      await vi.advanceTimersByTimeAsync(60000)
    }

    // Une connexion d'origine + quatre tentatives.
    expect(FauxEventSource.instances.length).toBeGreaterThanOrEqual(5)
    expect(flux.isConnected.value).toBe(false)
  })

  it('plafonne l’attente à trente secondes', async () => {
    /*
     * LE TÉMOIN de la tentative illimitée. Sans plafond, le doublement porterait l'attente à des
     * minutes puis à des heures : une reconnexion « illimitée » qui n'arrive jamais ne vaut pas
     * mieux qu'un abandon, et serait plus difficile à diagnostiquer.
     */
    const { flux } = await ouvrir()

    for (let i = 0; i < 8; i += 1) {
      derniere().tomber()
      await vi.advanceTimersByTimeAsync(30000)
    }
    const avant = FauxEventSource.instances.length
    derniere().tomber()
    await vi.advanceTimersByTimeAsync(30000)

    expect(FauxEventSource.instances.length).toBeGreaterThan(avant)
    expect(flux.isConnected.value).toBe(false)
  })

  it('ne réessaie pas tant que l’onglet est au second plan', async () => {
    // Le navigateur ralentit les minuteurs d'un onglet caché : réessayer y consomme des connexions
    // sans en établir. C'est `visibilitychange` qui reprend la main, cas suivant.
    await ouvrir()
    visibilite = 'hidden'

    derniere().tomber()
    await vi.advanceTimersByTimeAsync(60000)

    expect(FauxEventSource.instances).toHaveLength(1)
  })

  it('⚠️ SE RÉTABLIT AU RETOUR DE L’ONGLET AU PREMIER PLAN', async () => {
    // Le cas le plus courant en vrai : on quitte l'onglet, le flux tombe, on revient. Sans cette
    // reprise, il fallait recharger la page pour réapparaître dans la liste des présents.
    await ouvrir()
    visibilite = 'hidden'
    derniere().tomber()
    await vi.advanceTimersByTimeAsync(60000)
    expect(FauxEventSource.instances).toHaveLength(1)

    visibilite = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(FauxEventSource.instances).toHaveLength(2)
  })

  describe('le rattrapage des messages manqués', () => {
    it('⚠️ EST ANNONCÉ À L’ÉCRAN APRÈS UNE PERTE', async () => {
      /*
       * Les messages n'arrivent plus par ce flux : le flux global les pousse, et seulement aux
       * écoutants du moment. Pendant la coupure, personne n'écoute pour cette conversation, et rien
       * ensuite ne va chercher ce qui a été écrit. Ce compteur est ce qui dit à l'écran d'aller le
       * chercher.
       */
      const { flux } = await ouvrir()
      expect(flux.reconnexionsApresPerte.value).toBe(0)

      derniere().tomber()
      await vi.advanceTimersByTimeAsync(5000)
      derniere().ouvrir()

      expect(flux.reconnexionsApresPerte.value).toBe(1)
    })

    it('n’est PAS annoncé à la première ouverture', async () => {
      /*
       * LE TÉMOIN. Une première connexion n'a rien manqué : les messages viennent d'être chargés en
       * entier. Un compteur qui s'incrémenterait là ferait recharger l'écran à chaque ouverture de
       * conversation, pour rien.
       */
      const { flux } = await ouvrir()

      expect(flux.reconnexionsApresPerte.value).toBe(0)
    })

    it('n’est pas annoncé quand on change de conversation', async () => {
      /*
       * Second témoin. Changer de conversation ferme le flux volontairement puis en ouvre un autre.
       * Ce n'est pas une perte, et la conversation suivante vient d'être chargée en entier : un
       * rattrapage y serait une requête de plus pour exactement les mêmes messages.
       */
      const { flux, conversation } = await ouvrir()

      conversation.value = 'conv-2'
      await vi.waitFor(() => expect(FauxEventSource.instances).toHaveLength(2))
      derniere().ouvrir()

      expect(flux.reconnexionsApresPerte.value).toBe(0)
    })

    it('compte CHAQUE perte, et non la première seulement', async () => {
      // Un drapeau déjà levé ne se remarquerait pas : la deuxième coupure ne déclencherait aucun
      // rattrapage, et le fil resterait figé sur les messages d'avant.
      const { flux } = await ouvrir()

      for (let i = 0; i < 2; i += 1) {
        derniere().tomber()
        await vi.advanceTimersByTimeAsync(5000)
        derniere().ouvrir()
      }

      expect(flux.reconnexionsApresPerte.value).toBe(2)
    })
  })
})
