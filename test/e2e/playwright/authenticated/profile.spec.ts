import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Profil (connecté)', () => {
  test('la page profil est accessible', async ({ page, goto }) => {
    await goto('/profile', { waitUntil: 'hydration' })

    // On ne doit PAS être redirigé vers /login
    expect(page.url()).not.toContain('/login')

    // La page doit afficher le nom de l'utilisateur ou le formulaire de profil
    await expect(page.locator('h1')).toBeVisible()
  })

  test('la page favoris est accessible', async ({ page, goto }) => {
    await goto('/favorites', { waitUntil: 'hydration' })

    expect(page.url()).not.toContain('/login')
    await expect(page.getByText(/favoris/i).first()).toBeVisible()
  })

  test('la page mes conventions est accessible', async ({ page, goto }) => {
    await goto('/my-conventions', { waitUntil: 'hydration' })

    expect(page.url()).not.toContain('/login')
  })
})
