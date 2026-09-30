import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
 * ⚠️ `navigateTo` EST UN AUTO-IMPORT DE NUXT : le poser sur `globalThis` ne l'intercepte pas — le
 * middleware continue d'appeler celui de Nuxt, et la première version de ce test attendait un
 * appel qui n'arrivait jamais. `mockNuxtImport` est le mécanisme prévu pour ça.
 */
const navigateTo = vi.hoisted(() => vi.fn((cible: string) => cible))
mockNuxtImport('navigateTo', () => navigateTo)
const store = vi.hoisted(() => ({
  isAuthenticated: false,
  sessionVerifiee: false,
  user: null as any,
  initializeAuth: vi.fn(),
}))

vi.mock('~/stores/auth', () => ({ useAuthStore: () => store }))

import middleware from '../../../app/middleware/super-admin'

/**
 * La garde des pages d'administration.
 *
 * ⚠️ CE FICHIER TESTAIT SA PROPRE COPIE DU MIDDLEWARE. Les quatre tests d'origine recomposaient la
 * logique en variables locales (`const shouldRedirect = !authStore.isAuthenticated`) et
 * assertionnaient dessus : le middleware n'était JAMAIS importé. Le supprimer entièrement les
 * aurait laissés verts. Ils annonçaient une couverture qui n'existait pas.
 *
 * ⚠️ LE DÉFAUT QU'ILS AURAIENT DÛ ATTRAPER : ce middleware lisait `isAuthenticated` de façon
 * SYNCHRONE. Au rechargement d'une page en `ssr: false`, le greffon `auth.client` a lancé la
 * requête de session sans l'attendre — le store est donc encore vide, et l'on renvoyait vers
 * `/login`, où la session était trouvée valide et où l'on repartait vers l'accueil. Un
 * administrateur connecté qui rechargeait `/admin/feedback` atterrissait sur l'accueil, sans
 * message.
 */

/** Un événement de route minimal, tel que Nuxt le passe. */
const route = { fullPath: '/admin/feedback' } as any

describe('middleware super-admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.isAuthenticated = false
    store.sessionVerifiee = false
    store.user = null
    store.initializeAuth = vi.fn(async () => {
      // Le serveur répond : la session est valide et l'utilisateur est administrateur.
      store.sessionVerifiee = true
      store.isAuthenticated = true
      store.user = { id: 1, isGlobalAdmin: true }
    })
    ;(globalThis as any).createError = (e: any) => Object.assign(new Error(e.message), e)
  })

  it('ATTEND la session avant de décider', async () => {
    /*
     * 🔬 LE TEST QUI PORTE LE LOT. Le store part vide — l'état exact d'un rechargement — et la
     * session n'est confirmée que par `initializeAuth`. Sans cette attente, le middleware
     * renverrait vers la connexion un administrateur parfaitement connecté.
     */
    await middleware(route, route)

    expect(store.initializeAuth).toHaveBeenCalledTimes(1)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('ne redemande PAS la session quand elle est déjà vérifiée', async () => {
    // `auth-protected` passe avant sur les quatorze autres pages : l'attente ne doit rien coûter.
    store.sessionVerifiee = true
    store.isAuthenticated = true
    store.user = { id: 1, isGlobalAdmin: true }

    await middleware(route, route)

    expect(store.initializeAuth).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('renvoie vers la connexion AVEC la destination quand il n’y a pas de session', async () => {
    store.initializeAuth = vi.fn(async () => {
      store.sessionVerifiee = true
      store.isAuthenticated = false
      store.user = null
    })

    await middleware(route, route)

    /*
     * 📍 C'est le VRAI `useReturnTo` qui répond ici, et non le doublon posé en global : Nuxt le
     * résout par auto-import. Tant mieux — l'assertion porte donc sur le comportement réel, y
     * compris l'encodage du chemin.
     *
     * La destination voyage : sans elle, on se reconnecte et on retombe sur l'accueil, à charge
     * de refaire son chemin.
     */
    expect(navigateTo).toHaveBeenCalledTimes(1)
    const cible = navigateTo.mock.calls[0][0] as string
    expect(cible.startsWith('/login?returnTo=')).toBe(true)
    expect(decodeURIComponent(cible)).toContain('/admin/feedback')
  })

  it('REFUSE un compte connecté qui n’est pas super-administrateur', async () => {
    store.initializeAuth = vi.fn(async () => {
      store.sessionVerifiee = true
      store.isAuthenticated = true
      store.user = { id: 2, isGlobalAdmin: false }
    })

    await expect(middleware(route, route)).rejects.toMatchObject({ status: 403 })
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('REFUSE un utilisateur sans la propriété `isGlobalAdmin`', async () => {
    // Une forme inattendue ne doit pas ouvrir la porte : l'absence vaut « non ».
    store.initializeAuth = vi.fn(async () => {
      store.sessionVerifiee = true
      store.isAuthenticated = true
      store.user = { id: 3 }
    })

    await expect(middleware(route, route)).rejects.toMatchObject({ status: 403 })
  })
})
