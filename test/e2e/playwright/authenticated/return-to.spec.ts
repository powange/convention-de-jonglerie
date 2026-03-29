import { expect, test } from '@nuxt/test-utils/playwright'

import { loadCredentials, loginWith } from '../helpers'

test.describe('Redirection returnTo après login', () => {
  // Contexte vierge pour simuler un utilisateur déconnecté
  test.use({ storageState: { cookies: [], origins: [] } })

  test('redirige vers /profile après login si returnTo=/profile', async ({ page, goto }) => {
    const { email, password } = loadCredentials()

    await goto('/login?returnTo=%2Fprofile', { waitUntil: 'hydration' })

    await loginWith(page, email, password)

    await page.waitForURL(/\/profile/, { timeout: 10000 })
    expect(page.url()).toContain('/profile')
  })

  test('redirige vers /favorites après login si returnTo=/favorites', async ({ page, goto }) => {
    const { email, password } = loadCredentials()

    await goto('/login?returnTo=%2Ffavorites', { waitUntil: 'hydration' })

    await loginWith(page, email, password)

    await page.waitForURL(/\/favorites/, { timeout: 10000 })
    expect(page.url()).toContain('/favorites')
  })

  test('redirige vers / si aucun returnTo', async ({ page, goto }) => {
    const { email, password } = loadCredentials()

    await goto('/login', { waitUntil: 'hydration' })

    await loginWith(page, email, password)

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
    // Doit rediriger vers l'accueil
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test("ignore returnTo vers une page d'auth (/login) — pas de boucle", async ({ page, goto }) => {
    // Vérifier que le formulaire de login s'affiche normalement malgré returnTo=/login
    // (pas de boucle de redirection)
    await goto('/login?returnTo=%2Flogin', { waitUntil: 'hydration' })

    // La page de login doit s'afficher sans boucle
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test("préserve le returnTo lors d'une redirection depuis une page protégée", async ({
    page,
    goto,
  }) => {
    const { email, password } = loadCredentials()

    // Accéder directement à une page protégée sans être connecté
    await goto('/profile/mes-conventions', { waitUntil: 'hydration' })

    // Le middleware doit rediriger vers /login?returnTo=/profile/mes-conventions
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toContain('returnTo')
    expect(page.url()).toContain('mes-conventions')

    // Se connecter
    await loginWith(page, email, password)

    // Doit rediriger vers la page demandée initialement
    await page.waitForURL(/\/profile\/mes-conventions/, { timeout: 10000 })
    expect(page.url()).toContain('/profile/mes-conventions')
  })

  test('préserve le returnTo depuis /notifications (page protégée)', async ({ page, goto }) => {
    const { email, password } = loadCredentials()

    // Accéder à /notifications sans être connecté
    await goto('/notifications', { waitUntil: 'hydration' })

    // Redirection vers /login avec returnTo
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toContain('returnTo')
    expect(page.url()).toContain('notifications')

    // Se connecter
    await loginWith(page, email, password)

    // Doit revenir sur /notifications
    await page.waitForURL(/\/notifications/, { timeout: 10000 })
    expect(page.url()).toContain('/notifications')
  })
})
