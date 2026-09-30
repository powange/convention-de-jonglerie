import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
 * `navigateTo` et `useUserSession` sont des auto-imports : les poser sur `globalThis` ne les
 * intercepte pas. `mockNuxtImport` est le mécanisme prévu.
 */
const navigateTo = vi.hoisted(() => vi.fn((cible: string) => cible))
mockNuxtImport('navigateTo', () => navigateTo)

const session = vi.hoisted(() => ({
  loggedIn: { value: true },
  user: { value: { id: 1 } as any },
  fetch: vi.fn(async () => {}),
}))
mockNuxtImport('useUserSession', () => () => session)

import middleware from '../../../../../layers/auth/app/middleware/guest-only'

/**
 * La page de connexion renvoie ailleurs quelqu'un de déjà connecté — mais OÙ ?
 *
 * ⚠️ CE QUI N'ALLAIT PAS. Elle renvoyait TOUJOURS vers l'accueil, en perdant la destination. Le cas
 * se produisait quand un autre middleware avait envoyé ici alors que la session était en fait
 * valide : au rechargement de `/admin/feedback`, le store n'était pas encore hydraté, on arrivait
 * sur `/login?returnTo=/admin/feedback`, la session était trouvée bonne… et l'on repartait vers
 * l'accueil. L'administrateur perdait la page qu'il demandait, sans le moindre message.
 *
 * La cause de ce renvoi est corrigée par ailleurs — `super-admin` attend désormais la session —,
 * mais le rattrapage vaut pour tous les autres chemins qui mènent ici avec une destination.
 *
 * ⚠️ DEUX GARDES SUR LA DESTINATION, et elles ne sont pas décoratives : une adresse forgée ne doit
 * ni renvoyer hors du site, ni ramener sur une page d'authentification — ce qui ferait tourner en
 * rond.
 */

const versPage = (returnTo?: string) =>
  ({ query: returnTo === undefined ? {} : { returnTo } }) as any

describe('middleware guest-only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.loggedIn.value = true
    session.user.value = { id: 1 }
  })

  it('renvoie vers la DESTINATION quand il y en a une', async () => {
    // 🔬 L'assertion qui porte le lot : sans elle, on repart vers l'accueil et la page est perdue.
    await middleware(versPage('/admin/feedback'), versPage())

    expect(navigateTo).toHaveBeenCalledWith('/admin/feedback')
  })

  it('renvoie vers l’accueil quand il n’y en a pas', async () => {
    await middleware(versPage(), versPage())

    expect(navigateTo).toHaveBeenCalledWith('/')
  })

  it('ne peut pas renvoyer HORS DU SITE, même sur une adresse forgée', async () => {
    /*
     * ⚠️ `//exemple.test/piege` est une adresse RELATIVE AU PROTOCOLE : elle commence bien par
     * « / », et un contrôle qui s'arrêterait à ce caractère enverrait le visiteur sur un autre
     * domaine. C'est la forme classique d'une redirection ouverte.
     *
     * 📍 CE TEST A CORRIGÉ MON ATTENTE, PAS LE CODE. J'attendais un repli sur l'accueil ; ce qui
     * se produit est mieux : `cleanReturnTo` passe la valeur par `new URL(…, 'http://localhost')`
     * et n'en garde que `pathname + search`. Le domaine est donc RETIRÉ, et il ne reste qu'un
     * chemin local. La protection existait déjà, un cran plus bas que là où je la cherchais.
     */
    await middleware(versPage('//exemple.test/piege'), versPage())

    const cible = navigateTo.mock.calls[0][0] as string
    expect(cible.startsWith('/')).toBe(true)
    expect(cible.startsWith('//')).toBe(false)
    expect(cible).not.toContain('exemple.test')
  })

  it('ne peut pas renvoyer vers une adresse ABSOLUE', async () => {
    // Même mécanisme : seul le chemin survit, le protocole et le domaine sont perdus.
    await middleware(versPage('https://exemple.test/piege'), versPage())

    const cible = navigateTo.mock.calls[0][0] as string
    expect(cible).not.toContain('exemple.test')
    expect(cible).not.toContain('https:')
  })

  it('REFUSE de renvoyer vers une page d’authentification', async () => {
    // Sinon on tourne en rond : connecté → /login → connecté → /login.
    await middleware(versPage('/login'), versPage())

    expect(navigateTo).toHaveBeenCalledWith('/')
  })

  it('ne renvoie NULLE PART quelqu’un qui n’est pas connecté', async () => {
    // Le cas normal de la page de connexion : elle doit s'afficher.
    session.loggedIn.value = false
    session.user.value = null

    await middleware(versPage('/admin/feedback'), versPage())

    expect(navigateTo).not.toHaveBeenCalled()
  })
})
