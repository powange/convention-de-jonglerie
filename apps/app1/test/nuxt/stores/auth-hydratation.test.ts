import { registerEndpoint, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import authProtected from '../../../app/middleware/auth-protected'
import { useAuthStore } from '../../../app/stores/auth'

/**
 * Savoir qui consulte la page ne doit coûter qu'une requête, et un silence du réseau ne vaut
 * pas déconnexion.
 *
 * Deux défauts se tenaient là, et se corrigent ensemble.
 *
 * 1. Le greffon `auth.client` lance `initializeAuth()` sans l'attendre, et le middleware
 *    `auth-protected` s'exécutait dans la foulée en ouvrant un SECOND appel à
 *    `/api/session/me`. Mesuré au navigateur sur `/profile` avant le correctif : deux appels
 *    quand le stockage ne contient pas d'`authUser` — soit pour un visiteur anonyme, soit pour
 *    toute personne n'ayant pas coché « se souvenir de moi », dont la copie vit dans le
 *    `sessionStorage` et disparaît avec l'onglet. Chaque appel coûte deux requêtes en base.
 *
 * 2. Le `catch` de l'hydratation vidait l'utilisateur sans regarder la cause : une coupure
 *    réseau déconnectait donc visuellement quelqu'un dont le cookie était intact. Et à
 *    l'inverse, la copie locale relue par le middleware tenait lieu de réponse, si bien qu'un
 *    `authUser` périmé suffisait à ouvrir une page protégée sur une session morte.
 *
 * On compte les interrogations réelles de l'endpoint plutôt que les appels à `$fetch` : celui-ci
 * est auto-importé et ne se remplace pas de façon fiable.
 */
const UTILISATEUR = {
  id: 1,
  email: 'jongleuse@example.com',
  pseudo: 'jongleuse',
  nom: null,
  prenom: null,
  isGlobalAdmin: false,
}

/**
 * Ce que le serveur répondra, et combien d'appels il a reçus.
 *
 * `pannesRestantes` sert à simuler un réseau qui revient : les premiers essais échouent, les
 * suivants aboutissent. Le compte est fiable parce que l'hydratation passe `retry: 0` —
 * `ofetch` rejouait sinon un 502 de lui-même, et doublait chaque nombre.
 */
const serveur = { appels: 0, reponse: 'ok' as 'ok' | '401' | 'panne', pannesRestantes: 0 }

registerEndpoint('/api/session/me', () => {
  serveur.appels++
  if (serveur.reponse === '401') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (serveur.reponse === 'panne' || serveur.pannesRestantes > 0) {
    // Tient lieu de silence du réseau : le serveur n'a rien dit de la session. `$fetch` lève
    // dans les deux cas, et c'est justement ce que le correctif distingue d'un 401.
    serveur.pannesRestantes--
    throw createError({ statusCode: 502, message: 'Bad Gateway' })
  }
  return { user: UTILISATEUR, impersonation: null }
})

// La redirection est observée plutôt que jouée : laisser le routeur naviguer pour de vrai
// ferait déborder une navigation asynchrone sur le test suivant, dont elle fausserait le
// compte d'appels.
const { redirection } = vi.hoisted(() => ({ redirection: vi.fn() }))
mockNuxtImport('navigateTo', () => redirection)

/** Le middleware, appelé hors navigation réelle : `to` suffit. */
const passerLeMiddleware = () =>
  authProtected({ fullPath: '/profile' } as never, { fullPath: '/' } as never)

describe('Hydratation de la session', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    serveur.appels = 0
    serveur.reponse = 'ok'
    serveur.pannesRestantes = 0
    redirection.mockClear()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('une seule requête', () => {
    it('ne lance qu’une requête quand deux hydratations se croisent', async () => {
      const store = useAuthStore()

      const premiere = store.initializeAuth()
      const seconde = store.initializeAuth()
      await Promise.all([premiere, seconde])

      expect(serveur.appels).toBe(1)
      expect(store.user?.id).toBe(1)
    })

    it('repart du serveur une fois la requête retombée', async () => {
      const store = useAuthStore()

      await store.initializeAuth()
      await store.initializeAuth()

      // Le partage ne vaut que pour une requête EN COURS : une ré-hydratation demandée plus tard
      // — après une invitation acceptée, par exemple — doit bien réinterroger le serveur.
      expect(serveur.appels).toBe(2)
    })

    it('le middleware attend l’hydratation en cours au lieu d’en ouvrir une seconde', async () => {
      const store = useAuthStore()

      // Ce que fait le greffon `auth.client` : lancer sans attendre.
      void store.initializeAuth()

      await passerLeMiddleware()

      expect(serveur.appels).toBe(1)
      expect(store.user?.id).toBe(1)
    })

    it('le middleware hydrate la session quand le greffon n’a pas encore tourné', async () => {
      const store = useAuthStore()

      await passerLeMiddleware()

      expect(serveur.appels).toBe(1)
      expect(store.user?.id).toBe(1)
    })

    it('ne redemande plus rien une fois le serveur entendu', async () => {
      const store = useAuthStore()

      await passerLeMiddleware()
      await passerLeMiddleware()

      expect(serveur.appels).toBe(1)
    })
  })

  describe('un 401 est une déconnexion', () => {
    it('vide l’utilisateur et purge la copie locale', async () => {
      serveur.reponse = '401'
      localStorage.setItem('authUser', JSON.stringify(UTILISATEUR))
      const store = useAuthStore()

      await store.initializeAuth()

      expect(store.user).toBeNull()
      expect(store.sessionVerifiee).toBe(true)
      // Sans cette purge, le middleware relirait la copie au passage suivant et rouvrirait une
      // page protégée sur une session morte.
      expect(localStorage.getItem('authUser')).toBeNull()
      expect(sessionStorage.getItem('authUser')).toBeNull()
    })

    it('renvoie vers la connexion malgré une copie locale périmée', async () => {
      serveur.reponse = '401'
      localStorage.setItem('authUser', JSON.stringify(UTILISATEUR))
      const store = useAuthStore()

      await passerLeMiddleware()

      expect(store.user).toBeNull()
      expect(redirection).toHaveBeenCalledWith(expect.stringContaining('/login'))
    })
  })

  describe('un silence du réseau n’en est pas une', () => {
    it('conserve l’utilisateur quand le serveur ne dit rien de la session', async () => {
      const store = useAuthStore()
      store.user = { ...UTILISATEUR } as unknown as NonNullable<typeof store.user>
      serveur.reponse = 'panne'

      await store.initializeAuth()

      expect(store.user?.id).toBe(1)
      // L'état reste en suspens : c'est ce qui autorise le greffon à rejouer la requête au
      // retour du réseau.
      expect(store.sessionVerifiee).toBe(false)
    })

    it('laisse passer le middleware sur la copie locale', async () => {
      serveur.reponse = 'panne'
      localStorage.setItem('authUser', JSON.stringify(UTILISATEUR))
      const store = useAuthStore()

      await passerLeMiddleware()

      expect(redirection).not.toHaveBeenCalled()
      expect(store.user?.id).toBe(1)
    })

    it('retente une fois quand il n’y a ni réponse ni copie locale', async () => {
      serveur.reponse = 'panne'
      const store = useAuthStore()

      await passerLeMiddleware()

      // Ne pas renoncer au premier échec — mais ne pas boucler non plus : une seule seconde
      // chance, puis la connexion, faute de quoi que ce soit à afficher.
      expect(serveur.appels).toBe(2)
      expect(store.user).toBeNull()
      expect(redirection).toHaveBeenCalledWith(expect.stringContaining('/login'))
    })

    it('la seconde chance rattrape un démarrage à froid', async () => {
      // Le premier essai tombe avant que le réseau soit là, le second aboutit : c'est le
      // scénario d'une webapp installée qui s'ouvre pendant que le système rétablit le Wi-Fi.
      // Sans cette reprise, la personne voyait l'écran de connexion alors que son cookie était
      // parfaitement valide.
      serveur.pannesRestantes = 1
      const store = useAuthStore()

      await passerLeMiddleware()

      expect(serveur.appels).toBe(2)
      expect(store.user?.id).toBe(1)
      expect(redirection).not.toHaveBeenCalled()
    })
  })
})
