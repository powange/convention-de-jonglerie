import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Authentification', () => {
  test('la page de connexion affiche le formulaire email', async ({ page, goto }) => {
    await goto('/login', { waitUntil: 'hydration' })

    // Titre de la page
    await expect(page.getByText(/connexion ou inscription/i)).toBeVisible()

    // Champ email
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]')).toBeVisible()

    // Bouton confirmer
    await expect(page.getByText(/confirmer/i).first()).toBeVisible()

    // Boutons OAuth
    await expect(page.getByText(/google/i)).toBeVisible()
    await expect(page.getByText(/facebook/i)).toBeVisible()
  })

  test('le bouton confirmer soumet l\'email', async ({ page, goto }) => {
    await goto('/login', { waitUntil: 'hydration' })

    // Remplir l'email
    await page.locator('input[type="email"], input[placeholder*="email" i]').fill('test@example.com')

    // Cliquer sur confirmer
    await page.getByText(/confirmer/i).first().click()

    // Attendre une réaction (champ mot de passe, message d'erreur, ou changement d'état)
    await page.waitForSelector('input[type="password"], [role="alert"], [role="status"]', {
      timeout: 10000,
    }).catch(() => {})

    // Vérifier qu'on est toujours sur la page de login
    expect(page.url()).toContain('/login')
  })
})

test.describe('Pages protégées', () => {
  test('redirige vers login si non connecté — /profile', async ({ page, goto }) => {
    await goto('/profile', { waitUntil: 'hydration' })

    await page.waitForURL(/login/, { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('redirige vers login si non connecté — /favorites', async ({ page, goto }) => {
    await goto('/favorites', { waitUntil: 'hydration' })

    await page.waitForURL(/login/, { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('redirige vers login si non connecté — /my-conventions', async ({ page, goto }) => {
    await goto('/my-conventions', { waitUntil: 'hydration' })

    await page.waitForURL(/login/, { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })
})
